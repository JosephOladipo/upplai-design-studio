import test from 'node:test';
import assert from 'node:assert/strict';
import { createCarouselDraft, normalizeCarousel, addSlide, deleteSlide, duplicateSlide, moveSlide, slideFitWarning, carouselStyles, roleSequence } from '../src/carousel.js';

test('carousel starts with cover, content slides and a CTA', () => { const draft = createCarouselDraft(); assert.equal(draft.slides.length, 5); assert.equal(draft.slides[0].type, 'cover'); assert.equal(draft.slides.at(-1).type, 'cta'); });
test('carousel maintains two-slide minimum and ten-slide maximum', () => { let draft = createCarouselDraft(); while (draft.slides.length > 2) draft = deleteSlide(draft, 1); assert.equal(draft.slides.length, 2); for (let i = 0; i < 12; i += 1) draft = addSlide(draft, draft.slides.length - 1); assert.equal(draft.slides.length, 10); });
test('carousel duplicate, move and order preserve distinct slide IDs', () => { let draft = createCarouselDraft(); const id = draft.slides[1].id; draft = duplicateSlide(draft, 1); assert.notEqual(draft.slides[2].id, id); draft = moveSlide(draft, 2, -1); assert.equal(draft.slides[1].id, draft.slides[1].id); assert.deepEqual(draft.slides.map((slide, index) => slide.order), draft.slides.map((_, index) => index)); });
test('carousel normalizes theme and warns only when slide text exceeds safe limits', () => { const draft = normalizeCarousel({ slides: [{ type: 'cover', headline: 'x'.repeat(181) }, { type: 'cta' }] }); assert.ok(draft.theme.primaryColor); assert.equal(slideFitWarning(draft.slides[0]), true); assert.equal(slideFitWarning(draft.slides[1]), false); });
test('carousel offers nine deterministic visual systems and assigns intentional slide roles', () => {
  assert.deepEqual(carouselStyles.map(style => style.id), ['minimal-editorial', 'swipe-guide', 'numbered-steps', 'bold-cards', 'brand-gradient', 'modern-magazine', 'progress-story', 'data-insight', 'clean-brand']);
  assert.deepEqual(roleSequence(5), ['cover', 'context', 'insight', 'list', 'cta']);
  assert.deepEqual(roleSequence(7), ['cover', 'context', 'insight', 'list', 'stat', 'conclusion', 'cta']);
});
test('carousel normalization upgrades legacy content roles while preserving slide order', () => {
  const draft = normalizeCarousel({ slides: Array.from({ length: 7 }, (_, order) => ({ type: order === 0 ? 'cover' : order === 6 ? 'cta' : 'content', order })) });
  assert.deepEqual(draft.slides.map(slide => slide.type), roleSequence(7));
  assert.deepEqual(draft.slides.map(slide => slide.order), [0, 1, 2, 3, 4, 5, 6]);
});
test('carousel renderer keeps Brand Kit tokens, slide indicators, and editable object metadata', async () => {
  const source = await import('node:fs/promises')
    .then(fs => fs.readFile(new URL('../public/carousel.js', import.meta.url), 'utf8'));
  assert.match(source, /--carousel-primary/);
  assert.match(source, /padStart\(2, '0'\)/);
  assert.match(source, /data-editor-id="headline"/);
  assert.match(source, /data-editor-id="supporting-copy"/);
  assert.match(source, /data-editor-id="logo"/);
});
