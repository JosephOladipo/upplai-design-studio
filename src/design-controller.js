import { designStyles } from './styles.js';

const styleIds = new Set(designStyles.map(style => style.id));
const text = value => typeof value === 'string' ? value : '';

export function normalizeDesignInput(input = {}) {
  const style = styleIds.has(input.style) ? input.style : 'premium-editorial';
  return {
    ...input,
    headline: text(input.headline),
    supportingCopy: text(input.supportingCopy),
    cta: text(input.cta),
    style,
    aiSettings: {
      visualStyle: text(input.aiVisualStyle),
      subjectType: text(input.aiSubject),
      composition: text(input.aiComposition),
      direction: text(input.aiDirection),
      quality: text(input.aiQuality)
    }
  };
}

export async function generateDesign(input, context) {
  if (typeof context?.render !== 'function') throw new Error('A design render target is required.');
  return context.render(normalizeDesignInput(input));
}

export function calendarRowToDesignInput(row) {
  return normalizeDesignInput({
    headline: row.headline,
    supportingCopy: row.supportingCopy,
    cta: row.cta,
    style: row.style,
    aiVisualStyle: row.ai?.visualStyle,
    aiSubject: row.ai?.subjectType,
    aiComposition: row.ai?.composition,
    aiDirection: row.ai?.direction,
    aiQuality: row.ai?.quality
  });
}
