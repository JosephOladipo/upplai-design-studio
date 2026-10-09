import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualRow, importCalendarCsv, normalizeContentFormat } from '../src/calendar.js';
import fs from 'node:fs';
test('Calendar normalizes legacy and new content formats without losing format metadata', () => {
  assert.equal(normalizeContentFormat(), 'single-image'); assert.equal(normalizeContentFormat('single_image'), 'single-image'); assert.equal(normalizeContentFormat('ai_designer'), 'ai_designer'); assert.equal(normalizeContentFormat('reel'), 'reel');
  const row = createManualRow({ date:'2026-10-09', headline:'Plan', style:'premium-editorial', contentFormat:'ai_designer', rawCopy:'Long source copy', creativeDirection:'Bright', textMode:'native', referenceUsage:'style_inspiration' }).row;
  assert.equal(row.contentFormat,'ai_designer'); assert.equal(row.rawCopy,'Long source copy'); assert.equal(row.referenceUsage,'style_inspiration');
});
test('CSV optional format columns remain backward compatible', () => {
  const imported = importCalendarCsv('Date,Headline,Design Method,Content Format,Raw Copy,Reel Duration\n2026-10-09,Plan,Premium Editorial,reel,Script,30');
  assert.equal(imported.rows[0].contentFormat,'reel'); assert.equal(imported.rows[0].rawCopy,'Script'); assert.equal(imported.rows[0].reelDuration,30);
  const legacy = importCalendarCsv('Date,Headline,Design Method\n2026-10-09,Old,Premium Editorial'); assert.equal(legacy.rows[0].contentFormat,'single-image');
});
test('manual format controls and AI Designer dispatch use existing Calendar adapters', () => {
  const manual = fs.readFileSync(new URL('../public/calendar.js',import.meta.url),'utf8'); const table = fs.readFileSync(new URL('../public/calendar-table.js',import.meta.url),'utf8');
  assert.match(manual,/manual-raw-copy/); assert.match(manual,/manual-reel-duration/); assert.match(table,/row\.contentFormat === 'ai_designer'/); assert.match(table,/generateCalendarDesign/);
});
