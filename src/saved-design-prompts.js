import { createSavedPromptStore } from './saved-prompts.js';
export const SAVED_DESIGN_PROMPTS_KEY = 'upplai-design-studio-saved-design-prompts';
const store = createSavedPromptStore({ storageKey: SAVED_DESIGN_PROMPTS_KEY, prefix: 'prompt' });
export const loadSavedDesignPrompts = store.load;
export const saveDesignPrompt = store.save;
export const deleteDesignPrompt = store.remove;
export const renameDesignPrompt = store.rename;
export const duplicateDesignPrompt = store.duplicate;