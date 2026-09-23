// Brand Kit UI: browser-local load, validation, save, reset and logo previews.
import {
  loadBrandKit,
  saveBrandKit,
  resetBrandKit,
  validateBrandKit,
  validateLogoFile,
  normalizeBrandColor
} from '/src/brand-kit.js';
import { refreshBrand } from '/src/brand.js';

const form = document.getElementById('brand-kit-form');
const saveButton = document.getElementById('save-brand-kit');
const resetButton = document.getElementById('reset-brand-kit');
const status = document.getElementById('brand-kit-status');
const fields = {
  brandName: document.getElementById('brandName'),
  heading: document.getElementById('brandHeadingFont'),
  body: document.getElementById('brandBodyFont')
};
const colorFields = Object.fromEntries(['primary', 'secondary', 'accent', 'dark', 'light'].map(key => [key, {
  picker: document.getElementById(`brand${key[0].toUpperCase()}${key.slice(1)}Color`),
  hex: document.getElementById(`brand${key[0].toUpperCase()}${key.slice(1)}Hex`)
}]));
const logoFields = {
  primary: document.getElementById('brandPrimaryLogo'),
  white: document.getElementById('brandWhiteLogo'),
  dark: document.getElementById('brandDarkLogo'),
  icon: document.getElementById('brandIconLogo')
};
let logos = { ...loadBrandKit().logos };
let pendingLogoReads = [];

const normalizeHex = normalizeBrandColor;


function showStatus(message) { status.textContent = message; }
function setColor(key, value) {
  const normalized = normalizeHex(value);
  if (!normalized) return false;
  colorFields[key].picker.value = normalized;
  colorFields[key].hex.value = normalized;
  return true;
}

for (const [key, control] of Object.entries(colorFields)) {
  control.picker.addEventListener('input', () => setColor(key, control.picker.value));
  control.hex.addEventListener('input', () => {
    const normalized = normalizeHex(control.hex.value);
    if (normalized) setColor(key, normalized);
  });
  control.hex.addEventListener('change', () => {
    if (!setColor(key, control.hex.value)) {
      control.hex.value = control.picker.value.toUpperCase();
      showStatus('Enter a six-digit HEX color, for example #50C4F8.');
    }
  });
}

function refreshLogoPreview(key) {
  let image = document.getElementById(`brand-logo-preview-${key}`);
  if (!image) {
    const wrap = document.createElement('div');
    wrap.className = 'brand-logo-preview';
    image = document.createElement('img');
    image.id = `brand-logo-preview-${key}`;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => {
      logos[key] = key === 'primary' ? '/assets/upplai-logo.png' : '';
      logoFields[key].value = '';
      refreshLogoPreview(key);
    });
    wrap.append(image, clear);
    logoFields[key].insertAdjacentElement('afterend', wrap);
  }
  image.src = logos[key] || '';
  image.hidden = !logos[key];
  image.nextElementSibling.hidden = !logos[key] || (key === 'primary' && logos[key] === '/assets/upplai-logo.png');
}

for (const [key, input] of Object.entries(logoFields)) {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    const error = validateLogoFile(file);
    if (error) { showStatus(error); input.value = ''; return; }
    const task = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { logos[key] = reader.result; refreshLogoPreview(key); resolve(); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    pendingLogoReads.push(task);
    task.catch(() => showStatus('Logo could not be read.'));
  });
}

function fillForm(brandKit) {
  fields.brandName.value = brandKit.brandName;
  for (const key of Object.keys(colorFields)) setColor(key, brandKit.colors[key]);
  fields.heading.value = brandKit.fonts.heading;
  fields.body.value = brandKit.fonts.body;
}

function readColors() {
  const colors = {};
  for (const key of Object.keys(colorFields)) {
    const value = normalizeHex(colorFields[key].hex.value);
    if (!value) return null;
    setColor(key, value);
    colors[key] = value;
  }
  return colors;
}

function readForm() {
  const colors = readColors();
  if (!colors) return null;
  return {
    ...loadBrandKit(),
    brandName: fields.brandName.value.trim(),
    colors,
    logos: { ...logos },
    fonts: { heading: fields.heading.value, body: fields.body.value }
  };
}

saveButton.addEventListener('click', async () => {
  await Promise.all(pendingLogoReads);
  const brandKit = readForm();
  if (!brandKit) { showStatus('Enter valid six-digit HEX values before saving.'); return; }
  if (!validateBrandKit(brandKit)) { showStatus('Please complete the required Brand Kit fields.'); return; }
  saveBrandKit(brandKit);
  logos = { ...brandKit.logos };
  refreshBrand();
  showStatus(`${brandKit.brandName} Brand Kit saved in this browser.`);
});

resetButton.addEventListener('click', () => {
  const brandKit = resetBrandKit();
  logos = { ...brandKit.logos };
  form.reset();
  fillForm(brandKit);
  Object.keys(logoFields).forEach(refreshLogoPreview);
  refreshBrand();
  showStatus('Default Upplai Brand Kit restored.');
});

const savedBrandKit = loadBrandKit();
fillForm(savedBrandKit);
logos = { ...savedBrandKit.logos };
Object.keys(logoFields).forEach(refreshLogoPreview);
showStatus(`${savedBrandKit.brandName} Brand Kit loaded.`);


