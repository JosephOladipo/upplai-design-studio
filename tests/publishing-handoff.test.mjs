import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('single-design handoff persists the current preview and declares its identity', async () => {
  const app = await file('public/app.js');
  assert.match(app, /await saveCalendarAsset\(resultRef, \{\s*preview: preview\.cloneNode\(true\)/s);
  assert.match(app, /source: preview\.dataset\.editSource \|\| 'create'/);
  assert.match(app, /contentType: 'single-image'/);
  assert.match(app, /finally \{\s*sendToPublish\.disabled = false/s);
});

test('Publishing renders stored generated HTML before any explicit media upload', async () => {
  const publishing = await file('public/publishing.js');
  const receiver = publishing.slice(publishing.indexOf("document.addEventListener('publishing:generated'"));
  assert.match(publishing, /const visiblePreview = state\.generatedPreview\.cloneNode\(true\)/);
  assert.match(publishing, /q\('publishing-media'\)\.replaceChildren\(visiblePreview\)/);
  assert.doesNotMatch(receiver, /await prepareGeneratedMediaPreview\(\)/);
  assert.match(publishing, /const blob = await previewPngBlob\(state\.generatedPreview\)/);
});

test('multi-page, carousel, Calendar, and Review handoffs retain stored result references', async () => {
  const [html, multi, carousel, calendar] = await Promise.all([
    file('public/index.html'), file('public/multi-page.js'), file('public/carousel.js'), file('public/calendar-table.js')
  ]);
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
  assert.match(publishing, /finally \{ hideProcessing\(\); \}/);
  assert.match(publishing, /Generated design could not be loaded/);
});
