export const SAVED_DESIGN_PROMPTS_KEY = 'upplai-design-studio-saved-design-prompts';
const clean = value => String(value || '').trim();
export function loadSavedDesignPrompts(storage = globalThis.localStorage) {
  try { const value = JSON.parse(storage.getItem(SAVED_DESIGN_PROMPTS_KEY)); return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && clean(item.name) && clean(item.prompt)).map(item => ({ id: item.id, name: clean(item.name), prompt: clean(item.prompt), createdAt: typeof item.createdAt === 'string' ? item.createdAt : '' })) : []; } catch { return []; }
}
export function saveDesignPrompt(name, prompt, storage = globalThis.localStorage, now = () => new Date().toISOString()) {
  const savedName = clean(name); const savedPrompt = clean(prompt); if (!savedName || !savedPrompt) throw new Error('Enter a prompt and prompt name.');
  const item = { id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: savedName.slice(0, 80), prompt: savedPrompt.slice(0, 1200), createdAt: now() };
  const items = [...loadSavedDesignPrompts(storage), item]; storage.setItem(SAVED_DESIGN_PROMPTS_KEY, JSON.stringify(items)); return item;
}
export function deleteDesignPrompt(id, storage = globalThis.localStorage) { const items = loadSavedDesignPrompts(storage).filter(item => item.id !== id); storage.setItem(SAVED_DESIGN_PROMPTS_KEY, JSON.stringify(items)); return items; }