import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handoffToPublishing } from '../src/publishing-handoff.mjs';

const file = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('single-design handoff keeps DOM persistence for native and AI Visual designs while Full AI sends its prepared PNG directly', async () => {
  const app = await file('public/app.js');
  assert.match(app, /await saveCalendarAsset\(resultRef, \{\s*preview: preview\.cloneNode\(true\)/s);
  assert.match(app, /const isPreparedFullArtwork = value\.aiRenderMode === 'full-ai-artwork' && aiDesign\?\.fullArtwork === true/);
  assert.match(app, /preparedFullArtwork: isPreparedFullArtwork \? aiDesign\.image : ''/);
  assert.match(app, /source: preview\.dataset\.editSource \|\| 'create'/);
  assert.match(app, /contentType: 'single-image'/);
  assert.match(app, /finally \{\s*sendToPublish\.disabled = false/s);
});

test('Publishing persists the current generated PNG before navigation and recovers that exact media', async () => {
  const publishing = await file('public/publishing.js');
  const receiver = publishing.slice(publishing.indexOf("document.addEventListener('publishing:generated'"));
  assert.match(receiver, /new File\(\[await previewPngBlob\(state\.generatedPreview\)\], 'generated-design\.png'/);
  assert.match(receiver, /await savePublishingMedia\(state\.media, `publishing-generated:\$\{state\.generatedRef\}`\)/);
  assert.match(publishing, /const savedMedia = state\.mediaRef \? await loadCalendarAsset\(state\.mediaRef\) : null/);
  assert.match(publishing, /state\.media = savedMedia\.file; prepareGeneratedMediaPreview\(\)/);
  assert.match(publishing, /state\.carouselFiles = await Promise\.all/);
  assert.match(receiver, /if \(result\.preparedFullArtwork\)/);
  assert.match(receiver, /state\.media = await preparedArtworkFile\(result\.preparedFullArtwork\)/);
  assert.match(receiver, /await savePublishingMedia\(state\.media, `publishing-generated:\$\{state\.generatedRef\}`\)/);
  assert.doesNotMatch(receiver.slice(receiver.indexOf('if (result.preparedFullArtwork)'), receiver.indexOf('} else {')), /previewPngBlob/);
  assert.match(publishing, /state\.mediaSource === 'generated-direct' && state\.mediaRef/);
  assert.match(receiver, /state\.carouselFiles = \[\];/);
});

test('multi-page, carousel, Calendar, and Review handoffs retain stored result references', async () => {
  const [html, multi, carousel, calendar] = await Promise.all([file('public/index.html'), file('public/multi-page.js'), file('public/carousel.js'), file('public/calendar-table.js')]);
  assert.match(html, /id="multi-send-publishing"/);
  assert.match(multi, /await saveCalendarAsset\(resultRef, result\)/);
  assert.match(multi, /contentType: 'multi-page'/);
  assert.match(carousel, /await saveCalendarAsset\(resultRef, result\)/);
  assert.match(carousel, /contentFormat: 'carousel'/);
  assert.match(calendar, /if \(canReview\) \{/);
  assert.match(calendar, /'publishing:generated'/);
});

test('the Publishing receiver keeps source identity and settles errors visibly', async () => {
  const publishing = await file('public/publishing.js');
  assert.match(publishing, /source: result\.source \|\| 'unknown'/);
  assert.match(publishing, /contentType: result\.contentType \|\| result\.contentFormat \|\| 'single-image'/);
  assert.match(publishing, /const publishingHandoffOperation = showProcessing[\s\S]*?finally \{ hideProcessing\(publishingHandoffOperation\); \}/);
  assert.match(publishing, /Generated design could not be loaded/);
});

test('handoff success waits until the receiving Publishing handler confirms persisted media', async () => {
  const previous = globalThis.CustomEvent;
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  try {
    const order = [];
    const target = { dispatchEvent(event) { order.push('dispatched'); setTimeout(() => { order.push('persisted'); event.detail.completion.resolve({ mediaRef: 'publishing-generated:one', carouselFiles: 3 }); }, 0); } };
    const result = await handoffToPublishing({ resultRef: 'one' }, target);
    assert.deepEqual(order, ['dispatched', 'persisted']);
    assert.deepEqual(result, { mediaRef: 'publishing-generated:one', carouselFiles: 3 });
  } finally { globalThis.CustomEvent = previous; }
});

test('handoff failure rejects instead of allowing a false sender success message', async () => {
  const previous = globalThis.CustomEvent;
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  try {
    const target = { dispatchEvent(event) { event.detail.completion.reject(new Error('IndexedDB write failed')); } };
    await assert.rejects(handoffToPublishing({ resultRef: 'one' }, target), /IndexedDB write failed/);
  } finally { globalThis.CustomEvent = previous; }
});

test('senders await the real Publishing persistence and carousel preparation before success', async () => {
  const root = new URL('../', import.meta.url);
  const [app, carousel, publishing] = await Promise.all(['public/app.js', 'public/carousel.js', 'public/publishing.js'].map(path => readFile(new URL(path, root), 'utf8')));
  assert.match(app, /await handoffToPublishing\([\s\S]*?status\.textContent = 'Design ready in Publishing\.'/);
  assert.match(carousel, /await handoffToPublishing\(/);
  assert.match(publishing, /await savePublishingMedia\(state\.carouselFiles[\s\S]*?completion\?\.resolve/);
  assert.match(publishing, /await savePublishingMedia\(state\.media[\s\S]*?completion\?\.resolve/);
  assert.match(publishing, /completion\?\.reject\(error\)/);
});

test('handoff persistence completes before success and a stale restore cannot reset actual handed-off media', async () => {
  const [assets, publishing] = await Promise.all([file('src/calendar-assets.js'), file('public/publishing.js')]);
  assert.match(assets, /transaction\.oncomplete = \(\) => resolve\(request\.result\)/);
  assert.match(assets, /await transact\('readwrite', store => store\.put\(\{ id, type: 'publishing-media', file \}\)\)/);
  assert.match(publishing, /let mediaLifecycleVersion = 0/);
  assert.match(publishing, /beginMediaLifecycle\(\);\s*const publishingHandoffOperation = showProcessing/s);
  assert.match(publishing, /const current = \(\) => lifecycle === mediaLifecycleVersion && reference === state\.mediaRef && source === state\.mediaSource/);
  assert.match(publishing, /await loadCalendarAsset\(state\.mediaRef\); if \(!current\(\)\) return;/);
  assert.match(publishing, /validPublishingMedia\(state\.carouselFiles\.length \? state\.carouselFiles : state\.media\)/);
  assert.match(publishing, /mediaLog\('\[HANDOFF\] saved', state\.mediaRef/);
  assert.match(publishing, /mediaLog\('\[PUBLISHING\] file restored', state\.mediaRef, state\.carouselFiles\)/);
  assert.match(publishing, /mediaLog\('\[PUBLISHING\] preview rendered', state\.mediaRef, state\.carouselFiles\)/);
  assert.match(publishing, /completion\?\.resolve\(\{ mediaRef: state\.mediaRef, carouselFiles: state\.carouselFiles\.length \}\)/);
});