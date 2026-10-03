import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('default-white Full AI bypasses browser readability overlays but retains the cleaned PNG', async () => {
  const source = await file('src/ai-style.js');
  const branch = source.slice(source.indexOf('if (design.fullArtwork === true'), source.indexOf('const area =', source.indexOf('if (design.fullArtwork === true')));
  assert.match(branch, /design\.backgroundPolicy === 'white'/);
  assert.match(branch, /preview\.style\.background = `url/);
  assert.doesNotMatch(branch, /localizedGradient|analyzeReadability|linear-gradient/);
  assert.match(source, /localizedGradient\(/);
});

test('prepared Full AI metadata survives image preparation for current and restored versions', async () => {
  const source = await file('src/ai-style.js');
  assert.match(source, /fullArtwork: result\.fullArtwork === true/);
  assert.match(source, /backgroundPolicy: result\.backgroundPolicy \|\| 'auto'/);
});
