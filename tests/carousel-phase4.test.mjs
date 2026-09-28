import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { carouselTemplates, normalizeCarousel } from '../src/carousel.js';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');

test('template library contains the initial deterministic carousel systems without AI', () => {
  assert.deepEqual(carouselTemplates.map(item => item.id), ['minimal-editorial', 'swipe-guide', 'numbered-steps', 'bold-cards', 'brand-gradient', 'modern-magazine', 'progress-story', 'data-insight', 'clean-brand']);
  const draft = normalizeCarousel({ style: 'swipe-guide', slides: [{ type: 'cover', headline: 'Keep my content' }, { type: 'cta', cta: 'Continue' }] });
  assert.equal(draft.style, 'swipe-guide');
  assert.equal(draft.slides[0].headline, 'Keep my content');
});

test('builder exposes direct selected-slide editing, template cards, and a no-calendar publishing handoff', async () => {
  const [html, carousel, app] = await Promise.all([read('../public/index.html'), read('../public/carousel.js'), read('../public/app.js')]);
  assert.match(html, /id="carousel-edit-slide"/);
  assert.match(html, /id="carousel-template-cards"/);
  assert.match(html, /id="carousel-send-publishing"/);
  assert.match(html, /id="carousel-save-draft"/);
  assert.match(html, /id="carousel-saved-list"/);
  assert.match(carousel, /slideIndex: selected/);
  assert.match(carousel, /carousel:builder-slide-edit/);
  assert.match(carousel, /carousel:builder-slide-saved/);
  assert.match(carousel, /saveCalendarAsset\(resultRef, result\)/);
  assert.match(app, /context\.source === 'builder'/);
  assert.match(app, /carousel:builder-slide-edit/);
});

test('template rendering uses actual slide totals and exposes editable page and navigation elements', async () => {
  const carousel = await read('../public/carousel.js');
  assert.match(carousel, /String\(total\)\.padStart\(2, '0'\)/);
  assert.match(carousel, /SWIPE →/);
  assert.match(carousel, /data-editor-id="page-indicator"/);
  assert.match(carousel, /data-editor-id="progress"/);
  assert.match(carousel, /editedHtml/);
});
