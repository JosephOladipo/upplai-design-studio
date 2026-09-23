import test from 'node:test';
import assert from 'node:assert/strict';
import { designStyles } from '../src/styles.js';
import { generateDesign, normalizeDesignInput } from '../src/design-controller.js';

test('normalized design input supports every registered style', () => {
  for (const style of designStyles) {
    assert.equal(normalizeDesignInput({ style: style.id }).style, style.id);
  }
});

test('normalized OpenAI Style input retains its AI settings', () => {
  const input = normalizeDesignInput({
    style: 'openai-style', headline: 'No main subject', aiVisualStyle: 'editorial',
    aiSubject: 'none', aiComposition: 'left', aiDirection: 'Keep room for copy.', aiQuality: 'premium'
  });
  assert.equal(input.aiSettings.subjectType, 'none');
  assert.deepEqual(input.aiSettings, { visualStyle: 'editorial', subjectType: 'none', composition: 'left', direction: 'Keep room for copy.', quality: 'premium' });
});

test('generateDesign supplies normalized input through the shared render path', async () => {
  let received;
  const result = await generateDesign({ style: 'not-a-style', headline: 42 }, { render: async input => { received = input; return 'rendered'; } });
  assert.equal(result, 'rendered');
  assert.equal(received.style, 'premium-editorial');
  assert.equal(received.headline, '');
});

test('Calendar generation controls remain disabled in the static workspace', async () => {
  const html = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8'));
  assert.match(html, /id="generate-selected-calendar" type="button" disabled>Generate Selected<\/button>/);
  assert.match(html, /id="generate-today-calendar" type="button" disabled>Generate Today<\/button>/);
});

test('Calendar review markup provides download, regenerate, and compact navigation controls', async () => {
  const html = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8'));
  assert.match(html, /id="calendar-review"/);
  assert.match(html, /id="download-calendar-review"/);
  assert.match(html, /id="regenerate-calendar-review"/);
  assert.match(html, /id="calendar-review-position"/);
  const reviewSource = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/calendar-table.js', import.meta.url), 'utf8'));
  const css = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/styles.css', import.meta.url), 'utf8'));
  assert.match(reviewSource, /loadCalendarAsset\(row\.resultRef\)/);
  assert.match(css, /Stable Review workspace: display a rasterized existing design asset/);
});

test('Calendar controls do not retain the temporary Mock Mode generation block', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/calendar-table.js', import.meta.url), 'utf8'));
  assert.doesNotMatch(source, /limited to Mock Mode/);
  assert.doesNotMatch(source, /requireMockMode/);
});

test('Calendar UI has final product wording and keeps generated data out of storage modules', async () => {
  const fs = await import('node:fs/promises');
  const [html, calendar, table] = await Promise.all([
    fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/calendar.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/calendar-table.js', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(html, /Bulk generation will be enabled in a later phase/);
  assert.match(html, /<span class="badge">Design Studio<\/span>/);
  assert.doesNotMatch(calendar + table, /localStorage.*data:image|data:image.*localStorage/s);
});

test('Create can hand an existing rendered preview to the shared Publishing flow', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8'));
  const html = await import('node:fs/promises').then(fs => fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8'));
  assert.match(html, /id="send-to-publish"/);
  assert.match(source, /saveCalendarAsset\(resultRef/);
  assert.match(source, /new CustomEvent\('publishing:generated'/);
  assert.doesNotMatch(source, /generateAI\(.*sendToPublish/);
});