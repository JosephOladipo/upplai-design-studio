import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const ux = fs.readFileSync(new URL('../public/ux.js', import.meta.url), 'utf8');
test('portrait mobile navigation and disclosure hooks exist without replacing desktop navigation', () => {
  assert.match(html, /id="mobile-bottom-nav"/); assert.match(html, /data-mobile-workspace="calendar"/); assert.match(html, /id="mobile-more-menu"/);
  assert.match(css, /@media\(max-width:767px\).*mobile-bottom-nav/s); assert.match(css, /@media\(min-width:768px\).*#section-create/s);
  assert.match(ux, /sessionStorage/); assert.match(ux, /ai-designer-reference-settings/);
});
test('small portrait layouts constrain previews, make Reel vertical, and replace table overflow with cards', () => {
  assert.match(css, /max-width:100%/); assert.match(css, /\.calendar-table thead\{display:none\}/); assert.match(css, /\.calendar-table tr\{margin:10px/);
  assert.match(css, /reel-preview-card\{order:1\}/); assert.match(css, /padding-bottom:calc\(86px/);
  assert.match(css, /@media\(max-width:359px\)/);
});
