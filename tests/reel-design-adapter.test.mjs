import test from 'node:test';import assert from 'node:assert/strict';
import { designHtmlToReelAsset } from '../src/reel-design-adapter.mjs';
test('finished design and carousel slide flatten through one Reel adapter',async()=>{const preview={cloneNode(){return {}}};let saved;const ref=await designHtmlToReelAsset(preview,{capture:async()=>new Blob(['png'],{type:'image/png'}),save:async(file,id)=>{saved={file,id};return id},FileType:File});assert.match(ref,/^reel-existing:/);assert.equal(saved.file.type,'image/png');assert.equal(preview.cloneNode().constructor,Object);});
