import { advancedFields, overrideField, applyTypography } from './typography.js';
import { brand } from './brand.js';

export const freeCompositions = [
  { id: 'clean-editorial', name: 'Clean Editorial', typography: { fontWeight: '400', headlineSize: 'medium', textAlignment: 'left', contentPosition: 'middle-right' } },
  { id: 'bold-impact', name: 'Bold Impact', typography: { fontWeight: '800', headlineSize: 'extra-large', copySize: 'small', textAlignment: 'center', lineSpacing: 'tight', contentPosition: 'center' } },
  { id: 'modern-card', name: 'Modern Card', typography: { fontWeight: '600', headlineSize: 'medium', textAlignment: 'left', letterSpacing: 'normal', contentPosition: 'center' } },
  { id: 'gradient-feature', name: 'Gradient Feature', typography: { fontWeight: '700', headlineSize: 'large', copySize: 'small', textAlignment: 'left', contentPosition: 'bottom-left' } },
  { id: 'split-layout', name: 'Split Layout', typography: { fontWeight: '700', headlineSize: 'medium', copySize: 'small', textAlignment: 'left', contentPosition: 'middle-left' } }
];
// First matching rule wins. Content is inspected but never rewritten.
export function autoComposition(value, hasImage = false) {
  const headline = value.headline.trim(), copy = value.supportingCopy.trim(), cta = value.cta.trim();
  if (hasImage) return 'split-layout';
  if (copy.length > 360 || headline.length + copy.length + cta.length > 500) return 'modern-card';
  if (/\d/.test(headline) && headline.length <= 95) return 'split-layout';
  if (headline.length <= 42 && copy.length <= 140) return 'bold-impact';
  if (headline.length > 95 || copy.length > 180) return 'clean-editorial';
  if (cta && headline.length <= 80) return 'gradient-feature';
  return 'clean-editorial';
}
export function selectComposition(value, hasImage = false) {
  return freeCompositions.find(item => item.id === value.freeVariation) ||
    freeCompositions.find(item => item.id === autoComposition(value, hasImage));
}
export function nextComposition(id) {
  return freeCompositions[(freeCompositions.findIndex(item => item.id === id) + 1) % freeCompositions.length].id;
}
function textColor(value, composition) {
  if (value.freeCustomText === 'on') return value.freeTextColor;
  if (['modern-card', 'split-layout'].includes(composition.id)) return brand.colors.navy;
  if (value.background === 'template') return composition.id === 'gradient-feature' ? brand.colors.white : brand.colors.navy;
  if (value.background === 'image') return value.imageOverlay === 'light' ? brand.colors.navy : brand.colors.white;
  const hex = ({ cream: '#f5f1e8', white: '#ffffff', 'light-blue': '#dff5fe', blue: brand.colors.primaryLight, custom: value.backgroundColor })[value.background] || '#ffffff';
  const rgb = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .35 ? brand.colors.navy : brand.colors.white;
}
export function applyFreeStyle(preview, value, hasImage = false) {
  const composition = selectComposition(value, hasImage);
  preview.dataset.composition = composition.id;
  preview.classList.add('free-' + composition.id);
  const settings = { ...composition.typography };
  for (const key of advancedFields) {
    const override = value[overrideField(key)];
    if (override && override !== 'auto') settings[key] = override;
  }
  applyTypography(preview, settings, textColor(value, composition));
  if (['clean-editorial', 'bold-impact', 'split-layout'].includes(composition.id)) {
    const decoration = document.createElement('div');
    decoration.className = 'template-extra free-decoration';
    decoration.setAttribute('aria-hidden', 'true');
    preview.append(decoration);
  }
  return composition;
}


