// Server-only configuration. No client-supplied model names or API credentials.
const qualityMap = Object.freeze({ draft: 'low', standard: 'medium', premium: 'high' });
function readConfig(env = process.env) {
  const mock = env.OPENAI_MOCK_MODE ?? 'true';
  const quality = env.OPENAI_IMAGE_QUALITY || 'low';
  const config = {
    apiKey: env.OPENAI_API_KEY || '', mockMode: mock !== 'false',
    designModel: env.OPENAI_DESIGN_MODEL || 'gpt-5.6-luna',
    imageModel: env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare',
    quality, size: '1024x1536', timeout: 180000
  };
  config.error = !['true', 'false'].includes(mock) ? 'OPENAI_MOCK_MODE must be true or false.'
    : !Object.values(qualityMap).includes(quality) ? 'OPENAI_IMAGE_QUALITY must be low, medium or high.'
    : !/^gpt-image-/.test(config.imageModel) ? 'OPENAI_IMAGE_MODEL must be a GPT Image model.' : null;
  return config;
}
module.exports = { readConfig, qualityMap };
