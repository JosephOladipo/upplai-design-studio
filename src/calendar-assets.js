// Small browser-only store for Calendar review assets. Calendar metadata stays in localStorage.
const DB_NAME = 'upplai-design-studio-assets';
const STORE_NAME = 'calendar-results';
const VERSION = 1;

function openDatabase(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) { reject(new Error('Persistent review storage is unavailable in this browser.')); return; }
    const request = factory.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open review storage.'));
  });
}

async function transact(mode, work) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = work(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Review asset storage failed.'));
    });
  } finally { database.close(); }
}

export function calendarResultRef(rowId) { return `calendar-result:${rowId}`; }

export async function saveCalendarAsset(resultRef, result) {
  if (!resultRef) throw new Error('Generated result is unavailable for review storage.');
  const carousel = result?.type === 'carousel';
  if (!carousel && !result?.preview?.outerHTML) throw new Error('Generated preview is unavailable for review storage.');
  if (carousel && !Array.isArray(result.slides)) throw new Error('Generated carousel slides are unavailable for review storage.');
  const asset = carousel ? { id: resultRef, type: 'carousel', width: result.width, height: result.height, style: result.style || '', slides: result.slides.map(slide => ({ slideId: slide.slideId, order: slide.order, type: slide.type, html: slide.preview?.outerHTML || '' })), updatedAt: new Date().toISOString() } : { id: resultRef, type: 'single-image', html: result.preview.outerHTML, style: result.style || '', updatedAt: new Date().toISOString() };
  if (carousel && asset.slides.some(slide => !slide.html)) throw new Error('Generated carousel slide is unavailable for review storage.');
  await transact('readwrite', store => store.put(asset));
  return asset.id;
}

export async function loadCalendarAsset(resultRef) {
  if (!resultRef) return null;
  return transact('readonly', store => store.get(resultRef));
}

export async function removeCalendarAsset(resultRef) {
  if (!resultRef) return;
  await transact('readwrite', store => store.delete(resultRef));
}
