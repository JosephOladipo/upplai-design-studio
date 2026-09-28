import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiPageDraft, addMultiPage, duplicateMultiPage, deleteMultiPage, moveMultiPage, normalizeMultiPage } from '../src/multi-page.js';
import { saveDesignPrompt, renameDesignPrompt, duplicateDesignPrompt, deleteDesignPrompt, loadSavedDesignPrompts } from '../src/saved-design-prompts.js';
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) }; };
test('multi-page model keeps a 2–10 ordered page range without carousel roles', () => {
  let draft = createMultiPageDraft(3); draft = addMultiPage(draft, 1); draft = duplicateMultiPage(draft, 0); draft = moveMultiPage(draft, 0, 1);
  assert.equal(draft.pages.length, 5); assert.deepEqual(draft.pages.map((page, index) => page.order), [0, 1, 2, 3, 4]);
  while (draft.pages.length > 2) draft = deleteMultiPage(draft, draft.pages.length - 1);
  assert.equal(normalizeMultiPage(draft).pages.length, 2);
});
test('the existing saved prompt store supports rename, duplicate and delete', () => {
  const storage = memory(); const first = saveDesignPrompt('Career', 'Premium editorial direction.', storage, () => '2030-01-01T00:00:00Z');
  assert.equal(renameDesignPrompt(first.id, 'Career series', storage).name, 'Career series');
  const copy = duplicateDesignPrompt(first.id, storage, () => '2030-01-02T00:00:00Z');
  assert.equal(loadSavedDesignPrompts(storage).length, 2); assert.equal(deleteDesignPrompt(copy.id, storage).length, 1);
});
