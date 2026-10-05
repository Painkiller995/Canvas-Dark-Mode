export const PALETTES = ['dim', 'graphite', 'midnight'] as const;

export type Palette = (typeof PALETTES)[number];

/**
 * sRGB approximations of each palette's tokens, used by the extension UI for previews.
 * Derived from the OKLCH values in `content/theme.css`; keep the two in sync.
 */
export const PALETTE_SWATCHES: Record<
  Palette,
  { nav: string; page: string; surface: string; border: string; text: string; muted: string }
> = {
  dim: { nav: '#252628', page: '#2e2f31', surface: '#37383b', border: '#4a4c4f', text: '#e6e8eb', muted: '#a8abb1' },
  graphite: {
    nav: '#151618',
    page: '#1d1e20',
    surface: '#252629',
    border: '#38393c',
    text: '#e6e8eb',
    muted: '#a8abb1',
  },
  midnight: {
    nav: '#050506',
    page: '#0a0b0d',
    surface: '#121315',
    border: '#232427',
    text: '#dddee1',
    muted: '#9ea1a8',
  },
};
