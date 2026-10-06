import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatPresets, normalizeFormat, fitArtwork, formatPath, recomposeObjects, generationDimensions } from '../src/design-format.js';
import { generateVisual, refineVisual } from '../src/openai-image.mjs';
import { mockPlan, createDesignPlan } from '../src/ai-design-director.mjs';
import { safeImagePrompt } from '../src/ai-plan.mjs';

const file = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
const copy = { headline: 'Match your resume to the role', supportingCopy: 'Match your resume to the role with Upplai.', cta: 'Start today', customDirection: 'Paper documents on a navy background', visualStyle: 'editorial', composition: 'left', subjectType: 'object', brandContext: { aiInstruction: 'Use our brand family.' }, renderMode: 'full-ai-artwork' };
copy.brandContext.colors = { primary: '#50c4f8', secondary: '#2bb7f7', accent: '#e24c8e', dark: '#101d30', light: '#ffffff' };
copy.brandContext.fonts = { heading: 'Inter', body: 'Inter' };
const plan = mockPlan(copy);
const config = { mockMode: false, imageModel: 'gpt-image-test', designModel: 'test-director', size: '1024x1536' };
const pngBuffer = Buffer.alloc(24); pngBuffer.set([137,80,78,71,13,10,26,10]); pngBuffer.write('IHDR',12); pngBuffer.writeUInt32BE(1088,16); pngBuffer.writeUInt32BE(1920,20);
const png = pngBuffer.toString('base64');
const client = calls => ({ images: {
  generate: async input => { calls.push(input); return { data: [{ b64_json: png }] }; },
  edit: async input => { calls.push(input); return { data: [{ b64_json: png }] }; }
}, responses: { create: async () => ({ output_text: JSON.stringify({ backgroundCanvas: 'pass', typographyWithinSafeFrame: true, criticalTextPresent: true }) }) } });

test('all five format presets have the requested dimensions', () => {
  assert.deepEqual(formatPresets.map(({ id, width, height }) => [id, width, height]), [['portrait',1080,1350],['square',1080,1080],['story',1080,1920],['landscape',1920,1080],['linkedin',1200,627]]);
  for (const preset of formatPresets) assert.deepEqual(normalizeFormat(preset.id), preset);
});
test('custom sizes reject zero, negatives, decimals, excessive dimensions and extreme ratios', () => {
  assert.deepEqual(normalizeFormat('custom', '1440', '900'), { id: 'custom', label: 'Custom', width: 1440, height: 900 });
  for (const [w,h] of [[0,1080],[-1,1080],[1080.5,1350],['',1350],[Infinity,1350],[4097,1080],[4096,4096],[320,4000]]) assert.throws(() => normalizeFormat('custom', w, h));
});
test('generation sizes respect supported pixel, edge and aspect constraints', () => {
  for (const target of [...formatPresets, normalizeFormat('custom',320,320),normalizeFormat('custom',4096,2048),normalizeFormat('custom',320,960)]) {
    const [w,h] = generationDimensions(target).split('x').map(Number);
    assert.equal(w%16,0); assert.equal(h%16,0); assert.ok(w<=3840 && h<=3840);
    assert.ok(w*h>=655360 && w*h<=8294400); assert.ok(w/h<=3 && h/w<=3);
  }
});
test('Full AI reformat uses AI; Fit and native/hybrid resize locally', () => {
  assert.equal(formatPath('full-ai-artwork', 'reformat'), 'ai-reformat');
  for (const mode of ['native','visual-native-text','full-ai-artwork']) assert.equal(formatPath(mode, 'fit'), 'native-resize');
  assert.equal(formatPath('visual-native-text','reformat'), 'native-resize');
  assert.equal(formatPath('native','reformat'), 'native-resize');
});
test('native recompose preserves objects, text, image aspect ratio, hierarchy and original input', () => {
  const objects = [{ id:'headline',type:'text',text:copy.headline,x:100,y:300,width:700,height:200 },{ id:'image',type:'image',src:'existing.png',x:100,y:550,width:600,height:400 },{ id:'logo',type:'logo',src:'real-logo.png',x:100,y:50,width:180,height:58 }];
  const before = structuredClone(objects), target = normalizeFormat('linkedin');
  const result = recomposeObjects(objects,{ width:1080,height:1350 },target);
  assert.deepEqual(objects,before); assert.notEqual(result,objects);
  assert.equal(result[0].text,copy.headline); assert.equal(result[1].src,'existing.png'); assert.equal(result[2].src,'real-logo.png');
  assert.equal(result[1].width/result[1].height,1.5);
  for (const node of result) { assert.ok(node.x >= 0 && node.y >= 0); assert.ok(node.x+node.width <= target.width && node.y+node.height <= target.height); }
  assert.ok(result[0].y < result[1].y);
});
test('Fit Original shows the complete flattened 4:5 artwork centered in 9:16', () => {
  assert.deepEqual(fitArtwork({width:1080,height:1350},{width:1080,height:1920}),{x:0,y:285,width:1080,height:1350,scale:1});
});
test('final Full AI reformat request retains approved context and prohibits baked logos regardless of Logo setting', async () => {
  for (const logo of ['on','off']) {
    const calls = [], input = { ...copy, logo }, original = structuredClone(plan);
    const targetCanvas = normalizeFormat('story');
    const output = await generateVisual({config,plan,quality:'draft',copy:input,client:client(calls),fullArtwork:true,targetCanvas});
    assert.deepEqual(plan,original); assert.equal(calls.length,1);
    assert.equal(calls[0].size,'1088x1920'); assert.equal(calls[0].model,config.imageModel); assert.equal(calls[0].quality,'low');
    assert.deepEqual(output.targetCanvas,targetCanvas);
    const prompt = calls[0].prompt;
    for (const value of [copy.headline,copy.supportingCopy,copy.cta,copy.customDirection,plan.visualConcept,'Use our brand family.']) assert.ok(prompt.includes(value));
    assert.match(prompt,/REFORMAT EXISTING APPROVED DESIGN to 1080 x 1920/);
    assert.match(prompt,/Preserve ALL approved wording exactly/);
    assert.doesNotMatch(prompt,/Create a complete flattened 4:5|OPTIONAL supporting copy|OPTIONAL CTA/);
    assert.match(prompt,/DO NOT generate any logo, brand mark, wordmark/);
    assert.match(prompt,/Never imitate, redraw, approximate or invent the Upplai logo/);
    assert.match(prompt,/native logo system/);
  }
});
test('visual generation and both refinement modes receive the shared final logo prohibition', async () => {
  assert.match(safeImagePrompt(plan),/DO NOT generate any logo, brand mark, wordmark/);
  for (const fullArtwork of [false,true]) {
    const calls = [];
    await generateVisual({ config,plan,quality:'draft',copy,client:client(calls),fullArtwork });
    await refineVisual({ config,plan,quality:'draft',copy,client:client(calls),fullArtwork,image:{buffer:Buffer.from(png,'base64'),mimetype:'image/png'},instruction:'Use more blue' });
    for (const request of calls) assert.match(request.prompt,/DO NOT generate any logo, brand mark, wordmark/);
  }
});
test('design director policy preserves normal requested brand-name copy', async () => {
  let request;
  await createDesignPlan({config,input:copy,client:{responses:{create:async value=>{request=value;return {status:'completed',output_text:JSON.stringify(plan)};}}}});
  assert.match(request.instructions,/Preserve legitimate user-requested normal copy/);
  assert.match(request.instructions,/Logo On AND Logo Off/);
});
test('format versions preserve rendered originals and keep the existing editor and Reel handoff', async () => {
  const [ui,app,html,editor,exporter] = await Promise.all(['src/design-reformat.js','public/app.js','public/index.html','src/local-editor.js','src/export.js'].map(file));
  assert.match(ui,/versions\.push\(snapshot\('Original'\)\)/);
  assert.match(ui,/original\.preview\.cloneNode\(true\)/);
  assert.match(ui,/adapter\.restore\(versions\[next\]\)/);
  assert.match(app,/preview\.querySelector\('#preview-logo'\)\.hidden = value\.logo === 'off' \|\| !logoData/);
  assert.match(editor,/\['logo', preview\.querySelector\('#preview-logo'\), 'logo', 'Logo'\]/);
  assert.match(editor,/node\.dataset\.editorResizable = 'true'/);
  assert.match(html,/id="logo"/); assert.match(html,/id="create-reel-from-design"/);
  assert.match(app,/previews: \[preview\]/); assert.match(app,/reel:use-rendered-designs/);
  assert.match(exporter,/canvas\.width = width/); assert.match(exporter,/canvas\.height = height/);
});
