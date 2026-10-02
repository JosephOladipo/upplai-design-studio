import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refineVisual } from '../src/openai-image.mjs';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');
const mockConfig = { mockMode: true, imageModel: 'gpt-image-2.5-flare', size: '1024x1536', quality: 'low' };
const plan = { imageStyle: 'editorial', subjectPlacement: 'right', imagePrompt: 'visual' };

test('refinement uses the supported OpenAI Images edit API with a reference image in live mode', async () => {
  const image = await source('../src/openai-image.mjs');
  assert.match(image, /client\.images\.edit/);
  assert.doesNotMatch(image, /input_fidelity/);
  assert.match(image, /artworkInstructions\(copy\.customDirection\)/);
  assert.match(image, /background: backgroundPolicy === 'white'/);
  assert.match(image, /Do not add text, logos, or watermarks/);
});

test('mock refinement produces a visual without an OpenAI request', async () => {
  const result = await refineVisual({ config: mockConfig, plan, quality: 'draft', instruction: 'Move the subject right.', image: { buffer: Buffer.from('safe'), mimetype: 'image/png' } });
  assert.match(result.image, /^data:image\/svg\+xml;base64,/);
});

test('AI iteration UI and version history are rendered only after an AI visual exists', async () => {
  const [app, style] = await Promise.all([source('../public/app.js'), source('../src/ai-style.js')]);
  assert.match(style, /id="ai-refine-current"/);
  assert.match(style, /id="ai-try-another-version"/);
  assert.match(style, /id="ai-generation-history"/);
  assert.match(app, /aiIteration\.hidden = !ai \|\| !aiDesign/);
  assert.match(app, /recordAIVersion\(aiDesign/);
  assert.match(app, /restoreAIVersion/);
});

test('refinement preserves the prior visual on failure and only runs from its explicit action', async () => {
  const app = await source('../public/app.js');
  assert.match(app, /async function refineCurrentAI/);
  assert.match(app, /aiImageRequest\('refine-visual', data\)/);
  assert.match(app, /aiDesign = previous;/);
  assert.match(app, /aiRefineCurrent\.addEventListener\('click', refineCurrentAI\)/);
});

test('server exposes safe image engine information and accepts only multipart reference-image refinement', async () => {
  const server = await source('../server.js');
  assert.match(server, /imageEngine: 'OpenAI Images API'/);
  assert.match(server, /app\.post\('\/api\/ai\/refine-visual'/);
  assert.match(server, /aiImageUpload\.single\('image'\)/);
  assert.match(server, /req\.is\('multipart\/form-data'\)/);
  assert.doesNotMatch(server, /OPENAI_API_KEY[^\n]*res\.json/);
});
