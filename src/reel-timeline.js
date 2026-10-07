import { clampDuration, totalDuration } from './reel-project.mjs';

export const motions = ['static', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down'];
export const textAnimations = ['none', 'fade', 'slide-up', 'slide-left', 'pop', 'typewriter'];
export const transitions = ['cut', 'fade', 'crossfade', 'slide-left', 'slide-right', 'slide-up', 'zoom', 'wipe', 'dip-black'];
export const preset = (value, values, fallback) => values.includes(value) ? value : fallback;
export const unit = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 1;
export const nativeText = scene => scene.visualType !== 'existing-design';
export function normalizeAudio(audio = {}) {
  return { mode: ['none', 'music', 'original'].includes(audio.mode) ? audio.mode : 'none',
    assetRef: typeof audio.assetRef === 'string' && audio.assetRef.startsWith('reel-upload:') ? audio.assetRef : '',
    filename: String(audio.filename || '').slice(0, 200), volume: unit(audio.volume ?? 1),
    offset: Math.max(0, Math.min(3600, Number(audio.offset) || 0)), originalMuted: audio.originalMuted !== false };
}
export function timelineAt(project, seconds) {
  const total = totalDuration(project), time = Math.max(0, Math.min(total, Number(seconds) || 0));
  let start = 0;
  for (let index = 0; index < project.scenes.length; index++) {
    const duration = clampDuration(project.scenes[index].duration);
    if (time < start + duration || index === project.scenes.length - 1) {
      const local = time - start;
      const transitionDuration = index > 0 && project.scenes[index].transition !== 'cut'
        ? Math.min(.45, duration / 2, clampDuration(project.scenes[index - 1].duration) / 2) : 0;
      return { index, time, total, start, local, duration, progress: local / duration,
        transitionDuration, transitionProgress: transitionDuration ? Math.min(1, local / transitionDuration) : 1,
        ended: time >= total };
    }
    start += duration;
  }
  return { index: -1, time: 0, total: 0, ended: true };
}
export class ReelClock {
  constructor(project, now = () => performance.now()) { this.project = project; this.now = now; this.time = 0; this.playing = false; }
  read() {
    if (this.playing) { this.time = Math.min(totalDuration(this.project), this.base + (this.now() - this.started) / 1000); if (this.time >= totalDuration(this.project)) this.playing = false; }
    return timelineAt(this.project, this.time);
  }
  play() { if (!totalDuration(this.project)) return; if (this.time >= totalDuration(this.project)) this.time = 0; if (!this.playing) { this.base = this.time; this.started = this.now(); this.playing = true; } }
  pause() { this.read(); this.playing = false; }
  restart() { this.time = 0; this.base = 0; this.started = this.now(); }
  seek(time) { this.time = timelineAt(this.project, time).time; this.base = this.time; this.started = this.now(); }
}
export const timeLabel = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function fingerprint(project) {
  return JSON.stringify({ title: project.title, sourceText: project.sourceText, width: 1080, height: 1920,
    scenes: project.scenes.map(s => ({ id: s.id, duration: clampDuration(s.duration), background: s.background,
      imageRef: s.imageRef, visualAssetRef: s.visualAssetRef, visualType: s.visualType, visualMediaType: s.visualMediaType,
      headline: s.headline, bodyText: s.bodyText, motion: s.motion, textAnimation: s.textAnimation, transition: s.transition })), audio: normalizeAudio(project.audio) });
}
export const validRender = project => Boolean(project.render?.assetRef && project.render.mimeType === 'video/mp4' && project.render.fingerprint === fingerprint(project));
export const publishingContext = project => ({ title: project.title, topic: project.sourceText, totalDuration: totalDuration(project),
  scenes: project.scenes.map((s, order) => ({ id: s.id, order, headline: s.headline, bodyText: s.bodyText, duration: clampDuration(s.duration) })) });
