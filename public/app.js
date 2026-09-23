import { aiDefaults, setupAIControls, aiRequest, directorInput, prepareAIImage, applyAIStyle } from '/src/ai-style.js';
import { validatePlan } from '/src/ai-plan.mjs';
import { typography, typographyDefaults, typographyLabels, advancedFields, overrideField, migrateTypography, applyTypography, clearTypography } from '/src/typography.js';
import { freeCompositions, selectComposition, nextComposition, applyFreeStyle } from '/src/free-style.js';
import { brand, applyBrand } from '/src/brand.js';
import { designStyles } from '/src/styles.js';
import { loadState, saveState } from '/src/storage.js';
import { applyTemplate, fitTemplate } from '/src/templates.js';
import { downloadPng } from '/src/export.js';
import { saveCalendarAsset } from '/src/calendar-assets.js';
import { generateDesign, normalizeDesignInput } from '/src/design-controller.js';

applyBrand();
setupAIControls();

const form = document.querySelector('#generator');
const status = document.querySelector('#status');
const preview = document.querySelector('#preview');
const frame = document.querySelector('#canvas-frame');
const stage = document.querySelector('#canvas-stage');
const warning = document.querySelector('#fit-warning');
const download = document.querySelector('#download');
const sendToPublish = document.querySelector('#send-to-publish');
const generate = form.querySelector('button[type=submit]');
const another = document.querySelector('#try-another');
let shownComposition = null;
let aiDesign = null;
let aiBusy = false;
let aiConfiguration = null;
const regenerate = document.querySelector('#regenerate-visual');

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


// ==========================================================
// PREVIEW SCALING
// ==========================================================

function scalePreview() {
  stage.style.transform =
    `scale(${frame.clientWidth / 1080})`;
}

new ResizeObserver(scalePreview).observe(frame);


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
  sendToPublish.disabled = true;

  updateControls();

  if (event.target.name === 'backgroundImage') {
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

  currentStyle = null;

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
    if (value.style === 'openai-style') {
      if (!aiDesign) throw new Error('Generate an AI visual first.');
      aiNotice = applyAIStyle(preview, value, aiDesign);
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
    sendToPublish.hidden = !fits;
    sendToPublish.disabled = !fits;

    currentStyle =
      fits
        ? style.id
        : null;

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

    status.textContent =
      'PNG downloaded at 1080 × 1350 pixels.';
  } catch {
    status.textContent =
      'PNG export failed in this browser. Please try again in a current Chrome or Edge browser.';
  } finally {
    generate.disabled = false;
    another.disabled = false;
    download.disabled = !currentStyle;
  }
});
sendToPublish.addEventListener('click', async () => {
  if (!currentStyle || sendToPublish.disabled) return;
  const value = state();
  sendToPublish.disabled = true;
  status.textContent = 'Preparing design for publishing…';
  try {
    const resultRef = `create-result:${Date.now()}`;
    await saveCalendarAsset(resultRef, {
      preview: preview.cloneNode(true),
      style: currentStyle
    });
    document.dispatchEvent(new CustomEvent('publishing:generated', {
      detail: {
        resultRef,
        headline: value.headline,
        supportingCopy: value.supportingCopy,
        cta: value.cta,
        style: currentStyle
      }
    }));
    status.textContent = 'Design ready in Publishing.';
  } catch {
    status.textContent = 'This design could not be prepared for publishing. Please try again.';
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
// Only these two explicit actions can enter the generation pipeline.
async function generateAI(regenerateOnly = false) {
  if (aiBusy || !aiConfiguration || aiConfiguration.error || !aiConfiguration.mockMode && !aiConfiguration.configured) return;
  if (regenerateOnly && !aiDesign) return;
  if (!form.elements.headline.value.trim()) { status.textContent = 'Add a headline before generating an AI design.'; return; }
  const previous = aiDesign;
  const value = state();
  aiBusy = true;
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
    const result = await aiRequest('generate-visual', { planId: planned.planId, quality: value.aiQuality });
    status.textContent = 'Composing design…';
    const visual = await prepareAIImage(result);
    aiDesign = { plan: planned.plan, planId: planned.planId, mockMode: result.mockMode, ...visual };
    await renderPreview();
  } catch (error) {
    aiDesign = previous;
    if (previous) await renderPreview();
    status.textContent = error.message + (previous ? ' Last successful visual preserved.' : ' The other design styles are still available.');
  } finally {
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

