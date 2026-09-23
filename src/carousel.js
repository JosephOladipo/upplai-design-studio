import { brand } from './brand.js';

export const CAROUSEL_KEY = 'upplai-design-studio-carousel-draft';
export const carouselStyles = [
  { id: 'minimal-editorial', name: 'Minimal Editorial' },
  { id: 'bold-cards', name: 'Bold Cards' },
  { id: 'brand-gradient', name: 'Brand Gradient' }
];
const uid = () => `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slide = (type, order) => ({ id: uid(), type, headline: '', body: '', cta: '', order, settings: {} });

export function carouselTheme(style = 'minimal-editorial') {
  return { style, background: 'auto', primaryColor: brand.colors.primary, secondaryColor: brand.colors.primaryLight, accentColor: brand.colors.pink, textColor: brand.colors.navy, headingFont: brand.headingFont, bodyFont: brand.bodyFont, logoPosition: 'auto', decorativeVariant: 'default' };
}
export function createCarouselDraft() {
  return { id: `carousel-${Date.now()}`, title: '', description: '', style: 'minimal-editorial', theme: carouselTheme(), slides: [slide('cover', 0), slide('content', 1), slide('content', 2), slide('content', 3), slide('cta', 4)] };
}
export function normalizeCarousel(draft) {
  const base = draft && typeof draft === 'object' ? draft : createCarouselDraft();
  const slides = Array.isArray(base.slides) ? base.slides.slice(0, 10) : [];
  while (slides.length < 2) slides.push(slide(slides.length === 0 ? 'cover' : 'cta', slides.length));
  return { ...createCarouselDraft(), ...base, style: carouselStyles.some(item => item.id === base.style) ? base.style : 'minimal-editorial', theme: { ...carouselTheme(base.style), ...(base.theme || {}) }, slides: slides.map((item, index) => ({ ...slide(index === 0 ? 'cover' : index === slides.length - 1 ? 'cta' : 'content', index), ...item, order: index })) };
}
export function addSlide(draft, afterIndex) { const next = normalizeCarousel(draft); if (next.slides.length >= 10) return next; const index = Math.min(Math.max(Number(afterIndex) + 1 || next.slides.length, 1), next.slides.length); next.slides.splice(index, 0, slide('content', index)); return normalizeCarousel(next); }
export function duplicateSlide(draft, index) { const next = normalizeCarousel(draft); if (next.slides.length >= 10 || !next.slides[index]) return next; const copy = { ...next.slides[index], id: uid(), settings: { ...next.slides[index].settings } }; next.slides.splice(index + 1, 0, copy); return normalizeCarousel(next); }
export function deleteSlide(draft, index) { const next = normalizeCarousel(draft); if (next.slides.length <= 2) return next; next.slides.splice(index, 1); return normalizeCarousel(next); }
export function moveSlide(draft, index, direction) { const next = normalizeCarousel(draft); const target = index + direction; if (target < 0 || target >= next.slides.length) return next; [next.slides[index], next.slides[target]] = [next.slides[target], next.slides[index]]; return normalizeCarousel(next); }
export function slideFitWarning(slide) { return String(slide?.headline || '').length > 180 || String(slide?.body || '').length > 700 || String(slide?.cta || '').length > 70; }
export function loadCarouselDraft(storage = localStorage) { try { return normalizeCarousel(JSON.parse(storage.getItem(CAROUSEL_KEY))); } catch { return createCarouselDraft(); } }
export function saveCarouselDraft(draft, storage = localStorage) { const normalized = normalizeCarousel(draft); storage.setItem(CAROUSEL_KEY, JSON.stringify(normalized)); return normalized; }