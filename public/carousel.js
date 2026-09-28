import { brand } from '/src/brand.js';
import { downloadPng } from '/src/export.js';
import { loadCalendar, saveCalendar, createManualRow, updateManualRow } from '/src/calendar.js';
import { saveCalendarAsset, saveCarouselImportAsset, loadCarouselImportAsset, saveCarouselVisualAsset, loadCarouselVisualAsset } from '/src/calendar-assets.js';
import { carouselStyles, carouselTemplates, loadCarouselDraft, saveCarouselDraft, createCarouselDraft, normalizeCarousel, addSlide, duplicateSlide, deleteSlide, moveSlide, slideFitWarning, roleSequence, loadSavedCarousels, saveCarouselProject, duplicateCarouselProject, removeCarouselProject } from '/src/carousel.js';
import { showProcessing, hideProcessing } from '/src/processing.js';
import { loadSavedCarouselPrompts, saveCarouselPrompt, renameCarouselPrompt, duplicateCarouselPrompt, deleteCarouselPrompt } from '/src/saved-carousel-prompts.js';

const q = id => document.getElementById(id);
let draft = loadCarouselDraft();
const CAROUSEL_RECOVERY_KEY = 'upplai-design-studio-carousel-recovery';
let selected = (() => { try { return Number(JSON.parse(localStorage.getItem(CAROUSEL_RECOVERY_KEY))?.selected) || 0; } catch { return 0; } })();
let calendarEditingId = null;
let savedDraftId = null;
let autoSaveTimer = null;
let importQueue = [];
const importedAssets = new Map();
let previewZoom = .4;
let previewZoomMode = 'fit';
const builder = q('carousel-builder');
const generator = q('generator');
const standardPreview = q('create-preview-panel');
function renderCarouselPrompts(selectedId = '') { const select = q('carousel-prompt-select'); const prompts = loadSavedCarouselPrompts(); select.replaceChildren(new Option('Select Saved Prompt', ''), ...prompts.map(item => new Option(item.name, item.id))); select.value = selectedId; }
function selectedCarouselPrompt() { return loadSavedCarouselPrompts().find(item => item.id === q('carousel-prompt-select').value) || null; }
function manageCarouselPrompt(action) { const field = q('carousel-ai-prompt'); const current = selectedCarouselPrompt(); try { if (action === 'save') { const name = prompt('Saved carousel prompt name:'); if (!name) return; const item = saveCarouselPrompt(name, field.value); renderCarouselPrompts(item.id); } if (action === 'rename') { if (!current) return; const name = prompt('Rename saved carousel prompt:', current.name); if (!name) return; renameCarouselPrompt(current.id, name); renderCarouselPrompts(current.id); } if (action === 'duplicate') { if (!current) return; const item = duplicateCarouselPrompt(current.id); renderCarouselPrompts(item.id); } if (action === 'delete') { if (!current || !confirm(`Delete saved carousel prompt "${current.name}"?`)) return; deleteCarouselPrompt(current.id); renderCarouselPrompts(); } } catch (error) { q('carousel-ai-status').textContent = error.message || 'Saved prompt could not be updated.'; } }

async function persist() { try { draft = await externalizeEmbeddedSlideAssets(draft); draft = saveCarouselDraft(draft); localStorage.setItem(CAROUSEL_RECOVERY_KEY, JSON.stringify({ selected, prompt: q('carousel-ai-prompt')?.value || '', creationMode: document.querySelector('[data-carousel-creation].active')?.dataset.carouselCreation || 'prompt', designMode: q('carousel-ai-render-mode')?.value || 'native' })); } catch { /* draft remains available in memory if browser storage is unavailable */ } scheduleAutoSave(); }
function active() { return draft.slides[selected]; }
async function hydrateImportedAssets(source = draft) { const refs = new Set(); source.slides.forEach(slide => { if (slide.settings?.sourceType === 'imported-image' && slide.settings?.importAssetId) refs.add(slide.settings.importAssetId); (slide.settings?.embeddedAssetIds || []).forEach(id => refs.add(id)); }); await Promise.all([...refs].map(async id => { if (importedAssets.has(id)) return; const asset = await loadCarouselImportAsset(id); if (asset?.dataUrl) importedAssets.set(id, asset.dataUrl); })); }
async function hydrateCarouselVisuals(source = draft) { await Promise.all(source.slides.filter(slide => slide.settings?.visualAssetId && !slide.settings?.aiVisual).map(async slide => { const asset = await loadCarouselVisualAsset(slide.settings.visualAssetId); if (asset?.dataUrl) slide.settings.aiVisual = asset.dataUrl; })); }
async function externalizeEmbeddedSlideAssets(source) { const next = normalizeCarousel(source); const writes = []; for (const slide of next.slides) { const html = slide.settings?.editedHtml; if (!html || !/data:image\//i.test(html)) continue; const ids = [...(slide.settings.embeddedAssetIds || [])]; let sequence = 0; slide.settings.editedHtml = html.replace(/src=(['"])(data:image\/[\s\S]*?)\1/gi, (_whole, quote, dataUrl) => { const id = `carousel-embedded:${next.id}:${slide.id}:${Date.now()}:${sequence++}`; ids.push(id); importedAssets.set(id, dataUrl); writes.push(saveCarouselImportAsset(id, dataUrl, { source: 'edited-slide' })); return `data-carousel-asset-id=${quote}${id}${quote} src=${quote}${quote}`; }); slide.settings.embeddedAssetIds = ids; } await Promise.all(writes); return next; }
async function migrateLegacyVisuals() { let changed = false; for (const slide of draft.slides) { const dataUrl = slide.settings?.aiVisual; if (!dataUrl || slide.settings?.visualAssetId) continue; const id = `carousel-visual:${draft.id}:${slide.id}:${Date.now()}`; await saveCarouselVisualAsset(id, dataUrl, { sourceType: slide.settings?.sourceType || 'ai-visual-native-text' }); slide.settings.visualAssetId = id; changed = true; } if (changed) await persist(); }
function meaningful() { return Boolean(draft.title || draft.description || draft.slides.some(slide => slide.headline || slide.body || slide.cta || slide.settings?.editedHtml)); }
function project() { return { id: savedDraftId || draft.id, name: draft.projectName || draft.title || 'Untitled Carousel', carousel: draft, selectedSlide: selected }; }
function renderSavedCarousels() { const list = q('carousel-saved-list'); const saved = loadSavedCarousels(); q('carousel-draft-state').textContent = savedDraftId ? `Editing: ${saved.find(item => item.id === savedDraftId)?.name || draft.projectName || draft.title || 'Untitled Carousel'} · Saved` : 'New carousel · not yet saved'; list.replaceChildren(...saved.map(item => { const card = document.createElement('article'); card.className = 'carousel-saved-card'; const info = document.createElement('div'); info.innerHTML = `<strong></strong><small>${carouselStyles.find(style => style.id === item.carousel.style)?.name || item.carousel.style} · ${item.carousel.slides.length} slides · ${new Date(item.updatedAt).toLocaleDateString()}</small>`; info.querySelector('strong').textContent = item.name; const actions = document.createElement('div'); for (const [label, action] of [['Open', () => openSaved(item)], ['Duplicate', () => { const copy = duplicateCarouselProject(item); renderSavedCarousels(); if (copy) openSaved(copy); }], ['Rename', () => renameSaved(item)], ['Delete', () => deleteSaved(item)]]) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = action; actions.append(button); } card.append(info, actions); return card; })); if (!saved.length) list.textContent = 'No saved carousel drafts yet.'; }
function saveCurrentDraft() { if (!meaningful()) { q('carousel-ai-status').textContent = 'Add some content before saving this draft.'; return; } if (!savedDraftId) savedDraftId = `carousel-project-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; try { const saved = saveCarouselProject(project()); draft.projectName = saved.name; q('carousel-ai-status').textContent = 'Carousel draft saved.'; renderSavedCarousels(); } catch (error) { q('carousel-ai-status').textContent = error.message || 'Carousel draft could not be saved.'; savedDraftId = null; } }
function scheduleAutoSave() { if (!savedDraftId) return; clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(() => { try { saveCarouselProject(project()); q('carousel-ai-status').textContent = 'Changes saved.'; renderSavedCarousels(); } catch (error) { q('carousel-ai-status').textContent = error.message || 'Changes could not be saved.'; } }, 500); }
function openSaved(item) { if (!item || (meaningful() && !savedDraftId && !confirm('Discard the current unsaved carousel and open this saved draft?'))) return; draft = normalizeCarousel(item.carousel); draft.projectName = item.name; savedDraftId = item.id; selected = item.selectedSlide || 0; calendarEditingId = null; render(); q('carousel-ai-status').textContent = 'Saved carousel opened.'; }
function renameSaved(item) { const name = prompt('Rename carousel draft:', item.name); if (!name?.trim()) return; saveCarouselProject({ ...item, name: name.trim() }); if (item.id === savedDraftId) draft.projectName = name.trim(); renderSavedCarousels(); }
function deleteSaved(item) { if (!confirm('Delete this carousel draft? This cannot be undone.')) return; removeCarouselProject(item.id); if (item.id === savedDraftId) savedDraftId = null; renderSavedCarousels(); }
function escape(value = '') { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
export function createCarouselSlide(sourceDraft, index = 0) {
  const carousel = normalizeCarousel(sourceDraft); const slide = carousel.slides[index]; const total = carousel.slides.length;
  if (!slide) throw new Error('Carousel slide is unavailable.');
  const type = slide.type; const style = carousel.style;
  const page = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  const progress = style === 'progress-story' ? `${index + 1} of ${total}` : style === 'swipe-guide' ? (type === 'cta' ? page : 'SWIPE →') : style === 'numbered-steps' ? String(index + 1).padStart(2, '0') : type === 'cta' ? brand.name.toUpperCase() : page;
  const logo = brand.logoUrl ? `<img class="carousel-logo" data-editor-id="logo" data-editor-type="logo" src="${escape(brand.logoUrl)}" alt="${escape(brand.name)}">` : `<span class="carousel-logo-text" data-editor-id="logo" data-editor-type="text" data-editor-text="true">${escape(brand.name)}</span>`;
  const cta = slide.cta ? `<span class="carousel-cta" data-editor-id="cta" data-editor-type="button" data-editor-text="true">${escape(slide.cta)}</span>` : '';
  const template = document.createElement('template');
  if (slide.settings?.sourceType === 'ai-artwork' && slide.settings?.aiVisual) { template.innerHTML = `<article class="carousel-slide carousel-ai-artwork"><img class="carousel-ai-artwork-image" data-editor-id="ai-artwork" data-editor-type="image" src="${escape(slide.settings.aiVisual)}" alt="Generated carousel artwork"></article>`; return template.content.firstElementChild; }
  const aiVisualStyle = slide.settings?.aiVisual ? `background-image:linear-gradient(rgba(10,18,34,.12),rgba(10,18,34,.25)),url("${escape(slide.settings.aiVisual)}");background-size:cover;background-position:center;` : '';
  if (slide.settings?.editedHtml) { template.innerHTML = slide.settings.editedHtml; const edited = template.content.firstElementChild; if (edited) { edited.querySelectorAll('[data-carousel-asset-id]').forEach(image => { image.src = importedAssets.get(image.dataset.carouselAssetId) || ''; }); return edited; } }
  if (slide.settings?.sourceType === 'imported-image') { const source = importedAssets.get(slide.settings.importAssetId); template.innerHTML = `<article class="carousel-slide carousel-imported-image" style="--carousel-primary:${brand.colors.primary};--carousel-secondary:${brand.colors.primaryLight};--carousel-accent:${brand.colors.pink};--carousel-text:${brand.colors.navy};--carousel-light:${brand.colors.white};--carousel-heading:${brand.headingFont};--carousel-body:${brand.bodyFont}">${source ? `<img class="carousel-imported-base" data-editor-id="imported-base" data-editor-type="image" src="${escape(source)}" alt="Imported carousel slide">` : '<span class="carousel-import-missing">Loading imported slide…</span>'}</article>`; return template.content.firstElementChild; }
  template.innerHTML = `<article class="carousel-slide carousel-${style} carousel-${type}" style="--carousel-primary:${brand.colors.primary};--carousel-secondary:${brand.colors.primaryLight};--carousel-accent:${brand.colors.pink};--carousel-text:${brand.colors.navy};--carousel-light:${brand.colors.white};--carousel-heading:${brand.headingFont};--carousel-body:${brand.bodyFont};${aiVisualStyle}"><span class="carousel-decoration" data-editor-id="decoration" data-editor-type="shape"></span><div class="carousel-progress" data-editor-id="progress" data-editor-type="text" data-editor-text="true">${progress}</div><div class="carousel-copy"><h2 data-editor-id="headline" data-editor-type="text" data-editor-text="true">${escape(slide.headline || carousel.title)}</h2>${slide.body || carousel.description ? `<p data-editor-id="supporting-copy" data-editor-type="text" data-editor-text="true">${escape(slide.body || carousel.description)}</p>` : ''}${cta}</div><span class="carousel-page-indicator" data-editor-id="page-indicator" data-editor-type="text" data-editor-text="true">${page}</span><div class="carousel-brand">${logo}</div></article>`;
  return template.content.firstElementChild;
}
export async function generateCarouselDesign(sourceDraft) {
  const carousel = normalizeCarousel(sourceDraft);
  await hydrateImportedAssets(carousel);
  await hydrateCarouselVisuals(carousel);
  const slides = [];
  for (let index = 0; index < carousel.slides.length; index += 1) {
    if (slideFitWarning(carousel.slides[index])) throw new Error(`Slide ${index + 1} is too long for this carousel design.`);
    slides.push({ slideId: carousel.slides[index].id, order: index, type: carousel.slides[index].type, preview: createCarouselSlide(carousel, index) });
  }
  return { type: 'carousel', width: 1080, height: 1350, style: carousel.style, slides };
}
const clampZoom = value => Math.min(1.25, Math.max(.25, value));
function setPreviewZoom(value, mode = 'manual') { previewZoom = clampZoom(value); previewZoomMode = mode; q('carousel-preview').style.setProperty('--carousel-preview-scale', String(previewZoom)); q('carousel-zoom-value').textContent = `${Math.round(previewZoom * 100)}%`; }
function fitPreview() { const holder = q('carousel-preview'); const width = holder.clientWidth; const height = holder.clientHeight; if (width && height) setPreviewZoom(Math.min(width / 1080, height / 1350) * .96, 'fit'); }
function renderPreview() { q('carousel-preview').replaceChildren(createCarouselSlide(draft, selected)); q('carousel-warning').hidden = !slideFitWarning(active()); if (previewZoomMode === 'fit') requestAnimationFrame(fitPreview); }function renderEditor() {
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
  q('carousel-template-cards').replaceChildren(...carouselTemplates.map(template => { const card = document.createElement('button'); card.type = 'button'; card.className = `carousel-template-card${template.id === draft.style ? ' active' : ''}`; card.innerHTML = `<span class="carousel-template-swatch carousel-${template.id}"><b>${template.name.slice(0, 2)}</b></span><span>${template.name}</span>`; card.onclick = () => applyTemplate(template.id); return card; }));
  renderPreview();
}
function render() { draft = normalizeCarousel(draft); selected = Math.min(selected, draft.slides.length - 1); renderEditor(); void persist(); Promise.all([hydrateImportedAssets(), hydrateCarouselVisuals()]).then(() => renderPreview()).catch(() => {}); }
function applyTemplate(style) { if (!carouselStyles.some(template => template.id === style) || style === draft.style) return; draft.style = style; draft.theme.style = style; render(); }
const supportedImportTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const fileData = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('The image could not be read.')); reader.readAsDataURL(file); });
function renderImportQueue() { const list = q('carousel-import-list'); list.replaceChildren(...importQueue.map((item, index) => { const row = document.createElement('div'); row.className = 'carousel-import-item'; const image = document.createElement('img'); image.src = item.dataUrl; image.alt = `Imported slide ${index + 1}`; const name = document.createElement('span'); name.textContent = `${index + 1}. ${item.name}`; const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.disabled = index === 0; up.onclick = () => { [importQueue[index - 1], importQueue[index]] = [importQueue[index], importQueue[index - 1]]; renderImportQueue(); }; const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.disabled = index === importQueue.length - 1; down.onclick = () => { [importQueue[index + 1], importQueue[index]] = [importQueue[index], importQueue[index + 1]]; renderImportQueue(); }; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.onclick = () => { importQueue.splice(index, 1); renderImportQueue(); }; row.append(image, name, up, down, remove); return row; })); q('carousel-import-confirm').disabled = importQueue.length < 2; }
async function queueImportedFiles(files) { const valid = [...files].filter(file => supportedImportTypes.has(file.type) && file.size <= 10 * 1024 * 1024).slice(0, 10 - importQueue.length); if (!valid.length) { q('carousel-ai-status').textContent = 'Choose up to 10 PNG, JPG, or WebP images under 10MB each.'; return; } showProcessing({ title: 'Preparing your carousel…', message: 'Processing the uploaded slides.' }); try { for (const file of valid) importQueue.push({ name: file.name, dataUrl: await fileData(file), mimeType: file.type }); renderImportQueue(); q('carousel-ai-status').textContent = `${importQueue.length} image slides ready to import.`; } catch (error) { q('carousel-ai-status').textContent = error.message || 'An image could not be prepared.'; } finally { hideProcessing(); } }
async function commitImport() { if (importQueue.length < 2) return; if (meaningful() && !confirm('Importing will replace the current carousel slides. Continue?')) return; showProcessing({ title: 'Preparing your carousel…', message: 'Saving the uploaded slides in this browser.' }); try { const slides = []; for (let index = 0; index < importQueue.length; index += 1) { const item = importQueue[index]; const importAssetId = `carousel-import:${Date.now()}:${index}:${Math.random().toString(36).slice(2,8)}`; await saveCarouselImportAsset(importAssetId, item.dataUrl, { mimeType: item.mimeType, name: item.name }); importedAssets.set(importAssetId, item.dataUrl); slides.push({ id: `slide-${Date.now()}-${index}-${Math.random().toString(36).slice(2,8)}`, type: index === 0 ? 'cover' : index === importQueue.length - 1 ? 'cta' : 'insight', headline: '', body: '', cta: '', order: index, settings: { sourceType: 'imported-image', importAssetId, objectFit: 'contain' } }); } draft = normalizeCarousel({ ...createCarouselDraft(), title: draft.title, description: draft.description, slides }); savedDraftId = null; calendarEditingId = null; selected = 0; importQueue = []; q('carousel-import-panel').hidden = true; render(); q('carousel-ai-status').textContent = 'Imported carousel ready to edit.'; } catch (error) { q('carousel-ai-status').textContent = error.message || 'Carousel import failed.'; } finally { hideProcessing(); } }
function updateSlide(field, value) { draft.slides[selected][field] = value; render(); }
q('carousel-title').oninput = event => { draft.title = event.target.value; render(); };
q('carousel-description').oninput = event => { draft.description = event.target.value; render(); };
q('carousel-style').onchange = event => { draft.style = event.target.value; draft.theme.style = event.target.value; render(); };
q('carousel-slide-headline').oninput = event => updateSlide('headline', event.target.value);
q('carousel-slide-body').oninput = event => updateSlide('body', event.target.value);
q('carousel-slide-cta').oninput = event => updateSlide('cta', event.target.value);
q('carousel-prev').onclick = () => { selected -= 1; render(); }; q('carousel-next').onclick = () => { selected += 1; render(); };
q('carousel-fit').onclick = fitPreview; q('carousel-zoom-out').onclick = () => setPreviewZoom(previewZoom - .1); q('carousel-zoom-in').onclick = () => setPreviewZoom(previewZoom + .1);
q('carousel-import-open').onclick = () => { q('carousel-import-panel').hidden = !q('carousel-import-panel').hidden; renderImportQueue(); };
q('carousel-import-choose').onclick = () => q('carousel-import-input').click();
q('carousel-import-input').onchange = event => { queueImportedFiles(event.target.files || []); event.target.value = ''; };
q('carousel-import-confirm').onclick = commitImport;
new ResizeObserver(() => { if (previewZoomMode === 'fit') fitPreview(); }).observe(q('carousel-preview'));
q('carousel-add').onclick = () => { draft = addSlide(draft, selected); selected += 1; render(); };
q('carousel-add-upload').onclick = () => { q('carousel-import-input').onchange = async event => { const files = event.target.files || []; event.target.value = ''; if (!files.length) return; const file = files[0]; if (!supportedImportTypes.has(file.type) || file.size > 10 * 1024 * 1024) { q('carousel-ai-status').textContent = 'Choose a PNG, JPG, or WebP image under 10MB.'; return; } showProcessing({ title: 'Preparing your carousel…', message: 'Processing the uploaded slide.' }); try { const dataUrl = await fileData(file); const importAssetId = `carousel-import:${Date.now()}:${Math.random().toString(36).slice(2,8)}`; await saveCarouselImportAsset(importAssetId, dataUrl, { mimeType: file.type, name: file.name }); importedAssets.set(importAssetId, dataUrl); const next = addSlide(draft, selected); next.slides[selected + 1].settings = { sourceType: 'imported-image', importAssetId, objectFit: 'contain' }; draft = next; selected += 1; render(); } catch (error) { q('carousel-ai-status').textContent = error.message || 'The image slide could not be added.'; } finally { hideProcessing(); q('carousel-import-input').onchange = event2 => { queueImportedFiles(event2.target.files || []); event2.target.value = ''; }; } }; q('carousel-import-input').click(); };
q('carousel-duplicate').onclick = () => { draft = duplicateSlide(draft, selected); selected += 1; render(); };
q('carousel-delete').onclick = () => { draft = deleteSlide(draft, selected); selected = Math.min(selected, draft.slides.length - 1); render(); };
q('carousel-left').onclick = () => { draft = moveSlide(draft, selected, -1); selected -= 1; render(); };
q('carousel-right').onclick = () => { draft = moveSlide(draft, selected, 1); selected += 1; render(); };
q('carousel-edit-slide').onclick = () => {
  const source = q('carousel-preview').firstElementChild;
  if (!source) return;
  const context = { draft: normalizeCarousel(draft), slideIndex: selected, slideId: draft.slides[selected]?.id, preview: source.cloneNode(true) };
  console.info(`[CAROUSEL EDIT] clicked slide ${selected + 1}`);
  document.dispatchEvent(new Event('navigate:create'));
  requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('carousel:builder-slide-edit', { detail: context })));
};
q('carousel-new').onclick = () => { if (meaningful() && !confirm('Start a new carousel and discard this draft?')) return; draft = createCarouselDraft(); savedDraftId = null; calendarEditingId = null; selected = 0; render(); };
q('carousel-save-draft').onclick = saveCurrentDraft;
function hasCarouselContent() { return Boolean(draft.title || draft.description || draft.slides.some(item => item.headline || item.body || item.cta)); }
function carouselGenerationInput() { return { prompt: q('carousel-ai-prompt').value, topic: q('carousel-ai-topic').value, slideCount: Number(q('carousel-ai-count').value), goal: q('carousel-ai-goal').value, direction: q('carousel-ai-direction').value, renderMode: q('carousel-ai-render-mode').value, brand: { name: brand.name } }; }
q('carousel-prompt-select').onchange = () => { const item = selectedCarouselPrompt(); if (item) q('carousel-ai-prompt').value = item.prompt; };
q('carousel-prompt-save').onclick = () => manageCarouselPrompt('save');
q('carousel-prompt-rename').onclick = () => manageCarouselPrompt('rename');
q('carousel-prompt-duplicate').onclick = () => manageCarouselPrompt('duplicate');
q('carousel-prompt-delete').onclick = () => manageCarouselPrompt('delete');
renderCarouselPrompts();
void migrateLegacyVisuals().then(() => hydrateCarouselVisuals()).then(() => renderPreview()).catch(() => {});
document.querySelectorAll('[data-carousel-creation]').forEach(control => control.onclick = () => { const mode = control.dataset.carouselCreation; document.querySelectorAll('[data-carousel-creation]').forEach(item => item.classList.toggle('active', item === control)); q('carousel-prompt-workspace').hidden = mode !== 'prompt'; q('carousel-ai-manual').hidden = mode !== 'manual'; q('carousel-import-open').hidden = mode !== 'import'; });
try { const recovery = JSON.parse(localStorage.getItem(CAROUSEL_RECOVERY_KEY)); if (recovery) { q('carousel-ai-prompt').value = recovery.prompt || ''; q('carousel-ai-render-mode').value = recovery.designMode || 'native'; const control = document.querySelector(`[data-carousel-creation="${recovery.creationMode || 'prompt'}"]`); control?.click(); } } catch { /* existing draft is still restored by loadCarouselDraft */ }
q('carousel-ai-prompt').addEventListener('input', persist); q('carousel-ai-render-mode').addEventListener('change', persist); q('carousel-ai-count').addEventListener('change', persist);
q('carousel-ai-manual').onclick = () => { if (hasCarouselContent() && !confirm('Start a manual carousel and replace the current draft?')) return; const count = Number(q('carousel-ai-count').value); draft = normalizeCarousel({ ...createCarouselDraft(), slides: roleSequence(count).map((type, order) => ({ type, order, headline: '', body: '', cta: '' })) }); savedDraftId = null; calendarEditingId = null; selected = 0; q('carousel-ai-status').textContent = 'Manual carousel started.'; render(); };
async function addCarouselVisuals(generated, input, status) {
  if (input.renderMode === 'native') return generated;
  const slides = [];
  for (let index = 0; index < generated.slides.length; index += 1) {
    const slide = generated.slides[index];
    status.textContent = `Creating slide ${index + 1} of ${generated.slides.length}…`;
    const planResponse = await fetch('/api/ai/design-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ headline: slide.headline || generated.title, supportingCopy: slide.body || '', cta: slide.cta || '', visualStyle: 'auto', subjectType: 'auto', composition: 'auto', customDirection: [input.prompt, input.direction].filter(Boolean).join('\n'), renderMode: input.renderMode }) });
    const planData = await planResponse.json();
    if (!planResponse.ok) throw new Error(planData.error?.message || 'Carousel visual planning failed.');
    const visualResponse = await fetch('/api/ai/generate-visual', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId: planData.planId, quality: 'draft' }) });
    const visualData = await visualResponse.json();
    if (!visualResponse.ok || !visualData.image) throw new Error(visualData.error?.message || 'Carousel visual generation failed.');
    const visualAssetId = `carousel-visual:${generated.id || 'generated'}:${index}:${Date.now()}`;
    await saveCarouselVisualAsset(visualAssetId, visualData.image, { sourceType: input.renderMode });
    slides.push({ ...slide, aiVisual: visualData.image, visualAssetId });
  }
  return { ...generated, slides };
}
q('carousel-ai-generate').onclick = async () => {
  const topic = q('carousel-ai-prompt').value.trim() || q('carousel-ai-topic').value.trim(); const status = q('carousel-ai-status'); const generate = q('carousel-ai-generate');
  if (!topic) { status.textContent = 'Add a topic or source text first.'; return; }
  if (hasCarouselContent() && !confirm('Generate a new carousel and replace the current slide content?')) return;
  generate.disabled = true; status.textContent = 'Generating carousel…'; showProcessing({ title: 'Generating your carousel…', message: 'Creating the content structure and slide story.' });
  try {
    const response = await fetch('/api/ai/generate-carousel-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(carouselGenerationInput()) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'Carousel generation failed.');
    const input = carouselGenerationInput();
    const generated = await addCarouselVisuals(data.carousel, input, status);
    draft = normalizeCarousel({ ...draft, designMode: input.renderMode, title: generated.title, description: generated.description, slides: generated.slides.map((slide, order) => ({ type: slide.role, headline: slide.headline, body: slide.body, cta: slide.cta, order, settings: slide.aiVisual ? { sourceType: input.renderMode === 'full-ai-artwork' ? 'ai-artwork' : 'ai-visual-native-text', visualAssetId: slide.visualAssetId, aiVisual: slide.aiVisual } : {} })) });
    savedDraftId = null; calendarEditingId = null; selected = 0; render(); status.textContent = 'Carousel content is ready to edit.'; generate.textContent = '✨ Regenerate Carousel Content';
  } catch (error) { status.textContent = error.message || 'Carousel generation failed. Your current carousel is unchanged.'; }
  finally { hideProcessing(); generate.disabled = false; }
};
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
  const context = event.detail?.context;
  const row = context?.contentType === 'carousel' && context.calendarItemId === event.detail?.id
    ? context.row
    : (loadCalendar()?.rows || []).find(item => item.id === event.detail?.id);
  if (!row || row.contentFormat !== 'carousel') return;
  // Calendar owns this edit context. Never fall back to the last active draft.
  draft = normalizeCarousel(row.carousel); savedDraftId = null; calendarEditingId = context?.calendarItemId || row.id; selected = Number(context?.pageOrSlideIndex) || 0;
  document.querySelector('[data-content-type="carousel"]').click();
  document.dispatchEvent(new Event('navigate:create'));
});
function carouselFileBase() { return (draft.title || 'upplai-carousel').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'upplai-carousel'; }
async function exportSlide(index) { const previous = selected; selected = index; render(); await new Promise(resolve => requestAnimationFrame(resolve)); await downloadPng(q('carousel-preview').firstElementChild, 'carousel', `${carouselFileBase()}-slide-${String(index + 1).padStart(2, '0')}.png`); selected = previous; render(); }
q('carousel-download-current').onclick = () => exportSlide(selected);
q('carousel-download-all').onclick = async () => { q('carousel-download-all').disabled = true; try { for (let index = 0; index < draft.slides.length; index += 1) await exportSlide(index); } finally { q('carousel-download-all').disabled = false; } };
q('carousel-send-publishing').onclick = async () => {
  const button = q('carousel-send-publishing');
  if (button.disabled) return;
  button.disabled = true;
  showProcessing({ title: 'Preparing carousel for Publishing…', message: 'Serializing your current slides in order.' });
  try {
    console.info('[CAROUSEL PUBLISH] 1. clicked');
    const source = normalizeCarousel(draft);
    console.info('[CAROUSEL PUBLISH] 2. preparing slides');
    const result = await generateCarouselDesign(draft);
    result.slides.forEach((slide, index) => console.info(`[CAROUSEL PUBLISH] ${index + 3}. slide ${index + 1} complete`));
    const resultRef = `carousel-builder:${source.id}`;
    await saveCalendarAsset(resultRef, result);
    console.info('[CAROUSEL PUBLISH] handoff stored');
    document.dispatchEvent(new CustomEvent('publishing:generated', { detail: { resultRef, headline: source.title || source.slides[0]?.headline || 'Carousel', supportingCopy: source.description, cta: source.slides.at(-1)?.cta || '', carousel: source, contentFormat: 'carousel' } }));
    console.info('[CAROUSEL PUBLISH] opening Publishing');
  } catch (error) {
    console.error('[CAROUSEL PUBLISH] failed', error);
    q('carousel-ai-status').textContent = `Could not prepare the carousel for Publishing. Your carousel has not been changed.${error?.message ? ` ${error.message}` : ''}`;
  } finally {
    hideProcessing();
    button.disabled = false;
  }
};
document.addEventListener('carousel:builder-draft-commit', event => { const next = event.detail?.draft; if (!next) return; draft = normalizeCarousel(next); selected = event.detail.slideIndex; persist(); });

document.addEventListener('carousel:builder-slide-preview', event => { const index = event.detail?.slideIndex; if (!Number.isInteger(index) || index < 0 || index >= draft.slides.length) return; event.detail.resolve?.({ draft: normalizeCarousel(draft), preview: createCarouselSlide(draft, index) }); });
document.addEventListener('carousel:builder-slide-saved', event => { const { draft: saved, slideIndex, preview: edited } = event.detail || {}; if (!saved || !edited?.outerHTML) return; draft = normalizeCarousel(saved); const slide = draft.slides[slideIndex]; if (!slide) return; slide.settings = { ...(slide.settings || {}), editedHtml: edited.outerHTML }; selected = slideIndex; builder.hidden = false; generator.hidden = true; standardPreview.hidden = true; document.querySelectorAll('[data-content-type]').forEach(item => item.classList.toggle('active', item.dataset.contentType === 'carousel')); render(); console.info(`[CAROUSEL EDIT] returned to builder with slide ${slideIndex + 1}`); document.dispatchEvent(new Event('navigate:create')); });
document.querySelectorAll('[data-content-type]').forEach(button => button.onclick = () => { const carousel = button.dataset.contentType === 'carousel'; builder.hidden = !carousel; generator.hidden = carousel; standardPreview.hidden = carousel; document.querySelectorAll('[data-content-type]').forEach(item => item.classList.toggle('active', item === button)); if (carousel) render(); });
render();
renderSavedCarousels();
