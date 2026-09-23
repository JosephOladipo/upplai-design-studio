import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualRow, importCalendarCsv, loadCalendar, saveCalendar } from '../src/calendar.js';
import { createCalendarQueue } from '../src/calendar-generation.js';
import { createCarouselDraft } from '../src/carousel.js';

test('Calendar content format defaults legacy rows to single-image and preserves carousel drafts', () => {
  const storage = new Map(); const mock = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  saveCalendar([{ id: 'legacy', order: 0, date: '2030-01-01', headline: 'Legacy', style: 'premium-editorial', ai: {} }], mock);
  assert.equal(loadCalendar(mock).rows[0].contentFormat ?? 'single-image', 'single-image');
  const carousel = createCarouselDraft(); const result = createManualRow({ date: '2030-01-02', headline: 'Carousel', style: 'premium-editorial', contentFormat: 'carousel', carousel }, []);
  assert.equal(result.row.contentFormat, 'carousel'); assert.equal(result.row.carousel.slides.length, 5);
});
test('CSV Content Format is optional and normalizes carousel safely', () => {
  const legacy = importCalendarCsv('Date,Headline\n2030-01-01,Legacy');
  const carousel = importCalendarCsv('Date,Headline,Content Format\n2030-01-01,Slides,Carousel');
  assert.equal(legacy.rows[0].contentFormat, 'single-image'); assert.equal(carousel.rows[0].contentFormat, 'carousel'); assert.equal(carousel.rows[0].carousel.slides.length, 5);
});
test('Calendar queue dispatches a complete carousel row without the single-image input adapter', async () => {
  let received; const queue = createCalendarQueue(async row => { received = row; return { type: 'carousel', slides: [{ slideId: 'one' }, { slideId: 'two' }] }; });
  const row = { id: 'carousel', order: 0, date: '2030-01-01', headline: 'Slides', status: 'ready', contentFormat: 'carousel', carousel: createCarouselDraft() };
  const result = await queue.run([row], new Set(['carousel']));
  assert.equal(received.contentFormat, 'carousel'); assert.equal(result.rows[0].status, 'generated'); assert.equal(result.results.get('carousel').slides.length, 2);
});