import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReelProject, createScene, normalizeReelStartDuration, normalizeReelStartMotion, reelStartDurationOptions } from '../src/reel-project.mjs';

const html = fs.readFileSync('public/index.html', 'utf8');
const reels = fs.readFileSync('public/reels.js', 'utf8');
const publishing = fs.readFileSync('public/publishing.js', 'utf8');
const styles = fs.readFileSync('public/styles.css', 'utf8');

test('Reel Start From exposes each supported source without another project model', () => {
  for (const id of ['reel-start-idea','reel-start-script','reel-start-single-image','reel-start-existing-design','reel-start-carousel','reel-start-upload-image','reel-start-upload-video']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(reels, /createReelProject\(/);
  assert.match(reels, /reel:use-rendered-designs/);
  assert.match(reels, /reel:use-uploaded-media/);
});

test('friendly duration and motion controls normalize to supported timeline values', () => {
  assert.deepEqual(reelStartDurationOptions, ['auto',5,8,10,15]);
  assert.equal(normalizeReelStartDuration('auto', 8), 8);
  assert.equal(normalizeReelStartDuration('15', 8), 15);
  assert.equal(normalizeReelStartDuration('999', 5), 5);
  assert.equal(normalizeReelStartMotion('slow-zoom-in'), 'zoom-in');
  assert.equal(normalizeReelStartMotion('slow-zoom-out'), 'zoom-out');
  assert.equal(normalizeReelStartMotion('ken-burns'), 'pan-left');
  assert.equal(createScene({ motion: normalizeReelStartMotion('ken-burns') }).motion, 'pan-left');
});

test('uploaded media and carousel source handoffs retain source identity and scene order', () => {
  assert.match(reels, /next\.source=\{kind:detail\.sourceKind\|\|'upload',identity:detail\.sourceIdentity\|\|null\}/);
  assert.match(reels, /for\(let index=0;index<accepted\.length;index\+\+\)/);
  assert.match(reels, /project\.source=\{kind:scenes\.length>1\?'carousel':'existing-design'/);
  const project = createReelProject({ creationMode: 'manual' });
  project.audio = { mode: 'music', assetRef: 'reel-upload:audio', filename: 'track.mp3', volume: .5, offset: 1, originalMuted: true };
  assert.equal(project.audio.assetRef, 'reel-upload:audio');
});

test('Publishing offers an explicit image-only Turn into Reel handoff and Reel publishing retains identity', () => {
  assert.match(html, /id="publishing-turn-into-reel"/);
  assert.match(publishing, /turnIntoReel\.hidden = !imageFiles\.length/);
  assert.match(publishing, /new CustomEvent\('reel:use-uploaded-media'/);
  assert.match(reels, /projectId:project\.id/);
  assert.match(reels, /calendarRowId:project\.calendar\?\.rowId\|\|null/);
  assert.match(reels, /reel-advanced/);
  assert.match(styles, /@media\(max-width:760px\)\{\.reel-start-options/);
});
