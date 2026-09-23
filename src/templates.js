import { fitLimits } from './typography.js';
// Deterministic templates sharing the existing preview markup and text-length classes.
export function applyTemplate(preview, value) {
  preview.querySelector('.template-kicker')?.remove();
  preview.querySelectorAll('.template-extra').forEach(node => node.remove());

  const headline = preview.querySelector('#preview-headline');
  const copy = preview.querySelector('#preview-copy');
  const content = preview.querySelector('.design-content');

  const original =
    ['premium-editorial', 'bold-statement'].includes(value.style);

  if (!original) {
    headline.textContent = ['minimal-post', 'free-style', 'openai-style'].includes(value.style) ? value.headline : value.headline.trim();
  }

  headline.hidden = !headline.textContent;

  const text = headline.textContent;
  const length = text.length;

  preview.classList.add(
    'real-template',
    'headline-' + (
      length <= 45 ? 'short' :
      length <= 95 ? 'medium' :
      length <= 140 ? 'long' :
      'very-long'
    )
  );

  const copyLength = value.supportingCopy.length;

  preview.classList.add(
    'copy-' + (
      copyLength <= 140 ? 'short' :
      copyLength <= 300 ? 'medium' :
      copyLength <= 500 ? 'long' :
      'very-long'
    )
  );

  if (value.cta.length > 35) {
    preview.classList.add('cta-long');
  }

  // PREMIUM EDITORIAL / BOLD STATEMENT
  if (original) {
    const kicker = document.createElement('div');

    kicker.className = 'template-kicker';

    kicker.textContent =
      value.style === 'premium-editorial'
        ? 'Perspective'
        : 'Make a statement';

    content.prepend(kicker);
  }

  if (value.style === 'bold-statement') {
    const match = text.match(/\S+\s*$/u);

    if (match) {
      const emphasis =
        document.createElement('span');

      emphasis.className =
        'headline-emphasis';

      emphasis.textContent =
        match[0];

      headline.replaceChildren(
        document.createTextNode(
          text.slice(0, match.index)
        ),
        emphasis
      );
    }
  }

  // INFOGRAPHIC
  if (
    value.style === 'infographic' &&
    value.supportingCopy
  ) {
    copy.replaceChildren();

    value.supportingCopy
      .split('\n')
      .forEach((line, index) => {
        if (index) {
          copy.append(
            document.createTextNode('\n')
          );
        }

        const row =
          document.createElement('span');

        row.className = 'info-row';
        row.textContent = line;

        copy.append(row);
      });
  }

  // DATA / STAT
  if (value.style === 'data-stat') {
    const number =
      /(?<![\p{L}\p{N}_])(?:[$£€₦][+-]?|[+-])?\d+(?:[.,]\d+)*(?:\s?[%％]|[x×])?(?![\p{L}\p{N}_])/u;

    const match =
      text.match(number) ||
      value.supportingCopy.match(number);

    if (match) {
      const stat =
        document.createElement('div');

      stat.className =
        'template-extra stat-value';

      stat.textContent =
        match[0];

      content.prepend(stat);

      preview.classList.add('has-stat');

      if (match[0].length > 6) {
        preview.classList.add('stat-long');
      }
    }
  }

  // PRODUCT / FEATURE
  if (value.style === 'product-feature') {
    const shape =
      document.createElement('div');

    shape.className =
      'template-extra product-sculpture';

    shape.setAttribute(
      'aria-hidden',
      'true'
    );

    for (let i = 0; i < 3; i++) {
      shape.append(
        document.createElement('span')
      );
    }

    content.insertBefore(
      shape,
      headline
    );
  }

  // MINIMAL POST
  // Intentionally adds nothing.
  // Only user-supplied text appears.

  return true;
}


// ===========================================================
// TEXT FITTING
// ===========================================================

export function fitTemplate(preview) {
  const headline =
    preview.querySelector('#preview-headline');

  const copy =
    preview.querySelector('#preview-copy');

  const cta =
    preview.querySelector('#preview-cta');

  const content =
    preview.querySelector('.design-content');

  const stat =
    preview.querySelector('.stat-value');

  const art =
    preview.querySelector('.product-sculpture');

  const rows = [
    ...preview.querySelectorAll('.info-row')
  ];

  for (
    const node of [
      headline,
      copy,
      cta,
      content,
      stat,
      art,
      ...rows
    ].filter(Boolean)
  ) {
    node.removeAttribute('style');
  }

  if (preview.classList.contains('minimal-post') || preview.classList.contains('free-style') || preview.classList.contains('openai-style')) {
    return fitMinimalPost(preview, headline, copy, cta, content);
  }

  const tier = [
    'short',
    'medium',
    'long',
    'very-long'
  ].findIndex(size =>
    preview.classList.contains(
      'headline-' + size
    )
  );

  const copyTier = [
    'short',
    'medium',
    'long',
    'very-long'
  ].findIndex(size =>
    preview.classList.contains(
      'copy-' + size
    )
  );

  const headlineSizes =
    [112, 84, 66, 56];

  const copySizes =
    [34, 32, 30, 28];

  const headBase =
    Math.min(
      parseFloat(
        getComputedStyle(headline).fontSize
      ),
      headlineSizes[tier]
    );

  const statBase =
    stat
      ? parseFloat(
          getComputedStyle(stat).fontSize
        )
      : 0;

  const artBase =
    art
      ? art.offsetHeight
      : 0;

  for (
    const scale of [
      1,
      .92,
      .84,
      .76,
      .68,
      .60
    ]
  ) {
    headline.style.fontSize =
      Math.max(
        44,
        headBase * scale
      ) + 'px';

    headline.style.lineHeight =
      String(
        1.06 + .06 * scale
      );

    copy.style.fontSize =
      Math.max(
        28,
        copySizes[copyTier] * scale
      ) + 'px';

    copy.style.lineHeight =
      String(
        1.35 + .15 * scale
      );

    copy.style.maxWidth =
      copyTier >= 2
        ? '100%'
        : '';

    cta.style.fontSize =
      '28px';

    cta.style.lineHeight =
      '1.35';

    content.style.gap =
      Math.max(
        18,
        44 * scale
      ) + 'px';

    if (stat) {
      stat.style.fontSize =
        Math.max(
          preview.classList.contains(
            'stat-long'
          )
            ? 48
            : 80,
          statBase * scale
        ) + 'px';
    }

    if (art) {
      art.style.height =
        Math.max(
          150,
          artBase * scale
        ) + 'px';
    }

    for (const row of rows) {
      row.style.paddingTop =
        row.style.paddingBottom =
          Math.max(
            8,
            25 * scale
          ) + 'px';
    }

    if (fitsCanvas(preview)) {
      return true;
    }
  }

  return false;
}


// ===========================================================
// CANVAS SAFETY
// ===========================================================

function fitsCanvas(preview) {
  const canvas =
    preview.getBoundingClientRect();

  const scale =
    canvas.width / 1080;

  const bounds = [];

  const nodes = [
    ...preview.querySelectorAll(
      'h3, #preview-copy, .preview-cta, .preview-logo, .stat-value, .template-kicker, .product-sculpture'
    )
  ].filter(
    node =>
      node.getClientRects().length
  );

  for (const node of nodes) {
    const box =
      node.getBoundingClientRect();

    const ink = {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom
    };

    const isLogo =
      node.classList.contains(
        'preview-logo'
      );

    const top =
      canvas.top +
      (isLogo ? 20 : 104) * scale;

    const bottom =
      canvas.bottom -
      (isLogo ? 20 : 104) * scale;

    if (
      box.left < canvas.left ||
      box.right > canvas.right + .1 ||
      box.top < top - .1 ||
      box.bottom > bottom + .1
    ) {
      return false;
    }

    if (
      node.scrollWidth >
        node.clientWidth + 2 ||
      node.scrollHeight >
        node.clientHeight + 2
    ) {
      return false;
    }

    if (node.textContent) {
      const range =
        document.createRange();

      range.selectNodeContents(node);

      for (
        const line of
        range.getClientRects()
      ) {
        if (
          line.left < canvas.left ||
          line.right >
            canvas.right + .1 ||
          line.top <
            canvas.top +
              20 * scale ||
          line.bottom >
            canvas.bottom -
              20 * scale
        ) {
          return false;
        }

        ink.left =
          Math.min(
            ink.left,
            line.left
          );

        ink.right =
          Math.max(
            ink.right,
            line.right
          );

        ink.top =
          Math.min(
            ink.top,
            line.top
          );

        ink.bottom =
          Math.max(
            ink.bottom,
            line.bottom
          );
      }
    }

    bounds.push(ink);
  }

  for (
    let i = 0;
    i < nodes.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < nodes.length;
      j++
    ) {
      const a = bounds[i];
      const b = bounds[j];

      if (
        Math.min(
          a.right,
          b.right
        ) -
          Math.max(
            a.left,
            b.left
          ) >
          scale &&
        Math.min(
          a.bottom,
          b.bottom
        ) -
          Math.max(
            a.top,
            b.top
          ) >
          scale
      ) {
        return false;
      }
    }
  }

  return true;
}
// Manual font sizes are the starting point; shrink only if actual bounds require it.
function fitMinimalPost(preview, headline, copy, cta, content) {
  const headBase = parseFloat(getComputedStyle(headline).fontSize);
  const copyBase = parseFloat(getComputedStyle(copy).fontSize);
  const gap = parseFloat(getComputedStyle(content).gap) || 30;
  for (const scale of fitLimits.scales) {
    headline.style.fontSize = Math.max(fitLimits.headline, headBase * scale) + 'px';
    copy.style.fontSize = Math.max(fitLimits.copy, copyBase * scale) + 'px';

    content.style.gap = Math.max(fitLimits.gap, gap * scale) + 'px';
    if (content.scrollHeight <= content.clientHeight + 2 && content.scrollWidth <= content.clientWidth + 2 && minimalBoundsSafe(preview, [headline, copy, cta])) return true;
  }
  return false;
}

function minimalBoundsSafe(preview, textNodes) {
  const canvas = preview.getBoundingClientRect();
  const scale = canvas.width / 1080;
  if (!scale) return false;
  const boxes = [];
  const logo = preview.querySelector('#preview-logo');
  for (const node of [...textNodes, logo, ...preview.querySelectorAll('.free-decoration')]) {
    if (!node.getClientRects().length) continue;
    const rect = node.getBoundingClientRect();
    const ink = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    if (node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const line of range.getClientRects()) {
      ink.left = Math.min(ink.left, line.left); ink.right = Math.max(ink.right, line.right);
      ink.top = Math.min(ink.top, line.top); ink.bottom = Math.max(ink.bottom, line.bottom);
    }
    const decorative = node.classList.contains('free-decoration');
    const side = decorative ? 0 : node === logo ? 20 : 80;
    const vertical = decorative ? 0 : node === logo ? 20 : 100;
    if (ink.left < canvas.left + side * scale || ink.right > canvas.right - side * scale ||
        ink.top < canvas.top + vertical * scale || ink.bottom > canvas.bottom - vertical * scale) return false;
    boxes.push(ink);
  }
  return boxes.every((a, i) => boxes.slice(i + 1).every(b =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) <= scale ||
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= scale));
}