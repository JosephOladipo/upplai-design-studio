const pngDimensions = image => {
  const bytes = Buffer.from(String(image).replace(/^data:image\/png;base64,/, ''), 'base64');
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('Full AI validation requires a PNG image.');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

export function proportionalSafeFrame(width, height) {
  return { top: Math.round(height * 80 / 1350), bottom: Math.round(height * 80 / 1350), left: Math.round(width * 75 / 1080), right: Math.round(width * 75 / 1080) };
}

export function normalizeArtworkAssessment(value, backgroundPolicy) {
  const safe = value && value.typographyWithinSafeFrame === true && value.criticalTextPresent === true;
  const background = backgroundPolicy === 'custom' || value?.backgroundCanvas === 'pass';
  // The browser deterministically clears eligible edge-connected neutral backdrop
  // pixels and composites the final default canvas onto #FFFFFF. Vision's
  // background reading remains diagnostic; critical typography remains the gate.
  return { accepted: Boolean(safe), backgroundAccepted: Boolean(background), backgroundDiagnostic: value?.backgroundCanvas === 'pass' ? 'pass' : value?.backgroundCanvas === 'fail' ? 'fail' : 'unknown', safeAreaAccepted: Boolean(safe), reason: !safe ? 'Critical typography is outside the required safe frame or missing.' : '' };
}

export async function assessFullArtwork({ client, config, image, backgroundPolicy, copy = {} }) {
  const { width, height } = pngDimensions(image);
  const frame = proportionalSafeFrame(width, height);
  const headline = String(copy.headline || '').trim().slice(0, 300);
  const backgroundInstruction = backgroundPolicy === 'white'
    ? 'Return pass for backgroundCanvas only when the default exposed canvas is pure white or transparent with no large gray/colored backdrop, gradient, vignette, haze, or environmental wash. Local object shadows are allowed.'
    : 'The user explicitly requested a custom background; do not reject that background.';
  const response = await client.responses.create({
    model: config.designModel, store: false, max_output_tokens: 300,
    text: { format: { type: 'json_schema', name: 'full_artwork_acceptance', strict: true, schema: { type: 'object', additionalProperties: false, properties: { backgroundCanvas: { type: 'string', enum: ['pass', 'fail'] }, typographyWithinSafeFrame: { type: 'boolean' }, criticalTextPresent: { type: 'boolean' } }, required: ['backgroundCanvas', 'typographyWithinSafeFrame', 'criticalTextPresent'] } } },
    instructions: `Inspect this generated Full AI social artwork. ${headline ? `The essential headline is ${JSON.stringify(headline)}. Assess criticalTextPresent and typographyWithinSafeFrame only for that exact essential headline.` : 'No essential headline was supplied; do not reject the artwork for missing optional typography.'} ${backgroundInstruction} The essential headline must stay within this image's safe frame: top ${frame.top}px, bottom ${frame.bottom}px, left ${frame.left}px, right ${frame.right}px. Supporting copy and CTA are optional. Do not mark either typography field false because optional copy or a CTA is absent, uncertain, small, decorative, or outside the frame. Mark typographyWithinSafeFrame false only when the essential headline itself visibly breaches the frame.`,
    input: [{ role: 'user', content: [{ type: 'input_image', image_url: image, detail: 'high' }] }]
  });
  let parsed;
  try { parsed = JSON.parse(response.output_text || ''); } catch { parsed = null; }
  return { ...normalizeArtworkAssessment(parsed, backgroundPolicy), frame };
}
