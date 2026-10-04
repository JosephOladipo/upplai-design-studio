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
  assert.deepEqual(calls, ['first', 'second', 'third', 'failed']);
  assert.equal(result.summary.generated, 3);
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.alreadyGenerated, 0);
  assert.equal(result.summary.skipped, 2);
  assert.equal(result.rows.find(item => item.id === 'second').status, 'failed');
  assert.match(result.rows.find(item => item.id === 'second').error, /useful failure/);
  assert.equal(result.rows.find(item => item.id === 'third').status, 'generated');
  assert.equal(queue.running, false);
});

test('Today eligibility includes retryable failed rows and preserves row order without selection', async () => {
  const today = '2026-09-21';
  const rows = [row('stale', 2, 'stale'), row('generated', 1, 'generated'), row('ready', 0), row('failed', 3, 'failed'), { ...row('future', 4), date: '2026-09-22' }, { ...row('past', 5), date: '2026-09-20' }];
  const ids = todayEligibleIds(rows, today);
  assert.deepEqual([...ids], ['ready', 'stale', 'failed']);
  const calls = [];
  const queue = createCalendarQueue(async input => { calls.push(input.headline); return { preview: input.headline }; });
  const result = await queue.run(rows, ids);
  assert.deepEqual(calls, ['ready', 'stale', 'failed']);
  assert.equal(result.summary.generated, 3);
  assert.equal(result.rows.find(item => item.id === 'generated').status, 'generated');
  assert.equal(result.results.get('ready').preview, 'ready');
});

test('a failed Calendar row clears the queue and a later Generate retry invokes a fresh request', async () => {
  let attempts = 0;
  const queue = createCalendarQueue(async () => {
    attempts++;
    if (attempts === 1) throw new Error('temporary upstream error');
    return { preview: 'recovered-output' };
  });
  const first = await queue.run([row('retryable', 0)], new Set(['retryable']));
  assert.equal(first.rows[0].status, 'failed');
  assert.equal(queue.running, false);
  const second = await queue.run(first.rows, new Set(['retryable']));
  assert.equal(attempts, 2);
  assert.equal(second.rows[0].status, 'generated');
  assert.equal(second.results.get('retryable').preview, 'recovered-output');
  assert.equal(queue.running, false);
});

test('a Calendar Full AI result remains generated when only its secondary vision assessment is negative', async () => {
  const queue = createCalendarQueue(async () => ({ preview: 'valid-image', artworkValidatorFallback: true }));
  const result = await queue.run([row('vision-diagnostic', 0)], new Set(['vision-diagnostic']));
  assert.equal(result.rows[0].status, 'generated');
  assert.equal(result.results.get('vision-diagnostic').artworkValidatorFallback, true);
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
