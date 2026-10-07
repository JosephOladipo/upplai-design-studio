import { saveReelVisualAsset, saveReelUploadAsset, loadReelUploadAsset, saveReelRenderAsset, loadReelRenderAsset, removeCalendarAsset } from '/src/calendar-assets.js';
import {createReelProject,addScene,duplicateScene,deleteScene,moveScene,totalDuration,clampDuration,createScene} from '/src/reel-project.mjs';
import { applyReelPlan } from '/src/reel-planner.mjs';
import { ReelClock, timelineAt, timeLabel, normalizeAudio, fingerprint, validRender } from '/src/reel-timeline.js';
import { createCanvasPainter } from '/src/reel-canvas.js';
import { ReelMedia } from '/src/reel-media.js';
import { renderReel, mp4RecordingType } from '/src/reel-renderer.js';
import { handoffToPublishing } from '/src/publishing-handoff.mjs';
const q=id=>document.getElementById(id), key='upplai-reel-project';
const bind=(id,property,handler)=>{const element=q(id);if(element)element[property]=handler;return element;};
function organizeReelWorkspace() {
  const panel=q('section-reels').querySelector('.panel');
  if (panel.dataset.reelWorkspace) return;
  panel.dataset.reelWorkspace='true';
  const header=document.createElement('header');header.className='reel-project-header';
  const title=document.createElement('div');const heading=panel.querySelector('h1');
  const summary=q('reel-project-summary');title.append(heading,summary);header.append(title);
  const create=document.createElement('section');create.className='reel-card reel-create-card';create.innerHTML='<h2>Create Reel</h2>';
  const generator=q('reel-creation-mode').closest('section');
  [q('reel-title').closest('label'),q('reel-create')].forEach(node=>create.append(node));
  const setup=document.createElement('section');setup.className='reel-card reel-setup-card';setup.innerHTML='<h2>Build your Reel</h2>';
  setup.append(q('reel-source').closest('label'),generator);
  const workspace=document.createElement('section');workspace.className='reel-workspace';
  const preview=document.createElement('section');preview.className='reel-card reel-preview-card';preview.innerHTML='<h2>Preview</h2>';
  [q('reel-preview'),q('reel-total'),q('reel-play').parentElement].forEach(node=>preview.append(node));
  const scene=document.createElement('section');scene.className='reel-card reel-scenes-card';scene.innerHTML='<div class="reel-card-heading"><h2>Scenes</h2></div>';
  scene.append(q('reel-add'),q('reel-scenes'));
  const selected=document.createElement('section');selected.className='reel-card reel-selected-card';selected.innerHTML='<h2>Selected Scene</h2>';selected.append(q('reel-controls'));
  const audioCard=q('reel-audio-mode').closest('section');audioCard.classList.add('reel-card');audioCard.querySelector('h2').textContent='Audio';
  q('reel-audio-upload-trigger').textContent='Choose Audio File';
  q('reel-audio-volume').closest('label').firstChild.nodeValue='Music Volume';
  const exportCard=q('reel-render').closest('section');exportCard.classList.add('reel-card');exportCard.querySelector('h2').textContent='Export';
  setup.append(audioCard);workspace.append(setup,preview,selected,scene);
  panel.replaceChildren(header,create,workspace,exportCard);
}
organizeReelWorkspace();
let project, selected=0, frame, previewMedia, mediaSignature='', mediaEpoch=0, ready=false, playbackStarted=false;
let renderAbort, renderingSignature='', completedUrl='', completedRef='', soundtrackUrl='', soundtrackRef='';
try {
  project=JSON.parse(localStorage.getItem(key));
  if (!Array.isArray(project?.scenes)) project=null;
  else project.scenes=project.scenes.map(s=>({...createScene(s),id:s.id||createScene().id,
    visualAssetRef:typeof s.visualAssetRef==='string'&&!/^(data:|blob:)/.test(s.visualAssetRef)?s.visualAssetRef:'',
    imageRef:typeof s.imageRef==='string'&&/^(https?:\/\/|\/)/.test(s.imageRef)?s.imageRef:''}));
} catch {}
project ||= createReelProject(); project.audio=normalizeAudio(project.audio);
let clock=new ReelClock(project);
const paint=createCanvasPainter(q('reel-canvas'));
const sceneStart=index=>project.scenes.slice(0,index).reduce((sum,s)=>sum+clampDuration(s.duration),0);
function clearCompleted() {
  q('reel-download').disabled=true;q('reel-send-publishing').disabled=true; q('reel-rendered-video').pause();
  q('reel-rendered-video').removeAttribute('src'); q('reel-rendered-video').load(); q('reel-rendered-video').hidden=true;
  if(completedUrl)URL.revokeObjectURL(completedUrl); completedUrl='';completedRef='';q('reel-render-metadata').textContent='';
}
function save(){
  project.audio=normalizeAudio(project.audio); project.updatedAt=new Date().toISOString();
  if(renderAbort&&fingerprint(project)!==renderingSignature)renderAbort.abort();
  if(project.render&&!validRender(project)){clearCompleted();q('reel-render-status').textContent='Your Reel changed. Render again to update the video.';}
  localStorage.setItem(key,JSON.stringify(project));
}
async function restoreCompleted(){
  if(!validRender(project)){if(completedRef)clearCompleted();return;}
  if(completedRef===project.render.assetRef)return;
  const ref=project.render.assetRef, signature=fingerprint(project);
  const blob=await loadReelRenderAsset(ref);
  if(signature!==fingerprint(project)||!validRender(project))return;
  if(!blob?.size||blob.type!=='video/mp4'){clearCompleted();q('reel-render-status').textContent='Saved MP4 is missing. Render again.';return;}
  clearCompleted();completedRef=ref;completedUrl=URL.createObjectURL(blob);
  const video=q('reel-rendered-video'); video.src=completedUrl;video.hidden=false;
  video.onloadedmetadata=()=>{q('reel-render-metadata').textContent=`MP4 · ${video.videoWidth} × ${video.videoHeight} · ${video.duration.toFixed(2)} seconds`;};
  video.onerror=()=>{clearCompleted();q('reel-render-status').textContent='Saved MP4 could not be played. Render again.';};
  q('reel-download').disabled=false;q('reel-send-publishing').disabled=false;
}
async function soundtrackUI(){
  const audio=project.audio, element=q('reel-music-preview');
  q('reel-audio-mode').value=audio.mode;q('reel-audio-volume').value=audio.volume;q('reel-audio-offset').value=audio.offset;q('reel-original-muted').checked=audio.originalMuted;
  q('reel-audio-filename').textContent=audio.filename||'No uploaded music';
  q('reel-audio-remove').hidden=!audio.assetRef; q('reel-original-muted').closest('label').hidden=audio.mode!=='original';
  q('reel-audio-offset').closest('label').hidden=audio.mode!=='music';
  q('reel-audio-upload-trigger').hidden=audio.mode!=='music';
  element.volume=audio.volume; element.hidden=!audio.assetRef||audio.mode!=='music';
  if(audio.assetRef!==soundtrackRef){
    element.pause();element.removeAttribute('src');element.load();if(soundtrackUrl)URL.revokeObjectURL(soundtrackUrl);
    soundtrackRef=audio.assetRef;soundtrackUrl='';
    if(audio.assetRef){const file=await loadReelUploadAsset(audio.assetRef);if(soundtrackRef!==audio.assetRef)return;if(file){soundtrackUrl=URL.createObjectURL(file);element.src=soundtrackUrl;}else q('reel-audio-status').textContent='Saved soundtrack is missing; upload it again.';}
  }
}
function tick(){
  const position=clock.read();
  if(ready){previewMedia.sync(position,clock.playing);paint(project,!playbackStarted?{...position,local:Math.min(.8,position.duration||0)}:position,previewMedia.media);}
  q('reel-clock').textContent=`${timeLabel(position.time)} / ${timeLabel(position.total)}`;
  q('reel-progress').max=position.total||1;q('reel-progress').value=position.time;
  q('reel-preview').dataset.scene=String(position.index+1);q('reel-preview').dataset.playing=String(clock.playing);
  q('reel-preview').dataset.audioTime=String(previewMedia?.music?.currentTime||0);q('reel-preview').dataset.audioPaused=String(previewMedia?.music?.paused??true);
  q('reel-play').textContent=clock.playing?'Playing':playbackStarted&&position.time>0&&!position.ended?'Resume':'Play';
  q('reel-scenes').querySelectorAll('.reel-scene').forEach((row,index)=>row.classList.toggle('is-playing',clock.playing&&index===position.index));
  if(previewMedia?.failures.length){clock.pause();cancelAnimationFrame(frame);previewMedia.pause();q('reel-playback-status').textContent='Media playback was blocked. Preview the upload and try Play again.';return;}
  if(clock.playing)frame=requestAnimationFrame(tick);else previewMedia?.pause();
}
function pause(){clock.pause();cancelAnimationFrame(frame);previewMedia?.pause();q('reel-music-preview').pause();tick();}
async function preparePreview(){
  const signature=fingerprint(project);if(signature===mediaSignature){tick();return;}
  mediaSignature=signature;const epoch=++mediaEpoch;ready=false;q('reel-play').disabled=true;previewMedia?.dispose();
  const next=new ReelMedia(structuredClone(project));previewMedia=next;
  q('reel-playback-status').textContent=project.scenes.length?'Loading scene media…':'';
  try {await next.load();if(epoch!==mediaEpoch){next.dispose();return;}ready=true;q('reel-play').disabled=!project.scenes.length;q('reel-playback-status').textContent='';tick();}
  catch(error){if(epoch===mediaEpoch){q('reel-playback-status').textContent=error.message;q('reel-play').disabled=true;}}
}
function render(){
  clock.pause();cancelAnimationFrame(frame);previewMedia?.pause();playbackStarted=false;clock=new ReelClock(project);clock.seek(sceneStart(selected));
  q('reel-title').value=project.title;q('reel-total').textContent=`${totalDuration(project)} seconds`;
  q('reel-project-summary').textContent=`${project.scenes.length} ${project.scenes.length===1?'Scene':'Scenes'} • ${totalDuration(project)} sec • 9:16${validRender(project)?' • Reel ready':''}`;
  const s=project.scenes[selected];q('reel-controls').hidden=!s;
  q('reel-scenes').replaceChildren(...project.scenes.map((x,i)=>{
    const row=document.createElement('div');row.className='reel-scene';row.classList.toggle('is-selected',selected===i);
    row.innerHTML=`<button class="reel-scene-select" type="button" aria-label="Select scene ${i+1}">${i+1} · ${x.duration}s</button><span class="reel-scene-actions"><button type="button" title="Move left" aria-label="Move scene ${i+1} left">←</button><button type="button" title="Move right" aria-label="Move scene ${i+1} right">→</button><button type="button" title="Duplicate" aria-label="Duplicate scene ${i+1}">⧉</button><button type="button" title="Delete" aria-label="Delete scene ${i+1}">×</button></span>`;
    const bs=row.querySelectorAll('button');bs[0].onclick=()=>{pause();selected=i;render()};
    bs[1].onclick=()=>{project=moveScene(project,i,-1);selected=Math.max(0,i-1);save();render()};
    bs[2].onclick=()=>{project=moveScene(project,i,1);selected=Math.min(project.scenes.length-1,i+1);save();render()};
    bs[3].onclick=()=>{project=duplicateScene(project,i);selected=i+1;save();render()};
    bs[4].onclick=()=>{project=deleteScene(project,i);selected=Math.max(0,Math.min(selected,project.scenes.length-1));save();render()};
    bs[1].disabled=i===0;bs[2].disabled=i===project.scenes.length-1;return row;
  }));
  if(s){
    for(const [id,field] of [['reel-headline','headline'],['reel-body','bodyText'],['reel-duration','duration'],['reel-transition','transition'],['reel-motion','motion'],['reel-text-animation','textAnimation'],['reel-visual-type','visualType'],['reel-visual-direction','visualDirection'],['reel-background','background']])q(id).value=s[field]||'';
    q('reel-headline').closest('label').hidden=q('reel-body').closest('label').hidden=q('reel-text-animation').closest('label').hidden=s.visualType==='existing-design';
    q('reel-generate-visual').hidden=s.visualType!=='ai-visual';q('reel-generate-visual').textContent=s.visualAssetRef?'Regenerate Visual':'Generate Visual';q('reel-upload-trigger').hidden=s.visualType!=='uploaded-media';
  }
  tick();preparePreview();soundtrackUI().catch(error=>q('reel-audio-status').textContent=error.message);restoreCompleted().catch(error=>q('reel-render-status').textContent=error.message);
  q('reel-render').disabled=Boolean(renderAbort)||!project.scenes.length;
  if(!project.render&&!renderAbort&&!q('reel-render-status').textContent)q('reel-render-status').textContent='Ready to render.';
}
function update(){const s=project.scenes[selected];if(!s)return;for(const [id,field] of [['reel-headline','headline'],['reel-body','bodyText'],['reel-transition','transition'],['reel-motion','motion'],['reel-text-animation','textAnimation'],['reel-visual-direction','visualDirection'],['reel-visual-type','visualType'],['reel-background','background']])s[field]=q(id).value;s.duration=clampDuration(q('reel-duration').value);save();render();}
q('reel-create').onclick=()=>{pause();project=createReelProject({title:q('reel-title').value,sourceText:q('reel-source').value,creationMode:q('reel-creation-mode').value});project.audio=normalizeAudio();selected=0;save();clearCompleted();render();};
q('reel-title').onchange=()=>{project.title=q('reel-title').value||'Untitled Reel';save();};
q('reel-source').onchange=()=>{project.sourceText=q('reel-source').value;save();};
bind('reel-add','onclick',()=>{pause();project=addScene(project);selected=project.scenes.length-1;save();render();});
['reel-headline','reel-body','reel-duration','reel-transition','reel-visual-direction','reel-visual-type','reel-background'].forEach(id=>q(id).onchange=update);
for(const [id,field] of [['reel-headline','headline'],['reel-body','bodyText'],['reel-duration','duration'],['reel-visual-direction','visualDirection']])q(id).oninput=()=>{const s=project.scenes[selected];if(!s)return;s[field]=field==='duration'?clampDuration(q(id).value):q(id).value;save();pause();q('reel-total').textContent=`Total Duration: ${totalDuration(project)} seconds`;};
q('reel-play').onclick=async()=>{if(!ready||clock.playing)return;q('reel-music-preview').pause();q('reel-rendered-video').pause();try{await previewMedia.connectAudio();previewMedia.failures=[];if(!playbackStarted)clock.restart();playbackStarted=true;clock.play();tick();}catch(error){q('reel-playback-status').textContent=error.message;}};
q('reel-pause').onclick=pause;
q('reel-restart').onclick=()=>{playbackStarted=true;clock.restart();if(ready)previewMedia.sync(clock.read(),clock.playing);cancelAnimationFrame(frame);tick();};
q('reel-audio-upload-trigger').onclick=()=>q('reel-audio-upload').click();
q('reel-audio-upload').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(!['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/aac','audio/webm'].includes(file.type)||!q('reel-music-preview').canPlayType(file.type)){q('reel-audio-status').textContent='Use a browser-supported MP3, WAV, AAC, Ogg or M4A audio file.';return;}
  try{const assetRef=await saveReelUploadAsset(file);project.audio={...normalizeAudio(project.audio),mode:'music',assetRef,filename:file.name};save();render();q('reel-audio-status').textContent='Soundtrack uploaded. It plays once and stops with the Reel.';}catch(error){q('reel-audio-status').textContent=error.message;}
};
for(const id of ['reel-audio-mode','reel-audio-volume','reel-audio-offset','reel-original-muted'])q(id).onchange=()=>{project.audio=normalizeAudio({ ...project.audio,mode:q('reel-audio-mode').value,volume:q('reel-audio-volume').value,offset:q('reel-audio-offset').value,originalMuted:q('reel-original-muted').checked });save();render();};
q('reel-audio-remove').onclick=()=>{project.audio=normalizeAudio({...project.audio,mode:'none',assetRef:'',filename:'',offset:0});save();render();};
q('reel-music-preview').onplay=()=>{if(clock.playing)pause();};
q('reel-render').onclick=async()=>{
  if(renderAbort)return;pause();q('reel-rendered-video').pause();q('reel-music-preview').pause();clearCompleted();
  renderAbort=new AbortController();renderingSignature=fingerprint(project);q('reel-render').disabled=true;q('reel-render-cancel').hidden=false;
  try{
    const result=await renderReel(project,{signal:renderAbort.signal,onState:(state,position)=>{q('reel-render-status').textContent=position?`${state} · ${timeLabel(position.time)} / ${timeLabel(position.total)} — keep this tab visible`:state;}});
    if(result.fingerprint!==fingerprint(project)||renderAbort.signal.aborted)throw new Error('Project changed. Render the current Reel again.');
    const previous=project.render?.assetRef,assetRef=await saveReelRenderAsset(result.blob);
    if(result.fingerprint!==fingerprint(project)||renderAbort.signal.aborted){await removeCalendarAsset(assetRef);throw new Error('Project changed. Render the current Reel again.');}
    const {blob,...metadata}=result;project.render={...metadata,assetRef};save();await restoreCompleted();
    if(previous&&previous!==assetRef)await removeCalendarAsset(previous);
    q('reel-render-status').textContent='Complete — MP4 ready.';
  }catch(error){q('reel-render-status').textContent=error.message;}
  finally{renderAbort=null;q('reel-render').disabled=!project.scenes.length;q('reel-render-cancel').hidden=true;}
};
q('reel-render-cancel').onclick=()=>renderAbort?.abort();
q('reel-download').onclick=()=>{if(!validRender(project)||!completedUrl)return;const link=document.createElement('a');link.href=completedUrl;link.download=`upplai-reel-${new Date().toLocaleDateString('en-CA')}.mp4`;link.click();};
q('reel-send-publishing').onclick=async()=>{
  if(!validRender(project))return;
  const button=q('reel-send-publishing');button.disabled=true;q('reel-render-status').textContent='Preparing your Reel for Publishing…';
  try {
    await handoffToPublishing({ source:'reel-builder', contentType:'video', reelMediaRef:project.render.assetRef, mimeType:'video/mp4', title:project.title, headline:project.title, supportingCopy:project.sourceText, reelContext:project.render.context || { title:project.title, topic:project.sourceText, totalDuration:totalDuration(project), scenes:project.scenes.map((scene,order)=>({order,headline:scene.headline,bodyText:scene.bodyText,visualDirection:scene.visualDirection})) } });
    q('reel-render-status').textContent='Your Reel is ready in Publishing.';
  } catch(error) { q('reel-render-status').textContent=error.message||'Your Reel could not be sent to Publishing.'; }
  finally { button.disabled=!validRender(project); }
};
if(!mp4RecordingType())q('reel-render-status').textContent='MP4 recording requires a current Chrome or Edge browser with H.264/AAC recording support.';
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',()=>{renderAbort?.abort();cancelAnimationFrame(frame);previewMedia?.dispose();clearCompleted();q('reel-music-preview').pause();if(soundtrackUrl)URL.revokeObjectURL(soundtrackUrl);});
render();

q('reel-generate').onclick=async()=>{if(project.scenes.length&&!confirm('Replace existing Reel scenes?'))return;const button=q('reel-generate'),status=q('reel-ai-status'),content=q('reel-ai-content').value.trim();if(!content){status.textContent='Add a Reel topic or content before generating scenes.';return;}button.disabled=true;status.textContent='Generating Reel scenes...';try{const response=await fetch('/api/reels/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content,targetDuration:Number(q('reel-target').value),style:q('reel-style').value})});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Reel planning failed.');project=applyReelPlan(project,data.plan,{content,style:q('reel-style').value});selected=0;save();render();status.textContent='Reel scenes generated.'}catch(error){status.textContent=error.message}finally{button.disabled=false}};
q('reel-generate-visual').onclick=async()=>{const s=project.scenes[selected],b=q('reel-generate-visual'),status=q('reel-visual-status');b.disabled=true;status.textContent='Generating visual...';try{const r=await fetch('/api/reels/visual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scene:s})}),d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Visual generation failed.');const blob=await (await fetch(d.image)).blob(); const nextRef=await saveReelVisualAsset(new File([blob],blob.type==='image/svg+xml'?'reel-visual.svg':'reel-visual.png',{type:blob.type||'image/png'})); s.visualAssetRef=nextRef;save();render();status.textContent='Visual ready.'}catch(e){status.textContent=e.message}finally{b.disabled=false}};
q('reel-upload-trigger').onclick=()=>q('reel-upload-media').click();q('reel-upload-media').onchange=async e=>{const file=e.target.files[0],s=project.scenes[selected],status=q('reel-visual-status');if(!file)return;if(!['image/png','image/jpeg','image/webp','video/mp4'].includes(file.type)){status.textContent='Use PNG, JPEG, WebP, or MP4 media.';return}try{const ref=await saveReelUploadAsset(file);s.visualAssetRef=ref;s.visualMediaType=file.type.startsWith('video/')?'video':'image';save();render();status.textContent='Media uploaded.'}catch(error){status.textContent=error.message}};
const creation=q('reel-creation-mode'), animation=q('reel-animation-mode');
const describe=document.createElement('textarea'); describe.id='reel-describe-scenes'; describe.rows=6; describe.placeholder='Describe each scene exactly as you want it...';
const build=document.createElement('button'); build.type='button'; build.id='reel-build-scenes'; build.textContent='Build My Scenes';
q('reel-ai-content').parentElement.parentElement.append(describe,build);
function modeUI(){const mode=creation.value;project.creationMode=mode; q('reel-ai-content').closest('label').hidden=mode!=='ai-generate';q('reel-target').closest('label').hidden=mode==='manual';q('reel-style').closest('label').hidden=mode==='manual';q('reel-generate').hidden=mode!=='ai-generate';describe.hidden=mode!=='describe-scenes';build.hidden=mode!=='describe-scenes';save();}
creation.value=project.creationMode||'ai-generate';animation.value=project.animationMode||'auto';creation.onchange=modeUI;animation.onchange=()=>{project.animationMode=animation.value;save()};modeUI();
q('reel-motion').onchange=()=>{const s=project.scenes[selected];if(s){s.motion=q('reel-motion').value;save();render()}};q('reel-text-animation').onchange=()=>{const s=project.scenes[selected];if(s){s.textAnimation=q('reel-text-animation').value;save();render()}};
build.onclick=async()=>{if(project.scenes.length&&!confirm('Replace existing Reel scenes?'))return;const status=q('reel-ai-status');status.textContent='Generating Reel scenes...';try{const r=await fetch('/api/reels/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:describe.value,targetDuration:Number(q('reel-target').value),style:q('reel-style').value,creationMode:'describe-scenes'})}),d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Reel planning failed.');project=applyReelPlan(project,d.plan,{content:describe.value,style:q('reel-style').value});project.creationMode='describe-scenes';selected=0;save();render();status.textContent='Reel scenes generated.'}catch(e){status.textContent=e.message}};
document.addEventListener('reel:use-rendered-designs', async event => {
  const detail=event.detail||{}, previews=detail.previews||[];
  if(!previews.length){detail.completion?.reject(new Error('The current design preview is unavailable.'));return;}
  try {
    // The sender supplies a clean clone of the currently mounted preview. Clone
    // again before rasterizing so the source version remains untouched.
    const currentPreviews=previews.map(preview=>preview?.cloneNode?.(true)).filter(Boolean);
    if(currentPreviews.length!==previews.length)throw new Error('The current design preview is unavailable.');
    const { renderedDesignsToReelScenes }=await import('/src/reel-source-conversion.mjs');
    const scenes=await renderedDesignsToReelScenes(currentPreviews);
    project=createReelProject({title:detail.title||'Design Reel',creationMode:'manual'});
    project.scenes=scenes;project.sourceText=detail.source||'single-image-current-version';selected=0;
    save();render();
    detail.completion?.resolve({sceneCount:scenes.length,projectId:project.id});
    document.dispatchEvent(new Event('navigate:reels'));
  } catch(error) {
    detail.completion?.reject(error);
    if(!detail.completion)alert(error.message||'Design could not be added to Reel.');
  }
});
