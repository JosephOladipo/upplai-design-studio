// Native browser rasterization of the exact, already-fitted design DOM.
export async function downloadPng(preview, style, filename) {
  await document.fonts.ready;
  const clone = preview.cloneNode(true);
  clone.style.visibility = 'visible';
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.cssText = document.documentElement.style.cssText;
  Object.assign(wrapper.style, { width: '1080px', height: '1350px', fontFamily: 'var(--font-family)', lineHeight: '1.5', color: 'var(--white)' });
  const styles = document.createElement('style');
  styles.textContent = [...document.styleSheets].map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join('\n')).join('\n');
  wrapper.append(styles, clone);
  const markup = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><foreignObject width="1080" height="1350">${markup}</foreignObject></svg>`;
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG export is unavailable in this browser.');
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
  const clone = preview.cloneNode(true); const wrapper = document.createElement('div'); wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml'); Object.assign(wrapper.style,{width:'1080px',height:'1350px'}); const styles=document.createElement('style'); styles.textContent=[...document.styleSheets].map(sheet=>[...sheet.cssRules].map(rule=>rule.cssText).join('\n')).join('\n'); wrapper.append(styles,clone); const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><foreignObject width="1080" height="1350">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`; const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;canvas.getContext('2d').drawImage(image,0,0);return new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed.')),'image/png'));
}
