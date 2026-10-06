import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('Reel browser modules and planning route are wired',()=>{const server=fs.readFileSync('server.js','utf8');const reels=fs.readFileSync('public/reels.js','utf8');assert.match(server,/reel-planner\.mjs/);assert.match(server,/app\.post\('\/api\/reels\/plan'/);assert.match(reels,/fetch\('\/api\/reels\/plan'/);assert.doesNotMatch(reels,/\\\\nimport/);});

test('completed Design and Carousel Create Reel actions use rendered previews', () => {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const app = fs.readFileSync('public/app.js', 'utf8');
  const carousel = fs.readFileSync('public/carousel.js', 'utf8');
  assert.match(html, /id="create-reel-from-design"[^>]*>Create Reel<\/button>/);
  assert.match(app, /createReelFromDesign\.hidden = !fits/);
  assert.match(app, /previews: \[preview\]/);
  assert.match(app, /reel:use-rendered-designs/);
  assert.match(html, /id="carousel-create-reel"[^>]*>Create Reel<\/button>/);
  assert.match(carousel, /draft\.slides\.map\(\(_,index\)=>createCarouselSlide\(draft,index\)\)/);
  assert.match(carousel, /reel:use-rendered-designs/);
});