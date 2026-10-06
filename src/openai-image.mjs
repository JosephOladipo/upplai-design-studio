import { artworkBackground, artworkInstructions, aiLogoProhibition } from './artwork-policy.mjs';
import { reformatInstruction, generationDimensions } from './design-format.js';
import { safeImagePrompt } from './ai-plan.mjs';
import { qualityMap } from './ai-config.cjs';
import { assessFullArtwork } from './full-artwork-validation.mjs';

function imageResult(data) {
  if (typeof data !== 'string' || data.length > 40000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || !Buffer.from(data, 'base64').subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Image generation returned malformed PNG data.');
  return { image: 'data:image/png;base64,' + data };
}
const transientImageError = error => { const status=Number(error?.status||error?.statusCode||0), code=String(error?.code||error?.cause?.code||''), name=String(error?.name||''); return status===408||status===429||status>=500||/UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(code)||/APIConnectionTimeoutError|APIConnectionError|timeout|network/i.test(name)||/connect timeout|timed out|network/i.test(String(error?.message||'')); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function retryImageRequest(request,{sleep=wait,logger=console}={}) { let last; for(let attempt=1;attempt<=3;attempt+=1){ logger.info?.(`[OPENAI IMAGE] attempt ${attempt}/3`); try { const value=await request(); logger.info?.('[OPENAI IMAGE] success'); return value; } catch(error){ last=error; if(attempt===3||!transientImageError(error)){ logger.error?.('[OPENAI IMAGE] final failure',{attempt,name:error?.name||'Error',code:error?.code||error?.cause?.code||null}); throw error; } logger.warn?.('[OPENAI IMAGE] retrying after transient timeout',{attempt,name:error?.name||'Error',code:error?.code||error?.cause?.code||null}); await sleep(attempt*300); } } throw last; }

const essentialHeadline = copy => String(copy?.headline || '').trim().slice(0, 300);
const correctiveInstruction = (assessment, backgroundPolicy, copy) => `CORRECTIVE REGENERATION: The prior artwork was rejected. ${assessment.reason} Keep the essential headline exact: ${JSON.stringify(essentialHeadline(copy))}. Render that headline comfortably inside the safe frame, with clear margins on every side. Supporting copy and CTA are optional: omit them rather than making them tiny, clipped, or crowded. ${backgroundPolicy === 'white' ? 'For the default background, output only intentional artwork on transparent pixels; do not paint a backdrop, gray wash, gradient, vignette, haze, or canvas lighting.' : 'Preserve the explicitly requested background while correcting typography placement.'}`;
async function acceptFullArtwork({ client, config, image, backgroundPolicy, copy, regenerate }) {
  let candidate = image;
  let assessment = await assessFullArtwork({ client, config, image: candidate, backgroundPolicy, copy });
  if (assessment.accepted) return { image: candidate, assessment, attempts: 1 };
  candidate = await regenerate(correctiveInstruction(assessment, backgroundPolicy, copy));
  assessment = await assessFullArtwork({ client, config, image: candidate, backgroundPolicy, copy });
  // The second image is still a valid image-generation result. Vision is used to
  // improve typography, not to turn an otherwise usable generated PNG into a
  // failed Calendar/Create operation when its assessment remains uncertain.
  return { image: candidate, assessment, attempts: 2, validatorFallback: !assessment.accepted };
}

export async function generateVisual({ config, plan, quality, client, fullArtwork = false, copy = {}, brandInstruction = '', targetCanvas = null }) {
  const prompt = fullArtwork
    ? [plan.imagePrompt, brandInstruction ? `MANDATORY BRAND INSTRUCTION — FOLLOW DIRECTLY:\n${brandInstruction}` : '', targetCanvas ? `Create complete flattened artwork specifically composed for ${targetCanvas.width} x ${targetCanvas.height}.` : 'Create a complete flattened 4:5 social-media artwork. This output is intentionally not natively editable.', artworkInstructions(copy.customDirection), `ESSENTIAL HEADLINE — render this exact text prominently and wholly inside safe margins: ${copy.headline || ''}`, `${targetCanvas ? 'EXACT approved supporting copy — preserve all wording' : 'OPTIONAL supporting copy — include only when it remains clearly readable and comfortably inside safe margins'}: ${copy.supportingCopy || ''}`, `${targetCanvas ? 'EXACT approved CTA — preserve all wording' : 'OPTIONAL CTA — include only when it remains clearly readable and comfortably inside safe margins'}: ${copy.cta || ''}`].join('\n')
    : safeImagePrompt(plan);
  const finalPrompt = [prompt, targetCanvas ? reformatInstruction(copy, plan, targetCanvas) : '', aiLogoProhibition].filter(Boolean).join('\n');
  const imageSize = targetCanvas ? generationDimensions(targetCanvas) : config.size;
  const backgroundPolicy = fullArtwork ? artworkBackground(copy.customDirection) : 'auto';
  if (config.mockMode) {
    const base = fullArtwork && backgroundPolicy === 'white' ? '#FFFFFF' : plan.imageStyle === 'futuristic' ? '#101d30' : '#edf5f8';
    const x = plan.subjectPlacement === 'left' ? 140 : 880; const y = plan.subjectPlacement === 'top' ? 260 : 1200;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="${base}"/><circle cx="${x}" cy="${y}" r="240" fill="#50C4F8"/><circle cx="${x - 65}" cy="${y - 60}" r="135" fill="#2BB7F7"/><path d="M${x - 100},${y + 200} l220,-90" stroke="#E24C8E" stroke-width="24"/></svg>`;
    const formatted = targetCanvas ? svg.replace('width="1024" height="1536"', `width="${targetCanvas.width}" height="${targetCanvas.height}" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet"`) : svg;
    return { image: 'data:image/svg+xml;base64,' + Buffer.from(formatted).toString('base64'), fullArtwork, backgroundPolicy, targetCanvas };
  }
  if (!client) { const module = await import('openai'); client = new module.default({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); }
  const create = async extra => {
    const preserveCopy = targetCanvas ? reformatInstruction(copy, plan, targetCanvas) : '';
    const correction = targetCanvas ? extra.replace('Supporting copy and CTA are optional: omit them rather than making them tiny, clipped, or crowded.', 'Preserve supporting copy and CTA exactly and recompose them readably inside the target safe frame.') : extra;
    const response = await retryImageRequest(() => client.images.generate({ model: config.imageModel, prompt: [finalPrompt, correction, preserveCopy, aiLogoProhibition].filter(Boolean).join('\n'), n: 1, size: imageSize, quality: qualityMap[quality], background: backgroundPolicy === 'white' ? 'transparent' : 'auto', output_format: 'png' }));
    return imageResult(response.data?.[0]?.b64_json).image;
  };
  const image = await create('');
  if (!fullArtwork) return { image, fullArtwork, backgroundPolicy };
  const accepted = await acceptFullArtwork({ client, config, image, backgroundPolicy, copy, regenerate: create });
  return { image: accepted.image, fullArtwork, backgroundPolicy, targetCanvas, artworkAcceptance: accepted.assessment, artworkAttempts: accepted.attempts, artworkValidatorFallback: accepted.validatorFallback === true };
}

export async function refineVisual({ config, plan, quality, image, instruction, client, fullArtwork = false, copy = {}, brandInstruction = '', targetCanvas = null }) {
  if (!image?.buffer || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimetype)) throw new Error('A valid PNG, JPG, or WebP visual is required for refinement.');
  copy = { ...copy, customDirection: [copy.customDirection, instruction].filter(Boolean).join('; ') };
  const prompt = fullArtwork ? `Refine this complete social-media artwork. Preserve supplied text unless explicitly asked to change it. ${instruction}\n${artworkInstructions(copy.customDirection)}\nBrand instruction: ${brandInstruction}` : `Refine only this visual background. Preserve the composition unless requested otherwise. ${instruction}. Do not add text, logos, or watermarks.`;
  const backgroundPolicy = fullArtwork ? artworkBackground(copy.customDirection) : 'auto';
  if (config.mockMode) {
    const shift = [...instruction].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 180;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="${fullArtwork && backgroundPolicy === 'white' ? '#FFFFFF' : '#101d30'}"/><circle cx="${220 + shift}" cy="520" r="280" fill="#50C4F8"/><path d="M80 1160 L940 960" stroke="#E24C8E" stroke-width="34"/></svg>`;
    const formatted = targetCanvas ? svg.replace('width="1024" height="1536"', `width="${targetCanvas.width}" height="${targetCanvas.height}" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet"`) : svg;
    return { image: 'data:image/svg+xml;base64,' + Buffer.from(formatted).toString('base64'), fullArtwork, backgroundPolicy, targetCanvas };
  }
  if (!client) { const module = await import('openai'); client = new module.default({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); image = { ...image, file: await module.toFile(image.buffer, 'current-design.png', { type: image.mimetype }) }; }
  const edit = async (source, extra = '') => {
    const preserveCopy = targetCanvas ? fullArtwork ? reformatInstruction(copy, plan, targetCanvas) : `Visual/background only for ${targetCanvas.width} x ${targetCanvas.height}. Do not render any headline, supporting copy or CTA; the application preserves its native typography separately.` : '';
    const correction = targetCanvas ? extra.replace('Supporting copy and CTA are optional: omit them rather than making them tiny, clipped, or crowded.', 'Preserve supporting copy and CTA exactly inside the target safe frame.') : extra;
    const response = await client.images.edit({ model: config.imageModel, image: source, prompt: [prompt, correction, preserveCopy, aiLogoProhibition].filter(Boolean).join('\n'), n: 1, size: targetCanvas ? generationDimensions(targetCanvas) : config.size, quality: qualityMap[quality], background: backgroundPolicy === 'white' ? 'transparent' : 'auto', output_format: 'png' });
    return imageResult(response.data?.[0]?.b64_json).image;
  };
  const output = await edit(image.file || image.buffer);
  if (!fullArtwork) return { image: output, fullArtwork, backgroundPolicy, targetCanvas };
  const accepted = await acceptFullArtwork({ client, config, image: output, backgroundPolicy, copy, regenerate: extra => edit(Buffer.from(output.replace(/^data:image\/png;base64,/, ''), 'base64'), extra) });
  return { image: accepted.image, fullArtwork, backgroundPolicy, targetCanvas, artworkAcceptance: accepted.assessment, artworkAttempts: accepted.attempts, artworkValidatorFallback: accepted.validatorFallback === true };
}
