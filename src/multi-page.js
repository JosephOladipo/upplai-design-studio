// Lightweight ordered-page model. Rendering and asset persistence deliberately
// reuse the existing carousel/review infrastructure rather than a second store.
const text = value => String(value || '').trim();
const pageId = () => `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = value => Math.max(2, Math.min(10, Number(value) || 2));
export function createMultiPageDraft(count = 2) {
  return { id: `multi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: '', description: '', designMode: 'native', direction: '', pages: Array.from({ length: clamp(count) }, (_, order) => ({ id: pageId(), order, headline: '', supportingCopy: '', cta: '', style: 'premium-editorial' })) };
}
export function normalizeMultiPage(source = {}) {
  const raw = Array.isArray(source.pages) ? source.pages.slice(0, 10) : [];
  const pages = (raw.length ? raw : createMultiPageDraft(2).pages).map((page, order) => ({ id: text(page.id) || pageId(), order, headline: text(page.headline).slice(0, 180), supportingCopy: text(page.supportingCopy).slice(0, 700), cta: text(page.cta).slice(0, 70), style: text(page.style) || 'premium-editorial', settings: page.settings && typeof page.settings === 'object' ? page.settings : {} }));
  return { id: text(source.id) || `multi-${Date.now()}`, title: text(source.title).slice(0, 180), description: text(source.description).slice(0, 700), designMode: source.designMode === 'full-ai-artwork' || source.designMode === 'visual-native-text' ? source.designMode : 'native', direction: text(source.direction).slice(0, 1200), pages };
}
export function addMultiPage(draft, index) { const next = normalizeMultiPage(draft); if (next.pages.length >= 10) return next; const page = { id: pageId(), order: 0, headline: '', supportingCopy: '', cta: '', style: next.pages[index]?.style || 'premium-editorial', settings: {} }; next.pages.splice(Math.max(0, Math.min(index + 1, next.pages.length)), 0, page); return normalizeMultiPage(next); }
export function deleteMultiPage(draft, index) { const next = normalizeMultiPage(draft); if (next.pages.length <= 2) return next; next.pages.splice(index, 1); return normalizeMultiPage(next); }
export function duplicateMultiPage(draft, index) { const next = normalizeMultiPage(draft); if (next.pages.length >= 10 || !next.pages[index]) return next; next.pages.splice(index + 1, 0, { ...next.pages[index], id: pageId(), settings: { ...next.pages[index].settings } }); return normalizeMultiPage(next); }
export function moveMultiPage(draft, index, direction) { const next = normalizeMultiPage(draft); const target = index + direction; if (target < 0 || target >= next.pages.length) return next; [next.pages[index], next.pages[target]] = [next.pages[target], next.pages[index]]; return normalizeMultiPage(next); }
