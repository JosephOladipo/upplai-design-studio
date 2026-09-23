import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  importCalendarCsv,
  fingerprint,
  loadCalendar,
  saveCalendar,
  clearCalendar,
  selectAllRows,
  selectTodayRows,
  selectUngeneratedRows,
  getSelectedRowsInOrder,
  getTodayEligibleRows,
  calendarSummary,
  createManualRow,
  nextRowOrder,
  updateManualRow,
  deleteCalendarRow,
  shouldConfirmCalendarReplacement
} from '../src/calendar.js';

const header = 'Date,Headline,Supporting Copy,CTA,Design Method,Visual Style,Visual Subject,Composition,Visual Direction,Quality';
const local = '2026-09-21,5 Resume Mistakes,Small mistakes,Check, Bold Statement,,,,,';
const ai = '2026-09-22,Interview Hacks,Copy,Learn More,OpenAI Style,Editorial,No Main Subject,Left,"Quiet, clean space",Draft';
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

test('creates a normalized manual row after the current highest order', () => {
  const existing = [{ id: 'old', order: 4 }];
  const result = createManualRow({
    date: '2026-09-23', headline: 'Manual post', supportingCopy: 'A short description.', cta: 'Learn more',
    style: 'OpenAI Style', visualStyle: 'editorial', subjectType: 'none', composition: 'left',
    direction: 'Leave room for text.', quality: 'premium'
  }, existing);
  assert.equal(nextRowOrder(existing), 5);
  assert.equal(result.row.order, 5);
  assert.equal(result.row.status, 'ready');
  assert.equal(result.row.style, 'openai-style');
  assert.deepEqual(result.row.ai, { visualStyle: 'editorial', subjectType: 'none', composition: 'left', direction: 'Leave room for text.', quality: 'premium' });
  const storage = memory();
  saveCalendar([...existing, result.row], storage);
  assert.equal(loadCalendar(storage).rows[1].id, result.row.id);
});

test('rejects manual rows without a valid date or headline', () => {
  const result = createManualRow({ date: 'not-a-date', headline: '', style: 'premium-editorial' });
  assert.equal(result.row, undefined);
  assert.match(result.errors.join(' '), /valid date/);
  assert.match(result.errors.join(' '), /Headline is required/);
});

test('editing preserves the row id and order while recalculating its fingerprint', () => {
  const original = createManualRow({ date: '2026-09-23', headline: 'Original', style: 'premium-editorial' }, [{ order: 7 }]).row;
  original.status = 'ready';
  const result = updateManualRow(original, { date: '2026-09-23', headline: 'Updated', style: 'premium-editorial' });
  assert.equal(result.row.id, original.id);
  assert.equal(result.row.order, original.order);
  assert.notEqual(result.row.inputFingerprint, original.inputFingerprint);
  assert.equal(result.row.status, 'ready');
});

test('date-only edits leave a generated row generated and preserve its generation fingerprint', () => {
  const original = createManualRow({ date: '2026-09-23', headline: 'Same copy', style: 'premium-editorial' }).row;
  original.status = 'generated';
  const result = updateManualRow(original, { date: '2026-09-24', headline: 'Same copy', style: 'premium-editorial' });
  assert.equal(result.relevantChange, false);
  assert.equal(result.row.inputFingerprint, original.inputFingerprint);
  assert.equal(result.row.status, 'generated');
});

test('relevant edits stale generated rows and retain stale rows', () => {
  const generated = createManualRow({ date: '2026-09-23', headline: 'Original', style: 'premium-editorial' }).row;
  generated.status = 'generated';
  const changed = updateManualRow(generated, { date: generated.date, headline: 'Changed', style: 'premium-editorial' });
  assert.equal(changed.relevantChange, true);
  assert.equal(changed.row.status, 'stale');
  const stale = { ...generated, status: 'stale' };
  assert.equal(updateManualRow(stale, { date: stale.date, headline: 'Changed again', style: 'premium-editorial' }).row.status, 'stale');
});

test('deleting one calendar row preserves remaining rows and their orders', () => {
  const rows = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 2 }, { id: 'd', order: 3 }];
  const remaining = deleteCalendarRow(rows, 'b');
  assert.deepEqual(remaining.map(row => row.id), ['a', 'c', 'd']);
  assert.deepEqual(remaining.map(row => row.order), [0, 2, 3]);
  assert.equal(nextRowOrder(remaining), 4);
  assert.deepEqual(deleteCalendarRow(rows, 'missing'), rows);
});

test('calendar replacement protection applies only to nonempty valid imports', () => {
  const existing = [{ id: 'manual', order: 4 }];
  const imported = [{ id: 'csv', order: 0 }];
  assert.equal(shouldConfirmCalendarReplacement(existing, imported), true);
  assert.equal(shouldConfirmCalendarReplacement([], imported), false);
  assert.equal(shouldConfirmCalendarReplacement(existing, []), false);
  const storage = memory();
  saveCalendar(existing, storage);
  assert.deepEqual(loadCalendar(storage).rows, existing);
  saveCalendar(imported, storage);
  assert.deepEqual(loadCalendar(storage).rows, imported);
});

test('imports template-like CSV with two normalized rows', () => {
  const result = importCalendarCsv(`${header}\n${local}\n${ai}`);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].style, 'bold-statement');
  assert.deepEqual(result.rows[1].ai, { visualStyle: 'editorial', subjectType: 'none', composition: 'left', direction: 'Quiet, clean space', quality: 'draft' });
});

test('CSV parser supports quoted commas, escaped quotes, CRLF, LF, BOM and blank lines', () => {
  const rows = parseCsv(`\uFEFF${header}\r\n2026-09-21,"Hello, world","She said ""yes""",,Premium Editorial,,,,,\r\n\r\n`);
  assert.equal(rows.length, 2); assert.equal(rows[1][1], 'Hello, world'); assert.equal(rows[1][2], 'She said "yes"');
  assert.equal(importCalendarCsv(`${header}\n2026-09-21,Hello,,,`).rows.length, 1);
});

test('normalizes labels and defaults older CSV files', () => {
  const result = importCalendarCsv('date,headline,supportingcopy,cta,designmethod\n2026/09/21,Hello,Copy,,');
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].date, '2026-09-21');
  assert.equal(result.rows[0].style, 'premium-editorial');
  assert.deepEqual(result.rows[0].ai, { visualStyle: 'auto', subjectType: 'auto', composition: 'auto', direction: '', quality: 'draft' });
});

test('reports invalid rows while retaining valid ordered rows', () => {
  const result = importCalendarCsv(`${header}\n${local}\n2026-99-99,Missing method,,,Unknown Method,,,,,\n2026-09-23,,,,Premium Editorial,,,,,`);
  assert.equal(result.rows.length, 1); assert.equal(result.rows[0].order, 0);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0].messages.join(' '), /Invalid date/);
  assert.match(result.errors[0].messages.join(' '), /Unknown Design Method/);
  assert.match(result.errors[1].messages.join(' '), /Missing headline/);
});

test('forgives optional AI guidance and fingerprints deterministically', () => {
  const result = importCalendarCsv(`${header}\n2026-09-21,Hello,,,OpenAI Style,Wrong,Alien,Diagonal,,Ultra`);
  assert.equal(result.rows.length, 1); assert.equal(result.errors.length, 0);
  assert.deepEqual(result.rows[0].ai, { visualStyle: 'auto', subjectType: 'auto', composition: 'auto', direction: 'Alien. Diagonal composition.', quality: 'draft' });
  const row = importCalendarCsv(`${header}\n${local}`).rows[0];
  assert.equal(row.inputFingerprint, fingerprint(row));
});

test('calendar persistence restores and clearing only removes calendar storage', () => {
  const store = memory(); const rows = importCalendarCsv(`${header}\n${local}`).rows;
  saveCalendar(rows, store, '2026-09-20T00:00:00.000Z');
  assert.equal(loadCalendar(store).rows[0].headline, '5 Resume Mistakes');
  store.setItem('upplai-design-studio:form:v1', 'unchanged');
  clearCalendar(store);
  assert.equal(loadCalendar(store), null); assert.equal(store.getItem('upplai-design-studio:form:v1'), 'unchanged');
});

test('selection helpers preserve order and only select eligible statuses', () => {
  const rows = [
    { id: 'second', order: 2, date: '2026-09-20', status: 'generated' },
    { id: 'first', order: 1, date: '2026-09-20', status: 'ready' },
    { id: 'third', order: 3, date: '2026-09-21', status: 'stale' },
    { id: 'fourth', order: 4, date: '2026-09-20', status: 'generating' },
    { id: 'fifth', order: 5, date: '2026-09-20', status: 'failed' },
    { id: 'sixth', order: 6, date: '2026-09-20', status: 'skipped' }
  ];
  assert.deepEqual([...selectAllRows(rows)], ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']);
  assert.deepEqual([...selectTodayRows(rows, '2026-09-20')], ['first', 'second', 'fourth', 'fifth', 'sixth']);
  assert.deepEqual([...selectUngeneratedRows(rows)], ['first', 'third']);
  assert.deepEqual(getSelectedRowsInOrder(rows, new Set(['third', 'first'])).map(row => row.id), ['first', 'third']);
  assert.deepEqual(getTodayEligibleRows(rows, '2026-09-20').map(row => row.id), ['first']);
  assert.equal(calendarSummary(rows, new Set(['first', 'third']), '2026-09-20').selected, 2);
  assert.equal(calendarSummary(rows, new Set(), '2026-09-20').byStatus.generated, 1);
});

test('OpenAI settings persist without persisting selection state', () => {
  const row = importCalendarCsv(`${header}\n${ai}`).rows[0];
  const store = memory(); saveCalendar([row], store);
  assert.equal(loadCalendar(store).rows[0].ai.subjectType, 'none');
  assert.equal(Object.hasOwn(loadCalendar(store), 'selectedIds'), false);
});

test('imports legacy AI design labels into supported options and preserves resume direction detail', () => {
  const csv = `${header}\n2026-09-25,Resume proof points,Supporting copy,Review Resume,OpenAI Style,Premium Editorial,Resume with highlighted proof points,Split,,Ready`;
  const result = importCalendarCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.rows[0].ai, {
    visualStyle: 'editorial',
    subjectType: 'auto',
    composition: 'auto',
    direction: 'Resume with highlighted proof points. Split composition.',
    quality: 'draft'
  });
});

test('imports friendly optional guidance, preserves order, and reports compact adjustment counts', () => {
  const csv = `${header}\n2026-09-25,One,Copy,Go,OpenAI Style,Infographic,Before-and-after resume bullet,Grid,Keep the hook clear,Ready\n2026-09-26,Two,Copy,Go,OpenAI Style,Social Editorial,Skill cluster map,Split,,Unknown`;
  const result = importCalendarCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.rows.map(row => row.order), [0, 1]);
  assert.deepEqual(result.rows.map(row => row.ai.visualStyle), ['illustration', 'editorial']);
  assert.equal(result.rows[0].ai.subjectType, 'auto');
  assert.match(result.rows[0].ai.direction, /^Before-and-after resume bullet\. Grid composition\. Keep the hook clear$/);
  assert.deepEqual(result.adjustments, { visualStylesNormalized: 2, visualSubjectsMoved: 2, compositionsDefaulted: 2, qualityDefaulted: 2 });
});

test('imports Minimal Tech and High Contrast labels into supported visual styles', () => {
  const csv = `${header}\n2026-09-25,Minimal tech,Copy,Learn,OpenAI Style,Minimal Tech,Auto,Auto,,Draft\n2026-09-26,High contrast,Copy,Learn,OpenAI Style,High Contrast,Auto,Auto,,Ready`;
  const result = importCalendarCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].ai.visualStyle, 'minimal');
  assert.equal(result.rows[1].ai.visualStyle, 'auto');
  assert.equal(result.rows[1].ai.quality, 'draft');
});
