const goals = ['educate', 'explain', 'tips', 'story', 'promote', 'thought-leadership'];
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const requestedCount = prompt => { const match = clean(prompt, 1600).match(/\b(3|5|7|10)[\s-]*slide(?:s)?\b/i); return match ? Number(match[1]) : null; };
const rolesFor = count => ({ 3: ['cover', 'insight', 'cta'], 5: ['cover', 'context', 'insight', 'list', 'cta'], 7: ['cover', 'context', 'insight', 'list', 'stat', 'conclusion', 'cta'], 10: ['cover', 'context', 'insight', 'list', 'visual', 'stat', 'insight', 'conclusion', 'list', 'cta'] }[count]);

export function normalizeCarouselContentInput(value = {}) {
  const prompt = clean(value.prompt, 1600);
  const selectedCount = Number(value.slideCount);
  const slideCount = requestedCount(prompt) || ([3, 5, 7, 10].includes(selectedCount) ? selectedCount : 5);
  const topic = clean(value.topic, 1600) || prompt;
  return {
    prompt, topic,
    slideCount,
    goal: goals.includes(value.goal) ? value.goal : 'educate',
    direction: clean(value.direction, 600),
    renderMode: ['native', 'visual-native-text', 'full-ai-artwork'].includes(value.renderMode) ? value.renderMode : 'native',
    roles: rolesFor(slideCount),
    brand: { name: clean(value.brand?.name, 120) }
  };
}

function mockSlide(role, topic, index, total) {
  const base = topic || 'Your topic';
  const copy = {
    cover: { headline: base, body: 'A practical guide with clear next steps.', cta: '' },
    context: { headline: 'Why this matters', body: `Start with the context behind ${base.toLowerCase()}.`, cta: '' },
    insight: { headline: 'Focus on the key idea', body: `Use one clear, practical insight about ${base.toLowerCase()}.`, cta: '' },
    list: { headline: 'Put this into practice', body: `Choose one action that moves ${base.toLowerCase()} forward.`, cta: '' },
    stat: { headline: 'The important takeaway', body: 'Use a qualitative insight unless a verified number was supplied.', cta: '' },
    visual: { headline: 'See the pattern', body: `Connect this point back to ${base.toLowerCase()} with a simple example.`, cta: '' },
    conclusion: { headline: 'Bring it together', body: `Apply these ideas consistently to improve ${base.toLowerCase()}.`, cta: '' },
    cta: { headline: 'Your next step', body: `Save this guide and use one idea from it today.`, cta: 'Save this post' }
  }[role] || { headline: base, body: '', cta: '' };
  return { role, headline: copy.headline, body: copy.body, cta: copy.cta, order: index, total };
}

function validateResult(value, input) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.slides) || value.slides.length !== input.slideCount) throw new Error('Carousel generation returned an incomplete slide sequence.');
  return {
    title: clean(value.title, 180) || input.topic.slice(0, 180),
    description: clean(value.description, 700),
    slides: value.slides.map((slide, index) => ({
      role: input.roles[index], headline: clean(slide?.headline, 180), body: clean(slide?.body, 700), cta: clean(slide?.cta, 70), order: index
    }))
  };
}

export async function generateCarouselContent({ config, input, client }) {
  const safe = normalizeCarouselContentInput(input);
  if (!safe.topic) throw new Error('Add a carousel prompt, topic, or source text.');
  if (config.mockMode) return { title: safe.topic.slice(0, 180), description: `A ${safe.goal} carousel about ${safe.topic}.`, slides: safe.roles.map((role, index) => mockSlide(role, safe.topic, index, safe.roles.length)) };
  if (!client) { const { default: OpenAI } = await import('openai'); client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); }
  const response = await client.responses.create({ model: config.designModel, store: false, max_output_tokens: 3000, instructions: 'Create one coherent social-media carousel from the supplied source. Return valid JSON only: {"title":"","description":"","slides":[{"headline":"","body":"","cta":""}]}. Exactly match the requested slide roles and count. Keep copy concise. Never invent statistics, testimonials, results, URLs, offers, guarantees, or product capabilities. If asked for a stat with no verified statistic, use a qualitative insight.', input: JSON.stringify({ task: 'carousel-content', ...safe }) });
  return validateResult(JSON.parse(response.output_text || '{}'), safe);
}

export { goals };
