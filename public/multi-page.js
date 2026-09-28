import { brand } from '/src/brand.js';
import { designStyles } from '/src/styles.js';
import { createMultiPageDraft, normalizeMultiPage, addMultiPage, deleteMultiPage, duplicateMultiPage, moveMultiPage } from '/src/multi-page.js';
import { downloadPng } from '/src/export.js';
import { loadCalendar, saveCalendar, createManualRow, updateManualRow } from '/src/calendar.js';
import { showProcessing, hideProcessing } from '/src/processing.js';
import { saveCalendarAsset } from '/src/calendar-assets.js';

const q = id => document.getElementById(id);
const MULTI_PAGE_RECOVERY_KEY = 'upplai-design-studio-multi-page-recovery';
let recoveredMulti = null; try { recoveredMulti = JSON.parse(localStorage.getItem(MULTI_PAGE_RECOVERY_KEY)); } catch {}
let draft = normalizeMultiPage(recoveredMulti?.draft || createMultiPageDraft(3));
let selected = Math.min(Number(recoveredMulti?.selected) || 0, draft.pages.length - 1);
let calendarEditingId = null;
const escape = value => String(value || '').replace(/[&<>"']/g, item => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[item]));

function createPage(page, index) {
  if (page.settings?.editedHtml) { const template = document.createElement('template'); template.innerHTML = page.settings.editedHtml; const edited = template.content.firstElementChild; if (edited) return edited; }
  const node = document.createElement('article');
  node.className = 'carousel-slide multi-page-slide';
  node.style.cssText = `--carousel-primary:${brand.colors.primary};--carousel-secondary:${brand.colors.primaryLight};--carousel-accent:${brand.colors.pink};--carousel-text:${brand.colors.navy};--carousel-light:${brand.colors.white};--carousel-heading:${brand.headingFont};--carousel-body:${brand.bodyFont}`;
  node.innerHTML = `<span class="carousel-decoration"></span><div class="carousel-copy"><h2>${escape(page.headline || draft.title || 'Your page headline')}</h2>${page.supportingCopy ? `<p>${escape(page.supportingCopy)}</p>` : ''}${page.cta ? `<span class="carousel-cta">${escape(page.cta)}</span>` : ''}</div><span class="multi-page-number">${index + 1}</span><div class="carousel-brand">${escape(brand.name)}</div>`;
  return node;
}
export async function generateMultiPageDesign(source) {
  const normalized = normalizeMultiPage(source);
  const slides = normalized.pages.map((page, order) => ({ slideId: page.id, order, type: 'page', preview: createPage(page, order) }));
  return { type: 'multi-page', width: 1080, height: 1350, style: normalized.pages[0]?.style || 'premium-editorial', slides };
}
function active() { return draft.pages[selected]; }
function render() {
  draft = normalizeMultiPage(draft); try { localStorage.setItem(MULTI_PAGE_RECOVERY_KEY, JSON.stringify({ draft, selected })); } catch {} selected = Math.min(selected, draft.pages.length - 1);
  const page = active();
  q('multi-page-count').value = String(draft.pages.length);
  q('multi-design-mode').value = draft.designMode;
  q('multi-direction').value = draft.direction;
  q('multi-selected-label').textContent = `Page ${selected + 1} of ${draft.pages.length}`;
  q('multi-headline').value = page.headline; q('multi-copy').value = page.supportingCopy; q('multi-cta').value = page.cta; q('multi-style').value = page.style;
  q('multi-prev').disabled = selected === 0; q('multi-next').disabled = selected === draft.pages.length - 1;
  q('multi-delete').disabled = draft.pages.length <= 2; q('multi-add').disabled = draft.pages.length >= 10;
  q('multi-left').disabled = selected === 0; q('multi-right').disabled = selected === draft.pages.length - 1;
  q('multi-page-preview').replaceChildren(createPage(page, selected));
  q('multi-page-strip').replaceChildren(...draft.pages.map((item, index) => { const b = document.createElement('button'); b.type = 'button'; b.className = `carousel-tab${index === selected ? ' active' : ''}`; b.textContent = `Page ${index + 1}`; b.onclick = () => { selected = index; render(); }; return b; }));
}
for (const style of designStyles.filter(item => item.id !== 'openai-style')) q('multi-style').add(new Option(style.name, style.id));
q('multi-headline').oninput = e => { active().headline = e.target.value; render(); };
q('multi-copy').oninput = e => { active().supportingCopy = e.target.value; render(); };
q('multi-cta').oninput = e => { active().cta = e.target.value; render(); };
q('multi-style').onchange = e => { active().style = e.target.value; render(); };
q('multi-direction').oninput = e => { draft.direction = e.target.value; };
q('multi-design-mode').onchange = e => { draft.designMode = e.target.value; };
q('multi-page-count').onchange = e => { const count = Number(e.target.value); while (draft.pages.length < count) draft = addMultiPage(draft, draft.pages.length - 1); while (draft.pages.length > count) draft = deleteMultiPage(draft, draft.pages.length - 1); render(); };
q('multi-prev').onclick = () => { selected--; render(); }; q('multi-next').onclick = () => { selected++; render(); };
q('multi-add').onclick = () => { draft = addMultiPage(draft, selected); selected++; render(); };
q('multi-delete').onclick = () => { draft = deleteMultiPage(draft, selected); selected = Math.min(selected, draft.pages.length - 1); render(); };
q('multi-duplicate').onclick = () => { draft = duplicateMultiPage(draft, selected); selected++; render(); };
q('multi-left').onclick = () => { draft = moveMultiPage(draft, selected, -1); selected--; render(); };
q('multi-right').onclick = () => { draft = moveMultiPage(draft, selected, 1); selected++; render(); };
q('multi-generate').onclick = async () => {
  const button = q('multi-generate'); const status = q('multi-page-status'); const prompt = q('multi-direction').value.trim();
  if (!prompt) { status.textContent = 'Add a multi-page prompt or creative direction first.'; return; }
  button.disabled = true; showProcessing({ title: 'Generating your multi-page design…', message: 'Creating the ordered page structure.' });
  try {
    const response = await fetch('/api/ai/generate-multi-page-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, pageCount: Number(q('multi-page-count').value), direction: prompt, renderMode: q('multi-design-mode').value }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Multi-page generation failed.');
    draft = normalizeMultiPage({ ...draft, title: data.multiPage.title, description: data.multiPage.description, direction: prompt, designMode: q('multi-design-mode').value, pages: data.multiPage.pages }); selected = 0; render(); status.textContent = 'Multi-page design is ready to edit.';
  } catch (error) { status.textContent = error.message || 'Multi-page generation failed. Your current pages are unchanged.'; }
  finally { hideProcessing(); button.disabled = false; }
};
async function exportPage(index) { const node = createPage(draft.pages[index], index); await downloadPng(node, 'multi-page', `upplai-multi-page-${String(index + 1).padStart(2, '0')}.png`); }

q('multi-edit-page').onclick = () => {
  const source = createPage(active(), selected);
  document.dispatchEvent(new CustomEvent('multi-page:builder-page-edit', { detail: { draft: normalizeMultiPage(draft), pageIndex: selected, preview: source } }));
};
q('multi-download-current').onclick = () => exportPage(selected);
q('multi-download-all').onclick = async () => { q('multi-download-all').disabled = true; try { for (let i = 0; i < draft.pages.length; i++) await exportPage(i); } finally { q('multi-download-all').disabled = false; } };
q('multi-send-publishing').onclick = async () => {
  const button = q('multi-send-publishing');
  if (button.disabled) return;
  button.disabled = true;
  showProcessing({ title: 'Preparing multi-page design…', message: 'Saving pages in their current order for Publishing.' });
  try {
    const source = normalizeMultiPage(draft);
    const result = await generateMultiPageDesign(source);
    const resultRef = `multi-page-builder:${source.id}`;
    await saveCalendarAsset(resultRef, result);
    document.dispatchEvent(new CustomEvent('publishing:generated', { detail: {
      resultRef,
      source: 'create',
      contentType: 'multi-page',
      designMode: source.designMode || 'native',
      headline: source.title || source.pages[0]?.headline || 'Multi-page design',
      supportingCopy: source.description || '',
      cta: source.pages.at(-1)?.cta || '',
      multiPage: source
    } }));
  } catch (error) {
    q('multi-page-status').textContent = error.message || 'Could not prepare the multi-page design for Publishing.';
  } finally {
    hideProcessing();
    button.disabled = false;
  }
};q('multi-save-calendar').onclick = () => { const date = prompt('Calendar date (YYYY-MM-DD):', new Date().toLocaleDateString('en-CA')); if (!date) return; const rows = loadCalendar()?.rows || []; const input = { date, headline: draft.title || active().headline || 'Multi-page design', supportingCopy: draft.description, cta: active().cta, style: active().style, contentFormat: 'multi-page', multiPage: draft }; const index = rows.findIndex(row => row.id === calendarEditingId); const result = index < 0 ? createManualRow(input, rows) : updateManualRow(rows[index], input); if (!result.row) return; saveCalendar(index < 0 ? [...rows, result.row] : rows.map((row, i) => i === index ? result.row : row)); calendarEditingId = result.row.id; document.dispatchEvent(new Event('calendar:changed')); document.dispatchEvent(new Event('navigate:calendar')); };
document.addEventListener('calendar:edit', event => { const context = event.detail?.context; const row = context?.contentType === 'multi-page' && context.calendarItemId === event.detail?.id ? context.row : (loadCalendar()?.rows || []).find(item => item.id === event.detail?.id); if (!row || row.contentFormat !== 'multi-page') return; draft = normalizeMultiPage(row.multiPage); calendarEditingId = context?.calendarItemId || row.id; selected = Number(context?.pageOrSlideIndex) || 0; q('multi-page-builder').hidden = false; q('carousel-builder').hidden = true; q('generator').closest('.controls').hidden = true; q('create-preview-panel').hidden = true; document.querySelectorAll('[data-content-type]').forEach(button => button.classList.toggle('active', button.dataset.contentType === 'multi-page')); render(); document.dispatchEvent(new Event('navigate:create')); });
document.querySelectorAll('[data-content-type]').forEach(button => button.addEventListener('click', () => { if (button.dataset.contentType !== 'multi-page') return; q('multi-page-builder').hidden = false; q('carousel-builder').hidden = true; q('generator').closest('.controls').hidden = true; q('create-preview-panel').hidden = true; render(); }));
render();

document.addEventListener('multi-page:builder-page-saved', event => { const next = event.detail?.draft; const index = event.detail?.pageIndex; const html = event.detail?.preview?.outerHTML; if (!next || !Number.isInteger(index) || !html) return; draft = normalizeMultiPage(next); if (!draft.pages[index]) return; draft.pages[index].settings = { ...(draft.pages[index].settings || {}), editedHtml: html }; selected = index; render(); });
document.addEventListener('multi-page:builder-page-preview', event => { const index = event.detail?.pageIndex; if (!Number.isInteger(index) || !draft.pages[index]) return; event.detail?.resolve?.({ draft: normalizeMultiPage(draft), preview: createPage(draft.pages[index], index) }); });
