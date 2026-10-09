import test from 'node:test';
import assert from 'node:assert/strict';
import { planAiDesigner } from '../src/ai-designer-planner.mjs';
test('long raw copy is compressed before a single-image handoff', async () => {
  const plan = await planAiDesigner({ config:{mockMode:true}, input:{rawCopy:'A '.repeat(1200),format:'single_image',textMode:'native',rewriteStrength:'strong'} });
  assert.equal(plan.format,'single_image'); assert.ok(plan.headline.length <= 100); assert.ok(plan.body.length <= 260); assert.equal(plan.fitStrategy,'compress');
});
test('auto selects multi-page for dense content and retains reference intent safely', async () => {
  const plan = await planAiDesigner({ config:{mockMode:true}, input:{rawCopy:Array.from({length:9},(_,i)=>`Point ${i}.`).join(' '),format:'auto',hasReferenceImage:true,referenceUsage:'style_inspiration'} });
  assert.equal(plan.format,'multi_page'); assert.equal(plan.usedReferenceImage,true); assert.equal(plan.referenceUsage,'style_inspiration');
});
