import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function fakeDom() {
  const listeners = new Map();
  const overlayParts = { strong: { textContent: '' }, p: { textContent: '' } };
  const body = { append(node) { node.isConnected = true; this.node = node; } };
  const document = {
    body,
    querySelector(selector) { return selector === '.app-processing' ? body.node || null : null; },
    createElement() { return { hidden: false, isConnected: false, className: '', style: {}, querySelector(selector) { return selector === 'strong' ? overlayParts.strong : overlayParts.p; } }; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type) { listeners.get(type)?.({ type }); }
  };
  const window = { addEventListener(type, listener) { listeners.set(`window:${type}`, listener); } };
  return { document, window, body };
}

async function processingModule() {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const dom = fakeDom();
  globalThis.document = dom.document;
  globalThis.window = dom.window;
  const module = await import(new URL(`../src/processing.js?test=${Date.now()}-${Math.random()}`, import.meta.url));
  return { module, dom, restore() { globalThis.document = previousDocument; globalThis.window = previousWindow; } };
}

test('start then stop hides the overlay and returns the owned operation count to zero', async () => {
  const scope = await processingModule();
  try {
    const token = scope.module.startProcessing({ title: 'Upload media' });
    assert.equal(scope.module.processingCount(), 1);
    assert.equal(scope.dom.body.node.hidden, false);
    assert.equal(scope.dom.body.node.style.pointerEvents, 'auto');
    scope.module.stopProcessing(token);
    assert.equal(scope.module.processingCount(), 0);
    assert.equal(scope.dom.body.node.hidden, true);
    assert.equal(scope.dom.body.node.style.pointerEvents, 'none');
  } finally { scope.restore(); }
});

test('nested operations remain visible until their own tokens stop', async () => {
  const scope = await processingModule();
  try {
    const outer = scope.module.startProcessing({ title: 'Outer' });
    const inner = scope.module.startProcessing({ title: 'Inner' });
    scope.module.stopProcessing(outer);
    assert.equal(scope.module.processingCount(), 1);
    assert.equal(scope.dom.body.node.hidden, false);
    scope.module.stopProcessing(inner);
    assert.equal(scope.module.processingCount(), 0);
    assert.equal(scope.dom.body.node.hidden, true);
  } finally { scope.restore(); }
});

test('thrown and early-failure paths release their owned processing token in finally', async () => {
  const scope = await processingModule();
  try {
    const token = scope.module.startProcessing({ title: 'Failure path' });
    await assert.rejects((async () => { try { throw new Error('failure'); } finally { scope.module.stopProcessing(token); } })(), /failure/);
    assert.equal(scope.module.processingCount(), 0);
    assert.equal(scope.dom.body.node.hidden, true);
  } finally { scope.restore(); }
});

test('clear and workspace navigation discard stale operations and hide the overlay', async () => {
  const scope = await processingModule();
  try {
    scope.module.startProcessing({ title: 'Stale operation' });
    scope.module.clearProcessing('test clear');
    assert.equal(scope.module.processingCount(), 0);
    assert.equal(scope.dom.body.node.hidden, true);
    scope.module.startProcessing({ title: 'Navigated operation' });
    scope.dom.document.dispatch('workspace:changed');
    assert.equal(scope.module.processingCount(), 0);
    assert.equal(scope.dom.body.node.hidden, true);
  } finally { scope.restore(); }
});

test('hidden processing overlay has no display or pointer-event hit area and Publishing has no page-specific clear workaround', async () => {
  const [publishing, styles] = await Promise.all([
    readFile(new URL('../public/publishing.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/styles.css', import.meta.url), 'utf8')
  ]);
  assert.match(styles, /\.app-processing\[hidden\]\{display:none!important;pointer-events:none\}/);
  assert.doesNotMatch(publishing, /clearProcessing|navigate:publishing.*clearProcessing/);
});