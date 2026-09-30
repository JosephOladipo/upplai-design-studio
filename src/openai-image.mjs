import { safeImagePrompt } from './ai-plan.mjs';
import { qualityMap } from './ai-config.cjs';

function imageResult(data) {
  if (typeof data !== 'string' || data.length > 40000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || !Buffer.from(data, 'base64').subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Image generation returned malformed PNG data.');
  return { image: 'data:image/png;base64,' + data };
}

export async function generateVisual({ config, plan, quality, client, fullArtwork = false, copy = {} }) {
  const prompt = fullArtwork
    ? [plan.imagePrompt, 'Create a complete flattened 4:5 social-media artwork. Render the supplied post copy as part of the artwork when legible; this output is intentionally not natively editable.', `Headline: ${copy.headline || ''}`, `Supporting copy: ${copy.supportingCopy || ''}`, `CTA: ${copy.cta || ''}`].join('\n')
    : safeImagePrompt(plan);
  if (config.mockMode) {
    const base = plan.imageStyle === 'futuristic' ? '#101d30' : '#edf5f8';
    const x = plan.subjectPlacement === 'left' ? 140 : 880;
    const y = plan.subjectPlacement === 'top' ? 260 : 1200;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="${base}"/><circle cx="${x}" cy="${y}" r="240" fill="#50C4F8"/><circle cx="${x - 65}" cy="${y - 60}" r="135" fill="#2BB7F7"/><path d="M${x - 100},${y + 200} l220,-90" stroke="#E24C8E" stroke-width="24"/></svg>`;
    return { image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') };
  }
  if (!client) { const module = await import('openai'); client = new module.default({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); }
  const response = await client.images.generate({ model: config.imageModel, prompt, n: 1, size: config.size, quality: qualityMap[quality], output_format: 'png' });
  return imageResult(response.data?.[0]?.b64_json);
}

export async function refineVisual({ config, plan, quality, image, instruction, client, fullArtwork = false }) {
  if (!image?.buffer || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimetype)) throw new Error('A valid PNG, JPG, or WebP visual is required for refinement.');
  const prompt = fullArtwork ? `Refine this complete social-media artwork. ${instruction}` : `Refine only this visual background. Preserve the composition unless requested otherwise. ${instruction}. Do not add text, logos, or watermarks.`;
  if (config.mockMode) {
    const shift = [...instruction].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 180;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="#101d30"/><circle cx="${220 + shift}" cy="520" r="280" fill="#50C4F8"/><path d="M80 1160 L940 960" stroke="#E24C8E" stroke-width="34"/></svg>`;
    return { image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') };
  }
  if (!client) { const module = await import('openai'); client = new module.default({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); image = { ...image, file: await module.toFile(image.buffer, 'current-design.png', { type: image.mimetype }) }; }
  const response = await client.images.edit({ model: config.imageModel, image: image.file || image.buffer, prompt, n: 1, size: config.size, quality: qualityMap[quality], output_format: 'png', input_fidelity: 'high' });
  return imageResult(response.data?.[0]?.b64_json);
}
