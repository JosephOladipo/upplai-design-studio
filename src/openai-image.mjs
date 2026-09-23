import { safeImagePrompt } from './ai-plan.mjs';
import { qualityMap } from './ai-config.cjs';

export async function generateVisual({ config, plan, quality, client }) {
  const prompt = safeImagePrompt(plan);
  if (config.mockMode) {
    // Fixed local SVG contains no user strings, text, links, scripts or external assets.
    const base = plan.imageStyle === 'futuristic' ? '#101d30' : '#edf5f8';
    const x = plan.subjectPlacement === 'left' ? 140 : 880;
    const y = plan.subjectPlacement === 'top' ? 260 : 1200;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="${base}"/><circle cx="${x}" cy="${y}" r="240" fill="#50C4F8"/><circle cx="${x - 65}" cy="${y - 60}" r="135" fill="#2BB7F7"/><path d="M${x - 100},${y + 200} l220,-90" stroke="#E24C8E" stroke-width="24"/></svg>`;
    return { image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') };
  }
  if (!client) {
    const { default: OpenAI } = await import('openai');
    client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout });
  }
  const response = await client.images.generate({ model: config.imageModel, prompt, n: 1,
    size: config.size, quality: qualityMap[quality], output_format: 'png' });
  const data = response.data?.[0]?.b64_json;
  if (typeof data !== 'string' || data.length > 40000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data) || !Buffer.from(data, 'base64').subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    throw new Error('Image generation returned malformed PNG data.');
  }
  return { image: 'data:image/png;base64,' + data };
}
