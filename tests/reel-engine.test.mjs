import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReelProject, createScene, totalDuration } from '../src/reel-project.mjs';
import { ReelClock, timelineAt, motions, transitions, textAnimations, normalizeAudio, nativeText, fingerprint, validRender, publishingContext } from '../src/reel-timeline.js';
import { fitMotion, textEffect, createCanvasPainter } from '../src/reel-canvas.js';
import { ReelMedia, desiredAudioTime } from '../src/reel-media.js';
import { renderSize, mp4RecordingType, assertMp4 } from '../src/reel-renderer.js';
import { setupDesignReformat } from '../src/design-reformat.js';

const project = () => ({...createReelProject(),scenes:[4,6,5].map((duration,i)=>createScene({duration,headline:`Scene ${i+1}`}))});
test('timeline follows scene order and exact durations without adding transition time',()=>{
  const p=project(); assert.equal(totalDuration(p),15);
  for(const [time,index,local] of [[0,0,0],[3.99,0,3.99],[4,1,0],[9,1,5],[10,2,0],[15,2,5]]){
    const actual=timelineAt(p,time);assert.equal(actual.index,index);assert.equal(actual.local,local);
  }
  assert.equal(timelineAt(p,100).ended,true); assert.equal(timelineAt(p,-3).time,0);
  for(const transition of transitions){p.scenes[1].transition=transition;assert.ok(timelineAt(p,4.1).transitionDuration<=.45);assert.equal(timelineAt(p,15).total,15);}
});
test('pause freezes time; resume continues; restart resets both playing and paused clocks',()=>{
  let now=0;const clock=new ReelClock(project(),()=>now);clock.play();now=7000;assert.equal(clock.read().time,7);
  clock.pause();now=9000;assert.equal(clock.read().time,7);clock.play();now=11000;assert.equal(clock.read().time,9);
  clock.restart();assert.equal(clock.read().time,0);assert.equal(clock.playing,true);
  clock.pause();clock.restart();assert.equal(clock.playing,false);clock.play();now+=15000;assert.equal(clock.read().time,15);assert.equal(clock.playing,false);
});
test('every motion, text animation and transition survives normalization; invalid values fall back',()=>{
  for(const motion of motions)assert.equal(createScene({motion}).motion,motion);
  for(const textAnimation of textAnimations)assert.equal(createScene({textAnimation}).textAnimation,textAnimation);
  for(const transition of transitions)assert.equal(createScene({transition}).transition,transition);
  const bad=createScene({motion:'bad',textAnimation:'bad',transition:'bad'});assert.equal(bad.motion,'static');assert.equal(bad.textAnimation,'fade');assert.equal(bad.transition,'fade');
});
test('all motion frames preserve aspect and fully contain 4:5, 9:16, square and landscape artwork',()=>{
  for(const [width,height] of [[1080,1350],[1080,1920],[1080,1080],[1920,1080]])for(const motion of motions)for(const progress of [0,.25,.5,.75,1]){
    const box=fitMotion(width,height,progress,motion);assert.ok(box.x>=-.001&&box.y>=-.001);assert.ok(box.x+box.width<=1080.001&&box.y+box.height<=1920.001);assert.ok(Math.abs(box.width/box.height-width/height)<1e-9);
  }
  assert.ok(fitMotion(1080,1920,0,'zoom-in').width<fitMotion(1080,1920,1,'zoom-in').width);
  assert.ok(fitMotion(1080,1920,0,'pan-left').x>fitMotion(1080,1920,1,'pan-left').x);
});
test('text entry interpolates, and flattened artwork never draws duplicate text',()=>{
  assert.equal(textEffect('none',0).alpha,1);assert.equal(textEffect('fade',0).alpha,0);assert.equal(textEffect('fade',1).alpha,1);
  assert.ok(textEffect('slide-left',0).x>textEffect('slide-left',1).x);assert.ok(textEffect('slide-up',0).y>0);assert.ok(textEffect('pop',0).scale<1);assert.equal(textEffect('typewriter',1).characters,45);
  const drawn=[];const ctx=new Proxy({measureText:t=>({width:t.length*10}),fillText:t=>drawn.push(t)}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const canvas=()=>({width:1080,height:1920,getContext:()=>ctx});const old=globalThis.document;globalThis.document={createElement:canvas};
  try{const p=project(),paint=createCanvasPainter(canvas());p.scenes[0].visualType='existing-design';assert.equal(nativeText(p.scenes[0]),false);paint(p,timelineAt(p,1),new Map());assert.deepEqual(drawn,[]);p.scenes[0].visualType='branded-text';paint(p,timelineAt(p,1),new Map());assert.ok(drawn.includes('Scene 1'));for(const transition of transitions){p.scenes[1].transition=transition;paint(p,timelineAt(p,4.2),new Map());}}
  finally{globalThis.document=old;}
});
test('audio references and volumes normalize safely; binary audio is rejected',()=>{
  for(const [value,result] of [[-2,0],[3,1],[.5,.5],[NaN,1],[Infinity,1]])assert.equal(normalizeAudio({volume:value}).volume,result);
  assert.equal(normalizeAudio({mode:'bad',assetRef:'data:audio/wav;base64,xx'}).assetRef,'');
  assert.equal(normalizeAudio({assetRef:'blob:any'}).assetRef,'');
  assert.equal(normalizeAudio({assetRef:'reel-upload:audio',offset:-8}).offset,0);
  const p=project();p.audio=normalizeAudio({mode:'music',assetRef:'reel-upload:audio',filename:'song.wav'});assert.doesNotMatch(JSON.stringify(p),/base64|data:audio|blob:/);
  const source=fs.readFileSync('public/reels.js','utf8');assert.match(source,/saveReelUploadAsset\(file\)/);assert.match(source,/saveReelRenderAsset\(result.blob\)/);assert.match(fs.readFileSync('src/calendar-assets.js','utf8'),/type: 'reel-render', file/);
});
const mediaElement=duration=>({tagName:'AUDIO',duration,currentTime:0,paused:true,ended:false,seeking:false,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}});
test('soundtrack follows timeline play, pause, restart, offset and end without looping or extending',()=>{
  const p=project();p.audio={mode:'music',volume:.5,offset:1,assetRef:'reel-upload:song'};
  const media=new ReelMedia(p),music=mediaElement(8);media.music=music;media.gains=new Map([[music,{gain:{value:0}}]]);
  media.sync(timelineAt(p,2),true);assert.equal(music.currentTime,3);assert.equal(music.paused,false);assert.equal(media.gains.get(music).gain.value,.5);
  media.sync(timelineAt(p,2),false);assert.equal(music.paused,true);media.sync(timelineAt(p,0),true);assert.equal(music.currentTime,1);
  media.sync(timelineAt(p,8),true);assert.equal(music.paused,true);assert.equal(music.currentTime,8);
  media.sync(timelineAt(p,15),true);assert.equal(music.paused,true);assert.equal(totalDuration(p),15);
  assert.deepEqual(desiredAudioTime(timelineAt(p,15),normalizeAudio(),100),{time:15,active:false});
});
test('uploaded video plays only in its scene, pauses outside playback and honors original audio mute',()=>{
  const p=project();p.scenes[0].visualType='uploaded-media';p.scenes[0].visualMediaType='video';p.audio={mode:'original',originalMuted:false,volume:.4};
  const media=new ReelMedia(p),video=mediaElement(3);video.tagName='VIDEO';media.media.set(p.scenes[0].id,video);media.gains=new Map([[video,{gain:{value:0}}]]);
  media.sync(timelineAt(p,1),false);assert.equal(video.paused,true);media.sync(timelineAt(p,1),true);assert.equal(video.paused,false);assert.equal(media.gains.get(video).gain.value,.4);
  media.audio.originalMuted=true;media.sync(timelineAt(p,1.1),true);assert.equal(media.gains.get(video).gain.value,0);
  media.sync(timelineAt(p,3.5),true);assert.equal(video.paused,true);media.sync(timelineAt(p,4.5),true);assert.equal(video.paused,true);
});
test('render is 1080x1920; only a supported H264/AAC MP4 container is accepted',async()=>{
  assert.deepEqual(renderSize,{width:1080,height:1920,frameRate:30});assert.equal(mp4RecordingType({isTypeSupported:()=>false}),'');assert.match(mp4RecordingType({isTypeSupported:t=>t.includes('avc1')}),/^video\/mp4/);
  const header=new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109]);await assertMp4(new Blob([header],{type:'video/mp4'}));
  await assert.rejects(assertMp4(new Blob(['not a movie'],{type:'video/mp4'})));await assert.rejects(assertMp4(new Blob([header],{type:'video/webm'})));
  const source=fs.readFileSync('src/reel-renderer.js','utf8');assert.match(source,/new MediaRecorder\(stream/);assert.match(source,/video.videoWidth !== 1080/);assert.match(source,/video.videoHeight !== 1920/);assert.match(source,/verifyVideo\(blob, total\)/);
});
test('no download before valid completed render; every video edit invalidates output',()=>{
  const p=project();assert.equal(validRender(p),false);p.render={assetRef:'reel-render:mp4',mimeType:'video/mp4',fingerprint:fingerprint(p)};assert.equal(validRender(p),true);
  for(const [field,value] of [['duration',9],['visualAssetRef','reel-upload:new'],['motion','zoom-in'],['textAnimation','pop'],['transition','wipe'],['headline','changed'],['visualType','existing-design'],['background','#fff']]){const next=structuredClone(p);next.scenes[0][field]=value;assert.equal(validRender(next),false);}
  for(const audio of [{mode:'music',assetRef:'reel-upload:song'},{volume:.5},{mode:'original',originalMuted:false}]){const next=structuredClone(p);next.audio=audio;assert.equal(validRender(next),false);}
  const reordered=structuredClone(p);reordered.scenes.reverse();assert.equal(validRender(reordered),false);
  assert.deepEqual(publishingContext(p).scenes.map(s=>s.order),[0,1,2]);assert.equal(publishingContext(p).totalDuration,15);
  const html=fs.readFileSync('public/index.html','utf8');assert.match(html,/id="reel-download"[^>]*disabled/);
});
test('Resize Previous/Next restores independent edited versions with zero generation calls',async()=>{
  const oldDocument=globalThis.document,oldOption=globalThis.Option;
  const element=()=>({value:'',hidden:false,disabled:false,handlers:{},add(){},replaceChildren(){},addEventListener(type,fn){this.handlers[type]=fn},closest(){return {hidden:false}}});
  const elements=Object.fromEntries(['design-format','design-custom-size','design-format-action','design-format-apply','design-format-versions','design-format-previous','design-format-next','design-format-active','design-width','design-height'].map(id=>[id,element()]));
  const preview=()=>({dataset:{},style:{setProperty(){}},querySelectorAll:()=>[],getBoundingClientRect:()=>({width:1080,height:1350}),cloneNode(){const result=preview();result.dataset={...this.dataset};result.edit=this.edit;return result;}});
  let current=preview(),calls=0;current.edit='original';
  const panel={querySelector:selector=>elements[selector.slice(1)]};globalThis.document={querySelector:()=>panel};globalThis.Option=class{constructor(text,value){this.text=text;this.value=value}};
  try{
    const adapter={mode:()=> 'native',preview:()=>current,capture:()=>({preview:current.cloneNode(true)}),restore:version=>{current=version.preview.cloneNode(true)},available:()=>true,status(){},busy(){},reformat(){calls++;throw new Error('Must not generate');}};
    setupDesignReformat(adapter).reset();elements['design-format-action'].value='fit';await elements['design-format-apply'].handlers.click();
    current.edit='reel edit';elements['design-format-previous'].handlers.click();assert.equal(current.edit,'original');current.edit='original edit';
    elements['design-format-next'].handlers.click();assert.equal(current.edit,'reel edit');assert.match(elements['design-format-active'].textContent,/1080 × 1920 · 9:16/);
    elements['design-format-previous'].handlers.click();assert.equal(current.edit,'original edit');assert.equal(calls,0);assert.equal(elements['design-format-previous'].disabled,true);
  }finally{globalThis.document=oldDocument;globalThis.Option=oldOption;}
});
