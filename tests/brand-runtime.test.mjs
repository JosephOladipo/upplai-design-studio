import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBrandKit } from '../src/brand-kit.js';
import { LOGO_MAX_BYTES, validateLogoFile } from '../src/brand-kit.js';
import { runtimeBrandFromKit } from '../src/brand.js';

test('Brand Kit maps defaults and custom identity into the shared runtime brand', () => {
  const custom = { ...defaultBrandKit, brandName: 'Test Brand', colors: { primary: '#112233', secondary: '#223344', accent: '#334455', dark: '#445566', light: '#556677' }, fonts: { heading: 'Georgia', body: 'Arial' } };
  const runtime = runtimeBrandFromKit(custom);
  assert.equal(runtime.name, 'Test Brand');
  assert.equal(runtime.colors.primaryLight, '#112233');
  assert.equal(runtime.colors.primary, '#223344');
  assert.equal(runtime.colors.pink, '#334455');
  assert.equal(runtime.colors.navy, '#445566');
  assert.equal(runtime.colors.white, '#556677');
  assert.match(runtime.headingFont, /Georgia/);
  assert.match(runtime.bodyFont, /Arial/);
  assert.equal(runtimeBrandFromKit(null).name, 'Upplai');
});

test('logo validation accepts persistable image types and rejects unsafe uploads', () => {
  assert.equal(validateLogoFile({ type: 'image/png', size: LOGO_MAX_BYTES }), '');
  assert.equal(validateLogoFile({ type: 'image/jpeg', size: 10 }), '');
  assert.equal(validateLogoFile({ type: 'image/webp', size: 10 }), '');
  assert.match(validateLogoFile({ type: 'image/svg+xml', size: 10 }), /PNG, JPG, or WebP/);
  assert.match(validateLogoFile({ type: 'image/png', size: LOGO_MAX_BYTES + 1 }), /350 KB/);
});
import { applyTypography, typographyDefaults } from '../src/typography.js';
import { freeCompositions } from '../src/free-style.js';

function previewStub() {
  const properties = new Map();
  return { style: { setProperty: (name, value) => properties.set(name, value), getPropertyValue: name => properties.get(name) || '' } };
}

test('local typography inherits Brand Kit heading and body fonts by default', () => {
  const preview = previewStub();
  applyTypography(preview, {}, '#112233');
  assert.match(preview.style.getPropertyValue('--type-heading-font'), /brand-heading-font/);
  assert.match(preview.style.getPropertyValue('--type-body-font'), /brand-body-font/);
});

test('an explicit local typography font overrides both Brand Kit text defaults', () => {
  const preview = previewStub();
  applyTypography(preview, { ...typographyDefaults, fontStyle: 'editorial-serif' }, '#112233');
  assert.match(preview.style.getPropertyValue('--type-heading-font'), /Georgia/);
  assert.match(preview.style.getPropertyValue('--type-body-font'), /Georgia/);
});

test('all Free Style compositions inherit the Brand Kit font until a user override is supplied', () => {
  assert.equal(freeCompositions.length, 5);
  assert.ok(freeCompositions.every(item => !Object.hasOwn(item.typography, 'fontStyle')));
});

test('local template CSS uses runtime palette and typography variables', async () => {
  const css = await (await import('node:fs/promises')).readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  for (const color of ['--primaryLight', '--primary', '--primaryDeep', '--pink', '--navy', '--white']) assert.match(css, new RegExp(color));
  assert.match(css, /not\(\.minimal-post\):not\(\.free-style\) h3 \{ font-family: var\(--brand-heading-font/);
  assert.match(css, /:is\(\.minimal-post, \.free-style\) h3 \{ font-family: var\(--type-heading-font/);
});

import { normalizeBrandColor, loadBrandKit, saveBrandKit, resetBrandKit } from '../src/brand-kit.js';

test('Brand Kit colors normalize safely and preserve the default palette', () => {
  assert.equal(normalizeBrandColor(' #50c4f8 '), '#50C4F8');
  assert.equal(normalizeBrandColor('2bb7f7'), '#2BB7F7');
  assert.equal(normalizeBrandColor('#ABCDE'), '');
  assert.equal(normalizeBrandColor('#1234567'), '');
  assert.equal(defaultBrandKit.colors.primary, '#50C4F8');
  assert.equal(defaultBrandKit.colors.light, '#FFFFFF');
});

test('Brand Kit color save, reload, and reset retain valid values only', () => {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  try {
    const saved = { ...defaultBrandKit, colors: { ...defaultBrandKit.colors, primary: normalizeBrandColor('#112233'), accent: normalizeBrandColor('445566') } };
    saveBrandKit(saved);
    assert.equal(loadBrandKit().colors.primary, '#112233');
    assert.equal(loadBrandKit().colors.accent, '#445566');
    assert.equal(resetBrandKit().colors.primary, defaultBrandKit.colors.primary);
    assert.equal(loadBrandKit().colors.accent, defaultBrandKit.colors.accent);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});

test('saved Brand Kit initializes a fresh runtime after a simulated browser refresh', () => {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  try {
    const persisted = {
      ...defaultBrandKit,
      brandName: 'Persistence Test',
      colors: { primary: '#6D28D9', secondary: '#F59E0B', accent: '#10B981', dark: '#111827', light: '#FFF7ED' }
    };
    saveBrandKit(persisted);
    const rawBeforeReload = store.get('upplai-design-studio-brand-kit');
    const reloaded = loadBrandKit();
    const freshRuntime = runtimeBrandFromKit(reloaded);
    assert.equal(reloaded.brandName, 'Persistence Test');
    assert.deepEqual(reloaded.colors, persisted.colors);
    assert.equal(freshRuntime.name, 'Persistence Test');
    assert.equal(freshRuntime.colors.primaryLight, '#6D28D9');
    assert.equal(freshRuntime.colors.primary, '#F59E0B');
    assert.equal(freshRuntime.colors.pink, '#10B981');
    assert.equal(freshRuntime.colors.navy, '#111827');
    assert.equal(freshRuntime.colors.white, '#FFF7ED');
    assert.equal(store.get('upplai-design-studio-brand-kit'), rawBeforeReload);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});
