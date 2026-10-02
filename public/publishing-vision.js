import { previewPngBlob } from '/src/export.js';
async function imageData(source) {
  const image = new Image(); image.crossOrigin = 'anonymous'; image.src = source;
  await image.decode();
  return snapshot(image, image.naturalWidth, image.naturalHeight);
}
function snapshot(source, width, height) {
  if (!width || !height) throw new Error('Media dimensions are unavailable.');
  const scale = Math.min(1, 1536 / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d'); context.fillStyle = '#FFFFFF'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(source,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg', .85);
}
async function blobImage(blob) {
  const url = URL.createObjectURL(blob);
  try { return await imageData(url); } finally { URL.revokeObjectURL(url); }
}
function videoFrame(source) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.muted = true; video.preload = 'auto';
    const timer = setTimeout(() => finish(new Error('Video frame could not be read. Try a browser-supported video format.')), 15000);
    function finish(error, data) { clearTimeout(timer); video.onloadeddata = video.onseeked = video.onerror = null; video.removeAttribute('src'); video.load(); error ? reject(error) : resolve(data); }
    const capture = () => { try { finish(null, { images: [snapshot(video,video.videoWidth,video.videoHeight)], kind: 'video-frame', note: 'One sampled video frame only; no audio or full-video analysis.' }); } catch (error) { finish(error); } };
    video.onerror = () => finish(new Error('This browser could not decode the video.'));
    video.onloadeddata = () => { video.onloadeddata = null; if (Number.isFinite(video.duration) && video.duration > 1) { video.onseeked = capture; video.currentTime = Math.min(video.duration * .1, 5); } else capture(); };
    video.src = source;
  });
}
export async function attachedMediaInput(state) {
  if (state.carouselSlides.length) return { kind: 'images', images: await Promise.all(state.carouselSlides.map(async slide => blobImage(await previewPngBlob(slide)))) };
  if (state.mediaSource === 'generated') return { kind: 'images', images: [await blobImage(await previewPngBlob(state.generatedPreview))] };
  if (state.mediaSource === 'manual' && state.media) {
    if (state.media.type.startsWith('image/')) return { kind: 'images', images: [await blobImage(state.media)] };
    const url = URL.createObjectURL(state.media); try { return await videoFrame(url); } finally { URL.revokeObjectURL(url); }
  }
  if (state.mediaSource === 'existing-url' && state.existingMedia?.url) {
    return state.existingMedia.resourceType === 'video' ? videoFrame(state.existingMedia.url) : { kind: 'images', images: [await imageData(state.existingMedia.url)] };
  }
  return { kind: 'none', images: [] };
}
