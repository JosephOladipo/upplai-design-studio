import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const css = read('public/styles.css');
const navigation = read('public/navigation.js');
const ux = read('public/ux.js');
const html = read('public/index.html');

test('desktop Home explicitly uses the available workspace and responsive card widths', () => {
  assert.match(css, /#section-home\{display:block;grid-template-columns:none\}/);
  assert.match(css, /#section-home \.home-dashboard\{width:100%;max-width:1280px/);
  assert.match(css, /@media\(min-width:901px\)\{#section-home\{width:calc\(100vw - var\(--sidebar-width\)\)/);
  assert.match(css, /\.home-create-grid\{grid-template-columns:repeat\(auto-fit,minmax\(180px,1fr\)\)\}/);
  assert.match(css, /\.home-status-grid\{grid-template-columns:repeat\(auto-fit,minmax\(220px,1fr\)\)\}/);
});

test('mobile workspace buttons call shared navigation directly and close More', () => {
  for (const workspace of ['home','create','calendar','review','publishing','reels','brand']) assert.match(html, new RegExp(`data-mobile-workspace="${workspace}"`));
  assert.match(navigation, /export function navigateToWorkspace/);
  assert.match(navigation, /document\.addEventListener\('navigate:workspace', event => navigateToWorkspace\(event\.detail\?\.workspace\)\)/);
  assert.match(ux, /import \{ navigateToWorkspace \} from '\.\/navigation\.js'/);
  assert.match(ux, /navigateToWorkspace\(workspace\)/);
  assert.match(ux, /more\.hidden = true/);
  assert.doesNotMatch(ux, /\$\(id\)\?\.click\(\)/);
});

test('hidden mobile overlays cannot intercept taps and desktop sidebar remains the shared navigation source', () => {
  assert.match(css, /\.mobile-bottom-nav\{height:calc\(76px[^}]*pointer-events:none/);
  assert.match(css, /\.mobile-bottom-nav button\{pointer-events:auto/);
  assert.match(css, /\.mobile-more-menu\[hidden\]\{display:none!important;pointer-events:none\}/);
  assert.match(css, /body\.mobile-nav-open::after\{display:none\}/);
  assert.match(navigation, /createButton\.addEventListener[\s\S]*navigateToWorkspace\('create'\)/);
});
