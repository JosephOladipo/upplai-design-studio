import { previewPngBlob } from '/src/export.js';
import { videoSampleTargets } from '/src/video-frame-sampling.js';
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
function videoFrames(source) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.muted = true; video.preload = 'auto';
    let finished = false;
    const timer = setTimeout(() => finish(new Error('Video frames could not be read. Try a browser-supported video format.')), 15000);
    function finish(error, data) { if (finished) return; finished = true; clearTimeout(timer); video.onloadeddata = video.onseeked = video.onerror = null; video.removeAttribute('src'); video.load(); error ? reject(error) : resolve(data); }
    const capture = () => { try { return snapshot(video,video.videoWidth,video.videoHeight); } catch { return null; } };
    const seek = target => new Promise(resolveSeek => {
      let settled = false;
      let fallback;
      const done = value => { if (settled) return; settled = true; clearTimeout(fallback); video.onseeked = null; resolveSeek(value); };
      fallback = setTimeout(() => done(null), 3000);
      video.onseeked = () => done(capture());
      try { video.currentTime = target; } catch { done(null); }
    });
    const sample = async () => {
      const images = [];
      for (const target of videoSampleTargets(video.duration)) {
        const frame = await seek(target);
        if (frame && !images.includes(frame)) images.push(frame);
      }
      // Preserve the zero-second bounded fallback only when all representative
      // seeks failed; do not make it a routine intro-frame sample.
      if (!images.length) {
        const fallback = await seek(0);
        if (fallback) images.push(fallback);
      }
      if (!images.length) return finish(new Error('No usable video frame could be obtained. Try a browser-supported video format.'));
      finish(null, { images, kind: 'video-frames', note: `${images.length} chronological sampled video frame${images.length === 1 ? '' : 's'} only; no audio or transcript analysis.` });
    };
    video.onerror = () => finish(new Error('This browser could not decode the video.'));
    video.onloadeddata = () => { video.onloadeddata = null; sample(); };
    video.src = source;
  });
}
export async function attachedMediaInput(state) {
  if (state.carouselFiles?.length) return { kind: 'images', images: await Promise.all(state.carouselFiles.map(blobImage)) };
  if (state.carouselSlides.length) return { kind: 'images', images: await Promise.all(state.carouselSlides.map(async slide => blobImage(await previewPngBlob(slide)))) };
  if ((state.mediaSource === 'generated' || state.mediaSource === 'generated-direct') && state.media) return { kind: 'images', images: [await blobImage(state.media)] };
  if (state.mediaSource === 'generated') return { kind: 'images', images: [await blobImage(await previewPngBlob(state.generatedPreview))] };
  if (state.mediaSource === 'manual' && state.media) {
    if (state.media.type.startsWith('image/')) return { kind: 'images', images: [await blobImage(state.media)] };
    const url = URL.createObjectURL(state.media); try { return await videoFrames(url); } finally { URL.revokeObjectURL(url); }
  }
  if (state.mediaSource === 'existing-url' && state.existingMedia?.url) {
    return state.existingMedia.resourceType === 'video' ? videoFrames(state.existingMedia.url) : { kind: 'images', images: [await imageData(state.existingMedia.url)] };
  }
  return { kind: 'none', images: [] };
}
