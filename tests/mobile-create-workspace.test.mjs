import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const ux = fs.readFileSync(new URL('../public/ux.js', import.meta.url), 'utf8');
test('mobile Create has an Edit/Preview switcher while desktop rules remain present', () => {
  assert.match(html, /id="mobile-create-switcher"/); assert.match(html, /data-create-view="edit"/); assert.match(html, /data-create-view="preview"/);
  assert.match(ux, /setCreateView\('edit'\)/); assert.match(css, /#section-create\[data-mobile-view="edit"\]>#create-preview-panel\{display:none/); assert.match(css, /@media\(min-width:768px\).*#section-create/s);
});
test('mobile Create constrains desktop columns and reserves only the visible bottom-nav height', () => {
  assert.match(css, /#section-create\{display:block!important;width:100%!important/); assert.match(css, /overflow-x:hidden/); assert.match(css, /padding-bottom:calc\(76px \+ 24px/); assert.match(css, /\.mobile-bottom-nav\{height:calc\(76px/); assert.match(css, /pointer-events:none/); assert.match(css, /\.mobile-bottom-nav button\{pointer-events:auto/);
});
test('secondary standard Create controls use an existing disclosure pattern', () => {
  assert.match(ux, /create-advanced-controls/); assert.match(ux, /Advanced Design Controls/); assert.match(ux, /background-controls/); assert.match(ux, /ai-controls/);
});
