import { aiDefaults, setupAIControls, aiRequest, aiImageRequest, dataUrlToFile, directorInput, prepareAIImage, applyAIStyle } from '/src/ai-style.js';
import { validatePlan } from '/src/ai-plan.mjs';
import { typography, typographyDefaults, typographyLabels, advancedFields, overrideField, migrateTypography, applyTypography, clearTypography } from '/src/typography.js';
import { freeCompositions, selectComposition, nextComposition, applyFreeStyle } from '/src/free-style.js';
import { brand, applyBrand } from '/src/brand.js';
import { designStyles } from '/src/styles.js';
import { loadState, saveState } from '/src/storage.js';
import { applyTemplate, fitTemplate } from '/src/templates.js';
import { downloadPng } from '/src/export.js';
import { calendarResultRef, saveCalendarAsset, loadCalendarAsset } from '/src/calendar-assets.js';
import { loadCalendar, saveCalendar } from '/src/calendar.js';
import { generateDesign, normalizeDesignInput } from '/src/design-controller.js';
import { beginLocalEdits, setupLocalEditor } from '/src/local-editor.js';
import { showProcessing, hideProcessing } from '/src/processing.js';
import { handoffToPublishing } from '/src/publishing-handoff.mjs';
import { canvasDimensions, setCanvasDimensions } from '/src/design-format.js';
import { setupDesignReformat } from '/src/design-reformat.js';

applyBrand();
setupAIControls();

const form = document.querySelector('#generator');
const status = document.querySelector('#status');
let preview = document.querySelector('#preview');
const frame = document.querySelector('#canvas-frame');
const stage = document.querySelector('#canvas-stage');
const warning = document.querySelector('#fit-warning');
const download = document.querySelector('#download');
const sendToPublish = document.querySelector('#send-to-publish');
const createReelFromDesign = document.querySelector('#create-reel-from-design');
const generate = form.querySelector('button[type=submit]');
const another = document.querySelector('#try-another');
let shownComposition = null;
let aiDesign = null;
let aiVersions = [];
let aiCurrentVersionId = null;
let aiBusy = false;
let designReformat = null;
let aiConfiguration = null;
const regenerate = document.querySelector('#regenerate-visual');
const aiIteration = document.querySelector('#ai-iteration');
const aiRefinementInstruction = document.querySelector('#ai-refinement-instruction');
const aiRefineCurrent = document.querySelector('#ai-refine-current');
const aiTryAnotherVersion = document.querySelector('#ai-try-another-version');
const aiGenerationHistory = document.querySelector('#ai-generation-history');
const aiGenerationInfo = document.querySelector('#ai-generation-info-content');
const editDesign = document.querySelector('#edit-design');
const saveCalendarDesign = document.querySelector('#save-calendar-design');
const saveCarouselSlide = document.querySelector('#save-carousel-slide');
const carouselEditorActions = document.querySelector('#carousel-editor-actions');
const carouselEditorBack = document.querySelector('#carousel-editor-back');
const carouselEditorPrevious = document.querySelector('#carousel-editor-previous');
const carouselEditorNext = document.querySelector('#carousel-editor-next');
const carouselEditorPosition = document.querySelector('#carousel-editor-position');
const localDesignEditor = document.querySelector('#local-design-editor');
const localEditorControls = document.querySelector('#local-editor-controls');
const resetDesignEdits = document.querySelector('#reset-design-edits');
const canvasZoomControls = document.querySelector('#canvas-zoom-controls');
const canvasFit = document.querySelector('#canvas-fit');
const canvasZoomOut = document.querySelector('#canvas-zoom-out');
const canvasZoomIn = document.querySelector('#canvas-zoom-in');
const canvasZoomValue = document.querySelector('#canvas-zoom-value');

const customBackgroundControl =
  document.querySelector('#custom-background-control');

const backgroundImageControl =
  document.querySelector('#background-image-control');

const minimalControls =
  document.querySelector('#minimal-controls');

const defaults = {
  ...aiDefaults,
  headline: '',
  supportingCopy: '',
  cta: '',
  style: 'premium-editorial',
  logo: 'on',
  placement: 'auto',
  background: 'template',
  backgroundColor: '#f5f1e8',
  textColor: '#0b1739',
  ...typographyDefaults,
  freeVariation: 'auto',
  freeCustomText: 'off',
  freeTextColor: '#101d30',
  ...Object.fromEntries(advancedFields.map(key => [overrideField(key), 'auto'])),
  imageOverlay: 'none',
  overlayStrength: 'medium'
};

const placements = [
  'auto',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
];

let revision = 0;
let currentStyle = null;
let logoPromise = null;
let backgroundImageData = null;
let backgroundImageLoading = Promise.resolve(null);
let imageRequest = 0;
let localEditor = null;
let calendarEditorRowId = null;
let calendarEditorPreviousState = null;
let carouselEditorContext = null;
let editorZoom = .46;
let editorZoomMode = 'fit';
let fitFrame = 0;

const clampEditorZoom = value => Math.min(1.25, Math.max(.25, value));

function setEditorZoom(value, mode = 'manual') {
  editorZoom = mode === 'fit' ? Math.min(1.25, Math.max(.05, value)) : clampEditorZoom(value);
  editorZoomMode = mode;
  preview.style.setProperty('--editor-zoom', String(editorZoom));
  canvasZoomValue.textContent = Math.round(editorZoom * 100) + '%';
}

function fitEditorCanvas() {
  if (localDesignEditor.hidden) return;
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    const width = Math.max(0, stage.clientWidth - 32);
    const height = Math.max(0, stage.clientHeight - 32);
    const size = canvasDimensions(preview);
    setEditorZoom(Math.min(width / size.width, height / size.height) * .96, 'fit');
  });
}

function queueFitEditorCanvas() {
  if (editorZoomMode === 'fit' && !localDesignEditor.hidden) {
    fitEditorCanvas();
  }
}

function cleanEditedPreview(source) {
  const clone = source.cloneNode(true);
  clone.querySelectorAll('[data-editor-ui="true"]').forEach(node => node.remove());
  clone.querySelectorAll('.direct-edit-target, .direct-edit-selected').forEach(node => {
    node.classList.remove('direct-edit-target', 'direct-edit-selected');
    node.removeAttribute('contenteditable');
  });
  delete clone.dataset.selectedEditorElement;
  return clone;
}

function closeLocalEditor() {
  localEditor?.destroy?.();
  localEditor = null;
  localEditorControls.replaceChildren();
  localDesignEditor.hidden = true;
  canvasZoomControls.hidden = true;
  saveCarouselSlide.hidden = true;
  carouselEditorActions.hidden = true;
  preview.style.removeProperty('--editor-zoom');
  editDesign.textContent = 'Edit Design';
  scalePreview();
}

function openLocalEditor() {
  if (!currentStyle) return;
  localEditor?.destroy?.();
  beginLocalEdits(preview);
  localEditor = setupLocalEditor(preview, localEditorControls, () => {
    if (calendarEditorRowId) status.textContent = 'Edits are local. Save to Calendar when you are ready.';
  });
  localDesignEditor.hidden = false;
  canvasZoomControls.hidden = false;
  editDesign.textContent = 'Editing Design';
  fitEditorCanvas();
}


// ==========================================================
function openSharedEditor(options = {}) {
  const { source = 'create', contentType = 'single-image', designMode = 'native', itemId = null, resultRef = '', renderedPreview = null, style = null, returnDestination = 'create', carouselContext = null } = options;
  if (renderedPreview?.cloneNode && renderedPreview !== preview) { const imported = cleanEditedPreview(renderedPreview); imported.id = 'preview'; preview.replaceWith(imported); preview = imported; }
  if (source !== 'create') { document.querySelector('#create-preview-panel').hidden = false; document.querySelector('#generator').closest('.controls').hidden = false; document.querySelector('#carousel-builder').hidden = true; document.querySelector('#multi-page-builder').hidden = true; }
  currentStyle = style || preview.dataset?.style || currentStyle || 'premium-editorial'; calendarEditorRowId = source === 'calendar-single' ? itemId : null; carouselEditorContext = carouselContext;
  frame.hidden = false; warning.hidden = true; document.querySelector('#empty-preview').hidden = true; download.disabled = false; editDesign.hidden = false; sendToPublish.hidden = contentType !== 'single-image'; createReelFromDesign.hidden = contentType !== 'single-image'; sendToPublish.disabled = contentType !== 'single-image'; saveCalendarDesign.hidden = source !== 'calendar-single'; saveCarouselSlide.hidden = !carouselContext;
  if (['builder','multi-page-builder'].includes(carouselContext?.source)) updateCarouselEditorActions(); else carouselEditorActions.hidden = true;
  preview.dataset.editSource = source; preview.dataset.contentType = contentType; preview.dataset.designMode = designMode; preview.dataset.itemId = itemId || ''; preview.dataset.resultRef = resultRef || ''; preview.dataset.returnDestination = returnDestination;
  if (source !== 'create') designReformat?.reset();
  scalePreview(); openLocalEditor(); return localEditor;
}

// PREVIEW SCALING
// ==========================================================

function scalePreview() {
  const size = canvasDimensions(preview);
  if (localDesignEditor.hidden) {
    frame.style.aspectRatio = `${size.width} / ${size.height}`;
    stage.style.width = size.width + 'px';
    stage.style.height = size.height + 'px';
  }
  if (!localDesignEditor.hidden) {
    stage.style.transform = 'none';
    queueFitEditorCanvas();
    return;
  }

  stage.style.transform =
    `scale(${frame.clientWidth / size.width})`;
}

new ResizeObserver(scalePreview).observe(frame);

canvasFit.addEventListener('click', fitEditorCanvas);
canvasZoomOut.addEventListener('click', () => setEditorZoom(editorZoom - .1));
canvasZoomIn.addEventListener('click', () => setEditorZoom(editorZoom + .1));


// ==========================================================
// LOGO
// ==========================================================

function loadLogo() {
  if (!logoPromise) {
    logoPromise = (async () => {
      try {
        if (!brand.logoUrl) return null;

        const response = await fetch(
          brand.logoUrl,
          { signal: AbortSignal.timeout(5000) }
        );

        if (!response.ok) return null;

        const blob = await response.blob();

        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;

          reader.readAsDataURL(blob);
        });

        const image = new Image();
        image.src = data;

        await image.decode();

        return data;
      } catch {
        return null;
      }
    })();
  }

  return logoPromise;
}


// ==========================================================
// DESIGN STYLE OPTIONS
// ==========================================================

for (const style of designStyles) {
  form.elements.style.add(
    new Option(style.name, style.id)
  );
}


// ==========================================================
// LOAD SAVED STATE
// ==========================================================

// Build both sets of controls from the same shared options.
function addTypographyControls(container, advanced = false) {
  for (const key of advanced ? advancedFields : Object.keys(typography)) {
    const name = advanced ? overrideField(key) : key;
    const label = document.createElement('label');
    label.htmlFor = name;
    label.textContent = typographyLabels[key];
    const select = document.createElement('select');
    select.id = select.name = name;
    if (advanced) select.add(new Option('Auto', 'auto'));
    for (const [value, option] of Object.entries(typography[key])) select.add(new Option(option.label, value));
    container.append(label, select);
  }
}
addTypographyControls(document.querySelector('#minimal-typography-fields'));
addTypographyControls(document.querySelector('#free-typography-fields'), true);
form.elements.freeVariation.add(new Option('Auto', 'auto'));
for (const item of freeCompositions) form.elements.freeVariation.add(new Option(item.name, item.id));

const saved = loadState();
saved.value = migrateTypography(saved.value);

for (const [key, fallback] of Object.entries(defaults)) {
  const input = form.elements[key];

  if (!input) continue;

  const value =
    typeof saved.value[key] === 'string'
      ? saved.value[key]
      : fallback;

  if (
    input.tagName === 'TEXTAREA' ||
    (
      input.tagName === 'INPUT' &&
      !['color', 'file'].includes(input.type)
    )
  ) {
    input.value =
      input.maxLength > 0
        ? value.slice(0, input.maxLength)
        : value;
  } else {
    input.value = value;
  }

  if (
    input.tagName === 'SELECT' &&
    input.selectedIndex === -1
  ) {
    input.value = fallback;
  }
}


// ==========================================================
// STATE
// ==========================================================

function applyFormValues(values = {}) {
  Object.entries(values).forEach(([key, value]) => {
    const control = form.elements[key];
    if (control && typeof value !== 'object') control.value = String(value ?? '');
  });
  updateControls();
}

function populateCalendarForm(row = {}) {
  const saved = row.designConfig && typeof row.designConfig === 'object'
    ? row.designConfig
    : {};
  const values = {
    ...defaults,
    ...saved,
    headline: row.headline ?? saved.headline ?? '',
    supportingCopy: row.supportingCopy ?? saved.supportingCopy ?? '',
    cta: row.cta ?? saved.cta ?? '',
    style: row.style || saved.style || defaults.style,
    logo: saved.logo || row.logo || defaults.logo,
    placement: saved.placement || row.placement || defaults.placement,
    aiVisualStyle: saved.aiVisualStyle || row.ai?.visualStyle || defaults.aiVisualStyle,
    aiSubject: saved.aiSubject || row.ai?.subjectType || defaults.aiSubject,
    aiComposition: saved.aiComposition || row.ai?.composition || defaults.aiComposition,
    aiDirection: saved.aiDirection ?? row.ai?.direction ?? defaults.aiDirection,
    aiQuality: saved.aiQuality || row.ai?.quality || defaults.aiQuality,
    aiRenderMode: saved.aiRenderMode || row.ai?.renderMode || defaults.aiRenderMode,
    aiDesignPrompt: saved.aiDesignPrompt ?? row.ai?.designPrompt ?? defaults.aiDesignPrompt
  };
  applyFormValues(values);
}
function state() {
  return normalizeDesignInput(Object.fromEntries(
    Object.keys(defaults).map(key => [
      key,
      form.elements[key].value
    ])
  ));
}


// ==========================================================
// CONTROLS
// ==========================================================

function updateControls() {
  const selectedStyle =
    designStyles.find(
      style => style.id === form.elements.style.value
    );

  document.querySelector('#style-description').textContent =
    selectedStyle?.description || '';

  form.elements.placement.disabled =
    form.elements.logo.value === 'off';

  const background =
    form.elements.background.value;

  customBackgroundControl.hidden =
    background !== 'custom';

  backgroundImageControl.hidden =
    background !== 'image';

  minimalControls.hidden =
    form.elements.style.value !== 'minimal-post';
  const ai = form.elements.style.value === 'openai-style';
  document.querySelector('#ai-controls').hidden = !ai;
  document.querySelector('#ai-direction-control').hidden = form.elements.aiSubject.value !== 'custom';
  document.querySelector('#ai-custom-color-control').hidden = form.elements.aiTextColor.value !== 'custom';
  generate.textContent = ai ? 'Generate AI Design' : 'Generate Preview';
  generate.disabled = aiBusy || ai && (!aiConfiguration || !!aiConfiguration.error || !aiConfiguration.mockMode && !aiConfiguration.configured);
  regenerate.hidden = !ai || !aiDesign;
regenerate.disabled = aiBusy;
  aiIteration.hidden = !ai || !aiDesign;
  aiRefineCurrent.disabled = aiBusy;
  aiTryAnotherVersion.disabled = aiBusy;
  aiGenerationInfo.textContent = aiConfiguration ? `${aiConfiguration.imageEngine || 'OpenAI Images API'} · ${aiConfiguration.imageModel || 'Unknown model'} · ${aiConfiguration.defaultQuality || 'draft'} quality` : 'Generation configuration is loading.';
  const free = form.elements.style.value === 'free-style';
  document.querySelector('#free-controls').hidden = !free;
  document.querySelector('#background-controls').hidden = minimalControls.hidden && !free;
  another.hidden = !free;
  document.querySelector('#free-text-color-control').hidden = form.elements.freeCustomText.value !== 'on';
  document.querySelector('#image-overlay-controls').hidden = background !== 'image';
  document.querySelector('#overlay-strength-control').hidden = form.elements.imageOverlay.value === 'none';
}

updateControls();

status.textContent = saved.available
  ? 'Ready. Form changes are saved in this browser.'
  : 'Ready. Browser storage is unavailable; changes may not survive refresh.';


// ==========================================================
// BACKGROUND IMAGE
// ==========================================================

form.elements.backgroundImage.addEventListener('change', event => {
  const file = event.target.files?.[0];
  const request = ++imageRequest;
  backgroundImageData = null;
  currentStyle = null;
  download.disabled = true;
  sendToPublish.hidden = true;
  createReelFromDesign.hidden = true;
  sendToPublish.disabled = true;
  backgroundImageLoading = (async () => {
    if (!file) return null;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        throw new Error('Choose a PNG, JPG or WebP image.');
      }
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The background image could not be read.'));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = data;
      await image.decode();
      if (request !== imageRequest) return null;
      backgroundImageData = data;
      status.textContent = 'Background image ready. Generate Preview to apply it.';
      return data;
    } catch {
      if (request === imageRequest) status.textContent = 'The background image could not be loaded. Choose a valid PNG, JPG or WebP image.';
      return null;
    }
  })();
});

// ==========================================================
// FORM CHANGES
// ==========================================================

form.addEventListener('input', event => {
  if (aiBusy) return;
  revision++;
  currentStyle = null;
  download.disabled = true;
  sendToPublish.hidden = true;
  createReelFromDesign.hidden = true;
  sendToPublish.disabled = true;

  updateControls();

  if (event.target.name === 'backgroundImage') {
    return;
  }

  if (calendarEditorRowId) {
    status.textContent = 'Calendar content updated. Generate Preview to reformat this design.';
    if (form.elements.style.value === 'openai-style' && aiDesign) renderPreview();
    return;
  }

  status.textContent =
    saveState(state())
      ? 'Form saved. Generate Preview to apply your changes.'
      : 'Browser storage is unavailable. You can still generate a preview.';
  if (form.elements.style.value === 'openai-style' && aiDesign) {
    // Recompose current pixels locally, including copy edits. No network generation.
    renderPreview();
  }
});


// ==========================================================
// BACKGROUND
// ==========================================================

function applyBackground(value) {
  preview.style.removeProperty('background');
  preview.style.removeProperty('background-color');
  preview.style.removeProperty('background-image');
  preview.style.removeProperty('background-size');
  preview.style.removeProperty('background-position');
  preview.style.removeProperty('background-repeat');

  if (!['minimal-post', 'free-style'].includes(value.style) || value.background === 'template') {
    return;
  }

  if (value.background === 'cream') {
    preview.style.background = '#f5f1e8';
    return;
  }

  if (value.background === 'white') {
    preview.style.background = '#ffffff';
    return;
  }

  if (value.background === 'light-blue') {
    preview.style.background = '#dff5fe';
    return;
  }

  if (value.background === 'blue') {
    preview.style.background = brand.colors.primaryLight;
    return;
  }

  if (value.background === 'custom') {
    preview.style.background =
      value.backgroundColor || '#f5f1e8';
    return;
  }

  if (
    value.background === 'image' &&
    backgroundImageData
  ) {
    const strength = { low: .15, medium: .35, high: .55 }[value.overlayStrength] ?? .35;
    const tint = value.imageOverlay === 'light' ? '255,255,255' : '0,0,0';
    const overlay = value.imageOverlay === 'none' ? '' : `linear-gradient(rgba(${tint},${strength}), rgba(${tint},${strength})), `;
    preview.style.backgroundImage = `${overlay}url("${backgroundImageData}")`;

    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    preview.style.backgroundRepeat = 'no-repeat';
  }
}


// ==========================================================
// MINIMAL POST TEXT OPTIONS
// ==========================================================

function applyTextOptions(value) {
  clearTypography(preview);
  if (value.style === 'minimal-post') applyTypography(preview, value, value.textColor);
}

// ==========================================================
// GENERATE PREVIEW
// ==========================================================

async function renderDesign(value) {

  const run = ++revision;

  const style =
    designStyles.find(
      item => item.id === value.style
    );

  const preserveCalendarContext = Boolean(calendarEditorRowId && !carouselEditorContext);
  currentStyle = null;
  closeLocalEditor();
  delete preview.dataset.canvasWidth;
  delete preview.dataset.canvasHeight;
  delete preview.dataset.generationContext;
  delete preview.dataset.formatAction;
  preview.style.width = ''; preview.style.height = ''; preview.style.minWidth = ''; preview.style.minHeight = ''; preview.style.maxWidth = ''; preview.style.maxHeight = '';
  // A resized DOM contains absolute native objects; return to the template structure.
  if (!preview.querySelector('.design-content #preview-headline')) {
    preview.innerHTML = '<div id="preview-logo" class="preview-logo"></div><div class="design-content"><h3 id="preview-headline"></h3><p id="preview-copy"></p><span id="preview-cta" class="preview-cta"></span></div>';
  }
  if (!preserveCalendarContext) calendarEditorRowId = null;
  carouselEditorContext = null;
  saveCalendarDesign.hidden = !preserveCalendarContext;
  saveCarouselSlide.hidden = true;
  carouselEditorActions.hidden = true;

  generate.disabled = true;
  another.disabled = true;
  download.disabled = true;

  status.textContent = 'Preparing preview…';

  try {
    if (['minimal-post', 'free-style'].includes(value.style) && value.background === 'image') {
      await backgroundImageLoading;
      if (run !== revision) return;
      if (!backgroundImageData) {
        status.textContent = 'Choose a background image and generate again. Images must be selected again after refresh.';
        return;
      }
    }
    const logoData =
      value.logo === 'on'
        ? await loadLogo()
        : null;

    await document.fonts.ready;

    if (run !== revision) return;

    frame.hidden = false;
    frame.classList.remove('invalid');
    warning.hidden = true;

    preview.style.visibility = 'hidden';

    preview.className = style.id;
    delete preview.dataset.composition;

    preview.style.textAlign =
      style.layout.alignment;

    applyBackground(value);
    applyTextOptions(value);

    scalePreview();

    // LOGO
    const logo =
      document.querySelector('#preview-logo');

    logo.className = 'preview-logo';
    logo.textContent = brand.name;
    logo.hidden = value.logo === 'off';

    logo.dataset.placement =
      placements.includes(value.placement) &&
      value.placement !== 'auto'
        ? value.placement
        : 'top-left';

    if (logoData) {
      const image = new Image();

      image.alt = brand.name;
      image.src = logoData;

      await image.decode();

      if (run !== revision) return;

      logo.replaceChildren(image);
      logo.classList.add('has-asset');
    }

    // CONTENT
    preview.querySelector('.design-content').hidden = false;
    document.querySelector(
      '#preview-headline'
    ).textContent =
      value.headline.trim() ||
      'Your headline here';

    document.querySelector(
      '#preview-copy'
    ).textContent =
      value.supportingCopy;

    const cta =
      document.querySelector('#preview-cta');

    cta.textContent = value.cta;
    cta.hidden = !value.cta.trim();

    // TEMPLATE
    applyTemplate(preview, value);
    shownComposition = value.style === 'free-style'
      ? applyFreeStyle(preview, value, value.background === 'image' && !!backgroundImageData)
      : null;

    preview.setAttribute(
      'aria-label',
      `${style.name} design`
    );

    document.querySelector(
      '#preview-style'
    ).textContent = shownComposition ? `Free Style · ${shownComposition.name}` : style.name;

    document.querySelector(
      '#empty-preview'
    ).hidden = true;

    let aiNotice = '';
    preview.dataset.designMode = value.style === 'openai-style' ? value.aiRenderMode : 'native';
    if (value.style === 'openai-style') {
      if (!aiDesign) throw new Error('Generate an AI visual first.');
      aiNotice = applyAIStyle(preview, value, aiDesign);
      if (aiDesign.targetCanvas) { setCanvasDimensions(preview, aiDesign.targetCanvas); scalePreview(); }
      preview.dataset.generationContext = JSON.stringify({ plan: aiDesign.plan, planId: aiDesign.planId, value });
      if (value.aiRenderMode === 'full-ai-artwork') {
        preview.querySelector('.design-content').hidden = true;
        preview.querySelector('#preview-logo').hidden = value.logo === 'off' || !logoData;
      }
    }
    // FIT
    const fits = fitTemplate(preview);

    frame.classList.toggle(
      'invalid',
      !fits
    );

    warning.hidden = fits;

    preview.style.visibility = 'visible';

    download.disabled = !fits;
    editDesign.hidden = !fits;
    sendToPublish.hidden = !fits;
    sendToPublish.disabled = !fits;
    createReelFromDesign.hidden = !fits;

    currentStyle =
      fits
        ? style.id
        : null;
    designReformat?.reset();

    if (preserveCalendarContext) saveCalendarDesign.hidden = !fits;

    const stored = value.calendarRun || saveState(value);

    status.textContent =
      fits
        ? 'Preview ready. Download a 1080 × 1350 PNG.'
        : warning.textContent;

    if (
      value.logo === 'on' &&
      !logoData
    ) {
      status.textContent +=
        ' Using the Upplai text logo fallback.';
    }

    if (
      ['minimal-post', 'free-style'].includes(value.style) && value.background === 'image' &&
      !backgroundImageData
    ) {
      status.textContent +=
        ' Choose a background image and generate again.';
    }

    if (fits && value.style === 'openai-style') status.textContent = 'AI design ready. ' + (aiDesign.mockMode ? 'Mock Mode — No API Usage. ' : '') + aiNotice;
    if (!stored) {
      status.textContent +=
        ' Browser storage is unavailable; changes were not saved.';
    }

  } catch {
    frame.hidden = false;
    frame.classList.add('invalid');
    warning.hidden = false;
    sendToPublish.hidden = true;
    sendToPublish.disabled = true;
    createReelFromDesign.hidden = true;
    editDesign.hidden = true;

    status.textContent =
      'Preview could not be prepared. Please generate again.';
  } finally {
    generate.disabled = false;
    another.disabled = false;
  }
}


function renderPreview() {
  return generateDesign(state(), { render: renderDesign });
}


// ==========================================================
// DOWNLOAD
// ==========================================================

editDesign.addEventListener('click', () => {
  if (!currentStyle) return;
  const fromCalendar = Boolean(calendarEditorRowId);
  openSharedEditor({
    source: fromCalendar ? 'calendar-single' : 'create',
    contentType: 'single-image',
    designMode: form.elements.style.value === 'openai-style' ? form.elements.aiRenderMode.value : 'native',
    itemId: fromCalendar ? calendarEditorRowId : null,
    resultRef: fromCalendar ? preview.dataset.resultRef || '' : '',
    renderedPreview: preview,
    style: currentStyle,
    returnDestination: fromCalendar ? 'review' : 'create'
  });
});

resetDesignEdits.addEventListener('click', () => {
  if (!localEditor) return;
  localEditor.reset();
  status.textContent = calendarEditorRowId
    ? 'Edits reset. Save to Calendar when you are ready.'
    : 'Design edits reset to this design’s defaults.';
});

saveCalendarDesign.addEventListener('click', async () => {
  const rowId = calendarEditorRowId;
  const calendar = loadCalendar();
  const row = calendar?.rows?.find(item => item.id === rowId);

  if (!row || !currentStyle) {
    status.textContent = 'This Calendar design is no longer available. Return to Calendar and try again.';
    return;
  }

  saveCalendarDesign.disabled = true;
  status.textContent = 'Saving edited design to Calendar…';

  try {
    const resultRef = row.resultRef || calendarResultRef(row.id);
    const designConfig = { ...state(), style: currentStyle };
    const result = {
      preview: cleanEditedPreview(preview),
      style: currentStyle
    };

    await saveCalendarAsset(resultRef, result);

    const nextRows = calendar.rows.map(item =>
      item.id === row.id
        ? {
          ...item,
          headline: designConfig.headline,
          supportingCopy: designConfig.supportingCopy,
          cta: designConfig.cta,
          style: designConfig.style,
          logo: designConfig.logo,
          placement: designConfig.placement,
          ai: {
            visualStyle: designConfig.aiVisualStyle,
            subjectType: designConfig.aiSubject,
            composition: designConfig.aiComposition,
            direction: designConfig.aiDirection,
            quality: designConfig.aiQuality
          },
          designConfig,
          resultRef
        }
        : item
    );

    saveCalendar(nextRows);

    document.dispatchEvent(new CustomEvent('calendar:design-saved', {
      detail: {
        id: row.id,
        resultRef,
        result: {
          preview: result.preview.cloneNode(true),
          style: result.style
        }
      }
    }));

    closeLocalEditor();
    calendarEditorPreviousState = null;
    calendarEditorRowId = null;
    saveCalendarDesign.hidden = true;
    status.textContent = 'Edited design saved to Calendar.';
    document.dispatchEvent(new Event('navigate:review'));
  } catch {
    status.textContent = 'The edited design could not be saved. Please try again.';
  } finally {
    saveCalendarDesign.disabled = false;
  }
});

function commitCarouselBuilderSlide() {
  const context = carouselEditorContext;
  if (!context || !['builder', 'multi-page-builder'].includes(context.source)) return;
  const isCarousel = context.source === 'builder'; const collection = isCarousel ? context.draft.slides : context.draft.pages; const index = isCarousel ? context.slideIndex : context.pageIndex; const item = collection[index];
  if (!item) return; item.settings = { ...(item.settings || {}), editedHtml: cleanEditedPreview(preview).outerHTML };
  document.dispatchEvent(new CustomEvent(isCarousel ? 'carousel:builder-draft-commit' : 'multi-page:builder-page-saved', { detail: isCarousel ? { draft: context.draft, slideIndex: index } : { draft: context.draft, pageIndex: index, preview: cleanEditedPreview(preview) } }));
}
function updateCarouselEditorActions() {
  const context = carouselEditorContext;
  if (!context || !['builder', 'multi-page-builder'].includes(context.source)) return;
  const isCarousel = context.source === 'builder'; const index = isCarousel ? context.slideIndex : context.pageIndex; const total = isCarousel ? context.draft.slides.length : context.draft.pages.length;
  carouselEditorActions.hidden = false; carouselEditorPosition.textContent = (isCarousel ? 'Slide ' : 'Page ') + (index + 1) + ' of ' + total; carouselEditorPrevious.disabled = index === 0; carouselEditorNext.disabled = index === total - 1;
}
function loadCarouselBuilderSlide(index) {
  commitCarouselBuilderSlide(); const context = carouselEditorContext; const isCarousel = context.source === 'builder';
  const request = new CustomEvent(isCarousel ? 'carousel:builder-slide-preview' : 'multi-page:builder-page-preview', { detail: { draft: context.draft, [isCarousel ? 'slideIndex' : 'pageIndex']: index, resolve: detail => {
    const imported = cleanEditedPreview(detail.preview); imported.id = 'preview'; preview.replaceWith(imported); preview = imported;
    carouselEditorContext = { ...context, draft: detail.draft, ...(isCarousel ? { slideIndex: index } : { pageIndex: index }) }; openLocalEditor(); updateCarouselEditorActions(); status.textContent = 'Editing ' + (isCarousel ? 'Carousel slide ' : 'Multi-Page page ') + (index + 1) + ' locally.';
  } } }); document.dispatchEvent(request);
}
carouselEditorPrevious.addEventListener('click', () => { const c = carouselEditorContext; const index = c?.source === 'builder' ? c.slideIndex : c?.pageIndex; if (['builder','multi-page-builder'].includes(c?.source) && index > 0) loadCarouselBuilderSlide(index - 1); });
carouselEditorNext.addEventListener('click', () => { const c = carouselEditorContext; const index = c?.source === 'builder' ? c.slideIndex : c?.pageIndex; const total = c?.source === 'builder' ? c.draft.slides.length : c?.draft.pages.length; if (['builder','multi-page-builder'].includes(c?.source) && index < total - 1) loadCarouselBuilderSlide(index + 1); });
carouselEditorBack.addEventListener('click', () => { const c = carouselEditorContext; if (['builder','multi-page-builder'].includes(c?.source)) { commitCarouselBuilderSlide(); document.dispatchEvent(new CustomEvent(c.source === 'builder' ? 'carousel:builder-slide-saved' : 'multi-page:builder-page-saved', { detail: c.source === 'builder' ? { draft: c.draft, slideIndex: c.slideIndex, preview: cleanEditedPreview(preview) } : { draft: c.draft, pageIndex: c.pageIndex, preview: cleanEditedPreview(preview) } })); closeLocalEditor(); carouselEditorContext = null; document.dispatchEvent(new Event('navigate:create')); } });
saveCarouselSlide.addEventListener('click', async () => {
  const context = carouselEditorContext;
  if (!context) return;

  saveCarouselSlide.disabled = true;
  status.textContent = 'Saving edited slide…';

  try {
    if (context.source === 'builder' || context.source === 'multi-page-builder') {
      document.dispatchEvent(new CustomEvent(context.source === 'builder' ? 'carousel:builder-slide-saved' : 'multi-page:builder-page-saved', { detail: context.source === 'builder' ? { draft: context.draft, slideIndex: context.slideIndex, preview: cleanEditedPreview(preview) } : { draft: context.draft, pageIndex: context.pageIndex, preview: cleanEditedPreview(preview) } }));
      closeLocalEditor();
      carouselEditorContext = null;
      saveCarouselSlide.hidden = true;
  carouselEditorActions.hidden = true;
      status.textContent = 'Edited slide saved to Carousel Builder.';
      return;
    }
    const asset = await loadCalendarAsset(context.resultRef);
    if (!asset || asset.type !== 'carousel' || !asset.slides?.[context.slideIndex]) {
      throw new Error('Carousel result is unavailable.');
    }

    const slides = asset.slides.map((slide, index) => {
      if (index !== context.slideIndex) return slide;
      return {
        ...slide,
        html: cleanEditedPreview(preview).outerHTML
      };
    });

    const parseSlide = slide => {
      const template = document.createElement('template');
      template.innerHTML = slide.html;
      return {
        ...slide,
        preview: template.content.firstElementChild
      };
    };

    await saveCalendarAsset(context.resultRef, {
      type: 'carousel',
      width: asset.width || 1080,
      height: asset.height || 1350,
      style: context.style || asset.style,
      slides: slides.map(parseSlide)
    });

    document.dispatchEvent(new CustomEvent('calendar:carousel-slide-saved', {
      detail: {
        id: context.id,
        resultRef: context.resultRef,
        style: context.style || asset.style,
        slideIndex: context.slideIndex,
        slides: slides.map(parseSlide)
      }
    }));

    closeLocalEditor();
    carouselEditorContext = null;
    saveCarouselSlide.hidden = true;
  carouselEditorActions.hidden = true;
    status.textContent = 'Edited slide saved to Carousel.';
    document.dispatchEvent(new Event('navigate:review'));
  } catch {
    status.textContent = 'The edited slide could not be saved. Please try again.';
  } finally {
    saveCarouselSlide.disabled = false;
  }
});

download.addEventListener('click', async () => {
  if (!currentStyle || download.disabled) {
    return;
  }

  generate.disabled = true;
  another.disabled = true;
  download.disabled = true;

  try {
    await downloadPng(
      preview,
      currentStyle
    );

    const size = canvasDimensions(preview);
    status.textContent = `PNG downloaded at ${size.width} × ${size.height} pixels.`;
  } catch {
    status.textContent =
      'PNG export failed in this browser. Please try again in a current Chrome or Edge browser.';
  } finally {
    generate.disabled = false;
    another.disabled = false;
    download.disabled = !currentStyle;
  }
});

document.addEventListener('workspace:changed', event => {
  if (event.detail?.workspace !== 'create' || !calendarEditorRowId) return;
  applyFormValues(calendarEditorPreviousState || defaults);
  calendarEditorPreviousState = null;
  calendarEditorRowId = null;
  saveCalendarDesign.hidden = true;
});
document.addEventListener('calendar:design-edit', event => {
  const { id, resultRef = '', preview: source, style, designMode = 'native', row = null } = event.detail || {};
  if (!id || !source?.cloneNode) return;
  if (!calendarEditorRowId) calendarEditorPreviousState = state();
  closeLocalEditor();
  populateCalendarForm(row || { style });
  openSharedEditor({ source: 'calendar-single', contentType: 'single-image', designMode, itemId: id, resultRef, renderedPreview: source, style: row?.style || style, returnDestination: 'review' });
  document.querySelector('#preview-style').textContent = designStyles.find(item => item.id === currentStyle)?.name || 'Calendar design';
  status.textContent = 'Editing Calendar design locally. Save to Calendar when you are ready.';
});

document.addEventListener('calendar:carousel-slide-edit', event => {
  const { id, resultRef, slideIndex, preview: source, style } = event.detail || {};
  if (!id || !resultRef || !source?.cloneNode) return;

  closeLocalEditor();
  const imported = cleanEditedPreview(source);
  imported.id = 'preview';
  preview.replaceWith(imported);
  preview = imported;

  calendarEditorRowId = null;
  carouselEditorContext = { id, resultRef, slideIndex, style };
  currentStyle = style || 'carousel';
  frame.hidden = false;
  warning.hidden = true;
  document.querySelector('#empty-preview').hidden = true;
  document.querySelector('#preview-style').textContent =
    'Carousel slide ' + (slideIndex + 1);
  download.disabled = false;
  editDesign.hidden = false;
  sendToPublish.hidden = true;
  createReelFromDesign.hidden = true;
  saveCalendarDesign.hidden = true;
  saveCarouselSlide.hidden = false;
  scalePreview();
  openLocalEditor();
  status.textContent = 'Editing Carousel slide locally. Save Slide when you are ready.';
});
document.addEventListener('multi-page:builder-page-edit', event => {
  const { draft, pageIndex, preview: source } = event.detail || {};
  if (!draft || !Number.isInteger(pageIndex) || !source?.cloneNode) return;
  closeLocalEditor();
  openSharedEditor({ source: 'multi-page-builder', contentType: 'multi-page', designMode: draft.designMode || 'native', pageIndex, renderedPreview: source, style: draft.pages[pageIndex]?.style || 'premium-editorial', returnDestination: 'create', carouselContext: { source: 'multi-page-builder', draft, pageIndex, style: draft.pages[pageIndex]?.style || 'premium-editorial' } });
  document.querySelector('#preview-style').textContent = 'Multi-Page page ' + (pageIndex + 1);
  status.textContent = 'Editing Multi-Page page locally. Save Changes when you are ready.';
});
document.addEventListener('carousel:builder-slide-edit', event => {
  const { draft, slideIndex, preview: source } = event.detail || {};
  if (!draft || !Number.isInteger(slideIndex) || !source?.cloneNode) return;
  // Carousel mode hides the normal Create preview. Reveal that shared canvas
  // before initializing the editor so sizing and direct manipulation are real.
  document.querySelector('#carousel-builder').hidden = true;
  document.querySelector('#generator').closest('.controls').hidden = false;
  document.querySelector('#create-preview-panel').hidden = false;
  closeLocalEditor();
  const imported = cleanEditedPreview(source);
  imported.id = 'preview';
  preview.replaceWith(imported);
  preview = imported;
  calendarEditorRowId = null;
  carouselEditorContext = { source: 'builder', draft, slideIndex, style: draft.style };
  currentStyle = draft.style || 'carousel';
  frame.hidden = false;
  warning.hidden = true;
  document.querySelector('#empty-preview').hidden = true;
  document.querySelector('#preview-style').textContent = 'Carousel slide ' + (slideIndex + 1);
  download.disabled = false;
  editDesign.hidden = false;
  sendToPublish.hidden = true;
  createReelFromDesign.hidden = true;
  saveCalendarDesign.hidden = true;
  saveCarouselSlide.hidden = false;
  saveCarouselSlide.textContent = 'Save Changes';
  updateCarouselEditorActions();
  scalePreview();
  console.info(`[CAROUSEL EDIT] opening shared editor for slide ${slideIndex + 1}`);
  openLocalEditor();
  status.textContent = 'Editing Carousel Builder slide locally. Save Slide when you are ready.';
});
sendToPublish.addEventListener('click', async () => {
  if (!currentStyle || sendToPublish.disabled) return;
  const value = state();
  sendToPublish.disabled = true;
  status.textContent = 'Preparing design for publishing…';
  try {
    // Export the rendered DOM so native logos/edits and target dimensions survive.
    const isPreparedFullArtwork = value.aiRenderMode === 'full-ai-artwork' && aiDesign?.fullArtwork === true && typeof aiDesign.image === 'string' && value.logo === 'off' && !preview.dataset.canvasWidth && localDesignEditor.hidden;
    const resultRef = isPreparedFullArtwork ? `full-artwork:${Date.now()}` : `create-result:${Date.now()}`;
    if (!isPreparedFullArtwork) await saveCalendarAsset(resultRef, {
      preview: preview.cloneNode(true),
      style: currentStyle
    });
    await handoffToPublishing({
        resultRef,
        preparedFullArtwork: isPreparedFullArtwork ? aiDesign.image : '',
        source: preview.dataset.editSource || 'create',
        contentType: 'single-image',
        itemId: preview.dataset.itemId || null,
        designMode: preview.dataset.designMode || 'native',
        headline: value.headline,
        supportingCopy: value.supportingCopy,
        cta: value.cta,
        style: currentStyle
      });
    status.textContent = 'Design ready in Publishing.';
  } catch (error) {
    status.textContent = error.message || 'This design could not be prepared for publishing. Please try again.';
  } finally {
    sendToPublish.disabled = false;
  }
});
another.addEventListener('click', () => {
  if (form.elements.style.value !== 'free-style' || another.disabled) return;
  const value = state();
  const current = shownComposition || selectComposition(value, value.background === 'image' && !!backgroundImageData);
  form.elements.freeVariation.value = nextComposition(current.id);
  form.elements.freeVariation.dispatchEvent(new Event('input', { bubbles: true }));
  form.requestSubmit();
});
function updateAIVersionHistory() {
  aiGenerationHistory.replaceChildren();
  aiVersions.forEach(version => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `V${version.number} ${version.kind}${version.id === aiCurrentVersionId ? ' · Current' : ''}`;
    button.title = version.instruction || version.kind;
    button.addEventListener('click', () => restoreAIVersion(version.id));
    aiGenerationHistory.append(button);
  });
}

function recordAIVersion(design, { kind, instruction = '' }) {
  const version = { id: crypto.randomUUID(), number: aiVersions.length + 1, kind, instruction, createdAt: new Date().toISOString(), design };
  aiVersions.push(version);
  aiCurrentVersionId = version.id;
  updateAIVersionHistory();
}

async function restoreAIVersion(id) {
  const version = aiVersions.find(item => item.id === id);
  if (!version || aiBusy) return;
  aiDesign = version.design;
  aiCurrentVersionId = version.id;
  await renderPreview();
  updateAIVersionHistory();
  status.textContent = `Restored V${version.number}.`;
}

async function refineCurrentAI() {
  if (aiBusy || !aiDesign || !aiRefinementInstruction.value.trim()) return;
  const previous = aiDesign;
  aiBusy = true;
  updateControls();
  const refiningOperation = showProcessing({ title: 'Refining your visual…', message: 'Applying your instruction to the current AI visual.' });
  try {
    const data = new FormData();
    data.append('planId', aiDesign.planId);
    if (preview.dataset.canvasWidth) data.append('format', JSON.stringify({ id: 'custom', ...canvasDimensions(preview) }));
    data.append('quality', state().aiQuality);
    data.append('instruction', aiRefinementInstruction.value.trim());
    data.append('image', dataUrlToFile(aiDesign.image));
    const result = await aiImageRequest('refine-visual', data);
    const visual = await prepareAIImage(result);
    aiDesign = { ...previous, mockMode: result.mockMode, ...visual };
    recordAIVersion(aiDesign, { kind: 'Refined', instruction: aiRefinementInstruction.value.trim() });
    if (preview.dataset.canvasWidth && !previous.fullArtwork) {
      // Keep resized editable typography/objects while replacing only the visual.
      preview.style.background = `url("${aiDesign.image}") center / contain no-repeat #FFFFFF`;
    } else await renderPreview();
    aiRefinementInstruction.value = '';
    status.textContent = 'Refined visual ready.';
  } catch (error) {
    aiDesign = previous;
    status.textContent = error.message + ' The current version is unchanged.';
  } finally { hideProcessing(refiningOperation); aiBusy = false; updateControls(); }
}
// Only these two explicit actions can enter the generation pipeline.
async function generateAI(regenerateOnly = false) {
  if (aiBusy || !aiConfiguration || aiConfiguration.error || !aiConfiguration.mockMode && !aiConfiguration.configured) return;
  if (regenerateOnly && !aiDesign) return;
  if (!form.elements.headline.value.trim()) { status.textContent = 'Add a headline before generating an AI design.'; return; }
  const previous = aiDesign;
  const value = state();
  aiBusy = true;
  const generationOperation = showProcessing({ title: 'Creating your design…', message: 'Generating your visual and preparing the layout.' });
  const disabled = [...form.elements].map(element => [element, element.disabled]);
  for (const [element] of disabled) element.disabled = true;
  regenerate.disabled = download.disabled = another.disabled = true;
  try {
    let planned = previous;
    if (!regenerateOnly) {
      status.textContent = 'Planning design…';
      planned = await aiRequest('design-plan', directorInput(value));
      validatePlan(planned.plan);
      if (typeof planned.planId !== 'string') throw new Error('The server returned an invalid plan identifier.');
    }
    status.textContent = 'Generating visual…';
    const result = await aiRequest('generate-visual', { planId: planned.planId, quality: value.aiQuality, ...(regenerateOnly && previous?.targetCanvas ? { format: previous.targetCanvas } : {}) });
    status.textContent = 'Composing design…';
    const visual = await prepareAIImage(result);
    aiDesign = { plan: planned.plan, planId: planned.planId, mockMode: result.mockMode, ...visual };
    if (!previous) aiVersions = [];
    recordAIVersion(aiDesign, { kind: previous ? 'Alternative' : 'Original' });
    await renderPreview();
  } catch (error) {
    aiDesign = previous;
    if (previous) await renderPreview();
    status.textContent = error.message + (previous ? ' Last successful visual preserved.' : ' The other design styles are still available.');
  } finally {
    hideProcessing(generationOperation);
    for (const [element, wasDisabled] of disabled) element.disabled = wasDisabled;
    aiBusy = false;
    updateControls();
    download.disabled = !currentStyle;
    another.disabled = false;
  }
}
export async function generateCalendarDesign(input) {
  const value = normalizeDesignInput({ ...defaults, ...input, calendarRun: true });
  const previous = aiDesign;
  try {
    if (value.style === 'openai-style') {
      const planned = await aiRequest('design-plan', directorInput(value));
      validatePlan(planned.plan);
      if (typeof planned.planId !== 'string') throw new Error('The server returned an invalid plan identifier.');
      const result = await aiRequest('generate-visual', { planId: planned.planId, quality: value.aiQuality });
      const visual = await prepareAIImage(result);
      aiDesign = { plan: planned.plan, planId: planned.planId, mockMode: result.mockMode, ...visual };
    }
    await generateDesign(value, { render: renderDesign });
    return { preview: preview.cloneNode(true), style: currentStyle };
  } finally {
    aiDesign = previous;
  }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  if (aiBusy) return;
  if (form.elements.style.value === 'openai-style') generateAI();
  else renderPreview();
});
regenerate.addEventListener('click', () => generateAI(true));
aiRefineCurrent.addEventListener('click', refineCurrentAI);
aiTryAnotherVersion.addEventListener('click', () => generateAI(true));
// Status is a read-only local request, never an OpenAI request.
fetch('/api/ai/status', { signal: AbortSignal.timeout(5000) }).then(response => {
  if (!response.ok) throw new Error('Status unavailable');
  return response.json();
}).then(value => {
  aiConfiguration = value;
  if (!saved.value.aiQuality) form.elements.aiQuality.value = value.defaultQuality || 'draft';
  document.querySelector('#ai-status').textContent = value.error || (value.mockMode ? 'Mock Mode — No API Usage' : value.configured ? 'Live mode — Generate and Regenerate use API credits.' : 'OpenAI is not configured. Enable Mock Mode or configure the server.');
  updateControls();
}).catch(() => { document.querySelector('#ai-status').textContent = 'AI status unavailable. Check the local server.'; });

createReelFromDesign.addEventListener('click', async () => {
  if (!preview?.cloneNode || !currentStyle || createReelFromDesign.disabled) return;
  const value = state();
  const currentPreview = cleanEditedPreview(preview);
  const dimensions = canvasDimensions(preview);
  setCanvasDimensions(currentPreview, dimensions);
  createReelFromDesign.disabled = true;
  status.textContent = 'Preparing the current design for your Reel…';
  try {
    // Reels is normally loaded with the app. Importing it here also covers a
    // deferred module that has not attached its event listener yet.
    await import('/reels.js');
    const handoff = await new Promise((resolve, reject) => {
      document.dispatchEvent(new CustomEvent('reel:use-rendered-designs', {
        detail: {
          title: value.headline || 'Design Reel',
          previews: [currentPreview],
          source: 'single-image-current-version',
          dimensions,
          completion: { resolve, reject }
        }
      }));
    });
    if (!handoff?.sceneCount) throw new Error('The current design could not be added to the Reel.');
    status.textContent = 'Current design added to Reels.';
  } catch (error) {
    status.textContent = error.message || 'The current design could not be added to the Reel.';
  } finally {
    createReelFromDesign.disabled = false;
  }
});

designReformat = setupDesignReformat({
  preview: () => preview,
  available: () => Boolean(currentStyle) && !carouselEditorContext,
  mode: () => preview.dataset.designMode || (currentStyle === 'openai-style' ? state().aiRenderMode : 'native'),
  status: message => { status.textContent = message; },
  busy: value => {
    aiBusy = value;
    for (const control of [...form.elements, regenerate, aiRefineCurrent, aiTryAnotherVersion, download, editDesign, sendToPublish, createReelFromDesign]) control.disabled = value;
    if (!value) updateControls();
  },
  capture: () => ({ preview: cleanEditedPreview(preview), aiDesign, value: state(), style: currentStyle }),
  restore: version => {
    closeLocalEditor();
    const imported = cleanEditedPreview(version.preview); imported.id = 'preview';
    setCanvasDimensions(imported, canvasDimensions(imported));
    preview.replaceWith(imported); preview = imported;
    aiDesign = version.aiDesign;
    applyFormValues(version.value);
    currentStyle = version.style;
    scalePreview();
    download.disabled = false; editDesign.hidden = false;
    openLocalEditor();
  },
  reformat: async (source, target) => {
    let context;
    try { context = JSON.parse(source.preview.dataset.generationContext || '{}'); } catch { context = {}; }
    if (!context.planId || !context.plan) throw new Error('This artwork has no retained generation context. Generate it in Create before AI reformatting; Fit Original is available.');
    const result = await aiRequest('generate-visual', { planId: context.planId, quality: source.value.aiQuality, format: target });
    return { ...source.aiDesign, plan: context.plan, planId: context.planId, mockMode: result.mockMode, ...await prepareAIImage(result) };
  }
});
