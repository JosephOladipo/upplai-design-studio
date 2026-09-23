import {
  loadCalendar, saveCalendar, calendarSummary, localDateKey, normalizeStatus,
  rowsInOrder, selectAllRows, selectTodayRows, selectUngeneratedRows, getSelectedRowsInOrder
} from '/src/calendar.js';
import { createCalendarQueue, todayEligibleIds } from '/src/calendar-generation.js';
import { calendarResultRef, saveCalendarAsset, loadCalendarAsset, removeCalendarAsset } from '/src/calendar-assets.js';
import { generateCalendarDesign } from '/app.js';
import { generateCarouselDesign } from '/carousel.js';
import { downloadPng, previewPngBlob } from '/src/export.js';

const labels = { ready: 'Ready', generating: 'Generating', generated: 'Generated', failed: 'Failed', stale: 'Stale', skipped: 'Skipped' };
const human = value => value === 'none' ? 'No Main Subject' : value === '3d' ? '3D' : value === 'auto' ? 'Auto' : String(value || 'Auto').replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase());
const dateLabel = date => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`));
const empty = document.getElementById('calendar-empty');
const workspace = document.getElementById('calendar-workspace');
const clearButton = document.getElementById('clear-calendar');
const table = document.getElementById('calendar-table-body');
const summary = document.getElementById('calendar-summary');
const eligible = document.getElementById('calendar-eligible-count');
const details = document.getElementById('calendar-details');
const calendarStatus = document.getElementById('calendar-status');
const generateSelected = document.getElementById('generate-selected-calendar');
const generateToday = document.getElementById('generate-today-calendar');
const selectionButtons = ['select-all-calendar', 'select-today-calendar', 'select-ungenerated-calendar', 'clear-calendar-selection'].map(id => document.getElementById(id));
const review = document.getElementById('calendar-review');
const reviewEmpty = document.getElementById('calendar-review-empty');
const reviewSelect = document.getElementById('calendar-review-select');
const reviewPrevious = document.getElementById('review-previous');
const reviewNext = document.getElementById('review-next');
const reviewCount = document.getElementById('calendar-review-count');
const reviewPosition = document.getElementById('calendar-review-position');
const reviewPreview = document.getElementById('calendar-review-preview');
const reviewMeta = document.getElementById('calendar-review-meta');
const reviewMessage = document.getElementById('calendar-review-message');
const reviewDownload = document.getElementById('download-calendar-review');
const reviewRegenerate = document.getElementById('regenerate-calendar-review');
let selectedIds = new Set();
let detailId = null;
let reviewId = null;
let reviewObjectUrl = null;
const sessionResults = new Map();
const generateCalendarRow = row => row.contentFormat === 'carousel' ? generateCarouselDesign(row.carousel) : generateCalendarDesign(row);
const queue = createCalendarQueue(generateCalendarRow);

function rows() { return rowsInOrder(loadCalendar()?.rows || []); }
export function getSelectedRowsInOrderForCalendar() { return getSelectedRowsInOrder(rows(), selectedIds); }
function hasReview(row) { return Boolean(sessionResults.get(row.id)?.preview || row.resultRef); }

document.addEventListener('click', event => {
  if (!event.target.closest('.calendar-action-menu')) closeActionMenus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeActionMenus();
});
function render() {
  const currentRows = rows();
  const loaded = currentRows.length > 0;
  empty.hidden = loaded; workspace.hidden = !loaded; clearButton.hidden = !loaded;
  if (!loaded) { table.replaceChildren(); summary.replaceChildren(); details.hidden = true; return; }
  const info = calendarSummary(currentRows, selectedIds, localDateKey());
  const values = [[`${info.total} Posts`, 'total'], [`${info.today} Today`, 'today'], [`${info.byStatus.ready} Ready`, 'ready'], [`${info.byStatus.generated} Generated`, 'generated'], [`${info.selected} Selected`, 'selected']];
  summary.replaceChildren(...values.map(([text, name]) => { const item = document.createElement('span'); item.dataset.summary = name; item.textContent = text; return item; }));
  eligible.textContent = String(info.eligibleToday);
  generateSelected.disabled = queue.running || info.selected === 0;
  generateToday.disabled = queue.running || info.eligibleToday === 0;
  selectionButtons.forEach(button => { button.disabled = queue.running; });
  table.replaceChildren(...currentRows.map(rowElement));
  renderDetails(currentRows.find(row => row.id === detailId));
}

function closeActionMenus(except) {
  document.querySelectorAll('.calendar-action-menu[open]').forEach(menu => {
    if (menu !== except) menu.removeAttribute('open');
  });
}

function menuItem(label, action) {
  const item = document.createElement('button');
  item.type = 'button'; item.setAttribute('role', 'menuitem'); item.textContent = label;
  item.addEventListener('click', () => { closeActionMenus(); action(); });
  return item;
}

function rowElement(row) {
  const item = document.createElement('tr');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox'; checkbox.checked = selectedIds.has(row.id); checkbox.disabled = queue.running; checkbox.setAttribute('aria-label', `Select ${row.headline}`);
  checkbox.addEventListener('change', () => { checkbox.checked ? selectedIds.add(row.id) : selectedIds.delete(row.id); render(); });
  const select = document.createElement('td'); select.append(checkbox);
  const date = document.createElement('td'); date.textContent = dateLabel(row.date);
  const headline = document.createElement('td'); headline.className = 'calendar-headline'; headline.title = row.headline; headline.textContent = row.headline;
  const method = document.createElement('td'); method.textContent = human(row.style);
  if (row.style === 'openai-style') { const ai = document.createElement('span'); ai.className = 'calendar-ai-badge'; ai.textContent = 'AI'; method.append(ai); }
  const format = document.createElement('td'); const formatBadge = document.createElement('span'); formatBadge.className = 'calendar-format-badge'; formatBadge.textContent = row.contentFormat === 'carousel' ? 'Carousel' : 'Single'; format.append(formatBadge);
  const state = document.createElement('td'); const badge = document.createElement('span'); const value = normalizeStatus(row.status); badge.className = 'calendar-status-badge'; badge.dataset.status = value; badge.textContent = labels[value]; state.append(badge);
  const action = document.createElement('td'); action.className = 'calendar-row-actions';
  const menu = document.createElement('details'); menu.className = 'calendar-action-menu';
  const trigger = document.createElement('summary'); trigger.textContent = 'Actions'; trigger.setAttribute('aria-label', `Actions for ${row.headline}`);
  trigger.addEventListener('click', () => setTimeout(() => closeActionMenus(menu), 0));
  const items = document.createElement('div'); items.className = 'calendar-action-menu-items'; items.setAttribute('role', 'menu');
  const canReview = hasReview(row) || ['generated', 'stale', 'failed'].includes(value);
  if (canReview) items.append(menuItem('View design', () => { openReview(row); document.dispatchEvent(new Event('navigate:review')); }));
  items.append(menuItem('Edit content', () => document.dispatchEvent(new CustomEvent('calendar:edit', { detail: { id: row.id } }))));
  if (['ready', 'stale'].includes(value)) items.append(menuItem(value === 'stale' ? 'Regenerate' : 'Generate', () => runCalendarQueue(new Set([row.id]), 'Selected')));
  if (canReview && value === 'generated') items.append(menuItem('Regenerate', () => { reviewId = row.id; regenerateReview(); }));
  if (canReview && row.contentFormat !== 'carousel') {
    items.append(menuItem('Send to Publish', () => document.dispatchEvent(new CustomEvent('publishing:generated', { detail: row }))));
    items.append(menuItem('Download PNG', () => downloadRow(row)));
  }
  items.append(menuItem('Delete', () => document.dispatchEvent(new CustomEvent('calendar:delete', { detail: { id: row.id, resultRef: row.resultRef } }))));
  menu.append(trigger, items); action.append(menu);
  item.append(select, date, headline, method, format, state, action);
  return item;
}
function addDetail(grid, label, value) { const term = document.createElement('dt'); const description = document.createElement('dd'); term.textContent = label; description.textContent = value || '—'; grid.append(term, description); }
function renderDetails(row) {
  details.replaceChildren(); details.hidden = !row;
  if (!row) return;
  const heading = document.createElement('div'); heading.className = 'calendar-details-heading';
  const title = document.createElement('h2'); title.textContent = 'Post Details';
  const close = document.createElement('button'); close.className = 'calendar-details-close'; close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', () => { detailId = null; render(); }); heading.append(title, close);
  const grid = document.createElement('dl'); grid.className = 'calendar-detail-grid';
  addDetail(grid, 'Date', row.date); addDetail(grid, 'Headline', row.headline); addDetail(grid, 'Supporting Copy', row.supportingCopy); addDetail(grid, 'CTA', row.cta); addDetail(grid, 'Design Method', human(row.style)); addDetail(grid, 'Status', labels[normalizeStatus(row.status)]);
  if (row.style === 'openai-style') { addDetail(grid, 'Visual Style', human(row.ai.visualStyle)); addDetail(grid, 'Visual Subject', human(row.ai.subjectType)); addDetail(grid, 'Composition', human(row.ai.composition)); addDetail(grid, 'Visual Direction', row.ai.direction); addDetail(grid, 'Quality', human(row.ai.quality)); }
  details.append(heading, grid);
}

document.addEventListener('calendar:changed', event => {
  if (event.detail?.removedId) selectedIds.delete(event.detail.removedId);
  if (event.detail?.removedId && event.detail?.resultRef) removeCalendarAsset(event.detail.resultRef).catch(() => {});
  for (const resultRef of event.detail?.resultRefs || []) removeCalendarAsset(resultRef).catch(() => {});
  if (event.detail?.resetSelection) selectedIds = new Set();
  if (event.detail?.closeDetails || event.detail?.removedId === detailId) detailId = null;
  render();
});
document.getElementById('select-all-calendar').addEventListener('click', () => { selectedIds = selectAllRows(rows()); render(); });
document.getElementById('select-today-calendar').addEventListener('click', () => { selectedIds = selectTodayRows(rows(), localDateKey()); render(); });
document.getElementById('select-ungenerated-calendar').addEventListener('click', () => { selectedIds = selectUngeneratedRows(rows()); render(); });
document.getElementById('clear-calendar-selection').addEventListener('click', () => { selectedIds = new Set(); render(); });
function reviewFilename(row) { const slug = row.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'design'; return `upplai-${row.date}-${slug}.png`; }
function previewFromAsset(asset) { const template = document.createElement('template'); template.innerHTML = asset.html; return template.content.firstElementChild; }
async function resultFor(row) {
  const cached = sessionResults.get(row.id);
  if (cached?.preview) return cached;
  const asset = await loadCalendarAsset(row.resultRef);
  if (!asset) return null;
  const preview = previewFromAsset(asset);
  if (!preview) return null;
  const result = { preview, style: asset.style || row.style };
  sessionResults.set(row.id, result);
  return result;
}
function clearReviewPreview() {
  if (reviewObjectUrl) URL.revokeObjectURL(reviewObjectUrl);
  reviewObjectUrl = null;
  reviewPreview.replaceChildren();
}

async function openReview(row) {
  reviewId = row.id; renderReviewNavigation(); review.hidden = false; clearReviewPreview(); reviewDownload.disabled = true;
  reviewPreview.textContent = row.contentFormat === 'carousel' ? 'Carousel review will be added next.' : 'Loading design…';
  reviewMeta.replaceChildren();
  const fields = [['Date', row.date], ['Content', row.headline], ['Style', human(row.style)], ['Status', labels[normalizeStatus(row.status)]]];
  for (const [label, value] of fields) {
    const field = document.createElement('div');
    const term = document.createElement('span');
    const description = document.createElement('strong');
    term.textContent = label; description.textContent = value;
    if (label === 'Status') description.className = `calendar-status-badge review-status-${normalizeStatus(row.status)}`;
    field.append(term, description); reviewMeta.append(field);
  }  reviewMessage.textContent = row.contentFormat === 'carousel' ? 'Carousel review will be added next.' : 'Loading generated design…';
  if (row.contentFormat === 'carousel') return;
  const result = await resultFor(row);
  if (reviewId !== row.id) return;
  if (result?.preview) {
    try {
      const blob = await previewPngBlob(result.preview);
      if (reviewId !== row.id) return;
      reviewObjectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = reviewObjectUrl;
      image.alt = `${row.headline} generated design`;
      reviewPreview.replaceChildren(image);
      reviewDownload.disabled = false;
      reviewMessage.textContent = normalizeStatus(row.status) === 'stale' ? 'This preview was generated from earlier content. Regenerate it to use the current post.' : normalizeStatus(row.status) === 'failed' ? 'Showing the last successful preview. The latest regeneration failed.' : '';
    } catch {
      reviewPreview.textContent = 'Design preview could not be loaded.';
      reviewMessage.textContent = 'Design preview could not be loaded.';
    }
  } else {
    reviewPreview.textContent = 'Design preview could not be loaded.';
    reviewMessage.textContent = 'Generated preview is unavailable. Regenerate this design to review it.';
  }
}
function reviewableRows() { return rows().filter(row => hasReview(row) || ['generated', 'stale', 'failed'].includes(normalizeStatus(row.status))); }
function renderReviewNavigation() {
  const available = reviewableRows();
  reviewCount.textContent = `Generated Designs: ${available.length}`;
  reviewEmpty.hidden = available.length > 0;
  review.hidden = !available.length;
  reviewSelect.replaceChildren(...available.map(row => new Option(`${dateLabel(row.date)} — ${row.headline.slice(0, 56)}`, row.id)));
  const index = Math.max(0, available.findIndex(row => row.id === reviewId));
  if (available[index]) reviewSelect.value = available[index].id;
  reviewPrevious.disabled = index <= 0;
  reviewNext.disabled = index < 0 || index >= available.length - 1;
  reviewPosition.textContent = available.length ? `${index + 1} of ${available.length}` : '';
}
async function persistResult(row, result) {
  sessionResults.set(row.id, result);
  const resultRef = calendarResultRef(row.id);
  try { await saveCalendarAsset(resultRef, result); return resultRef; }
  catch { calendarStatus.textContent = 'Generated design is ready for this session, but persistent review storage is unavailable in this browser.'; return null; }
}
async function regenerateReview() {
  const row = rows().find(item => item.id === reviewId);
  if (!row || queue.running) return;
  const generating = { ...row, status: 'generating', error: null }; saveCalendar(rows().map(item => item.id === row.id ? generating : item)); render();
  try {
    const result = await generateCalendarDesign(generating);
    const resultRef = await persistResult(row, result);
    const generated = { ...generating, status: 'generated', generatedAt: new Date().toISOString(), error: null, resultRef: resultRef || row.resultRef };
    saveCalendar(rows().map(item => item.id === row.id ? generated : item));
    await openReview(generated);
  } catch (error) {
    const failed = { ...generating, status: 'failed', generatedAt: row.generatedAt, error: String(error?.message || error).slice(0, 180), resultRef: row.resultRef };
    saveCalendar(rows().map(item => item.id === row.id ? failed : item));
    calendarStatus.textContent = failed.error;
    await openReview(failed);
  }
  render();
}
reviewSelect.addEventListener('change', () => { const row = reviewableRows().find(item => item.id === reviewSelect.value); if (row) openReview(row); });
reviewPrevious.addEventListener('click', () => { const a = reviewableRows(); const i = a.findIndex(row => row.id === reviewId); if (i > 0) openReview(a[i - 1]); });
reviewNext.addEventListener('click', () => { const a = reviewableRows(); const i = a.findIndex(row => row.id === reviewId); if (i >= 0 && i < a.length - 1) openReview(a[i + 1]); });
window.addEventListener('beforeunload', clearReviewPreview);
document.getElementById('go-to-calendar').addEventListener('click', () => document.dispatchEvent(new Event('navigate:calendar')));
document.getElementById('edit-calendar-review').addEventListener('click', () => { if (reviewId) { document.dispatchEvent(new CustomEvent('calendar:edit', { detail: { id: reviewId } })); document.dispatchEvent(new Event('navigate:calendar')); } });
async function downloadRow(row) {
  const result = await resultFor(row);
  if (!result?.preview) { calendarStatus.textContent = 'Generated preview is unavailable. Regenerate this design to download it.'; return; }
  try { await downloadPng(result.preview, result.style || row.style, reviewFilename(row)); }
  catch { calendarStatus.textContent = 'PNG download failed in this browser. Please try again in a current Chrome or Edge browser.'; }
}
reviewDownload.addEventListener('click', async () => { const row = rows().find(item => item.id === reviewId); const result = row && await resultFor(row); if (!row || !result?.preview) return; try { await downloadPng(result.preview, result.style || row.style, reviewFilename(row)); } catch { reviewMessage.textContent = 'PNG download failed in this browser. Please try again in a current Chrome or Edge browser.'; } });
reviewRegenerate.addEventListener('click', regenerateReview);
document.getElementById('send-calendar-review').addEventListener('click', () => { const row = rows().find(item => item.id === reviewId); if (row) document.dispatchEvent(new CustomEvent('publishing:generated', { detail: row })); });
async function runCalendarQueue(ids, title) {
  if (queue.running || !ids.size) return;
  render();
  const result = await queue.run(rows(), ids, async (nextRows, row, summary) => {
    saveCalendar(nextRows);
    calendarStatus.textContent = `Generating ${summary.generated + summary.failed + 1} of ${summary.selected}… Current: ${row.headline}`;
    document.dispatchEvent(new CustomEvent('calendar:changed'));
  });
  if (result.summary) {
    let finalRows = result.rows;
    for (const [id, design] of result.results) {
      const row = finalRows.find(item => item.id === id);
      const resultRef = row && await persistResult(row, design);
      finalRows = finalRows.map(item => item.id === id ? { ...item, resultRef: resultRef || item.resultRef } : item);
    }
    saveCalendar(finalRows);
    const summary = result.summary;
    calendarStatus.textContent = title === 'Today' ? `Today's Designs · Eligible: ${summary.selected} · Generated: ${summary.generated} · Skipped: ${summary.skipped} · Failed: ${summary.failed}` : `Selected: ${summary.selected} · Generated: ${summary.generated} · Skipped: ${summary.skipped} · Failed: ${summary.failed}`;
  }
  render();
}
generateSelected.addEventListener('click', () => runCalendarQueue(new Set(selectedIds), 'Selected'));
generateToday.addEventListener('click', () => runCalendarQueue(todayEligibleIds(rows(), localDateKey()), 'Today'));
render();
renderReviewNavigation();

