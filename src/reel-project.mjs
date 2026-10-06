const id=()=>`reel-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
export const clampDuration=v=>{const n=Number(v);return Math.max(1,Math.min(15,Number.isFinite(n)?n:3));};
export function createReelProject({title='',sourceText=''}={}) { return {id:id(),title:String(title).trim()||'Untitled Reel',sourceText:String(sourceText),aspectRatio:'9:16',width:1080,height:1920,scenes:[],updatedAt:new Date().toISOString()}; }
export function createScene(data={}) { return {id:id(),duration:clampDuration(data.duration),background:data.background||'#101d30',imageRef:data.imageRef||'',headline:data.headline||'',bodyText:data.bodyText||'',transition:data.transition==='cut'?'cut':'fade',visualDirection:data.visualDirection||'',visualType:['ai-visual','uploaded-media'].includes(data.visualType)?data.visualType:'branded-text',visualAssetRef:data.visualAssetRef||''}; }
export const addScene=(project,data={})=>({...project,scenes:[...project.scenes,createScene(data)]});
export const duplicateScene=(project,index)=>index<0||index>=project.scenes.length?project:{...project,scenes:[...project.scenes.slice(0,index+1),{...project.scenes[index],id:id()},...project.scenes.slice(index+1)]};
export const deleteScene=(project,index)=>({...project,scenes:project.scenes.filter((_,i)=>i!==index)});
export const moveScene=(project,index,direction)=>{const target=index+direction;if(target<0||target>=project.scenes.length)return project;const scenes=[...project.scenes];[scenes[index],scenes[target]]=[scenes[target],scenes[index]];return {...project,scenes};};
export const totalDuration=project=>project.scenes.reduce((sum,scene)=>sum+clampDuration(scene.duration),0);
