const id=()=>`reel-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
export const clampDuration=v=>{const n=Number(v);return Math.max(1,Math.min(15,Number.isFinite(n)?n:3));};
// The timeline deliberately stores only its existing canonical motion values.
// These helpers translate the friendly Reel-start controls without introducing
// a second animation model or values the renderer cannot play.
export const reelStartDurationOptions=Object.freeze(['auto',5,8,10,15]);
export const normalizeReelStartDuration=(value,fallback=8)=>reelStartDurationOptions.includes(Number(value))?Number(value):clampDuration(fallback);
export const reelStartMotionOptions=Object.freeze(['auto','slow-zoom-in','slow-zoom-out','pan-left','pan-right','ken-burns','static']);
export const normalizeReelStartMotion=value=>({auto:'zoom-in','slow-zoom-in':'zoom-in','slow-zoom-out':'zoom-out','pan-left':'pan-left','pan-right':'pan-right','ken-burns':'pan-left',static:'static'})[value]||'zoom-in';
export function createReelProject({title='',sourceText=''}={}) { return {id:id(),title:String(title).trim()||'Untitled Reel',sourceText:String(sourceText),aspectRatio:'9:16',width:1080,height:1920,creationMode:['describe-scenes','manual'].includes(arguments[0]?.creationMode)?arguments[0].creationMode:'ai-generate',animationMode:arguments[0]?.animationMode==='manual'?'manual':'auto',audio:{mode:'none',assetRef:'',filename:'',volume:1,offset:0,originalMuted:true},scenes:[],updatedAt:new Date().toISOString()}; }
export function createScene(data={}) { return {id:id(),duration:clampDuration(data.duration),background:data.background||'#101d30',imageRef:data.imageRef||'',headline:data.headline||'',bodyText:data.bodyText||'',transition:['cut','fade','crossfade','slide-left','slide-right','slide-up','zoom','wipe','dip-black'].includes(data.transition)?data.transition:'fade',visualDirection:data.visualDirection||'',visualType:['ai-visual','uploaded-media','ai-design','existing-design'].includes(data.visualType)?data.visualType:'branded-text',visualAssetRef:data.visualAssetRef||'',visualMediaType:data.visualMediaType||'',motion:['zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down'].includes(data.motion)?data.motion:'static',textAnimation:['none','slide-up','slide-left','pop','typewriter'].includes(data.textAnimation)?data.textAnimation:'fade'}; }
export const addScene=(project,data={})=>({...project,scenes:[...project.scenes,createScene(data)]});
export const duplicateScene=(project,index)=>index<0||index>=project.scenes.length?project:{...project,scenes:[...project.scenes.slice(0,index+1),{...project.scenes[index],id:id()},...project.scenes.slice(index+1)]};
export const deleteScene=(project,index)=>({...project,scenes:project.scenes.filter((_,i)=>i!==index)});
export const moveScene=(project,index,direction)=>{const target=index+direction;if(target<0||target>=project.scenes.length)return project;const scenes=[...project.scenes];[scenes[index],scenes[target]]=[scenes[target],scenes[index]];return {...project,scenes};};
export const totalDuration=project=>project.scenes.reduce((sum,scene)=>sum+clampDuration(scene.duration),0);
