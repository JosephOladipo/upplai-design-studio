import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Carousel editor keeps the Carousel appearance and commits before continuous navigation', async () => {
  const [app, carousel, css] = await Promise.all([read('public/app.js'), read('public/carousel.js'), read('public/editor-workspace.css')]);
  assert.match(css, /#preview\.carousel-slide\{[^}]*background:var\(--carousel-light\)/);
  assert.match(app, /function commitCarouselBuilderSlide/);
  assert.match(app, /carousel:builder-slide-preview/);
  assert.match(app, /carouselEditorPrevious\.addEventListener/);
  assert.match(app, /carouselEditorNext\.addEventListener/);
  assert.match(carousel, /carousel:builder-draft-commit/);
  assert.match(carousel, /carousel:builder-slide-preview/);
});

test('Publishing initialization keeps a single parse-safe module without temporary debug capture', async () => {
  const [publishing, html] = await Promise.all([read('public/publishing.js'), read('public/index.html')]);
  assert.doesNotMatch(publishing, /function button\s*\(/);
  assert.match(publishing, /function makeButton\s*\(/);
  assert.doesNotMatch(publishing, /pub-debug|publishing-debug/);
  assert.doesNotMatch(html, /publishing-debug/);
});