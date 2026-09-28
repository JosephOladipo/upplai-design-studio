import { createSavedPromptStore } from './saved-prompts.js';
export const SAVED_CAPTION_PROMPTS_KEY = 'upplai-design-studio-saved-caption-prompts';
const store = createSavedPromptStore({ storageKey: SAVED_CAPTION_PROMPTS_KEY, prefix: 'caption-prompt' });
export const loadSavedCaptionPrompts = store.load;
export const saveCaptionPrompt = store.save;
export const renameCaptionPrompt = store.rename;
export const duplicateCaptionPrompt = store.duplicate;
export const deleteCaptionPrompt = store.remove;