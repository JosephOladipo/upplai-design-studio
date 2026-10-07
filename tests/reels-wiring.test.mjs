import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('Reel browser modules and planning route are wired',()=>{const server=fs.readFileSync('server.js','utf8');const reels=fs.readFileSync('public/reels.js','utf8');assert.match(server,/reel-planner\.mjs/);assert.match(server,/app\.post\('\/api\/reels\/plan'/);assert.match(reels,/fetch\('\/api\/reels\/plan'/);assert.doesNotMatch(reels,/\\\\nimport/);});

test('every Reel element queried by browser initialization exists in Reel markup', () => {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const reels = fs.readFileSync('public/reels.js', 'utf8');
  const queriedIds = [...new Set([...reels.matchAll(/q\('([^']+)'\)/g)].map(match => match[1]))];
  const markupIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  assert.deepEqual(queriedIds.filter(id => !markupIds.has(id)), []);
});

test('Reel initialization retains and conditionally binds the Add Scene control', () => {
  const reels = fs.readFileSync('public/reels.js', 'utf8');
  const helper = reels.match(/const q=.*\nconst bind=.*;/)?.[0];
  assert.ok(helper);
  const makeBinder = document => new Function('document', `${helper};return bind;`)(document);
  const missingControl = makeBinder({ getElementById: () => null });
  assert.doesNotThrow(() => missingControl('reel-add', 'onclick', () => {}));
  const element = {};
  const existingControl = makeBinder({ getElementById: id => id === 'reel-add' ? element : null });
  existingControl('reel-add', 'onclick', () => {});
  assert.equal(typeof element.onclick, 'function');
  assert.match(reels, /scene\.append\(q\('reel-add'\),q\('reel-scenes'\)\)/);
  assert.match(reels, /bind\('reel-add','onclick',\(\)=>\{/);
});

test('Reel workspace keeps setup, preview, selected scene, timeline, audio, and generation wiring', () => {
  const reels = fs.readFileSync('public/reels.js', 'utf8');
  const css = fs.readFileSync('public/styles.css', 'utf8');
  assert.match(reels, /reel-setup-card/);
  assert.match(reels, /workspace\.append\(setup,preview,selected,scene\)/);
  assert.match(reels, /setup\.append\(audioCard\)/);
  assert.match(css, /grid-template-columns:360px minmax\(460px,1fr\) 320px/);
  assert.match(css, /\.reel-preview-card\{grid-column:2/);
  assert.match(css, /\.reel-selected-card\{grid-column:3/);
  assert.match(css, /\.reel-scenes-card\{grid-column:1\/-1/);
  assert.match(reels, /content=q\('reel-ai-content'\)\.value\.trim\(\);if\(!content\)\{status\.textContent='Add a Reel topic or content before generating scenes\.';return;\}/);
  assert.match(reels, /fetch\('\/api\/reels\/plan'/);
});

test('completed Design and Carousel Create Reel actions use rendered previews', () => {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const app = fs.readFileSync('public/app.js', 'utf8');
  const carousel = fs.readFileSync('public/carousel.js', 'utf8');
  assert.match(html, /id="create-reel-from-design"[^>]*>Create Reel<\/button>/);
  assert.match(app, /createReelFromDesign\.hidden = !fits/);
  assert.match(app, /previews: \[currentPreview\]/);
  assert.match(app, /reel:use-rendered-designs/);
  assert.match(html, /id="carousel-create-reel"[^>]*>Create Reel<\/button>/);
  assert.match(carousel, /draft\.slides\.map\(\(_,index\)=>createCarouselSlide\(draft,index\)\)/);
  assert.match(carousel, /reel:use-rendered-designs/);
});

test('Create Reel hands off the currently visible format version and waits for Reel persistence', () => {
  const app = fs.readFileSync('public/app.js', 'utf8');
  const reels = fs.readFileSync('public/reels.js', 'utf8');
  assert.match(app, /createReelFromDesign\.addEventListener\('click', async/);
  assert.match(app, /const currentPreview = cleanEditedPreview\(preview\)/);
  assert.match(app, /const dimensions = canvasDimensions\(preview\)/);
  assert.match(app, /setCanvasDimensions\(currentPreview, dimensions\)/);
  assert.match(app, /await import\('\/reels\.js'\)/);
  assert.match(app, /completion: \{ resolve, reject \}/);
  assert.doesNotMatch(app.slice(app.indexOf("createReelFromDesign.addEventListener('click'")), /previews: \[preview\]/);
  assert.match(reels, /currentPreviews=previews\.map\(preview=>preview\?\.cloneNode\?\.\(true\)\)/);
  assert.match(reels, /const scenes=await renderedDesignsToReelScenes\(currentPreviews\)/);
  assert.match(reels, /save\(\);render\(\);\s*detail\.completion\?\.resolve/s);
  assert.match(reels, /document\.dispatchEvent\(new Event\('navigate:reels'\)\)/);
});
