import { createScene } from './reel-project.mjs';
import { designHtmlToReelAsset } from './reel-design-adapter.mjs';
export async function renderedDesignsToReelScenes(previews, options = {}) {
  if (!Array.isArray(previews) || !previews.length) throw new Error('Finished design previews are unavailable.');
  const scenes=[]; for (let index=0;index<previews.length;index+=1) { const ref=await designHtmlToReelAsset(previews[index], options); scenes.push(createScene({visualType:'existing-design',visualAssetRef:ref,sourceType:'existing-design',sourceIndex:index})); } return scenes;
}
