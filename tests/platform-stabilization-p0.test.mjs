import test from 'node:test';
import assert from 'node:assert/strict';
import { lightweightCarousel, saveCarouselDraft, loadCarouselDraft, normalizeCarousel } from '../src/carousel.js';
import { normalizeMultiPageContentInput, generateMultiPageContent } from '../src/multi-page-content.mjs';
import fs from 'node:fs';

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), value: key => values.get(key) }; };

test('carousel draft persistence keeps generated visual payloads out of localStorage while preserving references', () => {
  const storage = memory();
  const draft = normalizeCarousel({ slides: [{ type: 'cover', settings: { visualAssetId: 'carousel-visual:one', aiVisual: 'data:image/png;base64,' + 'x'.repeat(300000) } }, { type: 'cta', settings: {} }] });
  const saved = saveCarouselDraft(draft, storage);
  assert.equal(saved.slides[0].settings.aiVisual, undefined);
  assert.equal(saved.slides[0].settings.visualAssetId, 'carousel-visual:one');
  assert.equal(storage.value('upplai-design-studio-carousel-draft').includes('data:image'), false);
  assert.equal(loadCarouselDraft(storage).slides[0].settings.visualAssetId, 'carousel-visual:one');
});

test('carousel renderer declares its template before every AI visual rendering branch', () => {
  const source = fs.readFileSync(new URL('../public/carousel.js', import.meta.url), 'utf8');
  assert.ok(source.indexOf("const template = document.createElement('template');") < source.indexOf("sourceType === 'ai-artwork'"));
});

test('multi-page prompt generation normalizes page count and produces ordered mock pages without network access', async () => {
  const input = normalizeMultiPageContentInput({ prompt: 'Explain stronger resume bullets', pageCount: 3, renderMode: 'native' });
  const result = await generateMultiPageContent({ config: { mockMode: true }, input });
  assert.equal(result.pages.length, 3);
  assert.deepEqual(result.pages.map(page => page.order), [0, 1, 2]);
  assert.match(result.pages[0].headline, /resume bullets/i);
});

test('Calendar edit dispatches an explicit Calendar identity context and does not navigate multi-page or carousel review edits away', () => {
  const source = fs.readFileSync(new URL('../public/calendar-table.js', import.meta.url), 'utf8');
  assert.match(source, /source: 'CALENDAR', calendarItemId: row\.id/);
  assert.match(source, /!isPaginatedCalendarResult\(row\)/);
});
