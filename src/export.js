// Native browser rasterization of the exact, already-fitted design DOM.
import { canvasDimensions } from './design-format.js';
export async function downloadPng(preview, style, filename) {
  await document.fonts.ready;
  const { width, height } = canvasDimensions(preview);
  const clone = preview.cloneNode(true);
  clone.querySelectorAll('[data-editor-ui="true"]').forEach(node => node.remove());
  clone.querySelectorAll('.direct-edit-target, .direct-edit-selected').forEach(node => node.classList.remove('direct-edit-target', 'direct-edit-selected'));
  clone.style.setProperty('transform', 'none', 'important');
  clone.style.setProperty('position', 'relative', 'important');
  clone.style.setProperty('left', '0', 'important');
  clone.style.setProperty('top', '0', 'important');
  if (clone.classList?.contains('carousel-slide')) {
    clone.style.transform = 'none';
    clone.style.position = 'relative';
    clone.style.left = 'auto';
    clone.style.top = 'auto';
  }
  clone.style.visibility = 'visible';
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.cssText = document.documentElement.style.cssText;
  Object.assign(wrapper.style, { width: width + 'px', height: height + 'px', fontFamily: 'var(--font-family)', lineHeight: '1.5', color: 'var(--white)' });
  const styles = document.createElement('style');
  styles.textContent = [...document.styleSheets].map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join('\n')).join('\n');
  wrapper.append(styles, clone);
  const markup = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="${width}" height="${height}">${markup}</foreignObject></svg>`;
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG export is unavailable in this browser.');
  const background = getComputedStyle(preview).backgroundColor;
  context.fillStyle = background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent' ? background : '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `upplai-${style}-${Date.now()}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function previewPngBlob(preview) {
  await document.fonts.ready;
  const { width, height } = canvasDimensions(preview);
  const clone = preview.cloneNode(true);
  clone.querySelectorAll('[data-editor-ui="true"]').forEach(node => node.remove());
  clone.querySelectorAll('.direct-edit-target, .direct-edit-selected').forEach(node => node.classList.remove('direct-edit-target', 'direct-edit-selected'));
  for (const [key, value] of Object.entries({ transform: 'none', position: 'relative', left: '0', top: '0' })) clone.style.setProperty(key, value, 'important');
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.cssText = document.documentElement.style.cssText;
  Object.assign(wrapper.style, { width: width + 'px', height: height + 'px' });
  const styles = document.createElement('style');
  styles.textContent = [...document.styleSheets].map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join('\n')).join('\n');
  wrapper.append(styles, clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="${width}" height="${height}">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`;
  const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('PNG export is unavailable in this browser.');
  const background = getComputedStyle(preview).backgroundColor;
  context.fillStyle = background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent' ? background : '#ffffff';
  context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png'));
}
