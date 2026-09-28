import { createSavedPromptStore } from './saved-prompts.js';
export const SAVED_CAROUSEL_PROMPTS_KEY = 'upplai-design-studio-saved-carousel-prompts';
const store = createSavedPromptStore({ storageKey: SAVED_CAROUSEL_PROMPTS_KEY, prefix: 'carousel-prompt' });
export const loadSavedCarouselPrompts = store.load;
export const saveCarouselPrompt = store.save;
export const renameCarouselPrompt = store.rename;
export const duplicateCarouselPrompt = store.duplicate;
export const deleteCarouselPrompt = store.remove;