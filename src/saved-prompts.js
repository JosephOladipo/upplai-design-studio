const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function createSavedPromptStore({ storageKey, prefix = 'prompt' }) {
  const load = (storage = globalThis.localStorage) => {
    try {
      const raw = JSON.parse(storage.getItem(storageKey));
      return Array.isArray(raw) ? raw.filter(item => item && clean(item.id, 160) && clean(item.name, 80) && clean(item.prompt, 1200)).map(item => ({ id: clean(item.id, 160), name: clean(item.name, 80), prompt: clean(item.prompt, 1200), createdAt: clean(item.createdAt, 80), updatedAt: clean(item.updatedAt, 80) })) : [];
    } catch { return []; }
  };
  const persist = (items, storage) => { storage.setItem(storageKey, JSON.stringify(items)); return items; };
  const save = (name, prompt, storage = globalThis.localStorage, now = () => new Date().toISOString()) => {
    const savedName = clean(name, 80); const savedPrompt = clean(prompt, 1200);
    if (!savedName || !savedPrompt) throw new Error('Enter a prompt and prompt name.');
    const timestamp = now(); const item = { id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: savedName, prompt: savedPrompt, createdAt: timestamp, updatedAt: timestamp };
    persist([...load(storage), item], storage); return item;
  };
  const rename = (id, name, storage = globalThis.localStorage, now = () => new Date().toISOString()) => {
    const nextName = clean(name, 80); if (!nextName) throw new Error('Enter a prompt name.');
    let changed = null; const items = load(storage).map(item => item.id === id ? (changed = { ...item, name: nextName, updatedAt: now() }) : item); persist(items, storage); return changed;
  };
  const duplicate = (id, storage = globalThis.localStorage, now = () => new Date().toISOString()) => { const source = load(storage).find(item => item.id === id); if (!source) throw new Error('Saved prompt not found.'); return save(`${source.name} copy`, source.prompt, storage, now); };
  const remove = (id, storage = globalThis.localStorage) => persist(load(storage).filter(item => item.id !== id), storage);
  return { storageKey, load, save, rename, duplicate, remove };
}