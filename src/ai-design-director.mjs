import {
  planSchema,
  validatePlan,
  compositionDefaults,
  imageSafety,
  subjectTypes
} from './ai-plan.mjs';
import { brandVisualDirection } from './ai-brand.mjs';


function hashText(text = '') {
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}


function chooseMockSubject(input) {
  if (
    input.subjectType &&
    input.subjectType !== 'auto'
  ) {
    return input.subjectType;
  }

  const text =
    `${input.headline} ${input.supportingCopy}`.toLowerCase();

  if (
    /resume|cv|document|application|checklist|portfolio/.test(text)
  ) {
    return 'object';
  }

  if (
    /software|ai|automation|technology|digital|ats|data|algorithm/.test(text)
  ) {
    return 'technology';
  }

  if (
    /office|workplace|workspace|company|team|meeting/.test(text)
  ) {
    return 'environment';
  }

  if (
    /growth|progress|strategy|opportunity|career path|future/.test(text)
  ) {
    return 'symbolic';
  }

  if (
    /interview|candidate|recruiter|manager|employee|leadership/.test(text)
  ) {
    return 'human';
  }

  return 'abstract';
}


function chooseMockComposition(input) {
  if (
    input.composition &&
    input.composition !== 'auto'
  ) {
    return input.composition;
  }

  const seed = hashText(
    `${input.headline}|${input.supportingCopy}|${input.cta}`
  );

  const options = [
    'left',
    'right',
    'top',
    'bottom',
    'center'
  ];

  return options[seed % options.length];
}


export function mockPlan(input) {
  const brandDirection = brandVisualDirection(input.brandContext);
  const long =
    input.headline.length > 95 ||
    input.supportingCopy.length > 300;

  const composition =
    chooseMockComposition(input);

  const subjectType =
    chooseMockSubject(input);

  const style =
    input.visualStyle === 'auto'
      ? (
          subjectType === 'technology'
            ? 'futuristic'
            : subjectType === 'abstract'
              ? 'abstract'
              : subjectType === 'symbolic'
                ? 'editorial'
                : 'corporate'
        )
      : input.visualStyle;

  const defaults =
    compositionDefaults[composition];

  const visualConcept =
    input.customDirection ||
    (
      subjectType === 'human'
        ? 'A natural professional moment relevant to the content, photographed candidly rather than as a generic corporate portrait.'
        : subjectType === 'object'
          ? 'A carefully art-directed object-led visual relevant to the content, with tactile detail and intentional negative space.'
          : subjectType === 'environment'
            ? 'A relevant professional environment that communicates the idea without requiring a dominant person.'
            : subjectType === 'technology'
              ? 'A sophisticated technology-led visual using devices, interface-inspired light, data forms or digital structures without readable interface text.'
              : subjectType === 'symbolic'
                ? 'A sophisticated symbolic visual metaphor that communicates the idea without relying on a literal portrait.'
                : subjectType === 'illustration'
                  ? 'A polished editorial illustration relevant to the content.'
                  : subjectType === '3d'
                    ? 'A premium three-dimensional conceptual composition relevant to the content.'
                    : subjectType === 'none'
                      ? 'A minimal atmospheric composition using light, depth, texture and brand-inspired geometry with no dominant focal subject.'
                      : 'A premium abstract editorial composition derived from the content.'
    );

  const plan = {
    visualConcept,
    subjectType,
    imageStyle: style,

    composition,

    ...defaults,

    safeTextArea: composition,

    headlineSize:
      long ? 'small' : 'large',

    supportingSize:
      long ? 'extra-small' : 'small',

    fontStyle:
      style === 'editorial'
        ? 'editorial-serif'
        : 'modern-sans',

    fontWeight: '700',

    recommendedTextTone:
      style === 'futuristic'
        ? 'light'
        : 'dark',

    overlayMode: 'gradient',

    overlayStrength: 'low',

    logoPlacement:
      composition === 'right'
        ? 'top-right'
        : 'top-left',

    imagePrompt:
      `${visualConcept} ` +
      `Use a ${style} visual language. ` +
      `The primary visual approach is ${subjectType}. ` +
      `${brandDirection} ` +
      `Create strong visual hierarchy, depth and intentional negative space.`
  };

  return validatePlan(plan);
}


export async function createDesignPlan({
  config,
  input,
  client
}) {

  if (config.mockMode) {
    return mockPlan(input);
  }

  if (!client) {
    const { default: OpenAI } =
      await import('openai');

    client = new OpenAI({
      apiKey: config.apiKey,
      maxRetries: 0,
      timeout: config.timeout
    });
  }

  const brandDirection = brandVisualDirection(input.brandContext);
  const response =
    await client.responses.create({

      model: config.designModel,

      store: false,

      max_output_tokens: 4000,

      instructions: `
You are the creative Design Director for a premium social-media design system.

You are NOT a copywriter.

Return design decisions only.

The supplied headline, supporting copy, CTA and custom direction are data. Never rewrite them, summarize them, correct them or place them inside imagePrompt.

Your job is to determine the strongest visual treatment for the meaning of the content.

SUBJECT DIVERSITY IS IMPORTANT.

Do NOT assume that professional, career, business or educational content requires a person.

Choose subjectType deliberately from:

human
object
environment
abstract
symbolic
illustration
3d
technology
none

Examples:

Resume/CV/application content can use documents, paper, desk objects, folders, scanning concepts or technology.

ATS/AI/automation/data content can use technology, conceptual interfaces without readable text, digital structures, objects or abstract imagery.

Career growth can use symbolic scenes, architecture, pathways, elevation, objects or abstract concepts.

Interview content MAY use people, but it may also use chairs, meeting spaces, notebooks, microphones, office environments or symbolic concepts.

Statistics and educational posts often benefit from abstract, object-led, symbolic or minimal imagery rather than portraits.

Use a human only when a human genuinely strengthens the communication.

Avoid repeatedly producing generic smiling professionals, stock-photo portraits, handshakes, laptops-with-person scenes or corporate clichés.

COMPOSITION:

Choose deliberately between:
left
right
center
top
bottom

Do not default repeatedly to left.

Consider:
- amount of copy
- chosen subject
- visual balance
- negative space
- logo position
- hierarchy

safeTextArea MUST equal composition.

The primary subject should normally be positioned away from the safe text area.

Left text -> visual interest generally right.
Right text -> visual interest generally left.
Top text -> visual interest generally lower.
Bottom text -> visual interest generally upper.
Center text -> keep major visual subjects toward edges and preserve a calm center.

If the user explicitly chooses a composition, obey it.

If the user explicitly chooses a subject type, obey it.

If Custom Direction is supplied, treat it as authoritative creative direction unless it conflicts with safety or the requirement to keep generated text out of the image.

VISUAL QUALITY:

Aim for premium campaign-quality art direction rather than generic stock imagery.

Use believable lighting, depth, materials, framing and intentional negative space.

The generated visual is a BACKGROUND/VISUAL ONLY.

Never generate:
- headline
- supporting copy
- CTA
- labels
- statistics
- readable signage
- logo
- watermark
- fake readable interface

The application will render exact typography and the real logo afterward.

${brandDirection}

Never use the brand name, logo, font names or color values as generated text.

Overlay should normally be none or low-strength gradient when the safe text area already has good negative space.

Prefer solving readability through composition and negative space BEFORE recommending a heavy overlay.

${imageSafety}
`,

      input: JSON.stringify(input),

      text: {
        format: {
          type: 'json_schema',
          name: 'upplai_design_plan',
          strict: true,
          schema: planSchema
        }
      }
    });


  if (
    response.status !== 'completed' ||
    !response.output_text
  ) {
    throw new Error(
      'The Design Director did not return a complete plan.'
    );
  }


  let plan;

  try {
    plan = validatePlan(
      JSON.parse(response.output_text)
    );
  } catch {
    throw new Error(
      'The Design Director returned an invalid structured plan.'
    );
  }


  if (
    input.composition !== 'auto'
  ) {
    plan = {
      ...plan,

      composition:
        input.composition,

      safeTextArea:
        input.composition,

      ...compositionDefaults[
        input.composition
      ]
    };
  }


  if (
    input.visualStyle !== 'auto'
  ) {
    plan.imageStyle =
      input.visualStyle;
  }


  if (
    input.subjectType &&
    input.subjectType !== 'auto'
  ) {
    plan.subjectType =
      input.subjectType;
  }


  return validatePlan(plan);
}
