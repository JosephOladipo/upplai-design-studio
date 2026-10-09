export const reelMusicCategories = Object.freeze(['Trending','Upbeat','Corporate','Motivational','Chill','Cinematic','Technology']);
export const reelMusicLibrary = Object.freeze([]);

// Metadata only: audio files continue through the existing Reel upload asset path.
export function normalizeReelMusicTrack(track = {}) {
  if (!track || typeof track !== 'object') return null;
  const id = String(track.id || '').trim();
  const title = String(track.title || '').trim();
  if (!id || !title) return null;
  const category = reelMusicCategories.includes(track.category) ? track.category : 'Technology';
  const duration = Number(track.duration);
  return {
    id,
    title,
    artist: String(track.artist || track.source || '').trim(),
    source: String(track.source || '').trim(),
    category,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    previewUrl: String(track.previewUrl || track.previewRef || '').trim(),
    assetRef: String(track.assetRef || '').trim(),
    license: String(track.license || track.licenseSource || '').trim()
  };
}
