/**
 * Pluto colour tokens.
 *
 * Both ramps are a 1:1 mirror of the design system's source of truth,
 * `apps/web/src/app/globals.css`: `darkPalette` matches `:root` and
 * `lightPalette` matches `:root[data-theme="light"]`. `scripts/check-theme-parity.mjs`
 * fails the build when either drifts, so any change there must be mirrored here.
 *
 * Neutrals are the same graphite ramp inverted around the brand's own darkest
 * value (`#0B0C0E` becomes the ink, and the near-black canvas becomes
 * near-white), and every accent moves to the darker step of its existing family
 * so ink stays above WCAG AA on a white surface. `#34D399` is only ~1.9:1 on
 * white, which is why light mode uses the emerald ramp's `#059669` — already the
 * dark theme's `primaryActive`.
 */

export interface Palette {
  /** Page background. */
  canvas: string;
  /** Cards and other raised panels. */
  surface: string;
  /** Inset controls: inputs, segmented tracks, secondary buttons. */
  surfaceMuted: string;
  /** Primary text. */
  ink: string;
  /** Secondary text, labels and captions. */
  muted: string;
  /** Hairline separators. */
  border: string;
  /** Emphasised hairline: active borders, empty-state dashes. */
  borderStrong: string;

  primary: string;
  primaryHover: string;
  primaryActive: string;
  /** Tinted wash behind accent chips and badges. */
  primarySubtle: string;
  onPrimary: string;

  accent: string;
  accentHover: string;
  accentStrong: string;
  accentSubtle: string;
  onAccent: string;

  gold: string;
  goldSubtle: string;

  danger: string;
  dangerHover: string;
  /** Solid destructive surface (the danger button). */
  dangerSolid: string;
  dangerSolidHover: string;
  dangerSubtle: string;
  onDanger: string;

  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;

  /** The restrained six-hue category palette. */
  cat: {
    mint: string;
    sky: string;
    amber: string;
    rose: string;
    violet: string;
    slate: string;
  };

  /** Second-currency series in dual-line charts: a quiet grey. */
  chartSecondary: string;

  /** Keyboard focus ring. */
  focusRing: string;

  /** Radial glow behind hero charts and the product card. */
  glow: string;
  glowStrong: string;
}

export const darkPalette: Palette = {
  canvas: '#0B0C0E',
  surface: '#131518',
  surfaceMuted: '#1B1E22',
  ink: '#F2F4F5',
  muted: '#A4ABB2',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',

  primary: '#34D399',
  primaryHover: '#10B981',
  primaryActive: '#059669',
  primarySubtle: 'rgba(52, 211, 153, 0.12)',
  onPrimary: '#05130D',

  accent: '#34D399',
  accentHover: '#10B981',
  accentStrong: '#6EE7B7',
  accentSubtle: 'rgba(52, 211, 153, 0.12)',
  onAccent: '#05130D',

  gold: '#FBBF24',
  goldSubtle: 'rgba(251, 191, 36, 0.14)',

  danger: '#F87171',
  dangerHover: '#FCA5A5',
  dangerSolid: '#B91C1C',
  dangerSolidHover: '#991B1B',
  dangerSubtle: 'rgba(248, 113, 113, 0.14)',
  onDanger: '#2A0808',

  success: '#34D399',
  successSubtle: 'rgba(52, 211, 153, 0.12)',
  warning: '#FBBF24',
  warningSubtle: 'rgba(251, 191, 36, 0.14)',

  cat: {
    mint: '#34D399',
    sky: '#7DD3FC',
    amber: '#FCD34D',
    rose: '#FDA4AF',
    violet: '#C4B5FD',
    slate: '#94A3B8',
  },

  chartSecondary: '#CBD5E1',
  focusRing: '#34D399',
  glow: 'rgba(52, 211, 153, 0.22)',
  glowStrong: 'rgba(52, 211, 153, 0.34)',
};

export const lightPalette: Palette = {
  canvas: '#F7F8F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F4',
  ink: '#0B0C0E',
  muted: '#5B656D',
  border: 'rgba(11, 12, 14, 0.09)',
  borderStrong: 'rgba(11, 12, 14, 0.18)',

  primary: '#059669',
  primaryHover: '#047857',
  primaryActive: '#065F46',
  primarySubtle: 'rgba(5, 150, 105, 0.10)',
  onPrimary: '#FFFFFF',

  accent: '#059669',
  accentHover: '#047857',
  accentStrong: '#047857',
  accentSubtle: 'rgba(5, 150, 105, 0.10)',
  onAccent: '#FFFFFF',

  gold: '#B45309',
  goldSubtle: 'rgba(180, 83, 9, 0.10)',

  danger: '#DC2626',
  dangerHover: '#B91C1C',
  dangerSolid: '#B91C1C',
  dangerSolidHover: '#991B1B',
  dangerSubtle: 'rgba(220, 38, 38, 0.08)',
  onDanger: '#FFFFFF',

  success: '#047857',
  successSubtle: 'rgba(5, 150, 105, 0.10)',
  warning: '#B45309',
  warningSubtle: 'rgba(180, 83, 9, 0.10)',

  cat: {
    mint: '#059669',
    sky: '#0284C7',
    amber: '#D97706',
    rose: '#E11D48',
    violet: '#7C3AED',
    slate: '#64748B',
  },

  chartSecondary: '#94A3B8',
  focusRing: '#059669',
  glow: 'rgba(5, 150, 105, 0.16)',
  glowStrong: 'rgba(5, 150, 105, 0.26)',
};

/** A scheme key that always names a palette, even before the OS reports one. */
export type ColorScheme = 'light' | 'dark';

export const palettes: Record<ColorScheme, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** Narrowing helper: `Palette` for a scheme, defaulting anything unknown to `light`. */
export function paletteFor(scheme: string | null | undefined): Palette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}
