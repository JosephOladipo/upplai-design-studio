import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('carousel publishing handoff persists serialized assets in order and always closes processing', async () => {
  const carousel = await file('public/carousel.js');
  const assets = await file('src/calendar-assets.js');
  assert.match(carousel, /Preparing carousel for Publishing/);
  assert.match(carousel, /await saveCalendarAsset\(resultRef, result\)/);
  assert.match(carousel, /finally \{\s*hideProcessing\(\)/);
  assert.match(carousel, /normalizeCarousel\(draft\)/);
  assert.match(assets, /html: slide\.preview\?\.outerHTML \|\| ''/);
  assert.doesNotMatch(assets, /store\.put\(result\.slides/);
});

test('workspace and lightweight publishing recovery exclude browser file binaries', async () => {
  const navigation = await file('public/navigation.js');
  const publishing = await file('public/publishing.js');
  const carousel = await file('public/carousel.js');
  assert.match(navigation, /upplai-design-studio-active-workspace/);
  assert.match(navigation, /showSection\(restoredWorkspace, \{ history: false \}\)/);
  assert.match(publishing, /upplai-design-studio-publishing-draft/);
  assert.match(publishing, /generatedRef/);
  assert.doesNotMatch(publishing.match(/function savePublishingDraft\(\)[\s\S]*?\n\}/)?.[0] || '', /state\.media/);
  assert.match(carousel, /upplai-design-studio-carousel-recovery/);
});