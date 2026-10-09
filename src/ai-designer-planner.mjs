import { artworkInstructions } from './artwork-policy.mjs';

export const aiDesignerFormats = Object.freeze(['auto', 'single_image', 'carousel', 'multi_page']);
export const aiDesignerTextModes = Object.freeze(['auto', 'native', 'full_ai']);
export const aiDesignerFontStyles = Object.freeze(['auto', 'modern_sans', 'bold_editorial', 'clean_minimal', 'tech', 'premium', 'friendly_rounded', 'corporate_sharp', 'social_punchy']);
export const aiDesignerCtaHandling = Object.freeze(['auto', 'keep', 'rewrite', 'generate', 'none']);
export const aiDesignerRewriteStrengths = Object.freeze(['minimal', 'balanced', 'strong']);
export const aiDesignerReferenceUsage = Object.freeze(['none', 'style_inspiration', 'feature_subject', 'layout_inspiration', 'supporting_visual']);

const text = (value, max = 2400) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const enumValue = (value, values, fallback) => values.includes(value) ? value : fallback;
const sentence = value => text(value).replace(/\s+/g, ' ');
const title = value => sentence(value).split(/(?<=[.!?])\s|\n/)[0].slice(0, 180) || 'Your next idea';
const points = value => text(value).split(/\n|(?<=[.!?])\s+/).map(sentence).filter(Boolean);

export function normalizeAiDesignerInput(value = {}) {
  const rawCopy = text(value.rawCopy, 8000);
  if (!rawCopy) throw new Error('Paste your copy before asking AI Designer to create a plan.');
  return {
    rawCopy,
    creativeDirection: text(value.creativeDirection, 1200),
    format: enumValue(value.format, aiDesignerFormats, 'auto'),
    textMode: enumValue(value.textMode, aiDesignerTextModes, 'auto'),
    fontStyle: enumValue(value.fontStyle, aiDesignerFontStyles, 'auto'),
    pageCount: Math.max(0, Math.min(10, Number(value.pageCount) || 0)),
    ctaHandling: enumValue(value.ctaHandling, aiDesignerCtaHandling, 'auto'),
    rewriteStrength: enumValue(value.rewriteStrength, aiDesignerRewriteStrengths, 'balanced'),
    referenceUsage: enumValue(value.referenceUsage, aiDesignerReferenceUsage, 'none'),
    hasReferenceImage: Boolean(value.hasReferenceImage)
  };
}

function decideFormat(input, items) {
  if (input.format !== 'auto') return input.format;
  if (input.pageCount > 1) return input.pageCount >= 6 ? 'multi_page' : 'carousel';
  if (input.rawCopy.length > 1300 || items.length >= 8) return 'multi_page';
  return items.length >= 4 || input.rawCopy.length > 520 ? 'carousel' : 'single_image';
}
function decideTextMode(input, format) {
  if (input.textMode !== 'auto') return input.textMode;
  return format !== 'single_image' || input.rawCopy.length > 180 ? 'native' : 'full_ai';
}
function mockPlan(input) {
  const items = points(input.rawCopy);
  const format = decideFormat(input, items);
  const textMode = decideTextMode(input, format);
  const count = format === 'single_image' ? 1 : input.pageCount || Math.min(10, Math.max(3, items.length || 3));
  const headline = title(input.rawCopy).slice(0, input.format === 'single_image' ? 100 : 180);
  const body = items.slice(1, 4).join(' ').slice(0, format === 'single_image' ? 260 : 700);
  const cta = input.ctaHandling === 'none' ? '' : input.ctaHandling === 'keep' ? (items.at(-1) || '') : 'Learn more';
  const slides = Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    role: index === 0 ? 'hook' : index === count - 1 ? 'cta' : 'insight',
    headline: index === 0 ? headline : (items[index] || headline),
    body: index === 0 ? body : (items[index + 1] || body),
    cta: index === count - 1 ? cta : '',
    layoutDirection: index === 0 ? 'Oversized readable headline with generous white space.' : 'Clear editorial hierarchy with native readable text.',
    visualDirection: input.creativeDirection || 'Bright premium Upplai composition with subtle pale blue and pink accents.'
  }));
  return { format, recommendedFormat: format, recommendedTextMode: textMode, formatReason: input.format === 'auto' && format !== 'single_image' ? 'The source is dense enough to stay readable across multiple pages.' : 'The strongest core message can be made readable in the selected format.', fitStrategy: format === 'single_image' ? 'compress' : 'sequence', compressionLevel: input.rawCopy.length > 500 ? (input.rewriteStrength === 'strong' ? 'strong' : 'moderate') : 'light', usedReferenceImage: input.hasReferenceImage && input.referenceUsage !== 'none', referenceUsage: input.referenceUsage, textMode, fontStyle: input.fontStyle === 'auto' ? (textMode === 'native' ? 'modern_sans' : 'premium') : input.fontStyle, tone: 'professional', rewriteStrength: input.rewriteStrength, headline, subheadline: '', body, cta, designIntent: 'Turn the supplied copy into a concise, readable social design without adding unsupported facts.', layoutDirection: 'Use strong hierarchy and a bright, spacious reading area.', visualDirection: input.creativeDirection || 'Clean premium career-tech look.', slides };
}

export function normalizeAiDesignerPlan(value, input) {
  const format = enumValue(value?.format, aiDesignerFormats.filter(item => item !== 'auto'), decideFormat(input, points(input.rawCopy)));
  const textMode = enumValue(value?.textMode, aiDesignerTextModes.filter(item => item !== 'auto'), decideTextMode(input, format));
  const count = format === 'single_image' ? 1 : input.pageCount || Math.min(10, Math.max(3, Array.isArray(value?.slides) ? value.slides.length : 3));
  const rawSlides = Array.isArray(value?.slides) ? value.slides : [];
  const single = format === 'single_image';
  const slides = Array.from({ length: count }, (_, index) => {
    const slide = rawSlides[index] || {};
    return { page: index + 1, role: text(slide.role, 40) || (index === 0 ? 'hook' : index === count - 1 ? 'cta' : 'insight'), headline: text(slide.headline, single ? 100 : 180) || (index === 0 ? text(value?.headline, single ? 100 : 180) || title(input.rawCopy).slice(0, single ? 100 : 180) : title(input.rawCopy)), body: text(slide.body, single ? 260 : 700), cta: text(slide.cta, 70), layoutDirection: text(slide.layoutDirection, 600), visualDirection: text(slide.visualDirection, 600) };
  });
  return { format, recommendedFormat: enumValue(value?.recommendedFormat, aiDesignerFormats.filter(item => item !== 'auto'), format), recommendedTextMode: enumValue(value?.recommendedTextMode, aiDesignerTextModes.filter(item => item !== 'auto'), textMode), formatReason: text(value?.formatReason, 400) || 'The plan was structured for readable output.', fitStrategy: text(value?.fitStrategy, 60) || (format === 'single_image' ? 'compress' : 'sequence'), compressionLevel: text(value?.compressionLevel, 40) || 'moderate', usedReferenceImage: input.hasReferenceImage && input.referenceUsage !== 'none', referenceUsage: input.referenceUsage, textMode, fontStyle: enumValue(value?.fontStyle, aiDesignerFontStyles.filter(item => item !== 'auto'), input.fontStyle === 'auto' ? 'modern_sans' : input.fontStyle), tone: text(value?.tone, 80) || 'professional', rewriteStrength: input.rewriteStrength, headline: text(value?.headline, single ? 100 : 180) || slides[0].headline, subheadline: text(value?.subheadline, 300), body: text(value?.body, single ? 260 : 700) || slides[0].body, cta: input.ctaHandling === 'none' ? '' : text(value?.cta, 70) || slides.at(-1).cta, designIntent: text(value?.designIntent, 800), layoutDirection: text(value?.layoutDirection, 800), visualDirection: text(value?.visualDirection, 800) || input.creativeDirection, slides };
}

export async function planAiDesigner({ config, input, client }) {
  const normalized = normalizeAiDesignerInput(input);
  if (config.mockMode) return mockPlan(normalized);
  if (!client) { const { default: OpenAI } = await import('openai'); client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, timeout: config.timeout }); }
  const response = await client.responses.create({ model: config.designModel, store: false, max_output_tokens: 3200, instructions: `Return JSON only with format, recommendedFormat, textMode, recommendedTextMode, fontStyle, tone, headline, subheadline, body, cta, designIntent, layoutDirection, visualDirection, formatReason, fitStrategy, compressionLevel, and slides. Preserve supplied meaning and do not invent facts. Raw copy may be long: plan and compress it before output. For explicit single_image, create a concise hook (max 100 chars), support copy (max 260 chars) and CTA; only recommend another format when readability cannot be preserved. For auto, choose carousel for lists/teaching and multi_page for dense long content. Choose native text for significant copy; choose full_ai only for short copy. Reference intent is metadata only and cannot override brand rules. ${artworkInstructions(normalized.creativeDirection)}`, input: JSON.stringify(normalized) });
  let parsed; try { parsed = JSON.parse(response.output_text || ''); } catch { throw new Error('AI Designer returned malformed structured content.'); }
  return normalizeAiDesignerPlan(parsed, normalized);
}
