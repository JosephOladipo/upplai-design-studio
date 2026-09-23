// Shared, browser-local typography for the fixed 1080 x 1350 canvas.
export const typography = {
  fontStyle: {
    'modern-sans': { label: 'Modern Sans', value: 'Arial, Helvetica, sans-serif' },
    'clean-sans': { label: 'Clean Sans', value: 'Verdana, Geneva, sans-serif' },
    'geometric-sans': { label: 'Geometric Sans', value: '"Century Gothic", "Trebuchet MS", sans-serif' },
    'bold-display': { label: 'Bold Display', value: '"Arial Black", "Franklin Gothic Heavy", sans-serif' },
    'editorial-serif': { label: 'Editorial Serif', value: 'Georgia, "Times New Roman", serif' },
    'elegant-serif': { label: 'Elegant Serif', value: 'Cambria, "Palatino Linotype", Georgia, serif' },
    'condensed-impact': { label: 'Condensed / Impact', value: 'Impact, "Arial Narrow", sans-serif' }
  },
  headlineSize: {
    'extra-small': { label: 'Extra Small', value: 44 }, small: { label: 'Small', value: 58 },
    medium: { label: 'Medium', value: 76 }, large: { label: 'Large', value: 96 },
    'extra-large': { label: 'Extra Large', value: 144 }
  },
  copySize: {
    'extra-small': { label: 'Extra Small', value: 24 }, small: { label: 'Small', value: 28 },
    medium: { label: 'Medium', value: 32 }, large: { label: 'Large', value: 38 },
    'extra-large': { label: 'Extra Large', value: 46 }
  },
  fontWeight: Object.fromEntries([['400', 'Regular'], ['500', 'Medium'], ['600', 'Semi Bold'], ['700', 'Bold'], ['800', 'Extra Bold']].map(([value, label]) => [value, { label, value }])),
  lineSpacing: { tight: { label: 'Tight', value: [1.08, 1.3] }, normal: { label: 'Normal', value: [1.16, 1.45] }, relaxed: { label: 'Relaxed', value: [1.3, 1.65] } },
  letterSpacing: { tight: { label: 'Tight', value: '-.035em' }, normal: { label: 'Normal', value: '0em' }, wide: { label: 'Wide', value: '.045em' } },
  textAlignment: Object.fromEntries(['left', 'center', 'right'].map(value => [value, { label: value[0].toUpperCase() + value.slice(1), value }])),
  contentPosition: {
    'top-left': { label: 'Top Left', value: ['flex-start', 'flex-start'] },
    'top-center': { label: 'Top Center', value: ['center', 'flex-start'] },
    'top-right': { label: 'Top Right', value: ['flex-end', 'flex-start'] },
    'middle-left': { label: 'Middle Left', value: ['flex-start', 'center'] },
    center: { label: 'Center', value: ['center', 'center'] },
    'middle-right': { label: 'Middle Right', value: ['flex-end', 'center'] },
    'bottom-left': { label: 'Bottom Left', value: ['flex-start', 'flex-end'] },
    'bottom-center': { label: 'Bottom Center', value: ['center', 'flex-end'] },
    'bottom-right': { label: 'Bottom Right', value: ['flex-end', 'flex-end'] }
  }
};
export const typographyDefaults = {
  fontStyle: 'modern-sans', headlineSize: 'medium', copySize: 'medium', fontWeight: '700',
  lineSpacing: 'normal', letterSpacing: 'tight', textAlignment: 'left', contentPosition: 'center'
};
export const fitLimits = { headline: 44, copy: 24, cta: 28, gap: 18, scales: [1, .92, .84, .76, .68, .60, .50, .40, .30] };
export const typographyLabels = { fontStyle: 'Font Style / Family', headlineSize: 'Headline Size', copySize: 'Supporting Copy Size', fontWeight: 'Font Weight', lineSpacing: 'Line Spacing', letterSpacing: 'Letter Spacing', textAlignment: 'Text Alignment', contentPosition: 'Content Position' };
export const advancedFields = Object.keys(typography).filter(key => key !== 'contentPosition');
export const overrideField = key => 'free' + key[0].toUpperCase() + key.slice(1);

export function migrateTypography(value) {
  return { ...value, fontStyle: ({ 'bold-sans': 'clean-sans', 'clean-serif': 'elegant-serif' })[value.fontStyle] || value.fontStyle,
    contentPosition: ({ top: 'top-center', bottom: 'bottom-center' })[value.contentPosition] || value.contentPosition };
}
export function resolveTypography(settings, defaults = typographyDefaults) {
  return Object.fromEntries(Object.keys(typography).map(key => [key,
    Object.hasOwn(typography[key], settings[key]) ? settings[key] : defaults[key] || typographyDefaults[key]]));
}
export function clearTypography(preview) {
  for (const name of [...preview.style]) if (name.startsWith('--type-')) preview.style.removeProperty(name);
}
export function applyTypography(preview, settings, color) {
  const resolved = resolveTypography(settings);
  const values = Object.fromEntries(Object.entries(resolved).map(([key, value]) => [key, typography[key][value].value]));
  // A template without a selected font inherits the active Brand Kit.
  // An explicit typography selection still controls both text roles.
  const useBrandFonts = !Object.hasOwn(settings, 'fontStyle') || settings.fontStyle === typographyDefaults.fontStyle;
  const properties = {
    font: useBrandFonts ? 'var(--brand-heading-font, var(--font-family))' : values.fontStyle,
    'heading-font': useBrandFonts ? 'var(--brand-heading-font, var(--font-family))' : values.fontStyle,
    'body-font': useBrandFonts ? 'var(--brand-body-font, var(--font-family))' : values.fontStyle,
    headline: values.headlineSize + 'px', copy: values.copySize + 'px', weight: values.fontWeight,
    'head-leading': values.lineSpacing[0], 'copy-leading': values.lineSpacing[1], tracking: values.letterSpacing,
    alignment: values.textAlignment, items: { left: 'flex-start', center: 'center', right: 'flex-end' }[values.textAlignment],
    anchor: values.contentPosition[0], position: values.contentPosition[1], color, cta: fitLimits.cta + 'px'
  };
  for (const [key, value] of Object.entries(properties)) preview.style.setProperty('--type-' + key, String(value));
  return resolved;
}

