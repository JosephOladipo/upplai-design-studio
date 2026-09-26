import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSavedDesignPrompts, saveDesignPrompt, deleteDesignPrompt, SAVED_DESIGN_PROMPTS_KEY } from '../src/saved-design-prompts.js';
import { directorInput } from '../src/ai-style.js';
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) }; };
test('manual design prompt uses the existing customDirection pipeline and empty prompt preserves custom direction', () => {
  const base = { headline: 'Headline', supportingCopy: 'Copy', cta: 'CTA', aiVisualStyle: 'auto', aiSubject: 'custom', aiDirection: 'Existing direction', aiComposition: 'left', aiDesignPrompt: '' };
  assert.equal(directorInput(base).customDirection, 'Existing direction');
  assert.equal(directorInput({ ...base, aiDesignPrompt: 'Premium editorial lighting.' }).customDirection, 'Premium editorial lighting.');
  assert.equal(directorInput({ ...base, headline: 'New headline' }).headline, 'New headline');
});
test('saved design prompts save, load, delete and tolerate malformed storage', () => {
  const storage = memory(); const saved = saveDesignPrompt('Editorial', 'Keep negative space on the left.', storage, () => '2030-01-01T00:00:00.000Z');
  assert.deepEqual(loadSavedDesignPrompts(storage), [saved]);
  assert.deepEqual(deleteDesignPrompt(saved.id, storage), []);
  storage.setItem(SAVED_DESIGN_PROMPTS_KEY, '{bad'); assert.deepEqual(loadSavedDesignPrompts(storage), []);
});