const encoder = new TextEncoder();
const bytes = value => encoder.encode(value);
const join = parts => {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size); let offset = 0;
  parts.forEach(part => { result.set(part, offset); offset += part.length; });
  return result;
};

export function documentTitle(value, fallback = 'Upplai Carousel') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback;
}

// Produces a compact image-only PDF. Each JPEG is drawn at its original aspect
// ratio on a matching page, so slide order and layout are never recreated.
export function pdfFromJpegPages(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('Carousel slides are unavailable for the LinkedIn document.');
  const objects = []; const pageIds = [];
  pages.forEach((page, index) => {
    if (!(page?.jpeg instanceof Uint8Array) || !page.jpeg.length || !(page.width > 0) || !(page.height > 0)) throw new Error('A carousel slide could not be prepared for the LinkedIn document.');
    const pageId = 3 + index * 3; const contentId = pageId + 1; const imageId = pageId + 2;
    pageIds.push(pageId);
    objects[pageId] = [bytes(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`)];
    const draw = bytes(`q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im${index} Do\nQ\n`);
    objects[contentId] = [bytes(`${contentId} 0 obj\n<< /Length ${draw.length} >>\nstream\n`), draw, bytes('endstream\nendobj\n')];
    objects[imageId] = [bytes(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`), page.jpeg, bytes('\nendstream\nendobj\n')];
  });
  objects[1] = [bytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')];
  objects[2] = [bytes(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj\n`)];
  const chunks = [bytes('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')]; const offsets = [0]; let offset = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) { offsets[id] = offset; const value = join(objects[id]); chunks.push(value); offset += value.length; }
  const xref = offset; chunks.push(bytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return join(chunks);
}

async function jpegPage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('A carousel slide could not be encoded.')), 'image/jpeg', 0.96));
    return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close?.(); }
}

export async function carouselPdfFile(files, title) {
  const pages = await Promise.all([...files].map(jpegPage));
  return new File([pdfFromJpegPages(pages)], 'upplai-carousel.pdf', { type: 'application/pdf' });
}
