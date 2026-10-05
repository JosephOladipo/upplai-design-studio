const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

// Tiny .env loader so this project keeps zero runtime dependencies beyond Express.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const trimmed = lines[lineNumber].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (key === 'BUFFER_CONNECTIONS_JSON' && value.startsWith('[')) {
      let depth = (value.match(/\[/g) || []).length - (value.match(/\]/g) || []).length;
      while (depth > 0 && lineNumber + 1 < lines.length) {
        lineNumber += 1;
        value += `\n${lines[lineNumber].trim()}`;
        depth += (lines[lineNumber].match(/\[/g) || []).length - (lines[lineNumber].match(/\]/g) || []).length;
      }
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}


const { readConfig, qualityMap } = require('./src/ai-config.cjs');
const { randomUUID } = require('node:crypto');
const config = readConfig();
const app = express();
const mediaTempDir = path.join(__dirname, '.media-tmp');
fs.mkdirSync(mediaTempDir, { recursive: true });
const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES || 10 * 1024 * 1024);
const MAX_VIDEO_UPLOAD_BYTES = Number(process.env.MAX_VIDEO_UPLOAD_BYTES || 500 * 1024 * 1024);
const aiImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const mediaUpload = multer({ storage: multer.diskStorage({ destination: mediaTempDir, filename: (_req, file, done) => done(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname || '')}`) }), limits: { fileSize: Math.max(MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES) } });
const port = process.env.PORT || 3000;
let aiBusy = false;
const plans = new Map(); // Short-lived local plans; never persistent content storage.
app.use(['/api/ai/generate-caption', '/api/ai/generate-alt-text'], express.json({ limit: '16mb' }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'Upplai Design Studio', bufferConfigured: Boolean(process.env.BUFFER_API_KEY || process.env.BUFFER_CONNECTIONS_JSON), cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET), mediaLimits: { imageBytes: MAX_IMAGE_UPLOAD_BYTES, videoBytes: MAX_VIDEO_UPLOAD_BYTES } }));
function safeDestinations(body) {
  const legacy = Array.isArray(body.channelIds) ? body.channelIds.map(channelId => ({ connectionId: 'legacy', channelId })) : [];
  const values = Array.isArray(body.destinations) ? body.destinations : legacy;
  return values.filter(item => item && typeof item.connectionId === 'string' && item.connectionId.length <= 80 && typeof item.channelId === 'string' && item.channelId.length <= 160);
}
function safeTikTokTitle(value) { return typeof value === 'string' ? value.slice(0, 1000) : ''; }
function safeChannelTexts(value) { return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([id,text]) => typeof id === 'string' && id.length < 250 && typeof text === 'string' && text.trim() && text.length <= 8000).map(([id,text]) => [id,text.trim()])) : {}; }
function safeAccessibility(value) { const text = item => typeof item === 'string' ? item.trim().slice(0, 2000) : ''; return value && typeof value === 'object' ? { altTextMode: value.altTextMode === 'platform' ? 'platform' : 'generic', genericAltText: text(value.genericAltText), platformAltText: Object.fromEntries(Object.entries(value.platformAltText || {}).filter(([key]) => typeof key === 'string' && key.length < 250).map(([key,item]) => [key,text(item)])), carouselSlideAltText: Array.isArray(value.carouselSlideAltText) ? value.carouselSlideAltText.slice(0, 10).map(text) : [] } : {}; }
async function connections() { const { getBufferConnections } = await import('./src/buffer-connections.mjs'); return getBufferConnections(); }
app.post('/api/publishing/posts', async (req,res) => {
  const body=req.body||{}; const validMode=['shareNow','customScheduled'].includes(body.mode); const destinations=safeDestinations(body); const channelTexts=safeChannelTexts(body.channelTexts); const accessibility=safeAccessibility(body.accessibility); const tiktokTitle=safeTikTokTitle(body.tiktokTitle); const safeUrl=value=>typeof value==='string'&&value.length<=2000&&/^https:\/\//i.test(value); const singleMedia=!body.media||safeUrl(body.media?.url); const carouselMedia=body.media?.type==='carousel'&&Array.isArray(body.media.items)&&body.media.items.length>=2&&body.media.items.length<=10&&body.media.items.every(item=>safeUrl(item?.url)&&item.resourceType==='image'); const requestedMediaByDestination=body.mediaByDestination&&typeof body.mediaByDestination==='object'?Object.entries(body.mediaByDestination):[]; const invalidDocument=requestedMediaByDestination.some(([,item])=>item?.resourceType==='document'&&(!safeUrl(item?.url)||item.mimeType!=='application/pdf'||typeof item.title!=='string'||!item.title.trim()||!safeUrl(item?.thumbnailUrl))); const mediaByDestination=Object.fromEntries(requestedMediaByDestination.filter(([key,item])=>key.length<250&&safeUrl(item?.url)&&item.resourceType==='document'&&item.mimeType==='application/pdf'&&typeof item.title==='string'&&item.title.trim()&&safeUrl(item?.thumbnailUrl)).map(([key,item])=>[key,{url:item.url,resourceType:'document',mimeType:'application/pdf',title:item.title.trim().slice(0,120),thumbnailUrl:item.thumbnailUrl}]));
  if(!validMode||!destinations.length||typeof body.text!=='string'||!body.text.trim()) return failure(res,400,'INVALID_INPUT','Add content and select at least one channel.');
  if(body.media&&!(singleMedia||carouselMedia)) return failure(res,400,'INVALID_MEDIA','Choose valid public media before publishing.');
  if(invalidDocument) return failure(res,400,'INVALID_LINKEDIN_DOCUMENT','LinkedIn document preparation requires a PDF, title, and first-slide thumbnail.');
  if(body.mode==='customScheduled'&&(!body.dueAt||Number.isNaN(Date.parse(body.dueAt))||Date.parse(body.dueAt)<=Date.now())) return failure(res,400,'INVALID_SCHEDULE','Choose a future schedule time.');
  try { const { publishAcrossConnections }=await import('./src/buffer-connections.mjs'); const results=await publishAcrossConnections({connections:await connections(),destinations,text:body.text.trim(),channelTexts,tiktokTitle,accessibility,mode:body.mode,dueAt:body.mode==='customScheduled'?body.dueAt:undefined,media:body.media,mediaByDestination}); res.json({published:results.some(x=>x.success),results}); }
  catch(error) { failure(res,error?.code==='NOT_CONFIGURED'||error?.code==='CONFIGURATION'?503:502,error?.code||'BUFFER_FAILED',error?.message||'Buffer publishing failed.'); }
});
app.get('/api/buffer/posts', async (req, res) => { const status=req.query.status; if(!['scheduled','sent'].includes(status)) return failure(res,400,'INVALID_INPUT','Choose scheduled or sent posts.'); try { const { aggregateBufferPosts }=await import('./src/buffer-connections.mjs'); const result=await aggregateBufferPosts({connections:await connections(),status}); res.json(result); } catch(error) { failure(res,error?.code==='NOT_CONFIGURED'||error?.code==='CONFIGURATION'?503:502,error?.code||'BUFFER_FAILED',error?.message||'Buffer posts are unavailable.'); } });
app.post('/api/buffer/posts/:id/reschedule', async (req,res) => { const dueAt=req.body?.dueAt; const connectionId=req.body?.connectionId; if(!dueAt||Number.isNaN(Date.parse(dueAt))||Date.parse(dueAt)<=Date.now()) return failure(res,400,'INVALID_SCHEDULE','Choose a future schedule time.'); try { const { findBufferConnection }=await import('./src/buffer-connections.mjs'); const { rescheduleBufferPost }=await import('./src/buffer-posts.mjs'); const connection=findBufferConnection(await connections(),connectionId||'legacy'); await rescheduleBufferPost({apiKey:connection.apiKey,id:req.params.id,dueAt}); res.json({updated:true}); } catch(error) { failure(res,error?.code==='NOT_FOUND'?404:502,error?.code||'BUFFER_FAILED',error?.message||'Buffer could not reschedule this post.'); } });
app.delete('/api/buffer/posts/:id', async (req,res) => { const connectionId=req.query.connectionId||req.body?.connectionId; try { const { findBufferConnection }=await import('./src/buffer-connections.mjs'); const { deleteBufferPost }=await import('./src/buffer-posts.mjs'); const connection=findBufferConnection(await connections(),connectionId||'legacy'); await deleteBufferPost({apiKey:connection.apiKey,id:req.params.id}); res.json({deleted:true}); } catch(error) { failure(res,error?.code==='NOT_FOUND'?404:502,error?.code||'BUFFER_FAILED',error?.message||'Buffer could not cancel this post.'); } });
app.get('/api/buffer/channels', async (_req,res) => { try { const { aggregateBufferChannels }=await import('./src/buffer-connections.mjs'); const result=await aggregateBufferChannels({connections:await connections()}); res.json({connected:result.channels.length>0,...result}); } catch(error) { failure(res,error?.code==='NOT_CONFIGURED'||error?.code==='CONFIGURATION'?503:502,error?.code||'BUFFER_FAILED',error?.message||'Buffer connection failed.'); } });
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
  const supported = ['image/png','image/jpeg','image/webp','video/mp4','video/quicktime','video/webm','application/pdf'];
  if (!supported.includes(file.mimetype)) { fs.unlink(file.path, () => {}); return res.status(415).json({ uploaded:false, error:{ code:'UNSUPPORTED_TYPE', message:'Use PNG, JPG, WebP, MP4, MOV, WebM, or PDF media.' } }); }
  const limit = file.mimetype.startsWith('video/') ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
  if (file.size > limit) { fs.unlink(file.path, () => {}); return res.status(413).json({ uploaded:false, error:{ code:'FILE_TOO_LARGE', message:'This media file exceeds the configured upload limit.' } }); }
  try { const { uploadMedia } = await import('./src/cloudinary.mjs'); const media = await uploadMedia(file.path, file.mimetype); res.json({ uploaded:true, media }); }
  catch (error) { const safe = mediaFailure(error, file); res.status(safe.status).json({ uploaded:false, error:{ code: safe.code, message: safe.message } }); }
  finally { fs.unlink(file.path, () => {}); }
});app.get('/api/ai/status', (_req, res) => res.json({ configured: Boolean(config.apiKey), mockMode: config.mockMode,
  designModel: config.designModel, imageModel: config.imageModel, imageEngine: 'OpenAI Images API',
  defaultQuality: Object.keys(qualityMap).find(k => qualityMap[k] === config.quality) || 'draft', error: config.error }));
function failure(res, status, code, message) { res.status(status).json({ error: { code, message } }); }
function checkRequest(req, res, multipart = false, allowConcurrent = false) {
  if (!(multipart ? req.is('multipart/form-data') : req.is('application/json')) || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)) {
    failure(res, 403, 'REQUEST_BLOCKED', 'Use the local application to generate designs.'); return false;
  }
  if (config.error) { failure(res, 503, 'CONFIGURATION', config.error); return false; }
  if (!config.mockMode && !config.apiKey) { failure(res, 503, 'NOT_CONFIGURED', 'Add OPENAI_API_KEY on the server, or use OPENAI_MOCK_MODE=true.'); return false; }
  if (aiBusy && !allowConcurrent) { failure(res, 429, 'BUSY', 'A design request is already running. Please wait.'); return false; }
  return true;
}
function reportError(res, error) {
  // LOCAL DEBUG ONLY: log the upstream error to the server console.
  console.error('OPENAI GENERATION ERROR:', error);

  const timeout =
    /timeout|timed out/i.test(error?.name || '') ||
    error?.name === 'AbortError';

  failure(
    res,
    timeout ? 504 : 502,
    timeout ? 'TIMEOUT' : 'GENERATION_FAILED',
    timeout
      ? 'The generation request timed out. No automatic retry was made.'
      : 'Generation failed or returned invalid data. Check the local server console for details.'
  );
}
function validAssistantBody(value) {
  if (!value || typeof value !== 'object') return false;
  const textFields = [value.sourceCaption, value.instruction, value.context?.headline, value.context?.supportingCopy, value.context?.cta];
  return textFields.every(field => field === undefined || (typeof field === 'string' && field.length <= 4000));
}
async function assistantRoute(req, res, type) {
  // Caption and accessibility requests are independent of image/design generation.
  if (!checkRequest(req, res, false, true) || !validAssistantBody(req.body)) return;
  try {
    const { generateCaptionOptions, generateAltText } = await import('./src/content-assistant.mjs');
    const result = type === 'caption' ? await generateCaptionOptions({ config, input: req.body }) : await generateAltText({ config, input: req.body });
    res.json({ ...result, mockMode: config.mockMode });
  } catch (error) { reportError(res, error); }
}
app.post('/api/ai/generate-caption', (req, res) => assistantRoute(req, res, 'caption'));
app.post('/api/ai/generate-alt-text', (req, res) => assistantRoute(req, res, 'alt'));
app.post('/api/ai/generate-carousel-content', async (req, res) => {
  if (!checkRequest(req, res)) return;
  aiBusy = true;
  try {
    const { generateCarouselContent, normalizeCarouselContentInput } = await import('./src/carousel-content.mjs');
    const input = normalizeCarouselContentInput(req.body);
    if (!input.topic) return failure(res, 400, 'INVALID_INPUT', 'Add a carousel prompt, topic, or source text.');
    const carousel = await generateCarouselContent({ config, input });
    res.json({ carousel, mockMode: config.mockMode });
  } catch (error) { reportError(res, error); }
  finally { aiBusy = false; }
});
app.post('/api/ai/generate-multi-page-content', async (req, res) => {
  if (!checkRequest(req, res)) return;
  aiBusy = true;
  try {
    const { generateMultiPageContent, normalizeMultiPageContentInput } = await import('./src/multi-page-content.mjs');
    const input = normalizeMultiPageContentInput(req.body);
    if (!input.prompt) return failure(res, 400, 'INVALID_INPUT', 'Add a multi-page prompt or creative direction first.');
    const multiPage = await generateMultiPageContent({ config, input });
    res.json({ multiPage, mockMode: config.mockMode });
  } catch (error) { reportError(res, error); }
  finally { aiBusy = false; }
});
app.post('/api/ai/design-plan', async (req, res) => {
  if (!checkRequest(req, res)) return;
  aiBusy = true;
  try {
    const { visualStyles, subjectTypes, compositions } = await import('./src/ai-plan.mjs');
    const input = req.body || {};
    const subjectType = input.subjectType === undefined ? 'auto' : input.subjectType;
    for (const [key, max] of Object.entries({ headline: 180, supportingCopy: 700, cta: 70, customDirection: 1200 })) {
      if (typeof input[key] !== 'string' || input[key].length > max) return failure(res, 400, 'INVALID_INPUT', 'Invalid or excessive ' + key + '.');
    }
    if (!input.headline.trim() || !visualStyles.includes(input.visualStyle) || !subjectTypes.includes(subjectType) || !['auto', ...compositions].includes(input.composition)) return failure(res, 400, 'INVALID_INPUT', 'Add a headline and choose valid design options.');
    const { normalizeBrandContext } = await import('./src/ai-brand.mjs');
    const brandContext = input.brandContext === undefined ? null : normalizeBrandContext(input.brandContext);
    if (input.brandContext !== undefined && !brandContext) return failure(res, 400, 'INVALID_INPUT', 'Invalid brand context.');
    const { createDesignPlan } = await import('./src/ai-design-director.mjs');
    const sanitized = Object.fromEntries(['headline','supportingCopy','cta','customDirection','visualStyle','composition'].map(k => [k,input[k]]));
    sanitized.renderMode = input.renderMode === 'full-ai-artwork' ? 'full-ai-artwork' : 'visual-native-text';
    sanitized.subjectType = subjectType;
    if (brandContext) sanitized.brandContext = brandContext;
    const plan = await createDesignPlan({ config, input: sanitized });
    for (const [id, entry] of plans) if (entry.expires < Date.now()) plans.delete(id);
    if (plans.size >= 50) plans.delete(plans.keys().next().value);
    const planId = randomUUID();
   plans.set(planId, {
  plan,
  renderMode: sanitized.renderMode,
  headline: sanitized.headline,
  supportingCopy: sanitized.supportingCopy,
  cta: sanitized.cta,
  customDirection: sanitized.customDirection,
  brandContext: sanitized.brandContext || null,
  expires: Date.now() + 24 * 60 * 60 * 1000
});
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
    const result = await generateVisual({ config, plan: entry.plan, quality, fullArtwork: entry.renderMode === 'full-ai-artwork', copy: entry, brandInstruction: entry.brandContext?.aiInstruction || '' });
    res.json({ ...result, mockMode: config.mockMode });
  } catch (error) { reportError(res, error); }
  finally { aiBusy = false; }
});
app.post('/api/ai/refine-visual', (req, res, next) => aiImageUpload.single('image')(req, res, error => {
  if (error) return failure(res, 400, 'INVALID_IMAGE', 'Choose a PNG, JPG, or WebP visual under 10 MB.');
  next();
}), async (req, res) => {
  if (!checkRequest(req, res, true)) return;
  const entry = plans.get(req.body?.planId);
  const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
  const quality = req.body?.quality;
  if (!entry || entry.expires < Date.now()) return failure(res, 400, 'PLAN_EXPIRED', 'Generate a new design plan first. The previous plan has expired.');
  if (!instruction || instruction.length > 1200) return failure(res, 400, 'INVALID_INPUT', 'Add a refinement instruction of up to 1,200 characters.');
  if (!Object.hasOwn(qualityMap, quality)) return failure(res, 400, 'INVALID_QUALITY', 'Choose Draft, Standard or Premium.');
  if (!req.file || !['image/png','image/jpeg','image/webp'].includes(req.file.mimetype)) return failure(res, 400, 'INVALID_IMAGE', 'Choose a PNG, JPG, or WebP visual to refine.');
  aiBusy = true;
  try {
    const { refineVisual } = await import('./src/openai-image.mjs');
    const result = await refineVisual({ config, plan: entry.plan, quality, image: req.file, instruction, copy: entry, brandInstruction: entry.brandContext?.aiInstruction || '', fullArtwork: entry.renderMode === 'full-ai-artwork' });
    res.json({ ...result, mockMode: config.mockMode });
  } catch (error) { reportError(res, error); }
  finally { aiBusy = false; }
});app.use('/api', (_req, res) => failure(res, 404, 'API_NOT_FOUND', 'This API endpoint is unavailable. Restart the local app and try again.'));
// Only browser modules are public; server-only modules stay private.
const browserSafeMjs = new Set(['/ai-plan.mjs', '/publishing-handoff.mjs', '/linkedin-carousel-document.mjs']);
app.use('/src', (req, res, next) => {
  if (!/^\/[a-z-]+\.js$/.test(req.path) && !browserSafeMjs.has(req.path)) return res.sendStatus(404);
  next();
}, express.static(path.join(__dirname, 'src')));
app.use(express.static(path.join(__dirname, 'public')));
app.use((error, _req, res, _next) => failure(res, 400, 'INVALID_REQUEST', 'Invalid JSON request or request too large.'));
if (require.main === module) app.listen(port, '0.0.0.0', () => {
  console.log('Upplai Design Studio: http://localhost:' + port);
  console.log(config.mockMode ? 'Mock Mode — No API Usage' : 'OpenAI live mode: requests only after an explicit generation action.');
});
module.exports = app;
