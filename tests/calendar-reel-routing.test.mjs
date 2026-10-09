import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planReel, applyReelPlan } from '../src/reel-planner.mjs';
import { createReelProject, totalDuration } from '../src/reel-project.mjs';
import { createCalendarQueue } from '../src/calendar-generation.js';
import { normalizeStatus } from '../src/calendar.js';

test('the shared Reel planner creates an ordered valid project for Calendar source content', async () => {
  const content = 'Three practical ways to strengthen your resume before your next application.';
  const plan = await planReel({ config: { mockMode: true }, content, targetDuration: 30, style: 'educational' });
  const project = applyReelPlan(
    createReelProject({ title: 'Calendar Reel', sourceText: content, creationMode: 'ai-generate' }),
    plan,
    { content, style: 'educational' }
  );
  project.calendar = { rowId: 'calendar-reel-1', source: 'calendar', creativeDirection: 'Bright and clear', audioMode: 'none' };
  assert.equal(project.calendar.rowId, 'calendar-reel-1');
  assert.equal(project.scenes.length, plan.scenes.length);
  assert.deepEqual(project.scenes.map(scene => scene.headline), plan.scenes.map(scene => scene.headline));
  assert.equal(totalDuration(project), plan.scenes.reduce((sum, scene) => sum + scene.duration, 0));
});

test('a Reel Calendar queue result becomes Reel Ready without changing its Calendar identity', async () => {
  const row = { id: 'calendar-reel-1', order: 0, date: '2026-10-09', headline: 'Calendar Reel', rawCopy: 'Useful Reel script', contentFormat: 'reel', status: 'ready' };
  const queue = createCalendarQueue(async value => {
    assert.equal(value.id, row.id);
    assert.equal(value.contentFormat, 'reel');
    return { calendarStatus: 'reel-ready', skipResultPersistence: true, reelProjectId: 'reel-calendar-1', reelProject: { id: 'reel-calendar-1', scenes: [{ id: 'scene-1' }] } };
  });
  const result = await queue.run([row], new Set([row.id]));
  assert.equal(result.rows[0].id, row.id);
  assert.equal(result.rows[0].status, 'reel-ready');
  assert.equal(normalizeStatus(result.rows[0].status), 'reel-ready');
  assert.equal(result.results.get(row.id).reelProjectId, 'reel-calendar-1');
});

test('Reel Calendar browser routing reuses the existing planner, project handoff, renderer, and Calendar identity', () => {
  const calendar = fs.readFileSync(new URL('../public/calendar-table.js', import.meta.url), 'utf8');
  const reels = fs.readFileSync(new URL('../public/reels.js', import.meta.url), 'utf8');
  assert.match(calendar, /fetch\('\/api\/reels\/plan'/);
  assert.match(calendar, /reel:use-calendar-project/);
  assert.match(calendar, /calendarStatus: 'reel-ready'/);
  assert.match(calendar, /reel:open-calendar-project/);
  assert.match(calendar, /reel:rendered/);
  assert.match(calendar, /reelProjectId/);
  assert.match(reels, /applyReelPlan\(project,plan/);
  assert.match(reels, /project\.calendar=\{rowId/);
  assert.match(reels, /reel:rendered/);
  assert.match(reels, /reel:open-calendar-project/);
});

test('planning failures stay retryable and retain the same Calendar row', async () => {
  const row = { id: 'calendar-reel-failure', order: 0, date: '2026-10-09', headline: 'Broken Reel', contentFormat: 'reel', status: 'ready' };
  let attempts = 0;
  const queue = createCalendarQueue(async () => {
    attempts++;
    if (attempts === 1) throw new Error('Reel planning failed');
    return { calendarStatus: 'reel-ready', reelProjectId: 'reel-recovered', reelProject: { id: 'reel-recovered', scenes: [{ id: 'scene-1' }] } };
  });
  const failed = await queue.run([row], new Set([row.id]));
  assert.equal(failed.rows[0].id, row.id);
  assert.equal(failed.rows[0].status, 'failed');
  const retried = await queue.run(failed.rows, new Set([row.id]));
  assert.equal(retried.rows[0].id, row.id);
  assert.equal(retried.rows[0].status, 'reel-ready');
  assert.equal(attempts, 2);
});
