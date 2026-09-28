import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('hidden processing overlay cannot intercept Publishing clicks', () => {
  const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.app-processing\[hidden\]\{display:none!important;pointer-events:none\}/);
});
