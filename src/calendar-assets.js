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
      const transaction = database.transaction(STORE_NAME, mode);
      const request = work(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || new Error('Asset storage transaction aborted.'));
      request.onerror = () => reject(request.error || new Error('Review asset storage failed.'));
    });
  } finally { database.close(); }
}

export function calendarResultRef(rowId) { return `calendar-result:${rowId}`; }

export async function saveCalendarAsset(resultRef, result) {
  if (!resultRef) throw new Error('Generated result is unavailable for review storage.');
  const multi = result?.type === 'carousel' || result?.type === 'multi-page';
  if (!multi && !result?.preview?.outerHTML) throw new Error('Generated preview is unavailable for review storage.');
  if (multi && !Array.isArray(result.slides)) throw new Error('Generated multi-page result is unavailable for review storage.');
  const asset = multi ? { id: resultRef, type: result.type, width: result.width, height: result.height, style: result.style || '', slides: result.slides.map(slide => ({ slideId: slide.slideId, order: slide.order, type: slide.type, html: slide.preview?.outerHTML || '' })), updatedAt: new Date().toISOString() } : { id: resultRef, type: 'single-image', html: result.preview.outerHTML, style: result.style || '', updatedAt: new Date().toISOString() };
  if (multi && asset.slides.some(slide => !slide.html)) throw new Error('Generated page is unavailable for review storage.');
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

export async function saveCarouselImportAsset(id, dataUrl, metadata = {}) {
  if (!id || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) throw new Error('Imported image data is unavailable.');
  await transact('readwrite', store => store.put({ id, type: 'carousel-import', dataUrl, ...metadata, updatedAt: new Date().toISOString() }));
  return id;
}

export async function loadCarouselImportAsset(id) {
  const asset = await loadCalendarAsset(id);
  return asset?.type === 'carousel-import' ? asset : null;
}

// Carousel AI visuals share the existing IndexedDB store. Draft metadata keeps
// only the reference, so localStorage never receives a generated image URL.
export async function saveCarouselVisualAsset(id, dataUrl, metadata = {}) {
  if (!id || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) throw new Error('Generated carousel visual is unavailable.');
  await transact('readwrite', store => store.put({ id, type: 'carousel-visual', dataUrl, ...metadata, updatedAt: new Date().toISOString() }));
  return id;
}

export async function loadCarouselVisualAsset(id) {
  const asset = await loadCalendarAsset(id);
  return asset?.type === 'carousel-visual' ? asset : null;
}

// Blob persistence shares the existing asset database; localStorage stores only its key.
export async function savePublishingMedia(file, id = 'publishing-current-media') {
  if (!file || !id) throw new Error('Publishing media is unavailable for recovery.');
  await transact('readwrite', store => store.put({ id, type: 'publishing-media', file }));
  return id;
}
