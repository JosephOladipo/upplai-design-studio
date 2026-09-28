import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedPromptStore } from '../src/saved-prompts.js';
import { normalizeCarouselContentInput, generateCarouselContent } from '../src/carousel-content.mjs';

function memory() { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }; }

test('separate saved prompt stores save, rename, duplicate, delete, and preserve text', () => {
  const storage = memory(); const captions = createSavedPromptStore({ storageKey: 'caption', prefix: 'caption' }); const carousels = createSavedPromptStore({ storageKey: 'carousel', prefix: 'carousel' });
  const saved = captions.save('Job seeker', 'Use a challenging question.', storage, () => '2026-01-01');
  assert.equal(captions.load(storage)[0].prompt, 'Use a challenging question.');
  captions.rename(saved.id, 'Educational', storage, () => '2026-01-02');
  assert.equal(captions.load(storage)[0].prompt, 'Use a challenging question.');
  const copy = captions.duplicate(saved.id, storage, () => '2026-01-03'); assert.notEqual(copy.id, saved.id);
  captions.remove(saved.id, storage); assert.equal(captions.load(storage).length, 1);
  carousels.save('Framework', 'Create a 5-slide carousel.', storage); assert.equal(carousels.load(storage).length, 1); assert.equal(captions.load(storage).length, 1);
});

test('prompt-only carousel input respects an explicit slide count and native mode makes no image request', async () => {
  const input = normalizeCarouselContentInput({ prompt: 'Create a 7-slide educational carousel for job seekers.', slideCount: 3, renderMode: 'native' });
  assert.equal(input.topic, 'Create a 7-slide educational carousel for job seekers.'); assert.equal(input.slideCount, 7); assert.equal(input.renderMode, 'native');
  const result = await generateCarouselContent({ config: { mockMode: true }, input }); assert.equal(result.slides.length, 7);
});