import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('publishing accepts video media and persists only an IndexedDB asset reference',()=>{const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');const client=fs.readFileSync(new URL('../public/publishing.js',import.meta.url),'utf8');const cloudinary=fs.readFileSync(new URL('../src/cloudinary.mjs',import.meta.url),'utf8');const draft=client.match(/function savePublishingDraft\(\)[\s\S]*?\n\}/)?.[0] || '';assert.match(server,/MAX_VIDEO_UPLOAD_BYTES/);assert.match(server,/video\/quicktime/);assert.match(cloudinary,/upload_large/);assert.match(client,/video\/webm/);assert.match(client,/URL\.createObjectURL/);assert.match(draft,/mediaRef/);assert.doesNotMatch(draft,/state\.media\b|mediaInput\.files|File\(/);});

