import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalendarQueue, todayEligibleIds } from '../src/calendar-generation.js';

const row = (id, order, status = 'ready', style = 'premium-editorial') => ({ id, order, date: '2026-09-21', headline: id, supportingCopy: '', cta: '', style, ai: { visualStyle: 'editorial', subjectType: 'none', composition: 'left', direction: 'Quiet', quality: 'draft' }, status, inputFingerprint: id, generatedAt: null, error: null, resultRef: null });

test('Calendar queue runs selected eligible rows sequentially in order and preserves AI settings', async () => {
  const calls = [];
  const queue = createCalendarQueue(async input => { calls.push(input); await new Promise(resolve => setTimeout(resolve, 2)); return { preview: 'actual-rendered-output' }; });
  const rows = [row('second', 2, 'stale', 'openai-style'), row('first', 1), row('done', 0, 'generated')];
  const result = await queue.run(rows, new Set(['first', 'second', 'done']));
  assert.deepEqual(calls.map(input => input.headline), ['first', 'second']);
  assert.equal(calls[1].aiSettings.subjectType, 'none');
  assert.equal(calls[1].aiSettings.quality, 'draft');
  assert.deepEqual(result.rows.map(item => item.status), ['generated', 'generated', 'generated']);
  assert.deepEqual(result.summary, { selected: 3, generated: 2, alreadyGenerated: 1, skipped: 0, failed: 0 });
  assert.ok(result.rows[0].generatedAt);
  assert.equal(result.rows[0].resultRef, null);
  assert.equal(result.results.get('second').preview, 'actual-rendered-output');
});

test('local Calendar styles reach the shared queue without requiring AI settings', async () => {
  let received;
  const queue = createCalendarQueue(async input => { received = input; return { preview: 'local-output' }; });
  const local = { ...row('local', 0), ai: { visualStyle: 'auto', subjectType: 'auto', composition: 'auto', direction: '', quality: 'draft' } };
  const result = await queue.run([local], new Set(['local']));
  assert.equal(received.style, 'premium-editorial');
  assert.equal(result.summary.generated, 1);
  assert.equal(result.results.get('local').preview, 'local-output');
});

test('Calendar queue skips ineligible rows, continues after failure, and blocks a second queue', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const queue = createCalendarQueue(async input => { calls.push(input.headline); if (input.headline === 'first') await gate; if (input.headline === 'second') throw new Error('A useful failure'); });
  const rows = [row('first', 0), row('second', 1), row('third', 2), row('busy', 3, 'generating'), row('failed', 4, 'failed'), row('skipped', 5, 'skipped')];
  const active = queue.run(rows, new Set(rows.map(item => item.id)));
  assert.equal(queue.running, true);
  assert.equal((await queue.run(rows, new Set(['first']))).blocked, true);
  release();
  const result = await active;
  assert.deepEqual(calls, ['first', 'second', 'third']);
  assert.equal(result.summary.generated, 2);
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.alreadyGenerated, 0);
  assert.equal(result.summary.skipped, 3);
  assert.equal(result.rows.find(item => item.id === 'second').status, 'failed');
  assert.match(result.rows.find(item => item.id === 'second').error, /useful failure/);
  assert.equal(result.rows.find(item => item.id === 'third').status, 'generated');
  assert.equal(queue.running, false);
});

test('Today eligibility includes only local ready and stale rows and preserves row order without selection', async () => {
  const today = '2026-09-21';
  const rows = [row('stale', 2, 'stale'), row('generated', 1, 'generated'), row('ready', 0), row('failed', 3, 'failed'), { ...row('future', 4), date: '2026-09-22' }, { ...row('past', 5), date: '2026-09-20' }];
  const ids = todayEligibleIds(rows, today);
  assert.deepEqual([...ids], ['ready', 'stale']);
  const calls = [];
  const queue = createCalendarQueue(async input => { calls.push(input.headline); return { preview: input.headline }; });
  const result = await queue.run(rows, ids);
  assert.deepEqual(calls, ['ready', 'stale']);
  assert.equal(result.summary.generated, 2);
  assert.equal(result.rows.find(item => item.id === 'generated').status, 'generated');
  assert.equal(result.results.get('ready').preview, 'ready');
});

import { calendarResultRef } from '../src/calendar-assets.js';

test('Calendar generated assets use a lightweight row-associated reference', () => {
  assert.equal(calendarResultRef('calendar-42'), 'calendar-result:calendar-42');
  assert.doesNotMatch(calendarResultRef('calendar-42'), /data:image|base64/i);
});

test('Calendar review persistence uses IndexedDB and does not put generated assets in localStorage', async () => {
  const fs = await import('node:fs/promises');
  const [assets, table] = await Promise.all([
    fs.readFile(new URL('../src/calendar-assets.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/calendar-table.js', import.meta.url), 'utf8')
  ]);
  assert.match(assets, /indexedDB/);
  assert.match(table, /saveCalendarAsset/);
  assert.match(table, /loadCalendarAsset/);
  assert.doesNotMatch(table, /localStorage.*data:image|data:image.*localStorage/s);
});
