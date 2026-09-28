import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('shared editor provides undo, redo, and local copy/paste without intercepting typing', async () => {
  const editor = await source('../src/local-editor.js');

  assert.match(editor, /↶ Undo/);
  assert.match(editor, /↷ Redo/);
  assert.match(editor, /history = history\.slice\(0, historyIndex \+ 1\)/);
  assert.match(editor, /event\.key\.toLowerCase\(\) === 'c'/);
  assert.match(editor, /event\.key\.toLowerCase\(\) === 'v'/);
  assert.match(editor, /if \(typing\) return/);
});

test('Carousel Review uses the existing asset result, selected slide handoff, and same-result save back', async () => {
  const [html, app, table] = await Promise.all([
    source('../public/index.html'),
    source('../public/app.js'),
    source('../public/calendar-table.js')
  ]);

  assert.match(html, /id="carousel-review-strip"/);
  assert.match(html, /id="save-carousel-slide"/);
  assert.match(table, /carouselFromAsset/);
  assert.match(table, /calendar:carousel-slide-edit/);
  assert.match(table, /calendar:carousel-slide-saved/);
  assert.match(app, /loadCalendarAsset\(context\.resultRef\)/);
  assert.match(app, /saveCalendarAsset\(context\.resultRef/);
  assert.match(app, /index !== context\.slideIndex/);
});
