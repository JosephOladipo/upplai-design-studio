import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');const nav=fs.readFileSync(new URL('../public/navigation.js',import.meta.url),'utf8');const ux=fs.readFileSync(new URL('../public/ux.js',import.meta.url),'utf8');const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
test('Home dashboard routes into existing creation and workspace navigation',()=>{assert.match(html,/id="section-home"/);assert.match(html,/What do you want to create\?/);assert.match(html,/data-home-create="ai-designer"/);assert.match(html,/data-home-workspace="reels"/);assert.match(nav,/validWorkspaces = new Set\(\['home'/);assert.match(ux,/data-home-create/);});
test('shared UX hierarchy retains disclosures and primary action styling',()=>{assert.match(css,/home-create-grid/);assert.match(css,/\.ux-disclosure summary::after/);assert.match(css,/#ai-designer-generate/);assert.match(ux,/create-advanced-controls/);});
