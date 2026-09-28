import { brand } from './brand.js';

export const CAROUSEL_KEY = 'upplai-design-studio-carousel-draft';
export const CAROUSEL_DRAFTS_KEY = 'upplai-design-studio-carousel-drafts-v1';
export const carouselStyles = [
  { id: 'minimal-editorial', name: 'Minimal Editorial' },
  { id: 'swipe-guide', name: 'Swipe Guide' },
  { id: 'numbered-steps', name: 'Numbered Steps' },
  { id: 'bold-cards', name: 'Bold Cards' },
  { id: 'brand-gradient', name: 'Brand Gradient' },
  { id: 'modern-magazine', name: 'Modern Magazine' },
  { id: 'progress-story', name: 'Progress Story' },
  { id: 'data-insight', name: 'Data / Insight' },
  { id: 'clean-brand', name: 'Clean Brand' }
];
export const carouselTemplates = carouselStyles;
export const carouselRoles = [
  'cover', 'context', 'insight', 'list',
  'stat', 'visual', 'conclusion', 'cta'
];
const uid = () => `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slide = (type, order) => ({ id: uid(), type, headline: '', body: '', cta: '', order, settings: {} });

export function roleSequence(count) {
  const sequences = {
    2: ['cover', 'cta'],
    3: ['cover', 'insight', 'cta'],
    4: ['cover', 'context', 'insight', 'cta'],
    5: ['cover', 'context', 'insight', 'list', 'cta'],
    6: ['cover', 'context', 'insight', 'list', 'conclusion', 'cta'],
    7: ['cover', 'context', 'insight', 'list', 'stat', 'conclusion', 'cta'],
    8: ['cover', 'context', 'insight', 'list', 'visual', 'stat', 'conclusion', 'cta']
  };
  if (sequences[count]) return sequences[count];
  const middle = count >= 9
    ? ['context', 'insight', 'list', 'visual', 'stat', 'insight', 'conclusion', 'list']
    : ['insight'];
  return ['cover', ...middle.slice(0, Math.max(0, count - 2)), 'cta'];
}

export function carouselTheme(style = 'minimal-editorial') {
  return { style, background: 'auto', primaryColor: brand.colors.primary, secondaryColor: brand.colors.primaryLight, accentColor: brand.colors.pink, textColor: brand.colors.navy, headingFont: brand.headingFont, bodyFont: brand.bodyFont, logoPosition: 'auto', decorativeVariant: 'default' };
}
export function createCarouselDraft() {
  return { id: `carousel-${Date.now()}`, title: '', description: '', style: 'minimal-editorial', theme: carouselTheme(), slides: roleSequence(5).map((type, order) => slide(type, order)) };
}
export function normalizeCarousel(draft) {
  const base = draft && typeof draft === 'object' ? draft : createCarouselDraft();
  const slides = Array.isArray(base.slides) ? base.slides.slice(0, 10) : [];
  while (slides.length < 2) slides.push(slide(slides.length === 0 ? 'cover' : 'cta', slides.length));
  const roles = roleSequence(slides.length);
  return { ...createCarouselDraft(), ...base, style: carouselStyles.some(item => item.id === base.style) ? base.style : 'minimal-editorial', theme: { ...carouselTheme(base.style), ...(base.theme || {}) }, slides: slides.map((item, index) => {
    const migrated = item.type === 'content' || !carouselRoles.includes(item.type);
    return { ...slide(roles[index], index), ...item, type: migrated ? roles[index] : item.type, order: index };
  }) };
}
export function addSlide(draft, afterIndex) { const next = normalizeCarousel(draft); if (next.slides.length >= 10) return next; const index = Math.min(Math.max(Number(afterIndex) + 1 || next.slides.length, 1), next.slides.length); next.slides.splice(index, 0, slide('insight', index)); return normalizeCarousel(next); }
export function duplicateSlide(draft, index) { const next = normalizeCarousel(draft); if (next.slides.length >= 10 || !next.slides[index]) return next; const copy = { ...next.slides[index], id: uid(), settings: { ...next.slides[index].settings } }; next.slides.splice(index + 1, 0, copy); return normalizeCarousel(next); }
export function deleteSlide(draft, index) { const next = normalizeCarousel(draft); if (next.slides.length <= 2) return next; next.slides.splice(index, 1); return normalizeCarousel(next); }
export function moveSlide(draft, index, direction) { const next = normalizeCarousel(draft); const target = index + direction; if (target < 0 || target >= next.slides.length) return next; [next.slides[index], next.slides[target]] = [next.slides[target], next.slides[index]]; return normalizeCarousel(next); }
export function slideFitWarning(slide) { return String(slide?.headline || '').length > 180 || String(slide?.body || '').length > 700 || String(slide?.cta || '').length > 70; }
// Browser storage contains only draft metadata. Generated/imported image data is
// stored in IndexedDB and referenced through visualAssetId/importAssetId.
export function lightweightCarousel(draft) {
  const normalized = normalizeCarousel(draft);
  return { ...normalized, slides: normalized.slides.map(item => {
    const settings = { ...(item.settings || {}) };
    delete settings.aiVisual;
    delete settings.importedData;
    return { ...item, settings };
  }) };
}
export function loadCarouselDraft(storage = localStorage) { try { return normalizeCarousel(JSON.parse(storage.getItem(CAROUSEL_KEY))); } catch { return createCarouselDraft(); } }
export function saveCarouselDraft(draft, storage = localStorage) { const normalized = lightweightCarousel(draft); storage.setItem(CAROUSEL_KEY, JSON.stringify(normalized)); return normalized; }
const safeProject = value => {
  try {
    const draft = lightweightCarousel(value?.carousel || value);
    return { id: String(value?.id || draft.id), name: String(value?.name || draft.title || 'Untitled Carousel').slice(0, 180), carousel: draft, selectedSlide: Math.max(0, Math.min(Number(value?.selectedSlide) || 0, draft.slides.length - 1)), createdAt: value?.createdAt || new Date().toISOString(), updatedAt: value?.updatedAt || new Date().toISOString() };
  } catch { return null; }
};
export function loadSavedCarousels(storage = localStorage) { try { const raw = JSON.parse(storage.getItem(CAROUSEL_DRAFTS_KEY)); return Array.isArray(raw?.drafts) ? raw.drafts.map(safeProject).filter(Boolean).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) : []; } catch { return []; } }
export function saveSavedCarousels(drafts, storage = localStorage) { const safe = (Array.isArray(drafts) ? drafts : []).map(safeProject).filter(Boolean); const serialized = JSON.stringify({ version: 1, drafts: safe }); if (serialized.length > 1024 * 1024) throw new Error('Saved carousel drafts are too large for browser storage. Remove large uploaded images before saving.'); storage.setItem(CAROUSEL_DRAFTS_KEY, serialized); return safe; }
export function saveCarouselProject(project, storage = localStorage) { const next = safeProject({ ...project, updatedAt: new Date().toISOString() }); if (!next) return null; const drafts = loadSavedCarousels(storage); const index = drafts.findIndex(item => item.id === next.id); if (index >= 0) { next.createdAt = drafts[index].createdAt; drafts[index] = next; } else drafts.unshift(next); saveSavedCarousels(drafts, storage); return next; }
export function duplicateCarouselProject(project, storage = localStorage) { const source = safeProject(project); if (!source) return null; const copy = safeProject({ ...source, id: `carousel-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, name: `${source.name} — Copy`, carousel: { ...source.carousel, id: `carousel-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, slides: source.carousel.slides.map(item => ({ ...item, id: uid(), settings: { ...item.settings } })) }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); saveCarouselProject(copy, storage); return copy; }
export function removeCarouselProject(id, storage = localStorage) { const drafts = loadSavedCarousels(storage).filter(item => item.id !== id); saveSavedCarousels(drafts, storage); }
