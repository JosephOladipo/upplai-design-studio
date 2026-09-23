const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

// Tiny .env loader so this project keeps zero runtime dependencies beyond Express.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}


const { readConfig, qualityMap } = require('./src/ai-config.cjs');
const { randomUUID } = require('node:crypto');
const config = readConfig();
const app = express();
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const port = process.env.PORT || 3000;
let aiBusy = false;
const plans = new Map(); // Short-lived local plans; never persistent content storage.
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'Upplai Design Studio', bufferConfigured: Boolean(process.env.BUFFER_API_KEY), cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) }));
app.post('/api/publishing/posts', async (req,res) => { const body=req.body||{}; const validMode=['shareNow','customScheduled'].includes(body.mode); if(!process.env.BUFFER_API_KEY)return failure(res,503,'NOT_CONFIGURED','Buffer is not configured on this server.'); if(!validMode||!Array.isArray(body.channelIds)||!body.channelIds.length||typeof body.text!=='string'||!body.text.trim())return failure(res,400,'INVALID_INPUT','Add content and select at least one channel.'); if(body.mode==='customScheduled'&&(!body.dueAt||Number.isNaN(Date.parse(body.dueAt))||Date.parse(body.dueAt)<=Date.now()))return failure(res,400,'INVALID_SCHEDULE','Choose a future schedule time.'); try { const { publishPosts }=await import('./src/buffer-publish.mjs'); const results=await publishPosts({apiKey:process.env.BUFFER_API_KEY,text:body.text.trim(),channelIds:body.channelIds,mode:body.mode,dueAt:body.mode==='customScheduled'?body.dueAt:undefined,media:body.media});res.json({published:results.some(x=>x.success),results}); } catch { failure(res,502,'BUFFER_FAILED','Buffer publishing failed.'); }});app.get('/api/buffer/posts', async (req, res) => { const status = req.query.status; if (!['scheduled','sent'].includes(status)) return failure(res,400,'INVALID_INPUT','Choose scheduled or sent posts.'); try { const { getBufferOrganizations } = await import('./src/buffer.mjs'); const { listBufferPosts } = await import('./src/buffer-posts.mjs'); const organizations = await getBufferOrganizations({ apiKey: process.env.BUFFER_API_KEY }); const posts = await listBufferPosts({ apiKey: process.env.BUFFER_API_KEY, status, organizationIds: organizations.map(item => item.id) }); res.json({ posts }); } catch (error) { failure(res,error?.code === 'NOT_CONFIGURED' ? 503 : error?.code === 'AUTH' ? 401 : 502,error?.code || 'BUFFER_FAILED',error?.message || 'Buffer posts are unavailable.'); } });
app.post('/api/buffer/posts/:id/reschedule', async (req,res) => { const dueAt=req.body?.dueAt; if(!dueAt || Number.isNaN(Date.parse(dueAt)) || Date.parse(dueAt)<=Date.now()) return failure(res,400,'INVALID_SCHEDULE','Choose a future schedule time.'); try { const { getBufferOrganizations }=await import('./src/buffer.mjs'); const { listBufferPosts, rescheduleBufferPost }=await import('./src/buffer-posts.mjs'); const organizations=await getBufferOrganizations({apiKey:process.env.BUFFER_API_KEY}); const scheduled=await listBufferPosts({apiKey:process.env.BUFFER_API_KEY,status:'scheduled',organizationIds:organizations.map(item=>item.id)}); if(!scheduled.some(post=>post.id===req.params.id)) return failure(res,404,'NOT_FOUND','This scheduled post is no longer available.'); await rescheduleBufferPost({apiKey:process.env.BUFFER_API_KEY,id:req.params.id,dueAt}); res.json({updated:true}); } catch(error) { failure(res,error?.code==='NOT_CONFIGURED'?503:error?.code==='AUTH'?401:502,error?.code||'BUFFER_FAILED',error?.message||'Buffer could not reschedule this post.'); } });
app.delete('/api/buffer/posts/:id', async (req,res) => { try { const { getBufferOrganizations }=await import('./src/buffer.mjs'); const { listBufferPosts, deleteBufferPost }=await import('./src/buffer-posts.mjs'); const organizations=await getBufferOrganizations({apiKey:process.env.BUFFER_API_KEY}); const scheduled=await listBufferPosts({apiKey:process.env.BUFFER_API_KEY,status:'scheduled',organizationIds:organizations.map(item=>item.id)}); if(!scheduled.some(post=>post.id===req.params.id)) return failure(res,404,'NOT_FOUND','This scheduled post is no longer available.'); await deleteBufferPost({apiKey:process.env.BUFFER_API_KEY,id:req.params.id}); res.json({deleted:true}); } catch(error) { failure(res,error?.code==='NOT_CONFIGURED'?503:error?.code==='AUTH'?401:502,error?.code||'BUFFER_FAILED',error?.message||'Buffer could not cancel this post.'); } });app.get('/api/buffer/channels', async (_req, res) => { try { const { getBufferChannels, BufferError } = await import('./src/buffer.mjs'); const channels = await getBufferChannels({ apiKey: process.env.BUFFER_API_KEY }); res.json({ connected: true, channels }); } catch (error) { const status = error?.code === 'NOT_CONFIGURED' ? 503 : error?.code === 'AUTH' ? 401 : 502; failure(res, status, error?.code || 'BUFFER_FAILED', error?.message || 'Buffer connection failed.'); } });
function mediaFailure(error, file) {
  const status = Number(error?.http_code || error?.status || error?.response?.status || 0);
  const headers = error?.response?.headers || error?.headers || {};
  const upstream = error?.error?.message || error?.response?.body?.error?.message || error?.response?.data?.error?.message || headers['x-cld-error'] || headers['X-Cld-Error'] || error?.message || 'Upload failed.';
  const message = String(upstream).replace(/[\r\n]+/g, ' ').slice(0, 180);
  const lowered = message.toLowerCase();
  const code = error?.code === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : error?.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : status === 401 || /api key|signature|authorization|authentication/i.test(lowered) ? 'AUTH' : status === 403 && /permission|not allowed|denied|restricted|disabled/i.test(lowered) ? 'PERMISSION' : status === 403 ? 'ACCOUNT_RESTRICTED' : /invalid|parameter|format|resource type/i.test(lowered) ? 'INVALID_PARAMETER' : /network|fetch|socket|timeout/i.test(lowered) ? 'NETWORK' : 'UPLOAD_FAILED';
  console.error('[Cloudinary Upload Error]', { category: code, status, message, errorName: error?.name || null, errorCode: error?.code || null, cloudinaryHeader: headers['x-cld-error'] || headers['X-Cld-Error'] || null, fileReceived: Boolean(file), mimeType: file?.mimetype || null, bytes: file?.size || 0, resourceType: file?.mimetype?.startsWith('video/') ? 'video' : file ? 'image' : null });
  const safeMessages = { NOT_CONFIGURED:'Cloudinary is not configured on this server.', FILE_TOO_LARGE:'Media file is too large.', AUTH:'Cloudinary authentication failed.', PERMISSION:'Cloudinary denied permission to upload media.', ACCOUNT_RESTRICTED:'Cloudinary rejected this upload. Check the safe server diagnostic for the account restriction reason.', INVALID_PARAMETER:'Cloudinary rejected the media upload parameters.', NETWORK:'Could not reach Cloudinary.', UPLOAD_FAILED:'Cloudinary upload failed.' };
  return { status: code === 'NOT_CONFIGURED' ? 503 : code === 'FILE_TOO_LARGE' ? 413 : code === 'AUTH' ? 401 : code === 'PERMISSION' || code === 'ACCOUNT_RESTRICTED' ? 403 : 502, code, message: safeMessages[code] };
}app.post('/api/media/upload', (req, res, next) => mediaUpload.single('media')(req, res, error => {
  if (error) { const safe = mediaFailure(error, req.file); return res.status(safe.status).json({ uploaded: false, error: { code: safe.code, message: safe.message } }); }
  next();
}), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ uploaded:false, error:{ code:'NO_FILE', message:'Choose one media file to upload.' } });
  if (!['image/png','image/jpeg','image/webp','video/mp4'].includes(file.mimetype)) return res.status(415).json({ uploaded:false, error:{ code:'UNSUPPORTED_TYPE', message:'Use PNG, JPG, WebP, or MP4 media.' } });
  try { const { uploadMedia } = await import('./src/cloudinary.mjs'); const media = await uploadMedia(file.buffer, file.mimetype); res.json({ uploaded:true, media }); }
  catch (error) { const safe = mediaFailure(error, file); res.status(safe.status).json({ uploaded:false, error:{ code:safe.code, message:safe.message } }); }
});app.get('/api/ai/status', (_req, res) => res.json({ configured: Boolean(config.apiKey), mockMode: config.mockMode,
  designModel: config.designModel, imageModel: config.imageModel,
  defaultQuality: Object.keys(qualityMap).find(k => qualityMap[k] === config.quality) || 'draft', error: config.error }));
function failure(res, status, code, message) { res.status(status).json({ error: { code, message } }); }
function checkRequest(req, res) {
  if (!req.is('application/json') || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)) {
    failure(res, 403, 'REQUEST_BLOCKED', 'Use the local application to generate designs.'); return false;
  }
  if (config.error) { failure(res, 503, 'CONFIGURATION', config.error); return false; }
  if (!config.mockMode && !config.apiKey) { failure(res, 503, 'NOT_CONFIGURED', 'Add OPENAI_API_KEY on the server, or use OPENAI_MOCK_MODE=true.'); return false; }
  if (aiBusy) { failure(res, 429, 'BUSY', 'A design request is already running. Please wait.'); return false; }
  return true;
}
function reportError(res, error) {
  // Never echo upstream errors: they can contain request content or credentials.
  const timeout = /timeout|timed out/i.test(error.name || '') || error.name === 'AbortError';
  failure(res, timeout ? 504 : 502, timeout ? 'TIMEOUT' : 'GENERATION_FAILED',
    timeout ? 'The generation request timed out. No automatic retry was made.' : 'Generation failed or returned invalid data. Check model access/configuration and try again explicitly.');
}
app.post('/api/ai/design-plan', async (req, res) => {
  if (!checkRequest(req, res)) return;
  aiBusy = true;
  try {
    const { visualStyles, subjectTypes, compositions } = await import('./src/ai-plan.mjs');
    const input = req.body || {};
    const subjectType = input.subjectType === undefined ? 'auto' : input.subjectType;
    for (const [key, max] of Object.entries({ headline: 180, supportingCopy: 700, cta: 70, customDirection: 600 })) {
      if (typeof input[key] !== 'string' || input[key].length > max) return failure(res, 400, 'INVALID_INPUT', 'Invalid or excessive ' + key + '.');
    }
    if (!input.headline.trim() || !visualStyles.includes(input.visualStyle) || !subjectTypes.includes(subjectType) || !['auto', ...compositions].includes(input.composition)) return failure(res, 400, 'INVALID_INPUT', 'Add a headline and choose valid design options.');
    const { normalizeBrandContext } = await import('./src/ai-brand.mjs');
    const brandContext = input.brandContext === undefined ? null : normalizeBrandContext(input.brandContext);
    if (input.brandContext !== undefined && !brandContext) return failure(res, 400, 'INVALID_INPUT', 'Invalid brand context.');
    const { createDesignPlan } = await import('./src/ai-design-director.mjs');
    const sanitized = Object.fromEntries(['headline','supportingCopy','cta','customDirection','visualStyle','composition'].map(k => [k,input[k]]));
    sanitized.subjectType = subjectType;
    if (brandContext) sanitized.brandContext = brandContext;
    const plan = await createDesignPlan({ config, input: sanitized });
    for (const [id, entry] of plans) if (entry.expires < Date.now()) plans.delete(id);
    if (plans.size >= 50) plans.delete(plans.keys().next().value);
    const planId = randomUUID();
    plans.set(planId, { plan, expires: Date.now() + 24 * 60 * 60 * 1000 });
    res.json({ plan, planId, mockMode: config.mockMode });
  } catch (error) { reportError(res, error); }
  finally { aiBusy = false; }
});
app.post('/api/ai/generate-visual', async (req, res) => {
  if (!checkRequest(req, res)) return;
  const entry = plans.get(req.body?.planId);
  if (!entry || entry.expires < Date.now()) return failure(res, 400, 'PLAN_EXPIRED', 'Generate a new design plan first. The previous plan has expired.');
  const quality = req.body.quality;
  if (!Object.hasOwn(qualityMap, quality)) return failure(res, 400, 'INVALID_QUALITY', 'Choose Draft, Standard or Premium.');
  aiBusy = true;
  try {
    const { generateVisual } = await import('./src/openai-image.mjs');
    const result = await generateVisual({ config, plan: entry.plan, quality });
    res.json({ ...result, mockMode: config.mockMode });
  } catch (error) { reportError(res, error); }
  finally { aiBusy = false; }
});
// Only browser modules are public; server-only modules stay private.
app.use('/src', (req, res, next) => {
  if (!/^\/[a-z-]+\.js$/.test(req.path) && req.path !== '/ai-plan.mjs') return res.sendStatus(404);
  next();
}, express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));
app.use((error, _req, res, _next) => failure(res, 400, 'INVALID_REQUEST', 'Invalid JSON request or request too large.'));
if (require.main === module) app.listen(port, '0.0.0.0', () => {
  console.log('Upplai Design Studio: http://localhost:' + port);
  console.log(config.mockMode ? 'Mock Mode — No API Usage' : 'OpenAI live mode: requests only after an explicit generation action.');
});
module.exports = app;


