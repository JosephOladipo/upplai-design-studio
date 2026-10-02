// Server-side normalization for the text-only Brand Kit context used by AI planning.
const colorKeys = ['primary', 'secondary', 'accent', 'dark', 'light'];
const text = value => typeof value === 'string' ? value.trim() : '';
const safeName = value => /^[\p{L}\p{N} .,&'()-]{1,80}$/u.test(value) ? value : '';
const safeFont = value => /^[A-Za-z0-9 ,."'()_-]{1,120}$/.test(value) ? value : '';

export function normalizeBrandContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const brandName = text(value.brandName);
  const heading = text(value.fonts?.heading);
  const body = text(value.fonts?.body);
  const aiInstruction = text(value.aiInstruction);

  if (!safeName(brandName) || !safeFont(heading) || !safeFont(body)) return null;

  if (aiInstruction.length > 2000) return null;

  const colors = {};

  for (const key of colorKeys) {
    const color = text(value.colors?.[key]);

    if (!/^#[0-9a-f]{6}$/i.test(color)) return null;

    colors[key] = color.toUpperCase();
  }

  return {
    brandName,
    aiInstruction,
    colors,
    fonts: {
      heading,
      body
    }
  };
}

export function brandVisualDirection(brand) {
  if (!brand) return 'No active brand palette was supplied.';

  const { colors, fonts } = brand;

  const baseDirection =
    `Active brand visual direction: ${JSON.stringify(brand.brandName)}. ` +
    `Primary ${colors.primary}, secondary ${colors.secondary}, accent ${colors.accent}, ` +
    `dark ${colors.dark}, light ${colors.light}. ` +
    `Use the brand palette as a recognizable part of the visual identity while still allowing ` +
    `appropriate neutral and complementary colors. ` +
    `${JSON.stringify(fonts.heading)} and ${JSON.stringify(fonts.body)} describe visual tone only.`;

  const customDirection = brand.aiInstruction
    ? ` Permanent brand instruction: ${brand.aiInstruction}`
    : '';

  return baseDirection + customDirection;
}