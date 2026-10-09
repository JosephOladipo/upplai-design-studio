import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../public/ai-designer.js', import.meta.url), 'utf8');
const imageEngine = fs.readFileSync(new URL('../src/openai-image.mjs', import.meta.url), 'utf8');
test('AI Designer reference route is protected multipart and keeps brand image generation server-side', () => {
  assert.match(server, /app\.post\('\/api\/ai\/ai-designer-reference'/);
  assert.match(server, /aiImageUpload\.single\('image'\)/);
  assert.match(server, /checkRequest\(req, res, true\)/);
  assert.match(server, /\['image\/png','image\/jpeg','image\/webp'\]/);
  assert.match(server, /refineVisual\(/);
  assert.match(server, /style_inspiration/);
  assert.match(server, /feature_subject/);
  assert.match(imageEngine, /aiLogoProhibition/);
});
test('AI Designer sends one uploaded image by multipart without browser-side binary persistence', () => {
  assert.match(client, /aiImageRequest\('ai-designer-reference',data\)/);
  assert.match(client, /data\.append\('image',referenceFile\)/);
  assert.match(client, /URL\.createObjectURL/);
  assert.match(client, /referenceMetadata/);
  assert.doesNotMatch(client, /localStorage\.setItem\([^\n]*referenceFile/);
  assert.doesNotMatch(client, /OPENAI_API_KEY/);
});
