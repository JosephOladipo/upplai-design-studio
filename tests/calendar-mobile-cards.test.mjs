import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const table = fs.readFileSync(new URL('../public/calendar-table.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
test('mobile Calendar cards expose compact primary actions and preserve secondary details', () => {
  assert.match(table, /calendar-mobile-primary/); assert.match(table, /value === 'generated'.*Review/s); assert.match(table, /value === 'failed'.*Retry/s); assert.match(table, /value === 'stale'.*Retry/s); assert.match(table, /calendar-mobile-details/); assert.match(table, /Content changed after generation/);
});
test('mobile Calendar cards have no fixed row width and hide desktop-only fields', () => {
  assert.match(css, /@media\(max-width:767px\)[\s\S]*calendar-table tr\{display:grid/); assert.match(css, /td:nth-child\(1\),\.calendar-table td:nth-child\(4\)\{display:none/); assert.match(css, /overflow:hidden/); assert.match(css, /\.calendar-mobile-primary\{display:block/);
});
