import { createSavedPromptStore } from './saved-prompts.js';
export const SAVED_AI_DESIGNER_PROMPTS_KEY = 'upplai-design-studio-saved-ai-designer-prompts';
const store = createSavedPromptStore({ storageKey: SAVED_AI_DESIGNER_PROMPTS_KEY, prefix: 'ai-designer' });
export const loadAiDesignerPrompts = store.load;
export const saveAiDesignerPrompt = store.save;
export const deleteAiDesignerPrompt = store.remove;
