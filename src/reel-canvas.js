import { nativeText, preset, motions, textAnimations, transitions } from './reel-timeline.js';

const ease = p => p * p * (3 - 2 * p);
// Motion never enlarges a fitted image beyond its containment rectangle.
export function fitMotion(width, height, progress, motion = 'static', w = 1080, h = 1920) {
  const p = ease(Math.max(0, Math.min(1, progress))), fit = Math.min(w / width, h / height);
  motion = preset(motion, motions, 'static');
  let scale = 1, x = 0, y = 0;
  if (motion === 'zoom-in') scale = .9 + .1 * p;
  if (motion === 'zoom-out') scale = 1 - .1 * p;
  if (motion.startsWith('pan-')) scale = .9;
  const fw = width * fit * scale, fh = height * fit * scale;
  if (motion === 'pan-left') x = (w - fw) / 2 * (1 - 2 * p);
  if (motion === 'pan-right') x = (w - fw) / 2 * (2 * p - 1);
  if (motion === 'pan-up') y = (h - fh) / 2 * (1 - 2 * p);
  if (motion === 'pan-down') y = (h - fh) / 2 * (2 * p - 1);
  return { x: (w - fw) / 2 + x, y: (h - fh) / 2 + y, width: fw, height: fh };
}
export function textEffect(animation, seconds) {
  const p = ease(Math.min(1, Math.max(0, seconds / .65)));
  animation = preset(animation, textAnimations, 'fade');
  return { alpha: animation === 'fade' ? p : 1, x: animation === 'slide-left' ? 160 * (1 - p) : 0,
    y: animation === 'slide-up' ? 140 * (1 - p) : 0, scale: animation === 'pop' ? .65 + .35 * p : 1,
    characters: animation === 'typewriter' ? Math.floor(Math.max(0, seconds) * 45) : Infinity };
}
function lines(ctx, text, width) {
  const result = [];
  for (const paragraph of String(text || '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      // Break long unspaced words rather than losing text off the canvas.
      if (ctx.measureText(word).width > width) {
        if (line) { result.push(line); line = ''; }
        for (const character of word) { if (ctx.measureText(line + character).width > width) { result.push(line); line = ''; } line += character; }
      } else if (line && ctx.measureText(line + ' ' + word).width > width) { result.push(line); line = word; }
      else line += (line ? ' ' : '') + word;
    }
    result.push(line);
  }
  return result;
}
function drawText(ctx, scene, seconds, w, h) {
  if (!nativeText(scene)) return;
  const effect = textEffect(scene.textAnimation, seconds), headline = String(scene.headline || ''), body = String(scene.bodyText || '');
  const maxWidth = w - 160;
  let size = 88, headlineLines, bodyLines;
  do {
    ctx.font = `700 ${size}px Arial, sans-serif`; headlineLines = lines(ctx, headline, maxWidth);
    ctx.font = `${size * .57}px Arial, sans-serif`; bodyLines = lines(ctx, body, maxWidth);
    if ((headlineLines.length + bodyLines.length * .7) * size * 1.2 < h * .75) break;
    size -= 4;
  } while (size > 24);
  ctx.save(); ctx.translate(w / 2 + effect.x, h / 2 + effect.y); ctx.scale(effect.scale, effect.scale); ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha = effect.alpha; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
  ctx.shadowColor = '#000a'; ctx.shadowBlur = 16;
  let y = Math.max(150, (h - (headlineLines.length * 1.2 + bodyLines.length * .7) * size) / 2), remaining = effect.characters;
  for (const [content, font, spacing] of [[headlineLines, `700 ${size}px Arial, sans-serif`, size * 1.2], [bodyLines, `${size * .57}px Arial, sans-serif`, size * .7]]) {
    ctx.font = font;
    for (const line of content) { ctx.fillText(line.slice(0, remaining), 80, y); remaining = Math.max(0, remaining - line.length); y += spacing; }
    y += size * .4;
  }
  ctx.restore();
}
export function createCanvasPainter(canvas) {
  const context = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  const layers = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  function sceneLayer(layer, scene, media, seconds, duration) {
    const ctx = layer.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.fillStyle = scene.background || '#101d30'; ctx.fillRect(0, 0, w, h);
    if (media) {
      const width = media.videoWidth || media.naturalWidth, height = media.videoHeight || media.naturalHeight;
      if (width && height) { const box = fitMotion(width, height, seconds / duration, scene.motion, w, h); ctx.drawImage(media, box.x, box.y, box.width, box.height); }
    }
    drawText(ctx, scene, seconds, w, h);
  }
  return (project, position, media) => {
    context.fillStyle = '#101d30'; context.fillRect(0, 0, w, h);
    if (position.index < 0) return;
    const current = project.scenes[position.index];
    sceneLayer(layers[1], current, media.get(current.id), position.local, position.duration);
    const type = preset(current.transition, transitions, 'fade'), p = position.transitionProgress;
    if (p >= 1 || !position.index || type === 'cut') { context.drawImage(layers[1], 0, 0); return; }
    const previous = project.scenes[position.index - 1];
    sceneLayer(layers[0], previous, media.get(previous.id), previous.duration, previous.duration);
    context.save(); context.drawImage(layers[0], 0, 0);
    const slide = type.startsWith('slide-');
    if (slide) {
      const dx = type === 'slide-left' ? -w : type === 'slide-right' ? w : 0, dy = type === 'slide-up' ? -h : 0;
      context.fillStyle = '#101d30'; context.fillRect(0, 0, w, h);
      context.drawImage(layers[0], dx * p, dy * p);
      context.drawImage(layers[1], dx * (p - 1), dy * (p - 1));
    } else if (type === 'wipe') {
      context.beginPath(); context.rect(0, 0, w * p, h); context.clip(); context.drawImage(layers[1], 0, 0);
    } else if (type === 'dip-black' || type === 'fade') {
      context.fillStyle = '#000'; context.fillRect(0, 0, w, h);
      context.globalAlpha = p < .5 ? 1 - p * 2 : (p - .5) * 2;
      context.drawImage(layers[p < .5 ? 0 : 1], 0, 0);
    } else {
      context.globalAlpha = p;
      if (type === 'zoom') { context.translate(w / 2, h / 2); context.scale(.85 + .15 * p, .85 + .15 * p); context.translate(-w / 2, -h / 2); }
      context.drawImage(layers[1], 0, 0);
    }
    context.restore();
  };
}
