import {
  typography,
  typographyLabels,
  applyTypography
} from './typography.js';

import { brand } from './brand.js';

import {
  validatePlan,
  visualStyles,
  subjectTypes
} from './ai-plan.mjs';


export const aiDefaults = {
  aiVisualStyle: 'auto',
  aiSubject: 'auto',
  aiDirection: '',
  aiComposition: 'auto',
  aiQuality: 'draft',

  ...Object.fromEntries(
    Object.keys(typography).map(key => [
      'ai' + key[0].toUpperCase() + key.slice(1),
      'auto'
    ])
  ),

  aiTextColor: 'auto',
  aiCustomColor: '#101d30',
  aiOverlay: 'auto',
  aiOverlayStrength: 'auto'
};


function select(container, name, label, options) {
  const caption = document.createElement('label');
  caption.htmlFor = name;
  caption.textContent = label;

  const input = document.createElement('select');
  input.id = input.name = name;

  for (const [value, text] of options) {
    input.add(new Option(text, value));
  }

  container.append(caption, input);
}


export function setupAIControls() {
  const panel = document.querySelector('#ai-controls');

  const names = {
    auto: 'Auto',
    '3d': '3D'
  };

  select(
    panel,
    'aiVisualStyle',
    'AI Visual Style',
    visualStyles.map(id => [
      id,
      names[id] ||
        id[0].toUpperCase() + id.slice(1)
    ])
  );

  const subjectLabels = {
    auto: 'Auto from Content',
    human: 'Human / People',
    object: 'Object / Product',
    environment: 'Environment / Scene',
    abstract: 'Abstract',
    symbolic: 'Symbolic Concept',
    illustration: 'Illustration',
    '3d': '3D Concept',
    technology: 'Technology',
    none: 'No Main Subject'
  };

  select(
    panel,
    'aiSubject',
    'Visual Subject',
    subjectTypes.map(id => [
      id,
      subjectLabels[id] || id
    ]).concat([
      ['custom', 'Custom Direction']
    ])
  );

  const direction = document.createElement('div');
  direction.id = 'ai-direction-control';
  direction.hidden = true;

  direction.innerHTML = `
    <label for="aiDirection">
      Visual Direction
    </label>

    <textarea
      id="aiDirection"
      name="aiDirection"
      rows="3"
      maxlength="600"
      placeholder="Example: No people. Use a premium modern desk with a laptop, resume papers and interview notes. Keep clean negative space for the headline."
    ></textarea>
  `;

  panel.append(direction);

  select(
    panel,
    'aiComposition',
    'Composition',
    [
      'auto',
      'left',
      'right',
      'center',
      'top',
      'bottom'
    ].map(value => [
      value,
      value === 'auto'
        ? 'Auto'
        : 'Text ' +
          value[0].toUpperCase() +
          value.slice(1)
    ])
  );

  select(
    panel,
    'aiQuality',
    'AI Image Quality',
    [
      ['draft', 'Draft'],
      ['standard', 'Standard'],
      ['premium', 'Premium']
    ]
  );

  const details = document.createElement('details');
  details.id = 'ai-advanced';

  details.innerHTML =
    '<summary>Advanced Design Controls</summary>';

  panel.append(details);

  for (
    const [key, options]
    of Object.entries(typography)
  ) {
    select(
      details,
      'ai' +
        key[0].toUpperCase() +
        key.slice(1),
      typographyLabels[key],
      [
        ['auto', 'Auto'],
        ...Object.entries(options).map(
          ([id, option]) => [
            id,
            option.label
          ]
        )
      ]
    );
  }

  select(
    details,
    'aiTextColor',
    'Text Color',
    [
      ['auto', 'Auto'],
      ['white', 'White'],
      ['dark', 'Dark'],
      ['custom', 'Custom']
    ]
  );

  const custom =
    document.createElement('div');

  custom.id = 'ai-custom-color-control';
  custom.hidden = true;

  custom.innerHTML = `
    <label for="aiCustomColor">
      Custom Text Color
    </label>

    <input
      type="color"
      id="aiCustomColor"
      name="aiCustomColor"
      value="#101d30"
    >
  `;

  details.append(custom);

  select(
    details,
    'aiOverlay',
    'Overlay',
    [
      'auto',
      'none',
      'light',
      'dark',
      'gradient'
    ].map(value => [
      value,
      value[0].toUpperCase() +
        value.slice(1)
    ])
  );

  select(
    details,
    'aiOverlayStrength',
    'Overlay Strength',
    [
      'auto',
      'low',
      'medium',
      'high'
    ].map(value => [
      value,
      value[0].toUpperCase() +
        value.slice(1)
    ])
  );
}


export async function aiRequest(path, body) {
  let response;

  try {
    response = await fetch(
      '/api/ai/' + path,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify(body),

        signal:
          AbortSignal.timeout(190000)
      }
    );
  } catch (error) {
    throw new Error(
      error.name === 'TimeoutError'
        ? 'Generation timed out. No automatic retry was made.'
        : 'Could not reach the local design server.'
    );
  }

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
      'AI generation failed.'
    );
  }

  return result;
}


export function activeBrandContext() {
  return {
    brandName: brand.name,
    colors: {
      primary: brand.colors.primaryLight,
      secondary: brand.colors.primary,
      accent: brand.colors.pink,
      dark: brand.colors.navy,
      light: brand.colors.white
    },
    fonts: {
      heading: brand.headingFont,
      body: brand.bodyFont
    }
  };
}

export function directorInput(value) {
  const custom =
    value.aiSubject === 'custom';

  return {
    headline: value.headline,
    supportingCopy: value.supportingCopy,
    cta: value.cta,
    brandContext: activeBrandContext(),

    visualStyle:
      value.aiVisualStyle,

    subjectType:
      custom
        ? 'auto'
        : value.aiSubject,

    composition:
      value.aiComposition,

    customDirection:
      custom
        ? value.aiDirection
        : ''
  };
}


export async function prepareAIImage(result) {
  if (
    typeof result.image !== 'string' ||
    result.image.length > 40000000 ||
    (
      !result.image.startsWith(
        'data:image/png;base64,'
      ) &&
      !(
        result.mockMode === true &&
        result.image.startsWith(
          'data:image/svg+xml;base64,'
        )
      )
    )
  ) {
    throw new Error(
      'The server returned an invalid image.'
    );
  }

  const image = new Image();
  image.src = result.image;

  try {
    await image.decode();
  } catch {
    throw new Error(
      'The generated image could not be decoded.'
    );
  }

  if (
    !image.naturalWidth ||
    !image.naturalHeight
  ) {
    throw new Error(
      'The generated image has invalid dimensions.'
    );
  }

  const canvas =
    document.createElement('canvas');

  canvas.width = 1080;
  canvas.height = 1350;

  const context =
    canvas.getContext('2d');

  if (!context) {
    throw new Error(
      'Image composition is unavailable in this browser.'
    );
  }

  const scale = Math.max(
    1080 / image.naturalWidth,
    1350 / image.naturalHeight
  );

  const width =
    image.naturalWidth * scale;

  const height =
    image.naturalHeight * scale;

  context.drawImage(
    image,
    (1080 - width) / 2,
    (1350 - height) / 2,
    width,
    height
  );

  return {
    image:
      canvas.toDataURL('image/png'),

    canvas
  };
}


export function aiLayout(plan, value) {
  const position =
    value.aiContentPosition === 'auto'
      ? plan.contentPosition
      : value.aiContentPosition;

  const area =
    value.aiContentPosition !== 'auto'
      ? position.startsWith('top')
        ? 'top'
        : position.startsWith('bottom')
          ? 'bottom'
          : position.endsWith('left')
            ? 'left'
            : position.endsWith('right')
              ? 'right'
              : 'center'
      : plan.safeTextArea;

  const width =
    ['left', 'right'].includes(area)
      ? 560
      : 896;

  const height =
    ['top', 'bottom'].includes(area)
      ? 650
      : 1130;

  return {
    x:
      area === 'right'
        ? 1080 - 92 - width
        : 92,

    y:
      area === 'bottom'
        ? 1350 - 110 - height
        : 110,

    width,
    height,
    position,
    area
  };
}


const linear = value => {
  value /= 255;

  return value <= .04045
    ? value / 12.92
    : (
        (value + .055) / 1.055
      ) ** 2.4;
};


export function analyzeReadability(
  canvas,
  area
) {
  const sample =
    document.createElement('canvas');

  sample.width = 36;
  sample.height = 44;

  const context =
    sample.getContext(
      '2d',
      {
        willReadFrequently: true
      }
    );

  if (!context) {
    throw new Error(
      'Readability analysis unavailable.'
    );
  }

  context.drawImage(
    canvas,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    36,
    44
  );

  const pixels =
    context.getImageData(
      0,
      0,
      36,
      44
    ).data;

  const luminances = [];

  for (
    let i = 0;
    i < pixels.length;
    i += 4
  ) {
    luminances.push(
      .2126 * linear(pixels[i]) +
      .7152 * linear(pixels[i + 1]) +
      .0722 * linear(pixels[i + 2])
    );
  }

  const mean =
    luminances.reduce(
      (a, b) => a + b,
      0
    ) / luminances.length;

  const variance =
    luminances.reduce(
      (a, b) =>
        a + (b - mean) ** 2,
      0
    ) / luminances.length;

  const navy =
    .2126 * linear(16) +
    .7152 * linear(29) +
    .0722 * linear(48);

  const darkPass =
    luminances.filter(
      luminance =>
        (luminance + .05) /
        (navy + .05) >= 4.5
    ).length /
    luminances.length;

  const lightPass =
    luminances.filter(
      luminance =>
        1.05 /
        (luminance + .05) >= 4.5
    ).length /
    luminances.length;

  const kind =
    variance > .035
      ? 'mixed'
      : darkPass > .96
        ? 'light'
        : lightPass > .96
          ? 'dark'
          : 'mixed';

  return {
    kind,
    mean,
    variance,

    color:
      kind === 'light'
        ? brand.colors.navy
        : brand.colors.white,

    overlay:
      kind === 'mixed'
        ? 'gradient'
        : 'none',

    strength:
      kind === 'mixed'
        ? .42
        : 0
  };
}


function gradientDirection(area) {
  if (area === 'left') {
    return '90deg';
  }

  if (area === 'right') {
    return '270deg';
  }

  if (area === 'top') {
    return '180deg';
  }

  if (area === 'bottom') {
    return '0deg';
  }

  return '180deg';
}


function localizedGradient(
  tint,
  strength,
  area
) {
  const direction =
    gradientDirection(area);

  if (area === 'center') {
    return (
      'radial-gradient(' +
      'ellipse at center, ' +
      `rgba(${tint},${strength}) 0%, ` +
      `rgba(${tint},${Math.max(
        0,
        strength * .75
      )}) 38%, ` +
      `rgba(${tint},0) 78%)`
    );
  }

  return (
    `linear-gradient(${direction}, ` +
    `rgba(${tint},${strength}) 0%, ` +
    `rgba(${tint},${Math.max(
      0,
      strength * .72
    )}) 38%, ` +
    `rgba(${tint},${Math.max(
      0,
      strength * .22
    )}) 62%, ` +
    `rgba(${tint},0) 82%)`
  );
}


export function applyAIStyle(
  preview,
  value,
  design
) {
  const plan =
    validatePlan(design.plan);

  const area =
    aiLayout(plan, value);

  let reading;
  let notice = '';

  try {
    reading =
      analyzeReadability(
        design.canvas,
        area
      );
  } catch {
    reading = {
      kind: 'fallback',
      color: brand.colors.white,
      overlay: 'gradient',
      strength: .55
    };

    notice =
      'Readability analysis unavailable; a protective local gradient was applied.';
  }


  const settings = {
    fontStyle:
      plan.fontStyle,

    headlineSize:
      plan.headlineSize,

    copySize:
      plan.supportingSize,

    fontWeight:
      plan.fontWeight,

    textAlignment:
      plan.textAlignment,

    contentPosition:
      area.position,

    lineSpacing:
      'normal',

    letterSpacing:
      'normal'
  };


  for (
    const key
    of Object.keys(typography)
  ) {
    const choice =
      value[
        'ai' +
        key[0].toUpperCase() +
        key.slice(1)
      ];

    if (
      choice &&
      choice !== 'auto'
    ) {
      settings[key] = choice;
    }
  }


  const color =
    ({
      white:
        brand.colors.white,

      dark:
        brand.colors.navy,

      custom:
        value.aiCustomColor
    })[value.aiTextColor] ||
    reading.color;


  const rgb =
    /^#[0-9a-f]{6}$/i.test(color)
      ? color
          .slice(1)
          .match(/../g)
          .map(value =>
            parseInt(value, 16)
          )
      : [255, 255, 255];


  const lightText =
    (
      .2126 * linear(rgb[0]) +
      .7152 * linear(rgb[1]) +
      .0722 * linear(rgb[2])
    ) > .45;


  let overlay =
    value.aiOverlay === 'auto'
      ? (
          reading.overlay !== 'none'
            ? reading.overlay
            : plan.overlayMode
        )
      : value.aiOverlay;


  const incompatible =
    reading.kind === 'mixed' ||
    reading.kind === 'fallback' ||
    (
      lightText &&
      reading.kind === 'light'
    ) ||
    (
      !lightText &&
      reading.kind === 'dark'
    );


  if (
    value.aiOverlay === 'auto' &&
    incompatible
  ) {
    overlay = 'gradient';
  }


  let strength =
    value.aiOverlayStrength === 'auto'
      ? Math.max(
          reading.strength,
          ({
            low: .20,
            medium: .34,
            high: .52
          })[plan.overlayStrength] ||
          0
        )
      : ({
          low: .18,
          medium: .34,
          high: .52
        })[value.aiOverlayStrength];


  if (
    value.aiOverlay === 'auto' &&
    overlay !== 'none'
  ) {
    strength =
      Math.min(
        Math.max(strength, .28),
        .55
      );
  }


  const tint =
    overlay === 'light'
      ? '255,255,255'
      : overlay === 'dark'
        ? '0,0,0'
        : lightText
          ? '0,0,0'
          : '255,255,255';


  let layer = '';


  if (overlay === 'gradient') {
    layer =
      localizedGradient(
        tint,
        strength,
        area.area
      ) + ', ';
  } else if (
    overlay === 'light' ||
    overlay === 'dark'
  ) {
    /*
      Manual Light/Dark retains the user's
      explicit whole-image overlay choice.
      Auto readability uses localized gradients.
    */
    layer =
      `linear-gradient(` +
      `rgba(${tint},${strength}),` +
      `rgba(${tint},${strength})` +
      `), `;
  }


  preview.style.background =
    layer +
    `url("${design.image}") ` +
    'center / cover no-repeat';


  for (
    const key
    of ['x', 'y', 'width', 'height']
  ) {
    preview.style.setProperty(
      '--ai-' + key,
      area[key] + 'px'
    );
  }


  preview.dataset.readability =
    reading.kind;


  applyTypography(
    preview,
    settings,
    color
  );


  if (value.placement === 'auto') {
    preview
      .querySelector('#preview-logo')
      .dataset.placement =
        plan.logoPlacement;
  }


  return notice;
}

