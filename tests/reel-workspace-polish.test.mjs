import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReelProject, addScene, deleteScene, moveScene } from '../src/reel-project.mjs';
import { reelMusicLibrary, reelMusicCategories, normalizeReelMusicTrack } from '../src/reel-music-library.mjs';

const reels = fs.readFileSync('public/reels.js', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8');
const navigation = fs.readFileSync('public/navigation.js', 'utf8');
const ux = fs.readFileSync('public/ux.js', 'utf8');

test('Reel workspace has a shared-navigation Back action and a confirmed scoped reset', () => {
  assert.match(reels, /reel-back/);
  assert.match(reels, /navigateBackFromWorkspace\('create'\)/);
  assert.match(reels, /reel-reset/);
  assert.match(reels, /confirm\('Reset this Reel\?/);
  assert.match(reels, /project=createReelProject\(\);selected=0/);
  assert.match(reels, /renderAbort\?\.abort\(\)/);
  assert.match(reels, /removeCalendarAsset\(renderRef\)/);
  assert.match(navigation, /export function navigateBackFromWorkspace/);
});

test('scene controls remain readable and delete only updates the active Reel project', () => {
  let project = createReelProject();
  project = addScene(project, { headline: 'One', duration: 3 });
  project = addScene(project, { headline: 'Two', duration: 4 });
  project = addScene(project, { headline: 'Three', duration: 5 });
  project = moveScene(project, 2, -1);
  const afterDelete = deleteScene(project, 1);
  assert.deepEqual(afterDelete.scenes.map(scene => scene.headline), ['One', 'Two']);
  assert.match(reels, /Scene \$\{i\+1\} · \$\{x\.duration\}s/);
  assert.match(reels, /title="Delete scene" aria-label="Delete scene/);
  assert.match(reels, />Delete<\/button>/);
  assert.match(reels, /project=deleteScene\(project,i\);selected=Math\.max\(0,Math\.min\(selected,project\.scenes\.length-1\)\);save\(\);render\(\)/);
});

test('audio library architecture is metadata-only and honestly empty', () => {
  assert.deepEqual(reelMusicLibrary, []);
  assert.ok(reelMusicCategories.includes('Technology'));
  assert.equal(normalizeReelMusicTrack({}), null);
  const track = normalizeReelMusicTrack({ id: 'safe-1', title: 'Royalty-free loop', category: 'Chill', duration: 30, license: 'CC0' });
  assert.equal(track.category, 'Chill');
  assert.equal(track.duration, 30);
  assert.match(reels, /Music library coming soon\. Upload your own audio for now\./);
  assert.match(reels, /Add platform music after export/);
  assert.doesNotMatch(reels, /Instagram music search|TikTok music search/i);
});

test('Reel layout respects sidebar containment and reserves the mobile nav tap area', () => {
  assert.match(css, /#section-reels\{display:block;grid-template-columns:none;width:100%;max-width:1500px/);
  assert.match(css, /@media\(min-width:901px\)\{#section-reels\{width:calc\(100vw - var\(--sidebar-width\)\)/);
  assert.match(css, /reel-start-options\{grid-template-columns:repeat\(auto-fit,minmax\(148px,1fr\)\)/);
  assert.match(css, /reel-quick-settings \.reel-start-image-options\{grid-template-columns:repeat\(4,minmax\(145px,1fr\)\)/);
  assert.match(css, /--mobile-bottom-nav-clearance/);
  assert.match(css, /\.reel-export\{bottom:var\(--mobile-bottom-nav-clearance\)!important/);
  assert.match(ux, /import \{ navigateToWorkspace \} from '\.\/navigation\.js'/);
  assert.match(ux, /function navigateWorkspace\(workspace\) \{ navigateToWorkspace\(workspace\)/);
});
