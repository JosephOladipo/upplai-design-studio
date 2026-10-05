import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('generated Publishing uses persisted PNGs as the visual source for preview, AI, and upload', async () => {
  const [publishing, vision, assets] = await Promise.all([
    file('public/publishing.js'), file('public/publishing-vision.js'), file('src/calendar-assets.js')
  ]);
  assert.match(publishing, /state\.carouselFiles\[state\.carouselIndex\]/);
  assert.match(publishing, /state\.carouselFiles\[index\] \|\| await previewPngBlob/);
  assert.match(vision, /state\.carouselFiles\?\.length/);
  assert.match(vision, /state\.mediaSource === 'generated' \|\| state\.mediaSource === 'generated-direct'/);
  assert.match(assets, /savePublishingMedia\(file, id = 'publishing-current-media'\)/);
  assert.match(publishing, /mediaInput\.onchange[\s\S]*?state\.carouselFiles = \[\];[\s\S]*?altText\.value = ''/);
});

test('caption and alt text remain available during a design render and video sampling has bounded multi-frame fallback', async () => {
  const [server, vision, sampling] = await Promise.all([file('server.js'), file('public/publishing-vision.js'), file('src/video-frame-sampling.js')]);
  assert.match(server, /checkRequest\(req, res, false, true\)/);
  assert.match(server, /aiBusy && !allowConcurrent/);
  assert.doesNotMatch(server.slice(server.indexOf('async function assistantRoute'), server.indexOf("app.post('/api/ai/generate-caption'")), /aiBusy = true/);
  assert.match(vision, /import \{ videoSampleTargets \}/);
  assert.match(sampling, /\[\.12, \.5, \.85\]/);
  assert.match(sampling, /duration < 6 \? \[\.2, \.7\] : \[\.12, \.5, \.85\]/);
  assert.match(vision, /if \(!images\.length\)[\s\S]*?await seek\(0\)/);
  assert.match(vision, /setTimeout\(\(\) => done\(null\), 3000\)/);
});

test('direct multi-image uploads use the ordered carousel persistence and upload path', async () => {
  const [html, publishing] = await Promise.all([file('public/index.html'), file('public/publishing.js')]);
  assert.match(html, /id="publishing-media-input"[^>]*multiple/);
  assert.match(publishing, /const files = \[\.\.\.\(event\.target\.files \|\| \[\]\)\]/);
  assert.match(publishing, /classifyManualMedia\(files, supportedManualMedia\)/);
  assert.match(publishing, /state\.carouselFiles = files/);
  assert.match(publishing, /await savePublishingMedia\(files\)/);
  assert.match(publishing, /state\.mediaSource === 'manual-carousel' && state\.mediaRef/);
  assert.match(publishing, /state\.carouselFiles = asset\.file/);
});

test('uploaded and Builder carousels use one ordered Buffer media collection', async () => {
  const [publishing, buffer] = await Promise.all([file('public/publishing.js'), file('src/buffer-publish.mjs')]);
  assert.match(publishing, /const count = state\.carouselFiles\.length \|\| state\.carouselSlides\.length/);
  assert.match(publishing, /state\.carouselFiles\[index\] \|\| await previewPngBlob/);
  assert.match(buffer, /media\.type === 'carousel'.*media\.items\.map/s);
  assert.match(buffer, /TikTok multi-image publishing is not available yet/);
});
