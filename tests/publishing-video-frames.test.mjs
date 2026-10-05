import test from 'node:test';
import assert from 'node:assert/strict';
import { videoSampleTargets } from '../src/video-frame-sampling.js';

test('video sampling uses chronological early, middle, and late frames', () => {
  assert.deepEqual(videoSampleTargets(100), [12, 50, 85]);
});

test('short videos reduce samples and avoid duplicate timestamps', () => {
  assert.deepEqual(videoSampleTargets(4), [.8, 2.8]);
  assert.deepEqual(videoSampleTargets(1), [.5]);
  assert.deepEqual(videoSampleTargets(0), []);
});
