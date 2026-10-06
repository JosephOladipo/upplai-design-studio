// Shared sizing/recomposition rules; AI calls remain in the existing pipeline.
export const formatPresets = Object.freeze([
  { id: 'portrait', label: 'Portrait Post', width: 1080, height: 1350 },
  { id: 'square', label: 'Square', width: 1080, height: 1080 },
  { id: 'story', label: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'landscape', label: 'Landscape', width: 1920, height: 1080 },
  { id: 'linkedin', label: 'LinkedIn Landscape', width: 1200, height: 627 }
]);

export function normalizeFormat(id, width, height) {
  const preset = formatPresets.find(item => item.id === id);
  if (preset) return { ...preset };
  if (id !== 'custom') throw new Error('Choose a valid format.');
  const w = Number(width), h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 320 || h < 320 || w > 4096 || h > 4096 || w * h > 8388608 || Math.max(w / h, h / w) > 3) {
    throw new Error('Use whole-number dimensions from 320 to 4096 px, up to 8 megapixels and a maximum 3:1 aspect ratio.');
  }
  return { id, label: 'Custom', width: w, height: h };
}

export function canvasDimensions(preview) {
  return { width: Number(preview.dataset.canvasWidth) || 1080, height: Number(preview.dataset.canvasHeight) || 1350 };
}

export function fitArtwork(source, target) {
  const scale = Math.min(target.width / source.width, target.height / source.height);
  const width = source.width * scale, height = source.height * scale;
  return { x: (target.width - width) / 2, y: (target.height - height) / 2, width, height, scale };
}

export function formatPath(mode, action) {
  return mode === 'full-ai-artwork' && action !== 'fit' ? 'ai-reformat' : 'native-resize';
}

export function reformatInstruction(copy, plan, target) {
  return `REFORMAT EXISTING APPROVED DESIGN to ${target.width} x ${target.height} (${target.width}:${target.height}). Generate a genuine new composition for this target canvas, never stretch or crop the old artwork. Preserve the same visual concept, brand family, style, hierarchy and composition intent; reposition elements intelligently for the new aspect ratio. Preserve ALL approved wording exactly, including supporting copy and CTA; do not invent replacement messaging or omit copy.\nAPPROVED COPY: ${JSON.stringify({ headline: copy.headline || '', supportingCopy: copy.supportingCopy || '', cta: copy.cta || '' })}\nEXISTING CREATIVE CONTEXT: ${JSON.stringify({ customDirection: copy.customDirection, brandContext: copy.brandContext, plan })}`;
}

// API dimensions use multiples of 16; browser composition exports the exact target.
export function generationDimensions(target) {
  const pixels = target.width * target.height;
  const scale = Math.min(3840 / Math.max(target.width, target.height), Math.sqrt(8294400 / pixels), Math.max(1, Math.sqrt(655360 / pixels)));
  let width = Math.min(3840, Math.ceil(target.width * scale / 16) * 16);
  let height = Math.min(3840, Math.ceil(target.height * scale / 16) * 16);
  if (width > height * 3) height = Math.ceil(width / 3 / 16) * 16;
  if (height > width * 3) width = Math.ceil(height / 3 / 16) * 16;
  while (width * height > 8294400) { if (width >= height) width -= 16; else height -= 16; }
  return `${width}x${height}`;
}

export function recomposeObjects(objects, source, target) {
  const margin = Math.max(16, Math.min(target.width, target.height) * .035);
  const scale = Math.min((target.width - margin * 2) / source.width, (target.height - margin * 2) / source.height);
  const dx = (target.width - source.width * scale) / 2, dy = (target.height - source.height * scale) / 2;
  return objects.map(object => ({ ...object, x: dx + object.x * scale, y: dy + object.y * scale, width: object.width * scale, height: object.height * scale, scale }));
}

// Capture live geometry before cloning so text, images and shapes remain objects.
export function resizeNativePreview(source, target, clone) {
  const size = canvasDimensions(source);
  const rect = source.getBoundingClientRect();
  const sx = rect.width / size.width || 1, sy = rect.height / size.height || 1;
  const selector = '[data-editor-id]:not([data-editor-type="background"]), #preview-headline, #preview-copy, #preview-cta, #preview-logo, .template-kicker, .stat-value, .free-decoration';
  const candidates = [...source.querySelectorAll(selector)].filter(node => !node.hidden && node.getClientRects().length && !node.matches('[data-editor-ui]'));
  const nodes = candidates.filter(node => !candidates.some(parent => parent !== node && parent.contains(node)));
  const geometry = nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { node, x: (box.left - rect.left) / sx, y: (box.top - rect.top) / sy, width: box.width / sx, height: box.height / sy };
  });
  for (const item of recomposeObjects(geometry, size, target)) {
    const node = item.node;
    const copied = node.id ? clone.querySelector('#' + CSS.escape(node.id)) : node.dataset.editorId ? [...clone.querySelectorAll('[data-editor-id]')].find(x => x.dataset.editorId === node.dataset.editorId) : clone.querySelectorAll(selector)[[...source.querySelectorAll(selector)].indexOf(node)];
    if (!copied) continue;
    const computed = getComputedStyle(node);
    clone.append(copied);
    Object.assign(copied.style, {
      position: 'absolute', left: item.x + 'px', top: item.y + 'px', right: 'auto', bottom: 'auto', margin: '0',
      width: item.width + 'px', height: item.height + 'px', minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none',
      boxSizing: 'border-box', translate: 'none', transform: 'none', fontSize: parseFloat(computed.fontSize) * item.scale + 'px',
      color: computed.color, fontFamily: computed.fontFamily, letterSpacing: computed.letterSpacing === 'normal' ? 'normal' : parseFloat(computed.letterSpacing) * item.scale + 'px', lineHeight: computed.lineHeight === 'normal' ? 'normal' : parseFloat(computed.lineHeight) * item.scale + 'px'
    });
    for (const property of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRadius']) {
      copied.style[property] = (parseFloat(computed[property]) || 0) * item.scale + 'px';
    }
    copied.querySelectorAll('img').forEach(image => Object.assign(image.style, { width: '100%', height: '100%', objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' }));
    if (copied.tagName === 'IMG') copied.style.objectFit = 'contain';
  }
  clone.querySelectorAll('.design-content').forEach(container => { if (!container.children.length) container.hidden = true; });
  clone.style.backgroundSize = 'contain';
  clone.style.backgroundPosition = 'center';
  clone.style.backgroundRepeat = 'no-repeat';
  setCanvasDimensions(clone, target);
  return clone;
}

export function setCanvasDimensions(preview, target) {
  preview.dataset.canvasWidth = String(target.width);
  preview.dataset.canvasHeight = String(target.height);
  Object.assign(preview.style, { width: target.width + 'px', height: target.height + 'px', minWidth: target.width + 'px', minHeight: target.height + 'px', maxWidth: 'none', maxHeight: 'none', boxSizing: 'border-box' });
  // The existing desktop editor has fixed-size !important rules.
  preview.style.setProperty('width', target.width + 'px', 'important');
  preview.style.setProperty('height', target.height + 'px', 'important');
}
