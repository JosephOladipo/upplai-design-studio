import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Calendar Review passes the full row and result reference to the shared Create editor', async () => {
  const calendar = await source('../public/calendar-table.js');
  assert.match(calendar, /resultRef: row\.resultRef \|\| ''/);
  assert.match(calendar, /row,\s*\n\s*preview: result\.preview/);
});

test('Calendar edit replaces stale Create state with row copy, style, logo and placement', async () => {
  const app = await source('../public/app.js');
  assert.match(app, /function populateCalendarForm\(row = \{\}\)/);
  assert.match(app, /headline: row\.headline \?\? saved\.headline \?\? ''/);
  assert.match(app, /supportingCopy: row\.supportingCopy \?\? saved\.supportingCopy \?\? ''/);
  assert.match(app, /cta: row\.cta \?\? saved\.cta \?\? ''/);
  assert.match(app, /style: row\.style \|\| saved\.style \|\| defaults\.style/);
  assert.match(app, /logo: saved\.logo \|\| row\.logo \|\| defaults\.logo/);
  assert.match(app, /placement: saved\.placement \|\| row\.placement \|\| defaults\.placement/);
  assert.match(app, /populateCalendarForm\(row \|\| \{ style \}\)/);
});

test('Calendar reformatting preserves the same item context and still opens the shared local editor', async () => {
  const app = await source('../public/app.js');
  assert.match(app, /const preserveCalendarContext = Boolean\(calendarEditorRowId && !carouselEditorContext\)/);
  assert.match(app, /if \(!preserveCalendarContext\) calendarEditorRowId = null/);
  assert.match(app, /saveCalendarDesign\.hidden = !preserveCalendarContext/);
  assert.match(app, /source: fromCalendar \? 'calendar-single' : 'create'/);
  assert.match(app, /setupLocalEditor\(preview, localEditorControls/);
});

test('Save to Calendar persists the latest content, style, logo, placement and asset under the existing row identity', async () => {
  const app = await source('../public/app.js');
  assert.match(app, /const designConfig = \{ \.\.\.state\(\), style: currentStyle \}/);
  assert.match(app, /headline: designConfig\.headline/);
  assert.match(app, /supportingCopy: designConfig\.supportingCopy/);
  assert.match(app, /cta: designConfig\.cta/);
  assert.match(app, /style: designConfig\.style/);
  assert.match(app, /logo: designConfig\.logo/);
  assert.match(app, /placement: designConfig\.placement/);
  assert.match(app, /designConfig,/);
  assert.match(app, /saveCalendarAsset\(resultRef, result\)/);
});

test('legacy Calendar rows and a later fresh Create navigation have safe fallbacks', async () => {
  const app = await source('../public/app.js');
  assert.match(app, /row \|\| \{ style \}/);
  assert.match(app, /event\.detail\?\.workspace !== 'create' \|\| !calendarEditorRowId/);
  assert.match(app, /calendarEditorRowId = null;\s*\n\s*saveCalendarDesign\.hidden = true;/);
});
