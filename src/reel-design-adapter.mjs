import { previewPngBlob } from './export.js';
import { saveReelUploadAsset } from './calendar-assets.js';
export async function designHtmlToReelAsset(preview, { save = saveReelUploadAsset, capture = previewPngBlob, FileType = File } = {}) {
  if (!preview?.cloneNode) throw new Error('Finished design preview is unavailable.');
  const blob = await capture(preview);
  if (!(blob instanceof Blob) || !blob.size) throw new Error('Finished design could not be flattened.');
  const file = new FileType([blob], 'existing-design.png', { type: 'image/png' });
  return save(file, `reel-existing:${crypto.randomUUID()}`);
}
