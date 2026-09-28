import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCarouselContent, normalizeCarouselContentInput } from '../src/carousel-content.mjs';

const config = { mockMode: true, apiKey: '' };
for (const count of [3, 5, 7, 10]) test(`Mock carousel content returns a coherent ${count}-slide role sequence without network access`, async () => {
  const result = await generateCarouselContent({ config, input: { topic: '5 resume mistakes recruiters notice', slideCount: count, goal: 'tips', direction: 'Keep it concise.' } });
  assert.equal(result.slides.length, count);
  assert.equal(result.slides[0].role, 'cover');
  assert.equal(result.slides.at(-1).role, 'cta');
  assert.ok(result.slides.every(slide => slide.headline.length <= 180 && slide.body.length <= 700));
  assert.doesNotMatch(JSON.stringify(result), /\b\d+%|study|guarantee/i);
});

test('carousel content input preserves goal and direction while validating count', () => {
  const input = normalizeCarouselContentInput({ topic: 'Source draft', slideCount: 7, goal: 'thought-leadership', direction: 'Target founders.' });
  assert.equal(input.slideCount, 7);
  assert.equal(input.goal, 'thought-leadership');
  assert.equal(input.direction, 'Target founders.');
  assert.deepEqual(input.roles, ['cover', 'context', 'insight', 'list', 'stat', 'conclusion', 'cta']);
});

test('carousel generation rejects a missing topic before an AI request', async () => {
  await assert.rejects(() => generateCarouselContent({ config, input: { topic: '', slideCount: 5 } }), /topic/i);
});
