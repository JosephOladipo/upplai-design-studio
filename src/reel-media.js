import { loadCalendarAsset } from './calendar-assets.js';
import { normalizeAudio } from './reel-timeline.js';

function ready(element, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Media loading timed out. Re-upload this Reel asset.')), 15000);
    function finish(error) { clearTimeout(timeout); element.removeEventListener(event, loaded); element.removeEventListener('error', failed); error ? reject(error) : resolve(element); }
    function loaded() { finish(); } function failed() { finish(new Error('This browser cannot decode the uploaded media. Use a supported MP4, image, MP3 or WAV.')); }
    element.addEventListener(event, loaded, { once: true }); element.addEventListener('error', failed, { once: true });
  });
}
export function desiredAudioTime(position, audio, length) {
  const time = position.time + audio.offset;
  return { time: Math.min(Number.isFinite(length) ? length : time, time), active: !position.ended && (!Number.isFinite(length) || time < length) };
}
export class ReelMedia {
  constructor(project) { this.project = project; this.media = new Map(); this.urls = []; this.disposed = false; this.audio = normalizeAudio(project.audio); this.failures = []; }
  async load() {
    try {
      for (const scene of this.project.scenes) {
        if (this.disposed) throw new Error('Media loading cancelled.');
        let source, video = false;
        if (scene.visualAssetRef) {
          const asset = await loadCalendarAsset(scene.visualAssetRef);
          if (!asset?.file) throw new Error('A Reel visual is missing from this browser. Re-upload it before playing or rendering.');
          source = URL.createObjectURL(asset.file); this.urls.push(source); video = asset.file.type.startsWith('video/');
        } else if (scene.imageRef) {
          // Legacy URL scenes are decoded with CORS; binary URLs never enter project metadata.
          if (!/^(https?:\/\/|\/)/.test(scene.imageRef)) throw new Error('Re-upload this legacy image to store it safely.');
          source = scene.imageRef;
        }
        if (!source) continue;
        const element = document.createElement(video ? 'video' : 'img');
        this.media.set(scene.id, element);
        if (video) { element.preload = 'auto'; element.playsInline = true; element.muted = true; }
        else element.crossOrigin = 'anonymous';
        const loaded = ready(element, video ? 'loadeddata' : 'load'); element.src = source;
        if (video) element.load();
        await loaded;
      }
      if (this.audio.mode === 'music') {
        if (!this.audio.assetRef) throw new Error('Upload a soundtrack or select No Audio.');
        const asset = await loadCalendarAsset(this.audio.assetRef);
        if (!asset?.file) throw new Error('The soundtrack is missing. Re-upload the audio file.');
        this.music = document.createElement('audio'); this.music.preload = 'auto'; this.music.loop = false;
        const url = URL.createObjectURL(asset.file); this.urls.push(url);
        const loaded = ready(this.music, 'loadeddata'); this.music.src = url; this.music.load(); await loaded;
      }
      if (this.disposed) throw new Error('Media loading cancelled.');
      return this;
    } catch (error) { this.dispose(); throw error; }
  }
  async connectAudio(recording = false) {
    if (this.context) { await this.context.resume(); return; }
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) { if (this.music || (this.audio.mode === 'original' && !this.audio.originalMuted)) throw new Error('Audio mixing is unavailable in this browser.'); return; }
    this.context = new Audio(); this.destination = this.context.createMediaStreamDestination();
    this.gains = new Map();
    for (const element of [...this.media.values()].filter(e => e.tagName === 'VIDEO').concat(this.music || [])) {
      const source = this.context.createMediaElementSource(element), gain = this.context.createGain();
      gain.gain.value = 0; source.connect(gain); gain.connect(this.destination); if (!recording) gain.connect(this.context.destination);
      this.gains.set(element, gain); element.muted = false;
    }
    await this.context.resume();
  }
  sync(position, playing) {
    const active = this.project.scenes[position.index];
    for (const [id, element] of this.media) {
      if (element.tagName !== 'VIDEO') continue;
      const current = id === active?.id, length = element.duration;
      // Hold the last video frame when scene duration exceeds the video; do not loop.
      const time = current ? Math.min(position.local, Math.max(0, length - .04)) : 0;
      const shouldPlay = current && playing && !position.ended && position.local < length;
      this.syncElement(element, time, shouldPlay, current);
      const gain = this.gains?.get(element); if (gain) gain.gain.value = current && this.audio.mode === 'original' && !this.audio.originalMuted && playing && position.local < length ? this.audio.volume : 0;
    }
    if (this.music) {
      const target = desiredAudioTime(position, this.audio, this.music.duration);
      this.syncElement(this.music, target.time, playing && target.active, true);
      const gain = this.gains?.get(this.music); if (gain) gain.gain.value = playing && target.active ? this.audio.volume : 0;
    }
  }
  syncElement(element, time, playing, seek) {
    if (seek && Number.isFinite(time) && Math.abs(element.currentTime - time) > .2 && !element.seeking) element.currentTime = time;
    if (playing && element.paused && !element.ended && !element.seeking) element.play().catch(error => { this.failures.push(error); });
    else if (!playing && !element.paused) element.pause();
  }
  pause() { for (const element of [...this.media.values(), this.music].filter(Boolean)) if (element.pause) element.pause(); for (const gain of this.gains?.values() || []) gain.gain.value = 0; }
  dispose() {
    this.disposed = true; this.pause();
    for (const element of [...this.media.values(), this.music].filter(Boolean)) { element.removeAttribute('src'); if (element.load) element.load(); }
    this.urls.forEach(url => URL.revokeObjectURL(url)); this.urls = []; this.context?.close().catch(() => {});
  }
}
