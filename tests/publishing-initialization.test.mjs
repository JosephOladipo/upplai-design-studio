import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('publishing module has a parse-safe single initialization path and binds publishing controls', async () => {
  const source = await projectFile('public/publishing.js');
  const html = await projectFile('public/index.html');

  assert.doesNotMatch(source, /function button\s*\(/, 'the helper must not collide with the primary button binding');
  assert.match(source, /function makeButton\s*\(/);
  assert.match(source, /button\.onclick\s*=/);
  assert.match(source, /\[data-publishing-tab\].*showPublishingTab/s);
  assert.equal((html.match(/src="\/publishing\.js\?v=pub-click-02"/g) || []).length, 1);
});