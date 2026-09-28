import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCarouselDraft, normalizeCarousel, saveCarouselDraft, loadCarouselDraft } from '../src/carousel.js';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };

test('Carousel Builder Edit Slide hands the selected slide to the visible shared editor and returns it to the same index', async () => {
  const [carousel, app] = await Promise.all([source('public/carousel.js'), source('public/app.js')]);
  assert.match(carousel, /slideId: draft\.slides\[selected\]\?\.id/);
  assert.match(carousel, /document\.dispatchEvent\(new Event\('navigate:create'\)\)/);
  assert.match(carousel, /requestAnimationFrame\(\(\) => document\.dispatchEvent\(new CustomEvent\('carousel:builder-slide-edit'/);
  assert.match(app, /document\.querySelector\('#create-preview-panel'\)\.hidden = false/);
  assert.match(app, /document\.querySelector\('#carousel-builder'\)\.hidden = true/);
  assert.match(carousel, /slide\.settings = \{ \.\.\.\(slide\.settings \|\| \{\}\), editedHtml: edited\.outerHTML \}/);
  assert.match(carousel, /selected = slideIndex/);
});

test('an edited third slide persists with its identity and leaves other Carousel slides ordered', () => {
  const storage = memory(); const draft = createCarouselDraft(); draft.slides = draft.slides.map((slide, index) => ({ ...slide, headline: `Slide ${index + 1}` }));
  const third = draft.slides[2]; third.settings.editedHtml = '<article><h2>THIS SLIDE WAS EDITED</h2><span class="rectangle"></span></article>';
  const saved = saveCarouselDraft(normalizeCarousel(draft), storage); const restored = loadCarouselDraft(storage);
  assert.equal(restored.slides[2].id, third.id); assert.match(restored.slides[2].settings.editedHtml, /THIS SLIDE WAS EDITED/);
  assert.deepEqual(restored.slides.map(slide => slide.id), saved.slides.map(slide => slide.id));
});