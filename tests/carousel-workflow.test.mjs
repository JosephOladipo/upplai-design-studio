import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async path => readFile(new URL(path, import.meta.url), 'utf8');

test('carousel builder fits a 1080 by 1350 canvas within its actual workspace and clamps view-only zoom', async () => {
  const carousel = await source('../public/carousel.js');
  const styles = await source('../public/styles.css');
  assert.match(carousel, /Math\.min\(width \/ 1080, height \/ 1350\)/);
  assert.match(carousel, /Math\.min\(1\.25, Math\.max\(\.25, value\)\)/);
  assert.match(carousel, /new ResizeObserver/);
  assert.match(styles, /\.carousel-preview \.carousel-slide\{position:absolute;left:50%;top:0;flex:none;transform:translateX\(-50%\) scale/);
});

test('carousel downloads use deterministic ordered final-slide filenames and rasterize at full canvas scale', async () => {
  const carousel = await source('../public/carousel.js');
  const exporter = await source('../src/export.js');
  assert.match(carousel, /\$\{carouselFileBase\(\)\}-slide-\$\{String\(index \+ 1\)\.padStart\(2, '0'\)\}\.png/);
  assert.match(carousel, /for \(let index = 0; index < draft\.slides\.length; index \+= 1\)/);
  assert.match(exporter, /clone\.style\.transform = 'none'/);
});

test('publishing recognizes a carousel as ordered media and sends no media until an explicit action', async () => {
  const publishing = await source('../public/publishing.js');
  assert.match(publishing, /state\.carouselSlides = \(asset\.slides \|\| \[\]\)/);
  assert.match(publishing, /renderPublishingCarousel\(\)/);
  assert.match(publishing, /for \(let index = 0; index < state\.carouselSlides\.length; index \+= 1\)/);
  assert.match(publishing, /type: 'carousel', items/);
  assert.match(publishing, /if \(state\.uploaded\) return state\.uploaded/);
});

test('the single shared processing component is used by carousel, design, calendar, caption, alt text, upload, and publish flows', async () => {
  const [processing, carousel, app, calendar, publishing] = await Promise.all([
    source('../src/processing.js'), source('../public/carousel.js'), source('../public/app.js'), source('../public/calendar-table.js'), source('../public/publishing.js')
  ]);
  assert.match(processing, /role="status" aria-live="polite"/);
  assert.match(processing, /export function showProcessing/);
  assert.match(processing, /export function hideProcessing/);
  for (const value of [carousel, app, calendar, publishing]) {
    assert.match(value, /showProcessing/);
    assert.match(value, /hideProcessing/);
  }
  assert.match(publishing, /Generating slide descriptions/);
  assert.match(publishing, /Uploading your media/);
  assert.match(publishing, /Publishing your post/);
});
