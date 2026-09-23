// Server-side normalization for the small, text-only Brand Kit context used by AI planning.
const colorKeys = ['primary', 'secondary', 'accent', 'dark', 'light'];
const text = value => typeof value === 'string' ? value.trim() : '';
const safeName = value => /^[\p{L}\p{N} .,&'()-]{1,80}$/u.test(value) ? value : '';
const safeFont = value => /^[A-Za-z0-9 ,."'()_-]{1,120}$/.test(value) ? value : '';

export function normalizeBrandContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const brandName = text(value.brandName);
  const heading = text(value.fonts?.heading);
  const body = text(value.fonts?.body);
  if (!safeName(brandName) || !safeFont(heading) || !safeFont(body)) return null;
  const colors = {};
  for (const key of colorKeys) {
    const color = text(value.colors?.[key]);
    if (!/^#[0-9a-f]{6}$/i.test(color)) return null;
    colors[key] = color.toUpperCase();
  }
  return { brandName, colors, fonts: { heading, body } };
}

export function brandVisualDirection(brand) {
  if (!brand) return 'No active brand palette was supplied.';
  const { colors, fonts } = brand;
  return `Active brand visual direction: ${JSON.stringify(brand.brandName)}. Use its palette subtly where it supports the chosen concept: primary ${colors.primary}, secondary ${colors.secondary}, accent ${colors.accent}, dark ${colors.dark}, light ${colors.light}. Favor lighting, environmental details, gradients, props, or abstract accents over a flat color poster. Do not force every color into the image. ${JSON.stringify(fonts.heading)} and ${JSON.stringify(fonts.body)} describe visual tone only; never render typography, letters, or the brand name.`;
}
