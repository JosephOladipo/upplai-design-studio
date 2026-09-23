import { defaultBrandKit, loadBrandKit, validateBrandKit } from './brand-kit.js';

const font = value => `${value || 'Arial'}, Arial, Helvetica, sans-serif`;

export function runtimeBrandFromKit(value) {
  const kit = validateBrandKit(value) ? value : defaultBrandKit;
  return {
    name: kit.brandName,
    colors: { primaryLight: kit.colors.primary, primary: kit.colors.secondary, primaryDeep: kit.colors.secondary, pink: kit.colors.accent, navy: kit.colors.dark, white: kit.colors.light, grey: '#A7B2C2' },
    logoUrl: kit.logos.primary || '/assets/upplai-logo.png',
    fontFamily: font(kit.fonts.body), headingFont: font(kit.fonts.heading), bodyFont: font(kit.fonts.body),
    borderRadius: '12px', cta: { background: 'primary', text: 'navy', borderRadius: '999px' }
  };
}

export const brand = runtimeBrandFromKit(loadBrandKit());

export function refreshBrand() {
  Object.assign(brand, runtimeBrandFromKit(loadBrandKit()));
  applyBrand();
  return brand;
}

export function applyBrand() {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(brand.colors)) root.setProperty(`--${name}`, value);
  root.setProperty('--font-family', brand.fontFamily);
  root.setProperty('--brand-heading-font', brand.headingFont);
  root.setProperty('--brand-body-font', brand.bodyFont);
  root.setProperty('--radius', brand.borderRadius);
  root.setProperty('--cta-background', brand.colors[brand.cta.background]);
  root.setProperty('--cta-text', brand.colors[brand.cta.text]);
  root.setProperty('--cta-radius', brand.cta.borderRadius);
}