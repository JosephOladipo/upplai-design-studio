import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyManualMedia } from '../src/publishing-media-selection.js';

const image = name => ({ name, type: 'image/png' });
const video = { name: 'clip.mp4', type: 'video/mp4' };
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('direct three-image selection is one ordered carousel and single image or video stays singular', () => {
  const carousel = classifyManualMedia([image('1.png'), image('2.png'), image('3.png')]);
  assert.equal(carousel.kind, 'carousel');
  assert.deepEqual(carousel.files.map(file => file.name), ['1.png', '2.png', '3.png']);
  assert.equal(classifyManualMedia([image('only.png')]).kind, 'single');
  assert.equal(classifyManualMedia([video]).kind, 'single');
});

test('mixed and unsupported multi-file selections are rejected before publishing state is replaced', () => {
  assert.match(classifyManualMedia([image('slide.png'), video]).error, /carousel can contain only/);
  assert.match(classifyManualMedia([{ name: 'file.gif', type: 'image/gif' }]).error, /Choose up to 10/);
});

test('Publishing persists and restores ordered uploaded and Builder carousel media without localStorage binaries', async () => {
  const [publishing, assets, carousel, buffer] = await Promise.all([source('public/publishing.js'), source('src/calendar-assets.js'), source('public/carousel.js'), source('src/buffer-publish.mjs')]);
  assert.match(publishing, /state\.carouselFiles = files/);
  assert.match(publishing, /await savePublishingMedia\(files\)/);
  assert.match(publishing, /state\.mediaSource === 'manual-carousel'.*state\.mediaRef/s);
  assert.match(publishing, /state\.carouselFiles = asset\.file/);
  assert.match(publishing, /renderPublishingCarousel\(\)/);
  assert.match(carousel, /result\.slides\.forEach/);
  assert.match(carousel, /await saveCalendarAsset\(resultRef, result\)/);
  assert.match(buffer, /media\.type === 'carousel'.*media\.items\.map/s);
  assert.match(assets, /indexedDB/);
  assert.doesNotMatch(publishing.slice(publishing.indexOf('function savePublishingDraft'), publishing.indexOf('function restorePublishingDraft')), /data:image|base64/);
});
