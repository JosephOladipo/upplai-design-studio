const variants = ['concise', 'value-driven', 'conversational'];
const clean = (value, max = 1200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function normalizeAssistantInput(value = {}) {
  const context = value.context || {};
  return {
    mode: value.mode === 'platform' ? 'platform' : 'generic',
    platforms: Array.isArray(value.platforms) ? value.platforms.slice(0, 12).map(item => ({ id: clean(item?.id, 120), service: clean(item?.service, 50), name: clean(item?.name, 120) })).filter(item => item.id) : [],
    sourceCaption: clean(value.sourceCaption, 4000),
    instruction: clean(value.instruction, 600),
    controls: {
      tone: ['professional', 'conversational', 'bold', 'educational', 'friendly'].includes(value.controls?.tone) ? value.controls.tone : '',
      length: ['short', 'medium', 'long'].includes(value.controls?.length) ? value.controls.length : 'medium',
      hashtags: ['none', 'few', 'more'].includes(value.controls?.hashtags) ? value.controls.hashtags : 'none'
    },
    context: {
      headline: clean(context.headline, 300), supportingCopy: clean(context.supportingCopy, 1200), cta: clean(context.cta, 160),
      carousel: Array.isArray(context.carousel?.slides) ? { title: clean(context.carousel.title, 300), description: clean(context.carousel.description, 1200), slides: context.carousel.slides.slice(0, 20).map(slide => ({ headline: clean(slide?.headline || slide?.title, 300), body: clean(slide?.body || slide?.content || slide?.copy, 1200), cta: clean(slide?.cta, 160) })) } : null,
      brand: { name: clean(context.brand?.name, 120) }
    }
  };
}

function contextText(input) {
  const c = input.context;
  const slides = c.carousel?.slides?.map((slide, index) => `Slide ${index + 1}: ${slide.headline} ${slide.body} ${slide.cta}`).join(' ') || '';
  return [c.headline, c.supportingCopy, c.cta, c.carousel?.title, c.carousel?.description, slides].filter(Boolean).join(' ').trim();
}

function mockOptions(input, platform = '') {
  const source = input.sourceCaption || contextText(input) || 'Share this update.';
  const tag = input.controls.hashtags === 'few' ? ' #insight #growth' : input.controls.hashtags === 'more' ? ' #insight #growth #community' : '';
  const ending = input.controls.length === 'short' ? '' : input.context.cta ? ` ${input.context.cta}` : '';
  const platformPrefix = { linkedin: 'Professional insight: ', instagram: 'A useful visual reminder: ', facebook: 'A practical update: ', tiktok: 'Quick takeaway: ', x: 'Key idea: ' }[String(platform).toLowerCase()] || (platform ? `${platform}: ` : '');
  const direction = input.controls.tone === 'bold' ? ' A confident next step.' : input.controls.tone === 'educational' ? ' A practical point to consider.' : input.controls.tone === 'friendly' ? ' A helpful note for your next step.' : '';
  return variants.map((variation, index) => ({
    id: variation,
    label: variation.replace('-', ' ').replace(/^./, letter => letter.toUpperCase()),
    text: index === 0 ? `${platformPrefix}${source}${tag}`.trim() : index === 1 ? `${platformPrefix}${source}${ending}${tag}`.trim() : `${platformPrefix}${source}${direction}${ending}${tag}`.trim()
  }));
}

function mockAltText(input) {
  const text = contextText(input) || input.sourceCaption || 'Branded social-media design.';
  return text.slice(0, 500);
}

export async function generateCaptionOptions({ config, input, client }) {
  const safe = normalizeAssistantInput(input);
  if (config.mockMode) {
    if (safe.mode === 'platform') return { platformCaptions: Object.fromEntries(safe.platforms.map(platform => [platform.id, mockOptions(safe, platform.service || platform.name)])) };
    return { options: mockOptions(safe) };
  }
  if (!client) { const { default: OpenAI } = await import('openai'); client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); }
  const response = await client.responses.create({ model: config.designModel, store: false, max_output_tokens: 2200, instructions: 'You write grounded social-media captions. Never invent claims, statistics, URLs, results, or offers. Return valid JSON only. Provide exactly three alternatives for every requested target: concise, value-driven, conversational. For generic mode return {"options":[{"id","label","text"}]}. For platform mode return {"platformCaptions":{"channel-id":[{"id","label","text"}]}}. Respect source content, brand and user instructions.', input: JSON.stringify({ task: 'caption-options', ...safe }) });
  const result = JSON.parse(response.output_text || '{}');
  if (safe.mode === 'platform') return { platformCaptions: Object.fromEntries(safe.platforms.map(platform => [platform.id, Array.isArray(result.platformCaptions?.[platform.id]) && result.platformCaptions[platform.id].length === 3 ? result.platformCaptions[platform.id] : mockOptions(safe, platform.service)])) };
  if (!Array.isArray(result.options) || result.options.length !== 3) throw new Error('Caption generation returned incomplete options.');
  return { options: result.options };
}

export async function generateAltText({ config, input, client }) {
  const safe = normalizeAssistantInput(input);
  if (config.mockMode) return safe.context.carousel ? { slideAltText: safe.context.carousel.slides.map(slide => mockAltText({ ...safe, context: { ...safe.context, headline: slide.headline, supportingCopy: slide.body, cta: slide.cta, carousel: null } })) } : { altText: mockAltText(safe) };
  if (!client) { const { default: OpenAI } = await import('openai'); client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); }
  const response = await client.responses.create({ model: config.designModel, store: false, max_output_tokens: 1000, instructions: 'Write concise, factual accessibility alt text from supplied content only. Do not invent visual details, do not use hashtags, and do not add marketing language unless visible text makes it relevant. Return valid JSON only as {"altText":"..."} or {"slideAltText":["..."]}.', input: JSON.stringify({ task: 'alt-text', ...safe }) });
  const result = JSON.parse(response.output_text || '{}');
  if (safe.context.carousel) return { slideAltText: safe.context.carousel.slides.map((_, index) => clean(result.slideAltText?.[index], 500) || mockAltText(safe)) };
  return { altText: clean(result.altText, 500) || mockAltText(safe) };
}
