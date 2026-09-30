import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('shared editor handoff has one concrete Create entry point and retains explicit identity metadata', () => {
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /function openSharedEditor\(options = \{\}\)/);
  assert.match(source, /preview\.dataset\.resultRef = resultRef/);
  assert.match(source, /source: fromCalendar \? 'calendar-single' : 'create'/);
  assert.match(source, /openSharedEditor\(\{ source: 'calendar-single'/);
});

test('multi-page page editing uses the shared editor handoff and saves only the selected page HTML', () => {
  const [app, multi] = ['public/app.js', 'public/multi-page.js'].map(file => fs.readFileSync(file, 'utf8'));
  assert.match(multi, /id="multi-edit-page"|multi-edit-page/);
  assert.match(multi, /multi-page:builder-page-edit/);
  assert.match(app, /source: 'multi-page-builder'/);
  assert.match(app, /multi-page:builder-page-saved/);
  assert.match(multi, /page\.settings\?\.editedHtml/);
});
