import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkBackground, artworkInstructions } from '../src/artwork-policy.mjs';
import { clearEdgeConnectedNeutralBackdrop } from '../src/ai-style.js';

test('Full AI Artwork defaults to a transparent-to-white canvas with safe areas', () => {
  assert.equal(artworkBackground('Use brand accents in the illustration.'), 'white');
  assert.match(artworkInstructions(''), /pure white \(#FFFFFF\)/);
  assert.match(artworkInstructions(''), /TEXT SAFE AREA/);
});

test('an explicit Full AI Artwork backdrop is preserved', () => {
  assert.equal(artworkBackground('Use a deep navy background with pink accents.'), 'custom');
  assert.match(artworkInstructions('Use a deep navy background with pink accents.'), /USER BACKGROUND/);
});

test('opaque neutral backdrop connected to an edge becomes transparent without clearing isolated gray artwork', () => {
  const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  const set = (x, y, red, green, blue) => { const at = (y * 5 + x) * 4; pixels.set([red, green, blue, 255], at); };
  for (let y = 0; y < 5; y += 1) for (let x = 0; x < 5; x += 1) set(x, y, 205, 205, 205);
  set(2, 2, 90, 150, 210); // intentional non-neutral content blocks the flood-fill
  set(2, 3, 110, 110, 110); // isolated gray detail below the object
  const report = clearEdgeConnectedNeutralBackdrop(pixels, 5, 5);
  assert.ok(report.clearedPixels > 0);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(3 * 5 + 2) * 4 + 3], 255);
});
