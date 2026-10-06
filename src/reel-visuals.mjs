export const supportedReelMedia=new Set(['image/png','image/jpeg','image/webp','video/mp4']);
export function reelVisualPrompt(scene={}){return `Vertical 9:16 cinematic visual background: ${String(scene.visualDirection||scene.headline||'').slice(0,600)}. Do not render typography, words, letters, logos, watermarks, captions, UI, or branding.`;}
export function normalizeVisualType(value){return ['ai-visual','uploaded-media'].includes(value)?value:'branded-text';}
export function validReelUpload(file){return Boolean(file&&supportedReelMedia.has(file.type)&&file.size>0);}
