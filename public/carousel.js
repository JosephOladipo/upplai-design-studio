import { brand } from '/src/brand.js';
import { downloadPng } from '/src/export.js';
import { loadCalendar, saveCalendar, createManualRow, updateManualRow } from '/src/calendar.js';
import { carouselStyles, loadCarouselDraft, saveCarouselDraft, createCarouselDraft, normalizeCarousel, addSlide, duplicateSlide, deleteSlide, moveSlide, slideFitWarning } from '/src/carousel.js';

const q = id => document.getElementById(id);
let draft = loadCarouselDraft();
let selected = 0;
let calendarEditingId = null;
const builder = q('carousel-builder');
const generator = q('generator');
const standardPreview = q('create-preview-panel');

function persist() { draft = saveCarouselDraft(draft); }
function active() { return draft.slides[selected]; }
function escape(value = '') { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
export function createCarouselSlide(sourceDraft, index = 0) {
  const carousel = normalizeCarousel(sourceDraft); const slide = carousel.slides[index]; const total = carousel.slides.length;
  if (!slide) throw new Error('Carousel slide is unavailable.');
  const type = slide.type; const style = carousel.style;
  const progress = type === 'content' ? `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : type === 'cover' ? 'START HERE' : brand.name.toUpperCase();
  const logo = brand.logoUrl ? `<img class="carousel-logo" src="${escape(brand.logoUrl)}" alt="${escape(brand.name)}">` : `<span class="carousel-logo-text">${escape(brand.name)}</span>`;
  const cta = slide.cta ? `<span class="carousel-cta">${escape(slide.cta)}</span>` : '';
  const template = document.createElement('template');
  template.innerHTML = `<article class="carousel-slide carousel-${style} carousel-${type}" style="--carousel-primary:${brand.colors.primary};--carousel-secondary:${brand.colors.primaryLight};--carousel-accent:${brand.colors.pink};--carousel-text:${brand.colors.navy};--carousel-light:${brand.colors.white};--carousel-heading:${brand.headingFont};--carousel-body:${brand.bodyFont}"><div class="carousel-progress">${progress}</div><div class="carousel-copy"><h2>${escape(slide.headline || carousel.title || 'Your carousel headline')}</h2>${slide.body || carousel.description ? `<p>${escape(slide.body || carousel.description)}</p>` : ''}${cta}</div><div class="carousel-brand">${logo}</div></article>`;
  return template.content.firstElementChild;
}
export async function generateCarouselDesign(sourceDraft) {
  const carousel = normalizeCarousel(sourceDraft);
  const slides = [];
  for (let index = 0; index < carousel.slides.length; index += 1) {
    if (slideFitWarning(carousel.slides[index])) throw new Error(`Slide ${index + 1} is too long for this carousel design.`);
    slides.push({ slideId: carousel.slides[index].id, order: index, type: carousel.slides[index].type, preview: createCarouselSlide(carousel, index) });
  }
  return { type: 'carousel', width: 1080, height: 1350, style: carousel.style, slides };
}
function renderPreview() { q('carousel-preview').replaceChildren(createCarouselSlide(draft, selected)); q('carousel-warning').hidden = !slideFitWarning(active()); }function renderEditor() {
  const slide = active();
  q('carousel-title').value = draft.title;
  q('carousel-description').value = draft.description;
  q('carousel-style').value = draft.style;
  q('carousel-selected-label').textContent = `Slide ${selected + 1} — ${slide.type === 'cta' ? 'CTA' : slide.type[0].toUpperCase() + slide.type.slice(1)}`;
  q('carousel-slide-headline').value = slide.headline;
  q('carousel-slide-body').value = slide.body;
  q('carousel-slide-cta-wrap').hidden = slide.type !== 'cta';
  q('carousel-slide-cta').value = slide.cta;
  q('carousel-prev').disabled = selected === 0; q('carousel-next').disabled = selected === draft.slides.length - 1;
  q('carousel-add').disabled = draft.slides.length >= 10;
  q('carousel-delete').disabled = draft.slides.length <= 2;
  q('carousel-left').disabled = selected === 0; q('carousel-right').disabled = selected === draft.slides.length - 1;
  q('carousel-strip').replaceChildren(...draft.slides.map((item, index) => { const button = document.createElement('button'); button.type = 'button'; button.className = `carousel-tab${index === selected ? ' active' : ''}`; button.textContent = `${index + 1}${item.type === 'cover' ? ' Cover' : item.type === 'cta' ? ' CTA' : ''}`; button.onclick = () => { selected = index; render(); }; return button; }));
  renderPreview();
}
function render() { draft = normalizeCarousel(draft); selected = Math.min(selected, draft.slides.length - 1); renderEditor(); persist(); }
function updateSlide(field, value) { draft.slides[selected][field] = value; render(); }
q('carousel-title').oninput = event => { draft.title = event.target.value; render(); };
q('carousel-description').oninput = event => { draft.description = event.target.value; render(); };
q('carousel-style').onchange = event => { draft.style = event.target.value; draft.theme.style = event.target.value; render(); };
q('carousel-slide-headline').oninput = event => updateSlide('headline', event.target.value);
q('carousel-slide-body').oninput = event => updateSlide('body', event.target.value);
q('carousel-slide-cta').oninput = event => updateSlide('cta', event.target.value);
q('carousel-prev').onclick = () => { selected -= 1; render(); }; q('carousel-next').onclick = () => { selected += 1; render(); };
q('carousel-add').onclick = () => { draft = addSlide(draft, selected); selected += 1; render(); };
q('carousel-duplicate').onclick = () => { draft = duplicateSlide(draft, selected); selected += 1; render(); };
q('carousel-delete').onclick = () => { draft = deleteSlide(draft, selected); selected = Math.min(selected, draft.slides.length - 1); render(); };
q('carousel-left').onclick = () => { draft = moveSlide(draft, selected, -1); selected -= 1; render(); };
q('carousel-right').onclick = () => { draft = moveSlide(draft, selected, 1); selected += 1; render(); };
q('carousel-new').onclick = () => { if (draft.title || draft.slides.some(item => item.headline || item.body || item.cta)) { if (!confirm('Start a new carousel and discard this draft?')) return; } draft = createCarouselDraft(); calendarEditingId = null; selected = 0; render(); };
q('carousel-save-calendar').onclick = () => {
  const date = prompt('Calendar date (YYYY-MM-DD):', new Date().toLocaleDateString('en-CA'));
  if (!date) return;
  const existing = loadCalendar()?.rows || [];
  const input = { date, headline: draft.title || active().headline || 'Carousel', supportingCopy: draft.description, cta: draft.slides.at(-1)?.cta || '', style: 'premium-editorial', contentFormat: 'carousel', carousel: draft };
  const index = existing.findIndex(row => row.id === calendarEditingId);
  const result = index < 0 ? createManualRow(input, existing) : updateManualRow(existing[index], input);
  if (!result.row) { alert(result.errors?.join(' ') || 'Carousel could not be saved to Calendar.'); return; }
  saveCalendar(index < 0 ? [...existing, result.row] : existing.map((row, i) => i === index ? result.row : row));
  calendarEditingId = result.row.id;
  document.dispatchEvent(new Event('calendar:changed'));
  document.dispatchEvent(new Event('navigate:calendar'));
};
document.addEventListener('calendar:edit', event => {
  const row = (loadCalendar()?.rows || []).find(item => item.id === event.detail?.id);
  if (!row || row.contentFormat !== 'carousel') return;
  draft = normalizeCarousel(row.carousel); calendarEditingId = row.id; selected = 0;
  document.querySelector('[data-content-type="carousel"]').click();
  document.dispatchEvent(new Event('navigate:create'));
});
async function exportSlide(index) { const previous = selected; selected = index; render(); await downloadPng(q('carousel-preview').firstElementChild, 'carousel', `upplai-carousel-${String(index + 1).padStart(2, '0')}.png`); selected = previous; render(); }
q('carousel-download-current').onclick = () => exportSlide(selected);
q('carousel-download-all').onclick = async () => { q('carousel-download-all').disabled = true; try { for (let index = 0; index < draft.slides.length; index += 1) await exportSlide(index); } finally { q('carousel-download-all').disabled = false; } };
document.querySelectorAll('[data-content-type]').forEach(button => button.onclick = () => { const carousel = button.dataset.contentType === 'carousel'; builder.hidden = !carousel; generator.hidden = carousel; standardPreview.hidden = carousel; document.querySelectorAll('[data-content-type]').forEach(item => item.classList.toggle('active', item === button)); if (carousel) render(); });
render();