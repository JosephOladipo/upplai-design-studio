import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planAiDesigner } from '../src/ai-designer-planner.mjs';
import { createCalendarQueue } from '../src/calendar-generation.js';

const plannerConfig = { mockMode: true };
const input = format => ({
  rawCopy: 'Lead with a clear message. Explain the useful detail. End with a practical next step.',
  creativeDirection: 'Bright clean career-tech layout.',
  format,
  textMode: 'native',
  pageCount: format === 'single_image' ? 0 : 3,
  referenceUsage: 'none'
});

test('the shared AI Designer planner returns each Calendar-dispatchable format', async () => {
  const [single, carousel, multiPage] = await Promise.all([
    planAiDesigner({ config: plannerConfig, input: input('single_image') }),
    planAiDesigner({ config: plannerConfig, input: input('carousel') }),
    planAiDesigner({ config: plannerConfig, input: input('multi_page') })
  ]);
  assert.equal(single.format, 'single_image');
  assert.equal(carousel.format, 'carousel');
  assert.equal(multiPage.format, 'multi_page');
  for (const plan of [single, carousel, multiPage]) {
    assert.ok(plan.headline);
    assert.ok(plan.slides.length);
    assert.equal(plan.textMode, 'native');
  }
});

test('AI Designer Calendar queue input keeps the row identity and a completed plan through a render failure and retry', async () => {
  const row = {
    id: 'calendar-ai-designer', order: 0, date: '2026-10-09', headline: 'Source title',
    rawCopy: 'Source copy for the planner.', contentFormat: 'ai_designer', status: 'ready'
  };
  const plan = { format: 'carousel', headline: 'Planned title', slides: [] };
  let attempts = 0;
  const inputs = [];
  const queue = createCalendarQueue(async value => {
    inputs.push(value);
    attempts++;
    if (attempts === 1) {
      const error = new Error('render failed after planning');
      error.aiDesignerPlan = plan;
      throw error;
    }
    return { result: { type: 'carousel' }, plan };
  });

  const failed = await queue.run([row], new Set([row.id]));
  assert.equal(inputs[0].id, row.id);
  assert.equal(inputs[0].rawCopy, row.rawCopy);
  assert.equal(failed.rows[0].id, row.id);
  assert.equal(failed.rows[0].status, 'failed');
  assert.deepEqual(failed.rows[0].aiDesignerPlan, plan);

  const retried = await queue.run(failed.rows, new Set([row.id]));
  assert.equal(retried.rows[0].id, row.id);
  assert.equal(retried.rows[0].status, 'generated');
  assert.equal(retried.results.get(row.id).plan, plan);
});

test('Calendar browser routing calls the shared planner, retains a safe plan, and reuses existing output and publishing paths', () => {
  const client = fs.readFileSync(new URL('../public/calendar-table.js', import.meta.url), 'utf8');
  assert.match(client, /aiRequest\('ai-designer-plan', aiDesignerPlannerInput\(row\)\)/);
  assert.match(client, /retainedAiDesignerPlan/);
  assert.match(client, /generateCalendarDesign\(input\)/);
  assert.match(client, /generateCarouselDesign\(carouselFromAiDesignerPlan\(plan\)\)/);
  assert.match(client, /generateMultiPageDesign\(multiPageFromAiDesignerPlan\(plan\)\)/);
  assert.match(client, /publishingCalendarResult\(row\)/);
  assert.match(client, /AI Designer plan/);
});
