// Shared Phase 7/7.1 AI design contract.

export const visualStyles = [
  'auto',
  'photorealistic',
  'editorial',
  'corporate',
  'minimal',
  'abstract',
  'illustration',
  '3d',
  'futuristic'
];

export const subjectTypes = [
  'auto',
  'human',
  'object',
  'environment',
  'abstract',
  'symbolic',
  'illustration',
  '3d',
  'technology',
  'none'
];

export const compositions = [
  'left',
  'right',
  'center',
  'top',
  'bottom'
];

export const compositionDefaults = {
  left: {
    subjectPlacement: 'right',
    textAlignment: 'left',
    contentPosition: 'middle-left'
  },

  right: {
    subjectPlacement: 'left',
    textAlignment: 'right',
    contentPosition: 'middle-right'
  },

  center: {
    subjectPlacement: 'edges',
    textAlignment: 'center',
    contentPosition: 'center'
  },

  top: {
    subjectPlacement: 'bottom',
    textAlignment: 'left',
    contentPosition: 'top-left'
  },

  bottom: {
    subjectPlacement: 'top',
    textAlignment: 'left',
    contentPosition: 'bottom-left'
  }
};

const enumeration = values => ({
  type: 'string',
  enum: values
});

export const planSchema = {
  type: 'object',

  additionalProperties: false,

  properties: {
    visualConcept: {
      type: 'string',
      minLength: 1,
      maxLength: 1000
    },

    subjectType: enumeration(subjectTypes.slice(1)),

    imageStyle: enumeration(
      visualStyles.slice(1)
    ),

    composition: enumeration(compositions),

    subjectPlacement: enumeration([
      'left',
      'right',
      'top',
      'bottom',
      'edges'
    ]),

    safeTextArea: enumeration(compositions),

    textAlignment: enumeration([
      'left',
      'center',
      'right'
    ]),

    contentPosition: enumeration([
      'top-left',
      'top-center',
      'top-right',
      'middle-left',
      'center',
      'middle-right',
      'bottom-left',
      'bottom-center',
      'bottom-right'
    ]),

    headlineSize: enumeration([
      'extra-small',
      'small',
      'medium',
      'large',
      'extra-large'
    ]),

    supportingSize: enumeration([
      'extra-small',
      'small',
      'medium',
      'large',
      'extra-large'
    ]),

    fontStyle: enumeration([
      'modern-sans',
      'clean-sans',
      'geometric-sans',
      'bold-display',
      'editorial-serif',
      'elegant-serif',
      'condensed-impact'
    ]),

    fontWeight: enumeration([
      '400',
      '500',
      '600',
      '700',
      '800'
    ]),

    recommendedTextTone: enumeration([
      'light',
      'dark'
    ]),

    overlayMode: enumeration([
      'none',
      'light',
      'dark',
      'gradient'
    ]),

    overlayStrength: enumeration([
      'low',
      'medium',
      'high'
    ]),

    logoPlacement: enumeration([
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right'
    ]),

    imagePrompt: {
      type: 'string',
      minLength: 1,
      maxLength: 6000
    }
  }
};

planSchema.required =
  Object.keys(planSchema.properties);


export function validatePlan(plan) {
  if (
    !plan ||
    typeof plan !== 'object' ||
    Array.isArray(plan) ||
    Object.keys(plan).length !==
      planSchema.required.length
  ) {
    throw new Error(
      'Invalid structured design plan.'
    );
  }

  for (
    const [key, rule]
    of Object.entries(planSchema.properties)
  ) {
    const value = plan[key];

    if (
      typeof value !== 'string' ||
      (
        rule.enum
          ? !rule.enum.includes(value)
          : !value.trim() ||
            value.length > rule.maxLength
      )
    ) {
      throw new Error(
        'Invalid structured design plan: ' +
        key
      );
    }
  }

  if (
    plan.safeTextArea !== plan.composition
  ) {
    throw new Error(
      'Design plan has inconsistent safe text area.'
    );
  }

  return plan;
}


export const imageSafety =
  'Visual/background only. ' +
  'NO headline, caption, typography, letters, numbers, ' +
  'logo, watermark or fake interface. ' +
  'Avoid readable signage. ' +
  'Do not depict claims or statistics as text. ' +
  'The application adds all text and the real logo later.';


export function safeImagePrompt(plan) {
  validatePlan(plan);

  const subjectInstruction =
    plan.subjectType === 'none'
      ? 'Do not use a dominant person, product or focal object.'
      : `Primary visual approach: ${plan.subjectType}.`;

  return [
    plan.imagePrompt,
    subjectInstruction,
    imageSafety,
    'Portrait visual intended for a 4:5 social design.',
    `Keep important visual interest toward ${plan.subjectPlacement}.`,
    `Reserve genuinely calm negative space in the ${plan.safeTextArea} region for overlaid text.`,
    'Do not place important facial features, objects or visual detail inside the reserved text region.',
    'Keep logo corners visually calm.'
  ].join('\n');
}