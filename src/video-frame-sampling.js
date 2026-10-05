export function videoSampleTargets(duration) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const fractions = duration < 2 ? [.5] : duration < 6 ? [.2, .7] : [.12, .5, .85];
  return [...new Set(fractions.map(fraction => Math.round(Math.min(Math.max(duration * fraction, 0), Math.max(duration - .05, 0)) * 1000) / 1000))];
}
