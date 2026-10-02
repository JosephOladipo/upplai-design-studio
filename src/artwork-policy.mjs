// Shared by planning, generation and refinement. Only user direction selects a backdrop.
export const artworkSafeArea = 'TEXT SAFE AREA: Keep all important text comfortably inside all four edges, with generous space above the headline and below the CTA. Separate headline, supporting copy, CTA and visual elements deliberately. Never clip text. Allow creative layouts inside these safe margins.';
export function artworkBackground(direction = '') {
  const clauses = String(direction).split(/[.!;\n]/).filter(x => /background|backdrop|canvas|dark theme|dark mode|full[- ]bleed/i.test(x));
  if (!clauses.length) return 'white';
  const last = clauses.at(-1);
  if (/\b(?:pure |plain |solid )?white\b|#fff(?:fff)?\b/i.test(last) && !/off[- ]white|(?:not|no|avoid)\s+(?:a\s+)?white/i.test(last)) return 'white';
  return 'custom';
}
export function artworkInstructions(direction = '') {
  return [artworkSafeArea, artworkBackground(direction) === 'white'
    ? 'DEFAULT CANVAS: Final exposed canvas must be pure white (#FFFFFF). Generate the non-content canvas as transparent alpha, without opaque washes, gradients, tints or vignettes; the app composites onto #FFFFFF. Preserve localized object shadows and antialiasing. Use brand colors in typography, objects and accents, not the main canvas.'
    : 'USER BACKGROUND: Render the background/color/style explicitly requested in the user direction. Do not force a white or transparent background.',
    'Respect Brand Kit and AI Brand Instruction for content and design elements; the explicit user background takes precedence.'].join('\n');
}
