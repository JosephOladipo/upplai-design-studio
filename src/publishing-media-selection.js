export const supportedManualMedia = new Set(['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']);

export function classifyManualMedia(files, supported = supportedManualMedia) {
  const selection = [...(files || [])];
  if (!selection.length) return { kind: 'empty', files: selection };
  if (selection.length > 10 || selection.some(file => !supported.has(file?.type))) return { error: 'Choose up to 10 PNG, JPG, WebP, MP4, MOV, or WebM files.' };
  if (selection.length > 1 && selection.some(file => !file.type.startsWith('image/'))) return { error: 'A carousel can contain only PNG, JPG, or WebP images. Upload video by itself.' };
  return { kind: selection.length > 1 ? 'carousel' : 'single', files: selection };
}
