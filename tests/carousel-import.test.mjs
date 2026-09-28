import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = file => readFile(new URL(file, import.meta.url), 'utf8');

test('carousel import offers a multi-file PNG, JPEG and WebP path with explicit confirmation', async () => {
  const [html, carousel] = await Promise.all([source('../public/index.html'), source('../public/carousel.js')]);
  assert.match(html, /id="carousel-import-open"/);
  assert.match(html, /id="carousel-import-input"[^>]*multiple/);
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /id="carousel-import-confirm"/);
  assert.match(carousel, /supportedImportTypes = new Set\(\['image\/png', 'image\/jpeg', 'image\/webp'\]\)/);
  assert.match(carousel, /file\.size <= 10 \* 1024 \* 1024/);
  assert.match(carousel, /importQueue\.splice/);
});

test('imported carousel slides use persistent IndexedDB references and a standard unstretched canvas', async () => {
  const [carousel, assets, styles] = await Promise.all([source('../public/carousel.js'), source('../src/calendar-assets.js'), source('../public/styles.css')]);
  assert.match(carousel, /saveCarouselImportAsset/);
  assert.match(carousel, /loadCarouselImportAsset/);
  assert.match(carousel, /sourceType: 'imported-image'/);
  assert.match(carousel, /importAssetId/);
  assert.match(assets, /type: 'carousel-import'/);
  assert.match(styles, /\.carousel-imported-base\{width:100%;height:100%;object-fit:contain/);
});

test('imported slides enter the existing full editor and retain final HTML through normal carousel workflows', async () => {
  const carousel = await source('../public/carousel.js');
  assert.match(carousel, /data-editor-type="image"/);
  assert.match(carousel, /carousel:builder-slide-edit/);
  assert.match(carousel, /generateCarouselDesign\(draft\)/);
  assert.match(carousel, /saveCalendarAsset\(resultRef, result\)/);
  assert.match(carousel, /carousel-add-upload/);
  assert.doesNotMatch(carousel, /api\/ai\/generate.*import/i);
});
