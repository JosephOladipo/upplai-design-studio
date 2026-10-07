import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('mobile navigation uses an accessible drawer without changing desktop navigation', () => {
  const html = read('public/index.html');
  const navigation = read('public/navigation.js');
  const css = read('public/styles.css');
  assert.match(html, /id="mobile-nav-toggle"[^>]*aria-controls="studio-navigation"/);
  assert.match(html, /id="studio-navigation" class="studio-nav"/);
  assert.match(navigation, /mobile-nav-open/);
  assert.match(navigation, /aria-expanded/);
  assert.match(css, /@media\(max-width:767px\)/);
  assert.match(css, /body\.mobile-nav-open \.studio-nav/);
});

test('mobile rules provide touch-safe controls and a vertical Reel editor', () => {
  const css = read('public/styles.css');
  assert.match(css, /input,textarea,select\{font-size:16px\}/);
  assert.match(css, /\.reel-preview-card\{order:1\}/);
  assert.match(css, /\.reel-scenes-card\{order:2\}/);
  assert.match(css, /\.reel-selected-card\{order:3\}/);
  assert.match(css, /\.reel-export\{order:5\}/);
  assert.match(css, /\.reel-preview-card #reel-preview\{width:min\(100%,360px\).*aspect-ratio:9\/16/);
  assert.match(css, /\.reel-scenes-card #reel-scenes\{display:grid;grid-template-columns:1fr/);
  assert.match(css, /@media\(max-width:479px\)/);
});

test('mobile rules prevent overflow while retaining controlled table scrolling and scaled previews', () => {
  const css = read('public/styles.css');
  assert.match(css, /html,body\{max-width:100%;overflow-x:clip\}/);
  assert.match(css, /\.calendar-table-wrap\{margin-inline:-2px\}/);
  assert.match(css, /\.carousel-preview\{max-width:100%;width:min\(100%,360px\)/);
  assert.match(css, /\[role='dialog'\]\{width:calc\(100vw - 24px\)!important/);
});
