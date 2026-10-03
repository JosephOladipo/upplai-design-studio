import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
