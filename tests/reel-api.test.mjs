import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
process.env.OPENAI_MOCK_MODE = 'true';
const app = createRequire(import.meta.url)('../server.js');

test('Reel browser renderer modules and existing AI endpoints are available', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const name of ['reel-timeline.js','reel-canvas.js','reel-media.js','reel-renderer.js']) {
      const response = await fetch(`${base}/src/${name}`); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /javascript/);
    }
    const request = (path, body) => fetch(base + path, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    for (const creationMode of ['ai-generate','describe-scenes']) {
      const response = await request('/api/reels/plan', {content:'Keep scene one then scene two.',targetDuration:15,creationMode}); assert.equal(response.status,200); assert.ok((await response.json()).plan.scenes.length);
    }
    const visual = await request('/api/reels/visual', {scene:{headline:'Test scene',visualDirection:'Blue abstract visual'}}); assert.equal(visual.status,200); assert.match((await visual.json()).image,/^data:image\//);
    const invalid = await request('/api/reels/visual', {}); assert.equal(invalid.status,400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
