// Phase 8 — Brand Kit
// Central brand configuration used by all design methods.

const STORAGE_KEY = 'upplai-design-studio-brand-kit';
export const LOGO_MAX_BYTES = 350 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function normalizeBrandColor(value) {
  const match = typeof value === 'string' && value.trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? '#' + match[1].toUpperCase() : '';
}

export function validateLogoFile(file) {
  if (!file || !LOGO_TYPES.includes(file.type)) return 'Choose a PNG, JPG, or WebP logo.';
  if (file.size > LOGO_MAX_BYTES) return 'Logo files must be 350 KB or smaller.';
  return '';
}

export const defaultBrandKit = {
  brandName: 'Upplai',

  aiInstruction: 'Create artwork using the Upplai brand identity. Prioritize Upplai blue tones (#50C4F8, #2BB7F7, #0AABF1) as the dominant brand colors. Maintain a clean, modern, premium AI and career-tech aesthetic with strong visual hierarchy, professional composition, generous spacing, and high readability. Supporting neutral colors such as white, black, dark navy, and subtle gray may be used where appropriate. Avoid unrelated dominant colors unless specifically requested. Keep every artwork visually recognizable as part of the same Upplai brand family.',

  logos: {    primary: '/assets/upplai-logo.png',
    white: '',
    dark: '',
    icon: ''
  },

  colors: {
    primary: '#50C4F8',
    secondary: '#2BB7F7',
    accent: '#E24C8E',
    dark: '#101D30',
    light: '#FFFFFF'
  },

  fonts: {
    heading: 'Inter',
    body: 'Inter'
  }
};


function cloneDefault() {
  return JSON.parse(
    JSON.stringify(defaultBrandKit)
  );
}


export function loadBrandKit() {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return cloneDefault();
    }

    const parsed =
      JSON.parse(saved);

    return {
      ...cloneDefault(),
      ...parsed,

      logos: {
        ...defaultBrandKit.logos,
        ...(parsed.logos || {})
      },

      colors: {
        ...defaultBrandKit.colors,
        ...(parsed.colors || {})
      },

      fonts: {
        ...defaultBrandKit.fonts,
        ...(parsed.fonts || {})
      }
    };
  } catch {
    return cloneDefault();
  }
}


export function saveBrandKit(brandKit) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(brandKit)
  );

  return brandKit;
}


export function resetBrandKit() {
  const fresh =
    cloneDefault();

  localStorage.removeItem(
    STORAGE_KEY
  );

  return fresh;
}


export function updateBrandKit(changes) {
  const current =
    loadBrandKit();

  const updated = {
    ...current,
    ...changes,

    logos: {
      ...current.logos,
      ...(changes.logos || {})
    },

    colors: {
      ...current.colors,
      ...(changes.colors || {})
    },

    fonts: {
      ...current.fonts,
      ...(changes.fonts || {})
    }
  };

  saveBrandKit(updated);

  return updated;
}


export function validateBrandKit(brandKit) {
  if (
    !brandKit ||
    typeof brandKit !== 'object'
  ) {
    return false;
  }

  if (
    typeof brandKit.brandName !== 'string' ||
    !brandKit.brandName.trim()
  ) {
    return false;
  }

  const requiredColors = [
    'primary',
    'secondary',
    'accent',
    'dark',
    'light'
  ];

  for (const key of requiredColors) {
    if (
      !/^#[0-9a-f]{6}$/i.test(
        brandKit.colors?.[key] || ''
      )
    ) {
      return false;
    }
  }

  return true;
}


