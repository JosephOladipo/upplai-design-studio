import { attachedMediaInput } from './publishing-vision.js';
import { loadCalendarAsset, savePublishingMedia } from '/src/calendar-assets.js';
import { previewPngBlob } from '/src/export.js';
import { brand } from '/src/brand.js';
import { showProcessing, updateProcessing, hideProcessing } from '/src/processing.js';
import { loadSavedCaptionPrompts, saveCaptionPrompt, renameCaptionPrompt, duplicateCaptionPrompt, deleteCaptionPrompt } from '/src/saved-caption-prompts.js';
import { classifyManualMedia } from '/src/publishing-media-selection.js';
import { carouselPdfFile, documentTitle as linkedinDocumentTitle } from '/src/linkedin-carousel-document.mjs';

const state = {
  media: null,
  uploaded: null,
  generatedRef: null,
  generatedPreview: null,
  generatedFile: null,
  generatedPreviewUrl: null,
  mediaRef: '',
  carouselSlides: [],
  carouselFiles: [],
  carouselIndex: 0,
  mediaSource: 'none',
  existingMedia: null,
  channels: new Set(),
  channelLabels: new Map(),
  channelData: new Map(),
  captionMode: 'generic',
  platformCaptions: {},
  altTextMode: 'generic',
  platformAltText: {},
  slideAltText: [],
  linkedinDocument: null,
  linkedinDocumentTitle: '',
  contentContext: {},
  busy: false
};
let managementStatusName = 'composer';
let mediaLifecycleVersion = 0;

const q = (id) => document.getElementById(id);
const caption = q('publishing-caption');
const out = q('publishing-result');
const button = q('publishing-prepare');
const mediaInput = q('publishing-media-input');
const mediaTrigger = q('publishing-media-trigger');
const mediaBadge = q('publishing-media-badge');
const mediaDropzone = q('publishing-media-dropzone');
const turnIntoReel = q('publishing-turn-into-reel');
const modeSelect = q('publishing-mode');
const altText = q('publishing-alt-text');
const supportedManualMedia = new Set(['image/png','image/jpeg','image/webp','video/mp4','video/quicktime','video/webm']);
const bytesLabel = bytes => `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
const PUBLISHING_RECOVERY_KEY = 'upplai-design-studio-publishing-draft';
function savePublishingDraft() { try { localStorage.setItem(PUBLISHING_RECOVERY_KEY, JSON.stringify({ caption: caption.value, instruction: q('publishing-ai-instruction').value, altText: altText.value, captionMode: state.captionMode, altTextMode: state.altTextMode, mode: modeSelect.value, date: q('publishing-date').value, time: q('publishing-time').value, channels: [...state.channels], tab: managementStatusName || 'composer', generatedRef: state.generatedRef || '', mediaRef: state.mediaRef || '', mediaSource: state.mediaSource, existingMedia: state.existingMedia, contentContext: state.contentContext, platformCaptions: state.platformCaptions, platformAltText: state.platformAltText, slideAltText: state.slideAltText, linkedinDocumentTitle: state.linkedinDocumentTitle })); } catch { /* files and media are intentionally excluded */ } }
function restorePublishingDraft() { try { const saved = JSON.parse(localStorage.getItem(PUBLISHING_RECOVERY_KEY)); if (!saved || typeof saved !== 'object') return; caption.value = String(saved.caption || ''); q('publishing-ai-instruction').value = String(saved.instruction || ''); altText.value = String(saved.altText || ''); state.captionMode = saved.captionMode === 'platform' ? 'platform' : 'generic'; state.altTextMode = saved.altTextMode === 'platform' ? 'platform' : 'generic'; modeSelect.value = saved.mode === 'schedule' ? 'schedule' : 'now'; q('publishing-date').value = String(saved.date || ''); q('publishing-time').value = String(saved.time || ''); (saved.channels || []).forEach(id => state.channels.add(id)); state.generatedRef = String(saved.generatedRef || '') || null; state.mediaRef = saved.mediaRef || ''; state.mediaSource = saved.mediaSource || (state.generatedRef ? 'generated' : 'none'); state.existingMedia = saved.existingMedia || null; state.contentContext = saved.contentContext || {}; state.platformCaptions = saved.platformCaptions || {}; state.platformAltText = saved.platformAltText || {}; state.slideAltText = saved.slideAltText || []; state.linkedinDocumentTitle = String(saved.linkedinDocumentTitle || ''); managementStatusName = ['scheduled','sent'].includes(saved.tab) ? saved.tab : 'composer'; } catch { /* invalid recovery data is ignored */ } }

q('publishing-timezone').textContent = `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
restorePublishingDraft();

function channelLabel(channel) {
  const service = String(channel.service || 'Channel');
  const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
  return `${serviceName} — ${channel.name || 'Connected channel'}`;
}

function channelKey(channel) { return String(channel.connectionId || 'legacy') + ':' + String(channel.id || ''); }
function selectedPlatforms() { return [...state.channels].map(id => ({ key: id, ...(state.channelData.get(id) || {}) })).filter(channel => channel.id); }
function beginMediaLifecycle() { mediaLifecycleVersion += 1; return mediaLifecycleVersion; }
function validImageFile(file) { return file instanceof Blob && file.size > 0 && /^image\/(png|jpeg|webp)$/i.test(file.type); }
function validPublishingMedia(value) { return Array.isArray(value) ? value.length > 1 && value.every(validImageFile) : Boolean(value instanceof Blob && value.size > 0 && (/^image\/(png|jpeg|webp)$/i.test(value.type) || value.type === 'video/mp4')); }
function mediaLog(label, reference, value) { const files = Array.isArray(value) ? value : [value]; console.info(label, { reference: reference || '', fileType: files.map(file => file?.type || '').join(','), fileSize: files.map(file => Number(file?.size || 0)).join(',') }); }
function invalidateLinkedinDocument() { state.linkedinDocument = null; }
function isCarousel() { return Boolean(state.carouselFiles.length || state.carouselSlides.length); }
function renderLinkedinDocumentControl() { const host = q('publishing-linkedin-document'); if (!host) return; const linkedIn = isCarousel() && selectedPlatforms().some(channel => channel.service === 'linkedin'); host.hidden = !linkedIn; if (!linkedIn) return; const input = q('publishing-linkedin-document-title'); const derived = state.contentContext.headline || caption.value.split(/\r?\n/).find(line => line.trim()) || 'Upplai Carousel'; if (!state.linkedinDocumentTitle) state.linkedinDocumentTitle = linkedinDocumentTitle(derived); input.value = state.linkedinDocumentTitle; }
function renderCaptionPrompts(selectedId = '') { const select = q('caption-prompt-select'); if (!select) return; const prompts = loadSavedCaptionPrompts(); select.replaceChildren(new Option('Select Saved Prompt', ''), ...prompts.map(item => new Option(item.name, item.id))); select.value = selectedId; }
function selectedCaptionPrompt() { const id = q('caption-prompt-select')?.value; return loadSavedCaptionPrompts().find(item => item.id === id) || null; }
function manageCaptionPrompt(action) { const instruction = q('publishing-ai-instruction'); const current = selectedCaptionPrompt(); try { if (action === 'save') { const name = prompt('Saved caption prompt name:'); if (!name) return; const item = saveCaptionPrompt(name, instruction.value); renderCaptionPrompts(item.id); } if (action === 'rename') { if (!current) return; const name = prompt('Rename saved caption prompt:', current.name); if (!name) return; renameCaptionPrompt(current.id, name); renderCaptionPrompts(current.id); } if (action === 'duplicate') { if (!current) return; const item = duplicateCaptionPrompt(current.id); renderCaptionPrompts(item.id); } if (action === 'delete') { if (!current || !confirm(`Delete saved caption prompt "${current.name}"?`)) return; deleteCaptionPrompt(current.id); renderCaptionPrompts(); } } catch (error) { q('publishing-ai-status').textContent = error.message || 'Saved prompt could not be updated.'; } }
function handoffCarousel(result) {
  if (Array.isArray(result.carousel?.slides)) return result.carousel;
  if (Array.isArray(result.multiPage?.pages)) return { title: result.multiPage.title, description: result.multiPage.description, slides: result.multiPage.pages.map(page => ({ headline: page.headline, body: page.supportingCopy, cta: page.cta })) };
  if (Array.isArray(result.aiDesignerPlan?.slides)) return { title: result.aiDesignerPlan.headline, description: result.aiDesignerPlan.body, slides: result.aiDesignerPlan.slides.map(slide => ({ headline: slide.headline, body: slide.body, cta: slide.cta })) };
  return null;
}
function syncCarouselAltText(count) {
  if (count && state.slideAltText.length !== count) state.slideAltText = Array.from({ length: count }, () => '');
}
async function assistantPayload(mode = state.captionMode) { return { media: await attachedMediaInput(state), mode, platforms: selectedPlatforms().map(channel => ({ ...channel, channelId: channel.id, id: channel.key })), sourceCaption: caption.value, instruction: q('publishing-ai-instruction').value, controls: { tone: q('publishing-ai-tone').value, length: q('publishing-ai-length').value, hashtags: q('publishing-ai-hashtags').value }, context: state.contentContext }; }
function makeButton(id, text, action) { const value = document.createElement('button'); value.type = 'button'; value.textContent = text; value.onclick = action; return value; }
function renderOptions(host, options, use) { host.replaceChildren(...options.map(option => { const card = document.createElement('article'); card.className = 'publishing-ai-option'; const label = document.createElement('strong'); label.textContent = option.label || 'Option'; const copy = document.createElement('p'); copy.textContent = option.text || ''; card.append(label, copy, makeButton('', 'Use Caption', () => { use(option.text || ''); savePublishingDraft(); })); return card; })); }
function renderCopyWorkspaces() {
  const platformCaptions = q('publishing-platform-captions'); const platformAlt = q('publishing-platform-alt-text'); const selected = selectedPlatforms();
  const platformMode = state.captionMode === 'platform'; const altMode = state.altTextMode === 'platform';
  q('publishing-generic-caption-label').hidden = platformMode; platformCaptions.hidden = !platformMode;
  q('publishing-generic-alt-label').hidden = altMode; platformAlt.hidden = !altMode;
  q('publishing-ai-generic').hidden = platformMode; q('publishing-ai-copy').hidden = !platformMode; q('publishing-ai-platform').hidden = !platformMode;
  q('caption-mode-generic').classList.toggle('active', !platformMode); q('caption-mode-platform').classList.toggle('active', platformMode);
  q('alt-mode-generic').classList.toggle('active', !altMode); q('alt-mode-platform').classList.toggle('active', altMode);
  if (platformMode) platformCaptions.replaceChildren(...selected.map(channel => { const wrap = document.createElement('label'); wrap.className = 'publishing-platform-copy'; const title = document.createElement('strong'); title.textContent = channelLabel(channel); const input = document.createElement('textarea'); input.rows = 4; input.value = state.platformCaptions[channel.key] || ''; input.oninput = () => { state.platformCaptions[channel.key] = input.value; savePublishingDraft(); }; const regenerate = makeButton('', `Regenerate ${String(channel.service || 'platform').replace(/^./, x => x.toUpperCase())}`, () => generateOnePlatform(channel)); wrap.append(title, input, regenerate); return wrap; }));
  if (altMode) platformAlt.replaceChildren(...selected.map(channel => { const wrap = document.createElement('label'); wrap.className = 'publishing-platform-copy'; const title = document.createElement('strong'); title.textContent = `${channelLabel(channel)} Alt Text`; const input = document.createElement('textarea'); input.rows = 3; input.maxLength = 500; input.value = state.platformAltText[channel.key] || ''; input.oninput = () => { state.platformAltText[channel.key] = input.value; savePublishingDraft(); }; wrap.append(title, input); return wrap; }));
  if (state.slideAltText.length) { const slides = document.createElement('div'); slides.className = 'publishing-carousel-alt'; state.slideAltText.forEach((value, index) => { const label = document.createElement('label'); label.textContent = `Slide ${index + 1} Alt Text`; const input = document.createElement('textarea'); input.rows = 3; input.maxLength = 500; input.value = value; input.oninput = () => { state.slideAltText[index] = input.value; savePublishingDraft(); }; label.append(input); slides.append(label); }); platformAlt.hidden = false; platformAlt.replaceChildren(makeButton('', '✨ Generate Alt Text for All Slides', () => generateAssistant('alt')), slides); q('publishing-ai-alt').hidden = true; } else q('publishing-ai-alt').hidden = altMode;
}
async function generateAssistant(kind, platformOnly = false) {
  const status = q(kind === 'caption' ? 'publishing-ai-status' : 'publishing-alt-status'); const trigger = q(kind === 'caption' ? (platformOnly ? 'publishing-ai-platform' : 'publishing-ai-generic') : 'publishing-ai-alt');
  trigger.disabled = true; const assistantOperation = showProcessing({ title: kind === 'caption' ? 'Writing your captions…' : (state.carouselSlides.length ? 'Generating slide descriptions…' : 'Generating Alt Text…'), message: kind === 'caption' ? 'Creating caption options for your selected channels.' : (state.carouselSlides.length ? 'Creating accessibility descriptions for each carousel slide.' : 'Creating an accessibility description for your content.') }); status.textContent = kind === 'caption' ? (platformOnly ? 'Generating platform variations…' : 'Generating caption options…') : 'Generating Alt Text…';
  try { const response = await fetch(`/api/ai/generate-${kind === 'caption' ? 'caption' : 'alt-text'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await assistantPayload(platformOnly ? 'platform' : state.captionMode)) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'AI generation failed.');
    if (kind === 'caption') { const host = q('publishing-ai-results'); if (platformOnly) { host.replaceChildren(...selectedPlatforms().flatMap(channel => { const heading = document.createElement('h4'); heading.textContent = channelLabel(channel); const options = data.platformCaptions?.[channel.key] || []; const container = document.createElement('div'); renderOptions(container, options, text => { state.platformCaptions[channel.key] = text; renderCopyWorkspaces(); }); return [heading, container]; })); } else renderOptions(host, data.options || [], text => { caption.value = text; }); } else if (data.slideAltText) { state.slideAltText = data.slideAltText; status.textContent = 'Alt Text generated for all carousel slides.'; } else { altText.value = data.altText || ''; }
    savePublishingDraft(); renderCopyWorkspaces();
    if (kind === 'caption') status.textContent = 'Caption options are ready. Choose one to use it.'; else if (!data.slideAltText) status.textContent = 'Alt Text is ready to edit.';
  } catch (error) { status.textContent = error.message || 'AI generation failed. Your existing content is unchanged.'; } finally { hideProcessing(assistantOperation); trigger.disabled = false; }
}
async function generateOnePlatform(channel) {
  const status = q('publishing-ai-status'); const platformCaptionOperation = showProcessing({ title: 'Writing your captions…', message: 'Creating caption options for your selected channels.' }); status.textContent = `Generating ${channel.service || 'platform'} variations…`;
  try { const response = await fetch('/api/ai/generate-caption', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...await assistantPayload('platform'), platforms: [channel] }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || 'AI generation failed.'); const options = data.platformCaptions?.[channel.key] || []; const host = q('publishing-ai-results'); const heading = document.createElement('h4'); heading.textContent = channelLabel(channel); const result = document.createElement('div'); renderOptions(result, options, text => { state.platformCaptions[channel.key] = text; renderCopyWorkspaces(); }); host.replaceChildren(heading, result); status.textContent = `${channel.service || 'Platform'} options are ready.`; } catch (error) { status.textContent = error.message || 'AI generation failed. Your caption is unchanged.'; } finally { hideProcessing(platformCaptionOperation); }
}

function setMediaState(source, message = 'Text-only post') {
  state.mediaSource = source;
  const labels = { manual: 'Uploaded media', 'manual-carousel': 'Uploaded carousel', generated: 'Generated design', 'generated-direct': 'Generated design', 'existing-url': 'Existing media', reel: 'Reel video' };
  const label = labels[source];
  mediaBadge.hidden = !label;
  mediaBadge.textContent = label || '';
  mediaTrigger.textContent = source === 'none' ? 'Add media' : 'Replace media';
  const imageFiles = state.carouselFiles.length ? state.carouselFiles : (state.media?.type?.startsWith('image/') ? [state.media] : []);
  turnIntoReel.hidden = !imageFiles.length;
  turnIntoReel.textContent = imageFiles.length > 1 ? 'Turn into Reel' : 'Turn into Reel';
  if (source === 'none') q('publishing-media').textContent = message;
}

function clearGeneratedMedia() {
  if (state.generatedPreviewUrl) URL.revokeObjectURL(state.generatedPreviewUrl);
  state.generatedPreviewUrl = null;
  state.generatedFile = null;
  state.generatedPreview = null;
}

function prepareGeneratedMediaPreview() {
  if (state.media) {
    if (state.generatedPreviewUrl) URL.revokeObjectURL(state.generatedPreviewUrl);
    state.generatedFile = state.media;
    state.generatedPreviewUrl = URL.createObjectURL(state.media);
    const image = document.createElement('img');
    image.src = state.generatedPreviewUrl;
    image.alt = 'Generated design ready to publish';
    q('publishing-media').replaceChildren(image);
    return;
  }
  if (!state.generatedPreview) throw new Error('Generated design could not be loaded. Return to Design Review and regenerate it.');
  // Recovery fallback for legacy drafts that predate persisted generated PNGs.
  const visiblePreview = state.generatedPreview.cloneNode(true);
  visiblePreview.removeAttribute('id');
  visiblePreview.setAttribute('aria-label', 'Generated design ready to publish');
  q('publishing-media').replaceChildren(visiblePreview);
}
function prepareVideoMediaPreview(file) {
  const holder = q('publishing-media'); holder.replaceChildren();
  const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.src = URL.createObjectURL(file);
  const meta = document.createElement('small'); meta.className = 'publishing-media-meta';
  video.onloadedmetadata = () => { meta.textContent = `${file.name} · ${bytesLabel(file.size)} · ${Math.round(video.duration || 0)} seconds`; };
  holder.append(video, meta);
}

async function preparedArtworkFile(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) throw new Error('Prepared Full AI artwork is unavailable. Generate it again before publishing.');
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (!blob.size) throw new Error('Prepared Full AI artwork could not be converted for publishing.');
  return new File([blob], 'full-ai-artwork.png', { type: 'image/png' });
}
function renderPublishingCarousel() {
  const slides = state.carouselSlides;
  const total = state.carouselFiles.length || slides.length;
  if (!total) return;
  const media = q('publishing-media'); const wrap = document.createElement('div'); wrap.className = 'publishing-carousel-preview';
  const stage = document.createElement('div'); stage.className = 'publishing-carousel-stage';
  if (state.carouselFiles[state.carouselIndex]) { const image = document.createElement('img'); image.src = URL.createObjectURL(state.carouselFiles[state.carouselIndex]); image.alt = `Generated design slide ${state.carouselIndex + 1}`; stage.append(image); }
  else stage.append(slides[state.carouselIndex].cloneNode(true));
  const nav = document.createElement('div'); nav.className = 'publishing-carousel-nav';
  const previous = makeButton('', '←', () => { state.carouselIndex = Math.max(0, state.carouselIndex - 1); renderPublishingCarousel(); });
  const position = document.createElement('span'); position.textContent = `${state.carouselIndex + 1} / ${slides.length}`;
  const next = makeButton('', '→', () => { state.carouselIndex = Math.min(total - 1, state.carouselIndex + 1); renderPublishingCarousel(); });
  position.textContent = `${state.carouselIndex + 1} / ${total}`;
  previous.disabled = state.carouselIndex === 0; next.disabled = state.carouselIndex === total - 1; nav.append(previous, position, next);
  const thumbs = document.createElement('div'); thumbs.className = 'publishing-carousel-thumbs'; Array.from({ length: total }, (_, index) => { const thumb = makeButton('', String(index + 1), () => { state.carouselIndex = index; renderPublishingCarousel(); }); thumb.classList.toggle('active', index === state.carouselIndex); thumbs.append(thumb); });
  wrap.append(stage, nav, thumbs); media.replaceChildren(wrap);
}

function syncModeControl() {
  const schedule = modeSelect.value === 'schedule';
  q('publishing-schedule').hidden = !schedule;
  button.textContent = schedule ? 'Schedule Post' : 'Publish Now';
    document.querySelectorAll('[data-publishing-mode]').forEach((control) => {
    const active = control.dataset.publishingMode === modeSelect.value;
    control.classList.toggle('active', active);
    control.setAttribute('aria-pressed', String(active));
  });
}

async function loadChannels() {
  const retry = q('publishing-retry-channels'); retry.hidden = true;
  try {
    const response = await fetch('/api/buffer/channels');
    const data = await response.json();
    if (!response.ok) throw new Error('Channel loading failed');

    const channels = data.channels || [];
    q('publishing-status').textContent = `${channels.length} channel${channels.length === 1 ? '' : 's'} connected`;
    const connectionHost = q('publishing-connections');
    connectionHost.replaceChildren(...(data.connections || []).map(connection => { const item = document.createElement('small'); item.className = `publishing-connection ${connection.status || 'connected'}`; item.textContent = `${connection.name} · ${connection.status === 'connected' ? `Connected · ${connection.channelCount} channels` : 'Connection error'}`; return item; }));
    if (data.duplicates?.length) connectionHost.append(Object.assign(document.createElement('small'), { className: 'publishing-connection warning', textContent: `${data.duplicates.length} duplicate destination hidden to prevent double publishing.` }));
    state.channelLabels.clear(); state.channelData.clear();
    q('publishing-channels').replaceChildren(...channels.map((channel) => {
      const row = document.createElement('label');
      const input = document.createElement('input');
      const copy = document.createElement('span');
      const service = document.createElement('strong');
      const name = document.createElement('small');

      row.className = 'publishing-channel';
      input.type = 'checkbox';
      const key = channelKey(channel);
      input.value = key;
      service.textContent = String(channel.service || 'Channel').replace(/^./, (letter) => letter.toUpperCase());
      name.textContent = channel.name || 'Connected channel';
      copy.append(service, name);
      input.checked = state.channels.has(key);
      input.onchange = () => { input.checked ? state.channels.add(key) : state.channels.delete(key); savePublishingDraft(); renderCopyWorkspaces(); renderLinkedinDocumentControl(); };
      state.channelLabels.set(key, channelLabel(channel));
      state.channelData.set(key, channel);
      row.append(input, copy);
      return row;
    }));
    renderLinkedinDocumentControl();
  } catch (error) {
    q('publishing-status').textContent = 'Unable to load connected channels.';
    const connectionHost = q('publishing-connections');
    if (connectionHost) connectionHost.replaceChildren(Object.assign(document.createElement('small'), { className: 'publishing-connection error', textContent: 'Connection error. Retry channel loading to continue.' }));
    q('publishing-channels').replaceChildren(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'No channels are available. Caption, media, and other composer controls remain available.' })); renderLinkedinDocumentControl();
    retry.hidden = false;
  }
}

async function uploadOnce() {
  if (state.uploaded) return state.uploaded;
  if (state.mediaSource === 'existing-url') return state.existingMedia;
  if (state.carouselFiles.length || state.carouselSlides.length) {
    const carouselUploadOperation = showProcessing({ title: 'Uploading your media…', message: 'Preparing your carousel slides for publishing.' });
    try {
      const items = [];
      const count = state.carouselFiles.length || state.carouselSlides.length;
      for (let index = 0; index < count; index += 1) {
        const blob = state.carouselFiles[index] || await previewPngBlob(state.carouselSlides[index]);
        const form = new FormData();
        form.append('media', new File([blob], `carousel-slide-${String(index + 1).padStart(2, '0')}.png`, { type: 'image/png' }));
        const response = await fetch('/api/media/upload', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Carousel media upload failed.');
        items.push({ ...data.media, resourceType: 'image', slideIndex: index });
      }
      state.uploaded = { type: 'carousel', items };
      return state.uploaded;
    } finally {
      hideProcessing(carouselUploadOperation);
    }
  }
  if (state.mediaSource === 'generated') {
    if (!state.generatedPreview) throw new Error('Generated design could not be loaded. Return to Design Review and regenerate it.');
    if (!state.media) {
      const blob = await previewPngBlob(state.generatedPreview);
      state.generatedFile = new File([blob], 'generated-design.png', { type: 'image/png' });
      state.media = state.generatedFile;
    }
  }
  if (!state.media) return null;

  const form = new FormData();
  form.append('media', state.media);
  const singleUploadOperation = showProcessing({ title: 'Uploading your media…', message: (state.carouselFiles.length || state.carouselSlides.length) ? 'Preparing your carousel slides for publishing.' : 'Preparing your media for publishing.' });
  try {
    const response = await fetch('/api/media/upload', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Media upload failed.');
    state.uploaded = data.media;
    return state.uploaded;
  } finally {
    hideProcessing(singleUploadOperation);
  }
}

async function carouselFilesForLinkedinPdf() {
  if (state.carouselFiles.length) return state.carouselFiles;
  return Promise.all(state.carouselSlides.map(async (slide, index) => new File([await previewPngBlob(slide)], `carousel-slide-${index + 1}.png`, { type: 'image/png' })));
}

async function linkedInThumbnailUrl(files) {
  const uploadedSlide = state.uploaded?.type === 'carousel' ? state.uploaded.items?.[0] : null;
  if (typeof uploadedSlide?.url === 'string' && uploadedSlide.url.startsWith('https://')) return uploadedSlide.url;
  const thumbnail = files[0];
  if (!thumbnail) throw new Error('LinkedIn document could not be prepared because carousel slide 1 is unavailable.');
  const form = new FormData();
  form.append('media', thumbnail, thumbnail.name || 'carousel-slide-01.png');
  let response; let data;
  try { response = await fetch('/api/media/upload', { method: 'POST', body: form }); data = await response.json(); }
  catch { throw new Error('LinkedIn document thumbnail could not be uploaded. Your original carousel is unchanged.'); }
  if (!response.ok || typeof data.media?.url !== 'string' || !data.media.url.startsWith('https://')) throw new Error(`LinkedIn document thumbnail could not be uploaded. Your original carousel is unchanged. ${data.error?.message || ''}`.trim());
  return data.media.url;
}

async function prepareLinkedinDocument(selected) {
  const linkedIn = selected.filter(channel => channel.service === 'linkedin');
  if (!linkedIn.length || !isCarousel()) return {};
  const files = await carouselFilesForLinkedinPdf();
  const title = linkedinDocumentTitle(state.linkedinDocumentTitle || state.contentContext.headline || caption.value.split(/\r?\n/).find(line => line.trim()));
  const key = files.map(file => `${file.name}:${file.size}:${file.lastModified || 0}`).join('|') + `|${title}`;
  if (!state.linkedinDocument || state.linkedinDocument.key !== key) {
    let file;
    try { file = await carouselPdfFile(files, title); }
    catch (error) { throw new Error(`LinkedIn PDF could not be created. Your original carousel is unchanged. ${error.message || ''}`.trim()); }
    const form = new FormData(); form.append('media', file);
    let response; let data;
    try { response = await fetch('/api/media/upload', { method: 'POST', body: form }); data = await response.json(); }
    catch { throw new Error('LinkedIn PDF could not be uploaded. Your original carousel is unchanged.'); }
    if (!response.ok) throw new Error(`LinkedIn PDF could not be uploaded. Your original carousel is unchanged. ${data.error?.message || ''}`.trim());
    const thumbnailUrl = await linkedInThumbnailUrl(files);
    state.linkedinDocument = { key, media: { ...data.media, resourceType: 'document', mimeType: 'application/pdf', title, thumbnailUrl } };
  }
  return Object.fromEntries(linkedIn.map(channel => [channel.key, state.linkedinDocument.media]));
}

function reset() {
  state.mediaRef = '';
  state.media = null;
  state.uploaded = null;
  state.generatedRef = null;
  clearGeneratedMedia();
  state.carouselSlides = [];
  state.carouselFiles = [];
  invalidateLinkedinDocument(); state.linkedinDocumentTitle = '';
  state.existingMedia = null;
  state.channels.clear();
  state.platformCaptions = {}; state.platformAltText = {}; state.slideAltText = []; state.contentContext = {};
  caption.value = '';
  altText.value = '';
  mediaInput.value = '';
  out.textContent = '';
  q('publishing-channels').querySelectorAll('input').forEach((input) => { input.checked = false; });
  setMediaState('none');
  renderCopyWorkspaces();
}

q('publishing-new').onclick = reset;
q('caption-prompt-select').onchange = () => { const item = selectedCaptionPrompt(); if (item) q('publishing-ai-instruction').value = item.prompt; };
q('caption-prompt-save').onclick = () => manageCaptionPrompt('save');
q('caption-prompt-rename').onclick = () => manageCaptionPrompt('rename');
q('caption-prompt-duplicate').onclick = () => manageCaptionPrompt('duplicate');
q('caption-prompt-delete').onclick = () => manageCaptionPrompt('delete');
renderCaptionPrompts();
q('caption-mode-generic').onclick = () => { state.captionMode = 'generic'; renderCopyWorkspaces(); };
q('caption-mode-platform').onclick = () => { state.captionMode = 'platform'; renderCopyWorkspaces(); };
q('alt-mode-generic').onclick = () => { state.altTextMode = 'generic'; renderCopyWorkspaces(); };
q('alt-mode-platform').onclick = () => { state.altTextMode = 'platform'; renderCopyWorkspaces(); };
q('publishing-ai-generic').onclick = () => generateAssistant('caption');
q('publishing-ai-platform').onclick = () => generateAssistant('caption', true);
q('publishing-ai-copy').onclick = () => { selectedPlatforms().forEach(channel => { state.platformCaptions[channel.key] = caption.value; }); renderCopyWorkspaces(); };
q('publishing-ai-alt').onclick = () => generateAssistant('alt');
mediaTrigger.onclick = () => mediaInput.click();
mediaDropzone.onclick = event => { if (event.target !== mediaTrigger) mediaInput.click(); };
mediaDropzone.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); mediaInput.click(); } };
['dragenter','dragover'].forEach(type => mediaDropzone.addEventListener(type, event => { event.preventDefault(); mediaDropzone.classList.add('dragging'); }));
['dragleave','drop'].forEach(type => mediaDropzone.addEventListener(type, event => { event.preventDefault(); mediaDropzone.classList.remove('dragging'); }));
mediaDropzone.addEventListener('drop', event => { const files = event.dataTransfer?.files; if (!files?.length) return; const transfer = new DataTransfer(); [...files].forEach(file => transfer.items.add(file)); mediaInput.files = transfer.files; mediaInput.dispatchEvent(new Event('change')); });
q('publishing-retry-channels').onclick = loadChannels;
modeSelect.onchange = syncModeControl;
document.querySelectorAll('[data-publishing-mode]').forEach((control) => {
  control.onclick = () => {
    modeSelect.value = control.dataset.publishingMode;
    modeSelect.dispatchEvent(new Event('change'));
  };
});

mediaInput.onchange = async (event) => {
  const files = [...(event.target.files || [])];
  const selection = classifyManualMedia(files, supportedManualMedia);
  if (selection.kind === 'empty') return;
  if (selection.error) { out.textContent = selection.error; mediaInput.value = ''; return; }
  if (selection.kind === 'carousel') {
    state.media = null; state.uploaded = null; state.generatedRef = null; clearGeneratedMedia(); invalidateLinkedinDocument();
    state.carouselSlides = []; state.carouselFiles = files; state.carouselIndex = 0; state.existingMedia = null;
    state.contentContext = {}; state.slideAltText = files.map(() => ''); state.platformAltText = {}; altText.value = '';
    setMediaState('manual-carousel'); renderPublishingCarousel(); renderCopyWorkspaces(); renderLinkedinDocumentControl();
    try { state.mediaRef = await savePublishingMedia(files); savePublishingDraft(); }
    catch (error) { out.textContent = 'Carousel loaded, but reload recovery failed: ' + error.message; }
    return;
  }
  const [file] = files;
  state.media = file;
  state.uploaded = null;
  state.generatedRef = null;
  invalidateLinkedinDocument();
  clearGeneratedMedia();
  state.carouselSlides = [];
  state.carouselFiles = [];
  state.existingMedia = null;
  state.contentContext = {}; state.slideAltText = []; state.platformAltText = {}; altText.value = '';
  setMediaState('manual'); renderLinkedinDocumentControl();
  const url = URL.createObjectURL(file);
  const holder = q('publishing-media'); holder.replaceChildren();
  const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img'); media.src = url; if (media.tagName === 'VIDEO') { media.controls = true; media.onloadedmetadata = () => { const meta = document.createElement('small'); meta.className = 'publishing-media-meta'; meta.textContent = `${file.name} · ${bytesLabel(file.size)} · ${Math.round(media.duration || 0)} seconds`; holder.append(meta); }; } else media.alt = 'Selected media preview'; holder.append(media); if (media.tagName !== 'VIDEO') { const meta = document.createElement('small'); meta.className = 'publishing-media-meta'; meta.textContent = `${file.name} · ${bytesLabel(file.size)}`; holder.append(meta); }
  try { state.mediaRef = await savePublishingMedia(file); savePublishingDraft(); } catch (error) { out.textContent = 'Media loaded, but reload recovery failed: ' + error.message; }
};

turnIntoReel.onclick = async () => {
  const files = state.carouselFiles.length ? state.carouselFiles : (state.media?.type?.startsWith('image/') ? [state.media] : []);
  if (!files.length) return;
  turnIntoReel.disabled = true;
  out.textContent = 'Preparing your media as Reel scenes…';
  try {
    let resolve, reject; const completion = { promise: new Promise((res, rej) => { resolve = res; reject = rej; }), resolve, reject };
    document.dispatchEvent(new CustomEvent('reel:use-uploaded-media', { detail: { files, title: state.contentContext.headline || caption.value.split(/\r?\n/).find(line => line.trim()) || 'Publishing Reel', source: 'publishing-media', sourceKind: 'publishing', sourceIdentity: state.mediaRef || null, completion } }));
    await completion.promise;
    out.textContent = 'Your media is ready in Reel Builder.';
  } catch (error) {
    out.textContent = error.message || 'The media could not be turned into a Reel.';
  } finally { turnIntoReel.disabled = false; }
};

button.onclick = async () => {
  if (state.busy) return;
  const selected = selectedPlatforms();
  const missingPlatformCaption = state.captionMode === 'platform' && selected.some(channel => !(state.platformCaptions[channel.key] || '').trim());
  const activeCaption = state.captionMode === 'platform' ? (missingPlatformCaption ? '' : (caption.value.trim() || state.platformCaptions[selected[0]?.key] || '')) : caption.value;
  if (!activeCaption.trim() || !state.channels.size) {
    out.textContent = state.captionMode === 'platform' && missingPlatformCaption ? 'Add a caption for every selected channel.' : 'Add a caption and select at least one channel.';
    return;
  }

  const schedule = modeSelect.value === 'schedule';
  let dueAt;
  if (schedule) {
    const local = `${q('publishing-date').value}T${q('publishing-time').value}`;
    if (!q('publishing-date').value || !q('publishing-time').value || Number.isNaN(Date.parse(local)) || Date.parse(local) <= Date.now()) {
      out.textContent = 'Choose a future schedule date and time.';
      return;
    }
    dueAt = new Date(local).toISOString();
  }

  const confirmation = schedule
    ? `Schedule this post for ${q('publishing-date').value} ${q('publishing-time').value} on ${state.channels.size} selected channel(s)?`
    : `Publish this post to ${state.channels.size} selected channel(s) now?`;
  if (!confirm(confirmation)) return;

  state.busy = true;
  const publishOperation = showProcessing({ title: schedule ? 'Scheduling your post…' : 'Publishing your post…', message: (state.carouselFiles.length || state.carouselSlides.length) ? 'Uploading and publishing your carousel in the correct slide order.' : schedule ? 'Preparing your content for scheduled publishing.' : 'Sending your content to the selected channels.' });
  button.disabled = true;
  button.textContent = schedule ? 'Scheduling...' : 'Publishing...';
  try {
    const media = await uploadOnce();
    const mediaByDestination = await prepareLinkedinDocument(selected);
    updateProcessing(publishOperation, { title: schedule ? 'Scheduling your post…' : 'Publishing your post…', message: (state.carouselFiles.length || state.carouselSlides.length) ? 'Uploading and publishing your carousel in the correct slide order.' : schedule ? 'Preparing your content for scheduled publishing.' : 'Sending your content to the selected channels.' });
    const response = await fetch('/api/publishing/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: activeCaption,
        tiktokTitle: state.contentContext.headline || '',
        ...(state.captionMode === 'platform' ? { channelTexts: Object.fromEntries(selectedPlatforms().map(channel => [channel.key, state.platformCaptions[channel.key] || caption.value]).filter(([, text]) => text.trim())) } : {}),
        accessibility: { altTextMode: state.altTextMode, genericAltText: altText.value, platformAltText: state.platformAltText, carouselSlideAltText: state.slideAltText },
        destinations: selectedPlatforms().map(channel => ({ connectionId: channel.connectionId || 'legacy', channelId: channel.id })),
        mode: schedule ? 'customScheduled' : 'shareNow',
        ...(dueAt ? { dueAt } : {}),
        ...(media ? { media } : {}),
        ...(Object.keys(mediaByDestination).length ? { mediaByDestination } : {})
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Publishing failed.');
    out.textContent = data.results.map((result) => {
      const label = state.channelLabels.get(`${result.connectionId || 'legacy'}:${result.channelId}`) || 'Selected channel';
      return result.success
        ? `✓ ${label}\n  ${schedule ? 'Scheduled successfully' : 'Published successfully'}`
        : `✕ ${label}\n  ${result.error}`;
    }).join('\n\n');
  } catch (error) {
    out.textContent = error.message;
  } finally {
    hideProcessing(publishOperation);
    state.busy = false;
    button.disabled = false;
    syncModeControl();
  }
};

document.addEventListener('publishing:generated', async (event) => {
  const result = event.detail || {};
  const completion = result.completion;
  const preserveAltText = Boolean(result.resultRef && result.resultRef === state.generatedRef);
  const carousel = handoffCarousel(result);
  beginMediaLifecycle();
  const publishingHandoffOperation = showProcessing({ title: 'Preparing Publishing…', message: 'Loading your prepared design.' });
  try {
  console.info('[CAROUSEL PUBLISH] 7. Publishing received handoff');
  state.media = null;
  state.uploaded = null;
  state.generatedRef = result.resultRef || null;
  invalidateLinkedinDocument();
  state.contentContext = { ...state.contentContext, source: result.source || 'unknown', contentType: result.contentType || result.contentFormat || 'single-image', itemId: result.itemId || result.id || null, resultRef: result.resultRef || '', reel: result.reelContext || null };
  clearGeneratedMedia();
  state.carouselSlides = [];
  state.carouselFiles = [];
  state.existingMedia = null;
  mediaInput.value = '';
  if (!preserveAltText) { altText.value = ''; state.platformAltText = {}; state.slideAltText = []; }
  state.platformCaptions = {};
  caption.value = [result.headline, result.supportingCopy, result.cta].filter(Boolean).join('\n\n');
  state.contentContext = { ...state.contentContext, headline: result.headline || '', supportingCopy: result.supportingCopy || '', cta: result.cta || '', carousel, brand: { name: brand.name || 'Upplai', aiInstruction: brand.aiInstruction || '' } };
  if (!preserveAltText && Array.isArray(carousel?.slides)) state.slideAltText = carousel.slides.map(() => '');

  if (result.reelMediaRef) {
    const asset = await loadCalendarAsset(result.reelMediaRef);
    if (!asset?.file || asset.file.type !== 'video/mp4') throw new Error('The rendered Reel MP4 could not be loaded. Return to Reels and render it again.');
    state.media = asset.file;
    state.mediaRef = await savePublishingMedia(state.media, `publishing-reel:${result.reelMediaRef}`);
    prepareVideoMediaPreview(state.media);
    setMediaState('reel');
    out.textContent = 'Reel video ready for publishing.';
  } else if (result.preparedFullArtwork) {
    state.media = await preparedArtworkFile(result.preparedFullArtwork);
    mediaLog('[HANDOFF] rendered', `publishing-generated:${state.generatedRef}`, state.media);
    state.mediaRef = await savePublishingMedia(state.media, `publishing-generated:${state.generatedRef}`);
    prepareGeneratedMediaPreview();
    setMediaState('generated-direct');
    out.textContent = 'Generated Full AI artwork ready for publishing.';
  } else {
  const asset = await loadCalendarAsset(result.resultRef);
  if (!asset) throw new Error('Generated design could not be loaded. Return to Design Review and regenerate it.');
  {
    const template = document.createElement('template');
    template.innerHTML = ['carousel', 'multi-page'].includes(asset.type) ? asset.slides?.[0]?.html || '' : asset.html;
    state.generatedPreview = template.content.firstElementChild;
    if (!state.generatedPreview) throw new Error('Generated design could not be loaded. Return to Design Review and regenerate it.');
    if (['carousel', 'multi-page'].includes(asset.type)) {
      state.carouselSlides = (asset.slides || []).map(slide => { const node = document.createElement('template'); node.innerHTML = slide.html; return node.content.firstElementChild; });
      if (!state.carouselSlides.length || state.carouselSlides.some(slide => !slide)) throw new Error('Generated carousel could not be loaded. Return to Carousel and try again.');
      state.carouselFiles = await Promise.all(state.carouselSlides.map(async (slide, index) => new File([await previewPngBlob(slide)], `generated-slide-${index + 1}.png`, { type: 'image/png' })));
      syncCarouselAltText(state.carouselFiles.length);
      mediaLog('[HANDOFF] rendered', `publishing-generated:${state.generatedRef}`, state.carouselFiles);
      state.mediaRef = await savePublishingMedia(state.carouselFiles, `publishing-generated:${state.generatedRef}`);
      state.carouselIndex = 0; renderPublishingCarousel(); renderLinkedinDocumentControl();
    } else {
      state.generatedFile = new File([await previewPngBlob(state.generatedPreview)], 'generated-design.png', { type: 'image/png' });
      state.media = state.generatedFile;
      mediaLog('[HANDOFF] rendered', `publishing-generated:${state.generatedRef}`, state.media);
      state.mediaRef = await savePublishingMedia(state.media, `publishing-generated:${state.generatedRef}`);
      prepareGeneratedMediaPreview();
    }
    setMediaState('generated'); out.textContent = asset.type === 'carousel' ? 'Carousel loaded with all slides. Publishing will upload them in this order when you confirm.' : asset.type === 'multi-page' ? 'Multi-page design loaded with all pages. Publishing will upload them in this order when you confirm.' : 'Generated design ready for publishing.';
  }
  }
    if (!state.mediaRef || (['carousel', 'multi-page'].includes(result.contentType || result.contentFormat) && !state.carouselFiles.length) || (!['carousel', 'multi-page'].includes(result.contentType || result.contentFormat) && !state.media)) throw new Error('Publishing media could not be prepared. Your design has not been sent to Publishing.');
    renderCopyWorkspaces();
  savePublishingDraft(); showPublishingTab('composer');
  document.dispatchEvent(new Event('navigate:publishing'));
    if (!validPublishingMedia(state.carouselFiles.length ? state.carouselFiles : state.media)) throw new Error('Publishing media is empty or invalid.');
    mediaLog('[HANDOFF] saved', state.mediaRef, state.carouselFiles.length ? state.carouselFiles : state.media); mediaLog('[HANDOFF] reference', state.mediaRef, state.carouselFiles.length ? state.carouselFiles : state.media);
    completion?.resolve({ mediaRef: state.mediaRef, carouselFiles: state.carouselFiles.length });
  console.info('[CAROUSEL PUBLISH] 8. complete');
  } catch (error) {
    setMediaState('none', error.message || 'Generated design could not be loaded.');
    out.textContent = error.message || 'Generated design could not be loaded.';
    completion?.reject(error);
    console.error('[CAROUSEL PUBLISH] Publishing handoff failed', error);
  } finally { hideProcessing(publishingHandoffOperation); }
});

syncModeControl();
renderCopyWorkspaces();
q('publishing-linkedin-document-title').oninput = event => { state.linkedinDocumentTitle = linkedinDocumentTitle(event.target.value); invalidateLinkedinDocument(); savePublishingDraft(); };
renderLinkedinDocumentControl();
loadChannels();
const management = q('publishing-management');
const composer = q('publishing-composer');
const managementList = q('publishing-management-list');
const managementStatus = q('publishing-management-status');


function localDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function managementMedia(post) {
  const asset = post.assets?.[0];
  const holder = document.createElement('div');
  holder.className = 'publishing-post-thumb';
  if (!asset?.url) { holder.textContent = 'Text only'; return holder; }
  const media = document.createElement(asset.resourceType === 'video' ? 'video' : 'img');
  media.src = asset.url;
  if (media.tagName === 'IMG') media.alt = 'Post media'; else media.muted = true;
  holder.append(media); return holder;
}

function scheduleAgain(post) {
  reset();
  caption.value = post.text || '';
  if (post.channelId) {
    state.channels.add(`${post.connectionId || 'legacy'}:${post.channelId}`);
    q('publishing-channels').querySelectorAll('input').forEach(input => { input.checked = input.value === `${post.connectionId || 'legacy'}:${post.channelId}`; });
  }
  const media = post.assets?.[0];
  if (media?.url) {
    state.existingMedia = media;
    state.media = null;
    state.uploaded = null;
    setMediaState('existing-url');
    const image = document.createElement(media.resourceType === 'video' ? 'video' : 'img');
    image.src = media.url;
    if (image.tagName === 'VIDEO') image.controls = true; else image.alt = 'Existing post media';
    q('publishing-media').replaceChildren(image);
  }
  showPublishingTab('composer');
}

function postCard(post) {
  const card = document.createElement('article'); card.className = 'publishing-post-card';
  const copy = document.createElement('div'); copy.className = 'publishing-post-copy';
  const label = document.createElement('small'); label.textContent = `${channelLabel({ service: post.service, name: post.channelName })} · ${localDate(post.dueAt)}`;
  const text = document.createElement('p'); text.textContent = post.text || 'No caption'; copy.append(label, text);
  const actions = document.createElement('div'); actions.className = 'publishing-post-actions';
  const again = document.createElement('button'); again.type = 'button'; again.textContent = 'Schedule Again'; again.onclick = () => scheduleAgain(post); actions.append(again);
  if (managementStatusName === 'scheduled') {
    const reschedule = document.createElement('button'); reschedule.type = 'button'; reschedule.textContent = 'Reschedule';
    reschedule.onclick = () => {
      const form = document.createElement('div'); form.className = 'publishing-reschedule';
      const date = document.createElement('input'); date.type = 'date'; const time = document.createElement('input'); time.type = 'time';
      const current = new Date(post.dueAt); if (!Number.isNaN(current.getTime())) { date.value = current.toLocaleDateString('en-CA'); time.value = current.toTimeString().slice(0, 5); }
      const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save new time';
      save.onclick = async () => { const local = `${date.value}T${time.value}`; if (!date.value || !time.value || Number.isNaN(Date.parse(local)) || Date.parse(local) <= Date.now()) { managementStatus.textContent = 'Choose a future schedule time.'; return; } try { const response = await fetch(`/api/buffer/posts/${encodeURIComponent(post.id)}/reschedule`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dueAt: new Date(local).toISOString(), connectionId: post.connectionId || 'legacy' }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message); managementStatus.textContent = 'Post rescheduled successfully.'; loadManagement(); } catch (error) { managementStatus.textContent = error.message || 'Buffer could not reschedule this post.'; } };
      const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Cancel'; close.onclick = () => { form.remove(); reschedule.disabled = false; };
      form.append(date, time, save, close); card.append(form); reschedule.disabled = true;
    };
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.onclick = async () => { if (!confirm('Cancel this scheduled post? It will be removed from Buffer’s queue.')) return; try { const response = await fetch(`/api/buffer/posts/${encodeURIComponent(post.id)}?connectionId=${encodeURIComponent(post.connectionId || 'legacy')}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message); managementStatus.textContent = 'Scheduled post cancelled.'; loadManagement(); } catch (error) { managementStatus.textContent = error.message || 'Buffer could not cancel this post.'; } };
    actions.prepend(reschedule, cancel);
  }
  card.append(managementMedia(post), copy, actions); return card;
}

async function loadManagement() {
  managementStatus.textContent = 'Loading posts…'; managementList.replaceChildren();
  try { const response = await fetch(`/api/buffer/posts?status=${managementStatusName}`); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message); const posts = data.posts || []; managementStatus.textContent = ''; managementList.replaceChildren(...(posts.length ? posts.map(postCard) : [Object.assign(document.createElement('p'), { textContent: managementStatusName === 'scheduled' ? 'No scheduled posts yet.' : 'No published posts yet.' })])); } catch (error) { managementStatus.textContent = error.message || 'Buffer posts are unavailable.'; }
}
function showPublishingTab(tab) {
  document.querySelectorAll('[data-publishing-tab]').forEach(button => { const active = button.dataset.publishingTab === tab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  composer.hidden = tab !== 'composer'; management.hidden = tab === 'composer';
      if (tab !== 'composer') { managementStatusName = tab === 'scheduled' ? 'scheduled' : 'sent'; q('publishing-management-title').textContent = tab === 'scheduled' ? 'Scheduled' : 'Published'; loadManagement(); }
}
document.querySelectorAll('[data-publishing-tab]').forEach(button => { button.onclick = () => showPublishingTab(button.dataset.publishingTab); });
q('publishing-management-refresh').onclick = loadManagement;
caption.addEventListener('input', savePublishingDraft); altText.addEventListener('input', savePublishingDraft); q('publishing-ai-instruction').addEventListener('input', savePublishingDraft); modeSelect.addEventListener('change', savePublishingDraft); q('publishing-date').addEventListener('input', savePublishingDraft); q('publishing-time').addEventListener('input', savePublishingDraft);
if (managementStatusName !== 'composer') showPublishingTab(managementStatusName);

// Rehydrate media without replaying the handoff (which would overwrite edited copy).
async function restorePublishingMedia() {
  const lifecycle = mediaLifecycleVersion;
  const reference = state.mediaRef;
  const source = state.mediaSource;
  const current = () => lifecycle === mediaLifecycleVersion && reference === state.mediaRef && source === state.mediaSource;
  try {
    if (state.mediaSource === 'generated-direct' && state.mediaRef) {
      const savedMedia = await loadCalendarAsset(state.mediaRef); if (!current()) return;
      mediaLog('[PUBLISHING] reference found', state.mediaRef, savedMedia?.file);
      if (!savedMedia?.file) throw new Error('Saved Full AI artwork is unavailable. Send it to Publishing again.');
      state.media = savedMedia.file; prepareGeneratedMediaPreview(); setMediaState('generated-direct'); mediaLog('[PUBLISHING] file restored', state.mediaRef, state.media); mediaLog('[PUBLISHING] media state set', state.mediaRef, state.media); mediaLog('[PUBLISHING] preview rendered', state.mediaRef, state.media);
    } else if (state.mediaSource === 'generated' && state.generatedRef) {
      const asset = await loadCalendarAsset(state.generatedRef); if (!current()) return;
      if (!asset) throw new Error('Saved design is unavailable. Send it to Publishing again.');
      const node = html => { const template = document.createElement('template'); template.innerHTML = html || ''; return template.content.firstElementChild; };
      state.carouselSlides = ['carousel','multi-page'].includes(asset.type) ? asset.slides.map(slide => node(slide.html)) : [];
      state.generatedPreview = state.carouselSlides[0] || node(asset.html);
      const savedMedia = state.mediaRef ? await loadCalendarAsset(state.mediaRef) : null; if (!current()) return;
      mediaLog('[PUBLISHING] reference found', state.mediaRef, savedMedia?.file);
      if (state.carouselSlides.length) {
        state.carouselFiles = Array.isArray(savedMedia?.file) ? savedMedia.file : [];
        if (!state.carouselFiles.length) throw new Error('Saved publishing media is unavailable. Send the latest design to Publishing again.');
        syncCarouselAltText(state.carouselFiles.length);
        renderPublishingCarousel(); mediaLog('[PUBLISHING] file restored', state.mediaRef, state.carouselFiles); mediaLog('[PUBLISHING] preview rendered', state.mediaRef, state.carouselFiles);
      } else {
        if (!savedMedia?.file) throw new Error('Saved publishing media is unavailable. Send the latest design to Publishing again.');
        state.media = savedMedia.file; prepareGeneratedMediaPreview(); mediaLog('[PUBLISHING] file restored', state.mediaRef, state.media); mediaLog('[PUBLISHING] preview rendered', state.mediaRef, state.media);
      }
      setMediaState('generated'); mediaLog('[PUBLISHING] media state set', state.mediaRef, state.carouselFiles.length ? state.carouselFiles : state.media);
    } else if (state.mediaSource === 'manual-carousel' && state.mediaRef) {
      const asset = await loadCalendarAsset(state.mediaRef); if (!current()) return;
      if (!Array.isArray(asset?.file) || asset.file.length < 2) throw new Error('Saved carousel upload is unavailable. Please attach it again.');
      state.media = null; state.carouselSlides = []; state.carouselFiles = asset.file; state.carouselIndex = 0;
      if (state.slideAltText.length !== state.carouselFiles.length) state.slideAltText = state.carouselFiles.map(() => '');
      renderPublishingCarousel(); setMediaState('manual-carousel');
    } else if (state.mediaSource === 'manual' && state.mediaRef) {
      const asset = await loadCalendarAsset(state.mediaRef);
      if (!asset?.file) throw new Error('Saved upload is unavailable. Please attach it again.');
      state.media = asset.file;
      const media = document.createElement(state.media.type.startsWith('video/') ? 'video' : 'img');
      media.src = URL.createObjectURL(state.media); if (media.tagName === 'VIDEO') media.controls = true;
      q('publishing-media').replaceChildren(media); setMediaState('manual');
    } else if (state.mediaSource === 'existing-url' && state.existingMedia?.url) {
      const media = document.createElement(state.existingMedia.resourceType === 'video' ? 'video' : 'img'); media.src = state.existingMedia.url; if (media.tagName === 'VIDEO') media.controls = true;
      q('publishing-media').replaceChildren(media); setMediaState('existing-url');
    }
  } catch (error) { if (!current()) return; console.error('[PUBLISHING] restore failed', { reference, reason: error.message || String(error) }); out.textContent = error.message; setMediaState('none', error.message); }
  renderLinkedinDocumentControl();
}
restorePublishingMedia();
document.getElementById('section-publishing')?.addEventListener('change', savePublishingDraft);
window.addEventListener('pagehide', savePublishingDraft);
