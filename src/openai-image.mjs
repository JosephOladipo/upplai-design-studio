import { artworkBackground, artworkInstructions } from './artwork-policy.mjs';
import { safeImagePrompt } from './ai-plan.mjs';
import { qualityMap } from './ai-config.cjs';
import { assessFullArtwork } from './full-artwork-validation.mjs';

function imageResult(data) {
  if (typeof data !== 'string' || data.length > 40000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || !Buffer.from(data, 'base64').subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Image generation returned malformed PNG data.');
  return { image: 'data:image/png;base64,' + data };
}

const correctiveInstruction = (assessment, backgroundPolicy) => `CORRECTIVE REGENERATION: The prior artwork was rejected. ${assessment.reason} Keep the supplied copy exact. Render all critical typography comfortably inside the safe frame, with clear space above the headline and below the CTA. ${backgroundPolicy === 'white' ? 'For the default background, output only intentional artwork on transparent pixels; do not paint a backdrop, gray wash, gradient, vignette, haze, or canvas lighting.' : 'Preserve the explicitly requested background while correcting typography placement.'}`;
async function acceptFullArtwork({ client, config, image, backgroundPolicy, regenerate }) {
  let candidate = image;
  let assessment = await assessFullArtwork({ client, config, image: candidate, backgroundPolicy });
  if (assessment.accepted) return { image: candidate, assessment, attempts: 1 };
  candidate = await regenerate(correctiveInstruction(assessment, backgroundPolicy));
  assessment = await assessFullArtwork({ client, config, image: candidate, backgroundPolicy });
  if (!assessment.accepted) throw new Error(`Full AI artwork could not meet the required background and text-safe-area checks after one corrective retry. ${assessment.reason}`);
  return { image: candidate, assessment, attempts: 2 };
}

export async function generateVisual({ config, plan, quality, client, fullArtwork = false, copy = {}, brandInstruction = '' }) {
  const prompt = fullArtwork
    ? [plan.imagePrompt, brandInstruction ? `MANDATORY BRAND INSTRUCTION — FOLLOW DIRECTLY:\n${brandInstruction}` : '', 'Create a complete flattened 4:5 social-media artwork. Render the supplied post copy as part of the artwork when legible; this output is intentionally not natively editable.', artworkInstructions(copy.customDirection), `Headline: ${copy.headline || ''}`, `Supporting copy: ${copy.supportingCopy || ''}`, `CTA: ${copy.cta || ''}`].join('\n')
    : safeImagePrompt(plan);
  const backgroundPolicy = fullArtwork ? artworkBackground(copy.customDirection) : 'auto';
  if (config.mockMode) {
    const base = fullArtwork && backgroundPolicy === 'white' ? '#FFFFFF' : plan.imageStyle === 'futuristic' ? '#101d30' : '#edf5f8';
    const x = plan.subjectPlacement === 'left' ? 140 : 880; const y = plan.subjectPlacement === 'top' ? 260 : 1200;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="${base}"/><circle cx="${x}" cy="${y}" r="240" fill="#50C4F8"/><circle cx="${x - 65}" cy="${y - 60}" r="135" fill="#2BB7F7"/><path d="M${x - 100},${y + 200} l220,-90" stroke="#E24C8E" stroke-width="24"/></svg>`;
    return { image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), fullArtwork, backgroundPolicy };
  }
  if (!client) { const module = await import('openai'); client = new module.default({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); }
  const create = async extra => {
    const response = await client.images.generate({ model: config.imageModel, prompt: [prompt, extra].filter(Boolean).join('\n'), n: 1, size: config.size, quality: qualityMap[quality], background: backgroundPolicy === 'white' ? 'transparent' : 'auto', output_format: 'png' });
    return imageResult(response.data?.[0]?.b64_json).image;
  };
  const image = await create('');
  if (!fullArtwork) return { image, fullArtwork, backgroundPolicy };
  const accepted = await acceptFullArtwork({ client, config, image, backgroundPolicy, regenerate: create });
  return { image: accepted.image, fullArtwork, backgroundPolicy, artworkAcceptance: accepted.assessment, artworkAttempts: accepted.attempts };
}

export async function refineVisual({ config, plan, quality, image, instruction, client, fullArtwork = false, copy = {}, brandInstruction = '' }) {
  if (!image?.buffer || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimetype)) throw new Error('A valid PNG, JPG, or WebP visual is required for refinement.');
  copy = { ...copy, customDirection: [copy.customDirection, instruction].filter(Boolean).join('; ') };
  const prompt = fullArtwork ? `Refine this complete social-media artwork. Preserve supplied text unless explicitly asked to change it. ${instruction}\n${artworkInstructions(copy.customDirection)}\nBrand instruction: ${brandInstruction}` : `Refine only this visual background. Preserve the composition unless requested otherwise. ${instruction}. Do not add text, logos, or watermarks.`;
  const backgroundPolicy = fullArtwork ? artworkBackground(copy.customDirection) : 'auto';
  if (config.mockMode) {
    const shift = [...instruction].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 180;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="${fullArtwork && backgroundPolicy === 'white' ? '#FFFFFF' : '#101d30'}"/><circle cx="${220 + shift}" cy="520" r="280" fill="#50C4F8"/><path d="M80 1160 L940 960" stroke="#E24C8E" stroke-width="34"/></svg>`;
    return { image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), fullArtwork, backgroundPolicy };
  }
  if (!client) { const module = await import('openai'); client = new module.default({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); image = { ...image, file: await module.toFile(image.buffer, 'current-design.png', { type: image.mimetype }) }; }
  const edit = async (source, extra = '') => {
    const response = await client.images.edit({ model: config.imageModel, image: source, prompt: [prompt, extra].filter(Boolean).join('\n'), n: 1, size: config.size, quality: qualityMap[quality], background: backgroundPolicy === 'white' ? 'transparent' : 'auto', output_format: 'png' });
    return imageResult(response.data?.[0]?.b64_json).image;
  };
  const output = await edit(image.file || image.buffer);
  if (!fullArtwork) return { image: output, fullArtwork, backgroundPolicy };
  const accepted = await acceptFullArtwork({ client, config, image: output, backgroundPolicy, regenerate: extra => edit(Buffer.from(output.replace(/^data:image\/png;base64,/, ''), 'base64'), extra) });
  return { image: accepted.image, fullArtwork, backgroundPolicy, artworkAcceptance: accepted.assessment, artworkAttempts: accepted.attempts };
}
