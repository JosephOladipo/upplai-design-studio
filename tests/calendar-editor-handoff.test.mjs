import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Calendar Review hands a stored design to the shared Create editor without a second Review editor', async () => {
  const [html, app, calendar] = await Promise.all([
    source('../public/index.html'),
    source('../public/app.js'),
    source('../public/calendar-table.js')
  ]);

  assert.match(html, /id="save-calendar-design"/);
  assert.doesNotMatch(html, /calendar-review-design-editor/);
  assert.match(calendar, /new CustomEvent\(\s*'calendar:design-edit'/);
  assert.match(app, /document\.addEventListener\('calendar:design-edit'/);
  assert.match(app, /setupLocalEditor\(preview, localEditorControls/);
});

test('saving Calendar edits persists the cleaned preview under the existing result reference and refreshes Review', async () => {
  const [app, calendar] = await Promise.all([
    source('../public/app.js'),
    source('../public/calendar-table.js')
  ]);

  assert.match(app, /saveCalendarAsset\(resultRef, result\)/);
  assert.match(app, /cleanEditedPreview\(preview\)/);
  assert.match(app, /new CustomEvent\('calendar:design-saved'/);
  assert.match(calendar, /document\.addEventListener\('calendar:design-saved'/);
  assert.match(calendar, /sessionResults\.set\(id/);
  assert.match(calendar, /openReview\(row\)/);
});
