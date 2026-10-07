import { totalDuration } from './reel-project.mjs';
import { ReelClock, fingerprint, publishingContext } from './reel-timeline.js';
import { ReelMedia } from './reel-media.js';
import { createCanvasPainter } from './reel-canvas.js';

export const renderSize = Object.freeze({ width: 1080, height: 1920, frameRate: 30 });
// Require H.264/AAC MP4. Never label a WebM recording as MP4.
export function mp4RecordingType(Recorder = globalThis.MediaRecorder) {
  if (!Recorder?.isTypeSupported) return '';
  return ['video/mp4;codecs=avc1.420028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2'].find(type => Recorder.isTypeSupported(type)) || '';
}
export async function assertMp4(blob) {
  if (!blob.size || blob.type !== 'video/mp4') throw new Error('The recorder did not produce an MP4 video.');
  const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  if (String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') throw new Error('The recording is not a valid MP4 container.');
}
async function verifyVideo(blob, expectedDuration) {
  await assertMp4(blob);
  const video = document.createElement('video'), url = URL.createObjectURL(blob);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('MP4 playback validation timed out.')), 15000);
      const finish = error => { clearTimeout(timeout); video.onloadedmetadata = video.onerror = null; error ? reject(error) : resolve(); };
      video.onloadedmetadata = () => finish(); video.onerror = () => finish(new Error('This browser could not play the rendered MP4.'));
      video.preload = 'metadata'; video.src = url;
    });
    if (video.videoWidth !== 1080 || video.videoHeight !== 1920 || !Number.isFinite(video.duration) || Math.abs(video.duration - expectedDuration) > .35) {
      throw new Error('MP4 dimensions or duration did not match the Reel. Keep this tab visible and try again.');
    }
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
export async function renderReel(project, { onState = () => {}, signal } = {}) {
  const mimeType = mp4RecordingType();
  if (!mimeType) throw new Error('MP4 recording is unavailable in this browser. Open the app in a current Chrome or Edge browser with H.264/AAC recording support. Reel editing is still available.');
  if (!project.scenes.length) throw new Error('Add a scene before rendering.');
  if (document.hidden) throw new Error('Keep the Reel tab visible during rendering.');
  const snapshot = structuredClone(project), signature = fingerprint(snapshot), total = totalDuration(snapshot);
  let media, stream, recorder, frame, rejectRecording;
  const interrupted = () => { if (signal?.aborted) throw new Error('Render cancelled because the project changed.'); };
  try {
    onState('Preparing'); interrupted();
    media = await new ReelMedia(snapshot).load(); interrupted();
    const canvas = document.createElement('canvas'); canvas.width = renderSize.width; canvas.height = renderSize.height;
    if (!canvas.captureStream) throw new Error('Canvas recording is unavailable in this browser. Use current Chrome or Edge.');
    const paint = createCanvasPainter(canvas), clock = new ReelClock(snapshot);
    paint(snapshot, clock.read(), media.media);
    onState('Adding audio'); await media.connectAudio(true); interrupted();
    stream = canvas.captureStream(renderSize.frameRate);
    for (const track of media.destination?.stream.getAudioTracks() || []) stream.addTrack(track);
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 });
    const finished = new Promise((resolve, reject) => {
      rejectRecording = reject;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = event => reject(event.error || new Error('MP4 encoder failed. Try a shorter Reel or close other busy tabs.'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));
    });
    // Audio and frames share the same wall clock; transitions occupy scene time.
    recorder.start(1000); clock.play(); media.sync(clock.read(), true);
    let lastFrame = performance.now(), lastSecond = -1;
    const abort = () => rejectRecording(new Error('Render cancelled because the project changed.'));
    signal?.addEventListener('abort', abort, { once: true });
    const visible = () => { if (document.hidden) rejectRecording(new Error('Rendering stopped when the tab became hidden. Keep the Reel tab visible and render again.')); };
    document.addEventListener('visibilitychange', visible);
    try {
      const tick = () => {
        try {
          interrupted();
          const now = performance.now();
          if (now - lastFrame > 750) throw new Error('Rendering could not keep up. Close other busy tabs and try again.');
          lastFrame = now;
          const position = clock.read(); media.sync(position, !position.ended);
          if (media.failures.length) throw new Error('A media track could not play during rendering. Try previewing the media first.');
          paint(snapshot, position, media.media);
          const second = Math.floor(position.time);
          if (second !== lastSecond) { lastSecond = second; onState('Rendering scenes', position); }
          if (position.ended) { media.pause(); recorder.stop(); } else frame = requestAnimationFrame(tick);
        } catch (error) { rejectRecording(error); }
      };
      frame = requestAnimationFrame(tick);
      const blob = await finished;
      onState('Finalizing'); interrupted();
      const metadata = await verifyVideo(blob, total); interrupted();
      return { blob, ...metadata, mimeType: 'video/mp4', fingerprint: signature, context: publishingContext(snapshot) };
    } finally { document.removeEventListener('visibilitychange', visible); signal?.removeEventListener('abort', abort); }
  } finally {
    cancelAnimationFrame(frame);
    if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(track => track.stop()); media?.dispose();
  }
}
