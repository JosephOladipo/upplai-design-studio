import test from 'node:test';
import assert from 'node:assert/strict';
import { createCarouselDraft, loadSavedCarousels, saveSavedCarousels, saveCarouselProject, duplicateCarouselProject, removeCarouselProject } from '../src/carousel.js';

const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };

test('saved carousel draft receives stable identity and updates rather than duplicating', () => {
  const store = storage(); const carousel = createCarouselDraft(); carousel.title = 'Resume guide'; carousel.slides[2].settings.editedHtml = '<article>edited</article>';
  const first = saveCarouselProject({ id: 'draft-one', name: 'September carousel', carousel, selectedSlide: 2 }, store);
  const second = saveCarouselProject({ ...first, name: 'October carousel', selectedSlide: 3 }, store);
  const saved = loadSavedCarousels(store);
  assert.equal(saved.length, 1); assert.equal(saved[0].id, 'draft-one'); assert.equal(second.createdAt, first.createdAt); assert.equal(saved[0].name, 'October carousel'); assert.equal(saved[0].carousel.slides[2].settings.editedHtml, '<article>edited</article>');
});

test('saved carousel duplicate is independent, preserves content and manual edits, and deletion removes only the requested draft', () => {
  const store = storage(); const carousel = createCarouselDraft(); carousel.title = 'Original content'; carousel.slides[1].settings.editedHtml = '<article>manual edit</article>';
  const original = saveCarouselProject({ id: 'original', name: 'Original', carousel }, store); const copy = duplicateCarouselProject(original, store);
  assert.notEqual(copy.id, original.id); assert.equal(copy.carousel.title, 'Original content'); assert.equal(copy.carousel.slides[1].settings.editedHtml, '<article>manual edit</article>');
  copy.carousel.title = 'Changed copy'; saveCarouselProject(copy, store);
  assert.equal(loadSavedCarousels(store).find(item => item.id === 'original').carousel.title, 'Original content');
  removeCarouselProject(copy.id, store); assert.deepEqual(loadSavedCarousels(store).map(item => item.id), ['original']);
});

test('malformed saved carousel storage is ignored safely', () => {
  const store = storage(); store.setItem('upplai-design-studio-carousel-drafts-v1', '{bad json'); assert.deepEqual(loadSavedCarousels(store), []);
});

test('saved carousel storage rejects oversized local HTML instead of silently filling browser storage', () => {
  const store = storage(); const carousel = createCarouselDraft(); carousel.slides[0].settings.editedHtml = 'x'.repeat(1024 * 1024);
  assert.throws(() => saveSavedCarousels([{ id: 'large', name: 'Large', carousel }], store), /too large/);
});
