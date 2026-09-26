import test from 'node:test';
import assert from 'node:assert/strict';
import { beginLocalEdits, applyLocalEdits, resetLocalEdits } from '../src/local-editor.js';
const node = () => ({ style: {}, hidden: false, dataset: {}, offsetWidth: 100, offsetHeight: 50, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 50 }), getAttribute: () => '', setAttribute: () => {} });
test('shared local editor updates deterministic overlay elements and reset restores defaults without generation', () => {
  const nodes = { '#preview-headline': node(), '#preview-copy': node(), '#preview-cta': node(), '#preview-logo': node() };
  const preview = { style: {}, dataset: {}, offsetWidth: 1080, offsetHeight: 1350, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1080, height: 1350 }), getAttribute: () => '', setAttribute: () => {}, querySelector: selector => nodes[selector], querySelectorAll: () => [] };
  beginLocalEdits(preview); applyLocalEdits(preview, { headline: { color: '#ff0000', fontSize: '72', left: '12' }, cta: { hidden: true }, logo: { placement: 'bottom-right' } });
  assert.equal(nodes['#preview-headline'].style.color, '#ff0000'); assert.equal(nodes['#preview-headline'].style.fontSize, '72px'); assert.equal(nodes['#preview-cta'].hidden, true); assert.equal(nodes['#preview-logo'].dataset.placement, 'bottom-right');
  resetLocalEdits(preview); assert.equal(nodes['#preview-cta'].hidden, false);
});