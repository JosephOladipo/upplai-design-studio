export const designStyles = [
  {
    id: 'premium-editorial',
    name: 'Premium Editorial',
    description: 'A light editorial composition with serif type and restrained brand accents.',
    layout: { alignment: 'left', headline: 'serif', accent: 'rule' }
  },

  {
    id: 'infographic',
    name: 'Infographic',
    description: 'A structured explanation with line-by-line content rows and restrained accents.',
    layout: { alignment: 'left', headline: 'sans', accent: 'blocks' }
  },

  {
    id: 'simple-text',
    name: 'Simple Text',
    description: 'Centered sans-serif typography on a quiet blue field with an understated CTA.',
    layout: { alignment: 'center', headline: 'sans', accent: 'none' }
  },

  {
    id: 'bold-statement',
    name: 'Bold Statement',
    description: 'Oversized statement typography, a highlighted final word, and bold brand shapes.',
    layout: { alignment: 'left', headline: 'uppercase', accent: 'background' }
  },

  {
    id: 'data-stat',
    name: 'Data Stat',
    description: 'A supplied number takes focus, with its context intact and a subtle analytical grid.',
    layout: { alignment: 'left', headline: 'oversized', accent: 'divider' }
  },

  {
    id: 'product-feature',
    name: 'Product Feature',
    description: 'Abstract brand geometry above a feature-led headline, benefit copy, and prominent CTA.',
    layout: { alignment: 'left', headline: 'sans', accent: 'card' }
  },

  {
    id: 'minimal-post',
    name: 'Minimal Post',
    description: 'A clean text-led social design with restrained typography, generous space, and optional CTA.',
    layout: {
      alignment: 'center',
      headline: 'sans',
      accent: 'minimal'
    }
  }
,
  { id: 'free-style', name: 'Free Style', description: 'Automatic local compositions with optional typography overrides.', layout: { alignment: 'left', headline: 'sans', accent: 'free' } },
  { id: 'openai-style', name: 'OpenAI Style', description: 'AI visual direction with exact local text, logo and PNG output.', layout: { alignment: 'left', headline: 'sans', accent: 'ai' } }
];
