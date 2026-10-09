import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const client = fs.readFileSync(new URL('../public/calendar.js', import.meta.url), 'utf8');
const markup = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
test('Calendar manual entry maps each format to only its relevant fields', () => {
  assert.match(client, /'single-image': \['manual-creative-direction'\]/); assert.match(client, /carousel: \['manual-raw-copy','manual-slide-count','manual-creative-direction'\]/); assert.match(client, /'multi-page': \['manual-raw-copy','manual-page-count','manual-creative-direction'\]/); assert.match(client, /ai_designer: \['manual-raw-copy','manual-creative-direction','manual-text-mode','manual-reference-usage'\]/); assert.match(client, /reel: \['manual-raw-copy','manual-reel-duration','manual-audio-mode','manual-creative-direction'\]/);
});
test('format switching hides fields without clearing their existing values and supports legacy rows', () => {
  assert.match(client, /label\.hidden = !show\.has\(id\)/); assert.doesNotMatch(client, /\.value\s*=\s*''[\s\S]*updateManualFormatFields/); assert.match(client, /row\?\.contentFormat \?\? 'single-image'/); assert.match(markup, /manual-content-format/);
});
