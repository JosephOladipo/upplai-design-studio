import test from 'node:test';
import assert from 'node:assert/strict';
import { beginLocalEdits, applyLocalEdits, resetLocalEdits, screenToCanvas, SHAPE_OPTIONS } from '../src/local-editor.js';
const node = () => ({ style: {}, hidden: false, dataset: {}, offsetWidth: 100, offsetHeight: 50, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 50 }), getAttribute: () => '', setAttribute: () => {} });
test('shared local editor updates deterministic overlay elements and reset restores defaults without generation', () => {
  const nodes = { '#preview-headline': node(), '#preview-copy': node(), '#preview-cta': node(), '#preview-logo': node() };
  const preview = { style: {}, dataset: {}, offsetWidth: 1080, offsetHeight: 1350, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1080, height: 1350 }), getAttribute: () => '', setAttribute: () => {}, querySelector: selector => nodes[selector], querySelectorAll: () => [] };
  beginLocalEdits(preview); applyLocalEdits(preview, { headline: { color: '#ff0000', fontSize: '72', left: '12' }, cta: { hidden: true }, logo: { placement: 'bottom-right' } });
  assert.equal(nodes['#preview-headline'].style.color, '#ff0000'); assert.equal(nodes['#preview-headline'].style.fontSize, '72px'); assert.equal(nodes['#preview-cta'].hidden, true); assert.equal(nodes['#preview-logo'].dataset.placement, 'bottom-right');
  resetLocalEdits(preview); assert.equal(nodes['#preview-cta'].hidden, false);
});

test('visual shape picker exposes the supported local shapes without prompt input', async () => {
  assert.deepEqual(
    SHAPE_OPTIONS.map(shape => shape.id),
    ['rectangle', 'rounded-rectangle', 'circle', 'ellipse', 'triangle', 'line', 'pill', 'star', 'arrow']
  );

  const source = await import('node:fs/promises')
    .then(fs => fs.readFile(new URL('../src/local-editor.js', import.meta.url), 'utf8'));

  assert.match(source, /className = 'shape-picker'/);
  assert.match(source, /addShape\(preview,\s*shape\.id\)/);
  assert.doesNotMatch(source, /window\.prompt\(/);
});

test('editor zoom is clamped and remains display-only', async () => {
  const source = await import('node:fs/promises')
    .then(fs => fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8'));

  assert.match(source, /Math\.min\(1\.25, Math\.max\(\.25, value\)\)/);
  assert.match(source, /canvasZoomOut.addEventListener/);
  assert.match(source, /canvasZoomIn.addEventListener/);
  assert.match(source, /stage.style.transform = 'none'/);
});

test('screen to canvas conversion is stable across editor zoom levels', () => {
  for (const scale of [1, .44, .75, 1.25]) {
    const preview = { offsetWidth: 1080, offsetHeight: 1350, getBoundingClientRect: () => ({ left: 100, top: 50, width: 1080 * scale, height: 1350 * scale }) };
    const point = screenToCanvas(preview, 100 + 360 * scale, 50 + 540 * scale);
    assert.equal(Math.round(point.x), 360);
    assert.equal(Math.round(point.y), 540);
  }
});

test('direct editing defers absolute positioning until movement and does not rerender inspector on history commits', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/local-editor.js', import.meta.url), 'utf8'));
  assert.match(source, /Math\.hypot\(x - dragging\.left, y - dragging\.top\) < 2/);
  assert.match(source, /Do not rebuild the inspector after a routine value change/);
  assert.doesNotMatch(source, /setPosition\(\s*preview,\s*node,\s*id,\s*position\.x,\s*position\.y\s*\);/);
});
