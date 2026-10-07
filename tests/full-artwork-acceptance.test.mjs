import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateVisual } from '../src/openai-image.mjs';
import { normalizeArtworkAssessment, proportionalSafeFrame } from '../src/full-artwork-validation.mjs';
import { calendarSingleImageInput } from '../src/calendar-generation.js';
import { importCalendarCsv } from '../src/calendar.js';

const png = () => { const value = Buffer.alloc(24); value.set([137,80,78,71,13,10,26,10]); value.write('IHDR', 12); value.writeUInt32BE(1024, 16); value.writeUInt32BE(1536, 20); return value.toString('base64'); };
const config = { mockMode: false, designModel: 'test-vision', imageModel: 'gpt-image-test', size: '1024x1536', quality: 'low' };
const plan = { imagePrompt: 'A social post', imageStyle: 'editorial', subjectPlacement: 'right' };
const assessment = value => ({ output_text: JSON.stringify(value) });

function clientWith(assessments) {
  const calls = { images: [], assessments: [] };
  return { calls, client: { images: { generate: async value => { calls.images.push(value); return { data: [{ b64_json: png() }] }; } }, responses: { create: async value => { calls.assessments.push(value); return assessment(assessments.shift()); } } } };
}

test('Full AI safe frame scales from the 1080 by 1350 target', () => {
  assert.deepEqual(proportionalSafeFrame(1080, 1350), { top: 80, bottom: 80, left: 75, right: 75 });
  assert.deepEqual(proportionalSafeFrame(540, 675), { top: 40, bottom: 40, left: 38, right: 38 });
});

test('strict bright canvas policy keeps a failed background diagnostic visible', () => {
  const result = normalizeArtworkAssessment({ backgroundCanvas: 'fail', typographyWithinSafeFrame: true, criticalTextPresent: true }, 'custom');
  assert.equal(result.accepted, true);
  assert.equal(result.backgroundAccepted, false);
});

test('default Full AI accepts a background diagnostic failure when critical typography is safe', async () => {
  const { client, calls } = clientWith([{ backgroundCanvas: 'fail', typographyWithinSafeFrame: true, criticalTextPresent: true }]);
  const result = await generateVisual({ config, plan, quality: 'draft', client, fullArtwork: true, copy: { headline: 'Headline' } });
  assert.equal(result.artworkAttempts, 1);
  assert.equal(calls.images.length, 1);
  assert.equal(result.artworkAcceptance.backgroundDiagnostic, 'fail');
  assert.equal(result.artworkAcceptance.safeAreaAccepted, true);
});

test('default Full AI validates the returned PNG and performs one corrective retry', async () => {
  const { client, calls } = clientWith([{ backgroundCanvas: 'fail', typographyWithinSafeFrame: false, criticalTextPresent: true }, { backgroundCanvas: 'pass', typographyWithinSafeFrame: true, criticalTextPresent: true }]);
  const result = await generateVisual({ config, plan, quality: 'draft', client, fullArtwork: true, copy: { headline: 'Headline' } });
  assert.equal(result.artworkAttempts, 2);
  assert.equal(calls.images.length, 2);
  assert.equal(calls.assessments.length, 2);
  assert.match(calls.images[1].prompt, /CORRECTIVE REGENERATION/);
  assert.match(calls.images[0].prompt, /ESSENTIAL HEADLINE/);
  assert.match(calls.assessments[0].instructions, /Supporting copy and CTA are optional/);
  assert.equal(calls.images[0].background, 'transparent');
});

test('Full AI keeps the essential headline gate while excluding optional copy from the vision gate', async () => {
  const { client, calls } = clientWith([{ backgroundCanvas: 'pass', typographyWithinSafeFrame: false, criticalTextPresent: true }, { backgroundCanvas: 'pass', typographyWithinSafeFrame: true, criticalTextPresent: true }]);
  const result = await generateVisual({ config, plan, quality: 'draft', client, fullArtwork: true, copy: { headline: 'Essential message', supportingCopy: 'Optional supporting explanation that may be omitted.', cta: 'Optional CTA' } });
  assert.equal(result.artworkAttempts, 2);
  assert.match(calls.assessments[0].instructions, /essential headline is "Essential message"/);
  assert.match(calls.assessments[0].instructions, /Do not mark either typography field false because optional copy or a CTA is absent/);
  assert.match(calls.images[1].prompt, /Supporting copy and CTA are optional/);
});

test('Full AI returns the corrective generated artwork when vision still cannot verify typography', async () => {
  const { client, calls } = clientWith([{ backgroundCanvas: 'fail', typographyWithinSafeFrame: false, criticalTextPresent: true }, { backgroundCanvas: 'fail', typographyWithinSafeFrame: false, criticalTextPresent: true }]);
  const result = await generateVisual({ config, plan, quality: 'draft', client, fullArtwork: true, copy: { headline: 'Headline' } });
  assert.match(result.image, /^data:image\/png;base64,/);
  assert.equal(result.artworkAttempts, 2);
  assert.equal(result.artworkValidatorFallback, true);
  assert.equal(result.artworkAcceptance.safeAreaAccepted, false);
  assert.equal(calls.images.length, 2);
  assert.equal(calls.assessments.length, 2);
});

test('a missing headline diagnosis after correction is retained as a diagnostic fallback', async () => {
  const { client, calls } = clientWith([{ backgroundCanvas: 'pass', typographyWithinSafeFrame: true, criticalTextPresent: false }, { backgroundCanvas: 'pass', typographyWithinSafeFrame: true, criticalTextPresent: false }]);
  const result = await generateVisual({ config, plan, quality: 'draft', client, fullArtwork: true, copy: { headline: 'Headline' } });
  assert.equal(result.artworkValidatorFallback, true);
  assert.equal(result.artworkAcceptance.safeAreaAccepted, false);
  assert.equal(calls.images.length, 2);
  assert.equal(calls.assessments.length, 2);
});

test('genuine image API and malformed image failures still reject Full AI generation', async () => {
  const apiFailure = { images: { generate: async () => { throw new Error('image API unavailable'); } }, responses: { create: async () => assessment({ backgroundCanvas: 'pass', typographyWithinSafeFrame: true, criticalTextPresent: true }) } };
  await assert.rejects(() => generateVisual({ config, plan, quality: 'draft', client: apiFailure, fullArtwork: true, copy: { headline: 'Headline' } }), /image API unavailable/);
  const malformed = { images: { generate: async () => ({ data: [{ b64_json: 'not-a-png' }] }) }, responses: { create: async () => assessment({ backgroundCanvas: 'pass', typographyWithinSafeFrame: true, criticalTextPresent: true }) } };
  await assert.rejects(() => generateVisual({ config, plan, quality: 'draft', client: malformed, fullArtwork: true, copy: { headline: 'Headline' } }), /malformed PNG data/);
});

test('Calendar single-image normalization retains Full AI mode and prompt for review regeneration', () => {
  const value = calendarSingleImageInput({ headline: 'Calendar post', style: 'openai-style', ai: { renderMode: 'full-ai-artwork', designPrompt: 'Pure white canvas', visualStyle: 'editorial', subjectType: 'none', composition: 'left', direction: '', quality: 'draft' } });
  assert.equal(value.aiRenderMode, 'full-ai-artwork');
  assert.equal(value.aiDesignPrompt, 'Pure white canvas');
});

test('Calendar CSV template exposes Full AI columns and importer retains their values', async () => {
  const source = await readFile(new URL('../public/calendar.js', import.meta.url), 'utf8');
  assert.match(source, /'Render Mode'/);
  assert.match(source, /'Design Prompt'/);
  const result = importCalendarCsv(`Date,Headline,Design Method,Render Mode,Design Prompt\n2026-10-03,Calendar Full AI,OpenAI Style,full-ai-artwork,Pure white canvas`);
  assert.equal(result.rows[0].ai.renderMode, 'full-ai-artwork');
  assert.equal(result.rows[0].ai.designPrompt, 'Pure white canvas');
});
