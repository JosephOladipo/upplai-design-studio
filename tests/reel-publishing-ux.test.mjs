import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Reel workspace presents creator workflow cards and keeps scene controls compact', async () => {
  const [reels, styles] = await Promise.all([source('public/reels.js'), source('public/styles.css')]);
  for (const name of ['reel-project-header', 'reel-create-card', 'reel-preview-card', 'reel-selected-card', 'reel-scenes-card', 'reel-card']) assert.match(reels, new RegExp(name));
  assert.match(reels, /Selected Scene/);
  assert.match(reels, /Create Reel/);
  assert.match(reels, /class="reel-scene-select"/);
  assert.match(reels, /Move left/);
  assert.match(reels, /Move right/);
  assert.match(styles, /grid-template-columns:minmax\(0,1fr\) minmax\(260px,360px\)/);
  assert.match(styles, /max-width:560px/);
  assert.match(styles, /@media\(max-width:850px\)/);
});

test('Reel export has user-facing current-render controls and only enables Publishing after valid output', async () => {
  const [reels, html] = await Promise.all([source('public/reels.js'), source('public/index.html')]);
  assert.match(html, /id="reel-send-publishing"/);
  assert.match(reels, /q\('reel-send-publishing'\)\.disabled=true/);
  assert.match(reels, /q\('reel-send-publishing'\)\.disabled=false/);
  assert.match(reels, /if\(!validRender\(project\)\)return/);
  assert.match(reels, /Your Reel changed\. Render again to update the video\./);
  assert.match(reels, /Preparing your Reel for Publishing/);
});

test('one rendered MP4 and structured Reel context use the established Publishing handoff', async () => {
  const [reels, publishing, assets] = await Promise.all([source('public/reels.js'), source('public/publishing.js'), source('src/calendar-assets.js')]);
  assert.match(reels, /handoffToPublishing/);
  assert.match(reels, /source:'reel-builder'/);
  assert.match(reels, /contentType:'video'/);
  assert.match(reels, /reelMediaRef:project\.render\.assetRef/);
  assert.match(reels, /mimeType:'video\/mp4'/);
  assert.match(reels, /reelContext:project\.render\.context/);
  assert.match(publishing, /if \(result\.reelMediaRef\)/);
  assert.match(publishing, /asset\.file\.type !== 'video\/mp4'/);
  assert.match(publishing, /savePublishingMedia\(state\.media, `publishing-reel:\$\{result\.reelMediaRef\}`\)/);
  assert.match(publishing, /prepareVideoMediaPreview/);
  assert.match(publishing, /reel: result\.reelContext \|\| null/);
  assert.match(publishing, /value\.type === 'video\/mp4'/);
  assert.match(assets, /type: 'publishing-media', file/);
});

test('creation modes, existing design conversion, and Resize version navigation remain present', async () => {
  const [reels, conversion, reformat] = await Promise.all([source('public/reels.js'), source('src/reel-source-conversion.mjs'), source('src/design-reformat.js')]);
  assert.match(reels, /modeUI\(\)/);
  assert.match(reels, /mode!=='ai-generate'/);
  assert.match(reels, /mode!=='describe-scenes'/);
  assert.match(reels, /reel:use-rendered-designs/);
  assert.match(conversion, /visualType:'existing-design'/);
  assert.match(reformat, /previous\.addEventListener\('click'/);
  assert.match(reformat, /nextButton\.addEventListener\('click'/);
  assert.match(reformat, /adapter\.restore\(versions\[next\]\)/);
});
