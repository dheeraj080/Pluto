/**
 * Pluto typography.
 *
 * The web app loads Plus Jakarta Sans (body and display) and Geist Mono via
 * `next/font`. React Native has no CSS cascade, so every style states its
 * family and weight explicitly — and because Android will not reliably pick
 * a weight out of a bundled variable family, each weight is its own
 * registered family name (see `app/_layout.tsx`).
 *
 * Sizes and line heights mirror the Tailwind scale the web app actually uses
 * in the signed-in product (`text-sm` body, `text-xs` captions, `text-2xl`
 * page and stat titles). The two exceptions — the 15px button size and the
 * 18px display leading — are listed in `scripts/check-theme-parity.mjs`
 * alongside the web class each one stands in for. Geist Mono is only used on
 * admin and marketing screens, so mobile falls back to the platform monospace.
 */

import { Platform, PixelRatio, type TextStyle } from 'react-native';

/** Scale a font size by the device's font scale for dynamic type support. */
const fontScale = PixelRatio.getFontScale();
const scaleFont = (size: number): number => Math.round(size * fontScale * 100) / 100;

export const fontFamily = {
  /** Plus Jakarta Sans — body copy, labels, controls. */
  sans: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
  /** Plus Jakarta Sans — page titles and the wordmark only. */
  display: {
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
} as const;

export const fontSize = {
  xs: scaleFont(12),
  sm: scaleFont(14),
  base: scaleFont(15),
  md: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  xxl: scaleFont(24),
  xxxl: scaleFont(30),
};

export const lineHeight = {
  xs: scaleFont(16),
  sm: scaleFont(20),
  base: scaleFont(22),
  md: scaleFont(24),
  /** 26, not `text-lg`'s 28, so the 18px display and subtitle share one leading. */
  lg: scaleFont(26),
  xl: scaleFont(28),
  xxl: scaleFont(32),
  xxxl: scaleFont(36),
};

/**
 * Tabular figures, shared rather than inlined: `['tabular-nums'] as const`
 * infers a readonly tuple, which React Native's `fontVariant` rejects.
 */
const tabularFigures: TextStyle['fontVariant'] = ['tabular-nums'];

/** Tabular figures, for every money column. */
export const tabularNums = { fontVariant: tabularFigures } satisfies TextStyle;

/** Tailwind's `tracking-tight`, in px at the size it is used. */
const tight = (size: number) => Math.round(size * -0.025 * 100) / 100;
/** Tailwind's `tracking-wider`, in px at 12px. */
const wider = fontSize.xs * 0.05;

/**
 * Named text styles. Screens read these instead of hand-rolling sizes, so the
 * type scale can only change in one place.
 */
export const text = {
  /** Page title — `font-display text-2xl font-semibold tracking-tight`. */
  display: {
    fontFamily: fontFamily.display.semibold,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    letterSpacing: tight(fontSize.xxl),
  },
  /** Marketing-scale display, for the sign-in hero only. */
  displayLarge: {
    fontFamily: fontFamily.display.bold,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.xxxl,
    letterSpacing: tight(fontSize.xxxl),
  },
  /** Section/stat title — `text-2xl font-semibold tracking-tight`. */
  title: {
    fontFamily: fontFamily.sans.semibold,
    fontSize: fontSize.xxl,
    lineHeight: lineHeight.xxl,
    letterSpacing: tight(fontSize.xxl),
  },
  /** Sub-section title — `text-lg font-semibold tracking-tight`. */
  subtitle: {
    fontFamily: fontFamily.sans.semibold,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.lg,
    letterSpacing: tight(fontSize.lg),
  },
  /** Card and stat label — `text-xs font-semibold uppercase tracking-wider`. */
  overline: {
    fontFamily: fontFamily.sans.semibold,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    letterSpacing: wider,
    textTransform: 'uppercase',
  },
  /** Default body — `text-sm`. */
  body: {
    fontFamily: fontFamily.sans.regular,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  },
  /** Emphasised body — `text-sm font-medium`. */
  bodyMedium: {
    fontFamily: fontFamily.sans.medium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  },
  /** Strong body — `text-sm font-semibold`. */
  bodyStrong: {
    fontFamily: fontFamily.sans.semibold,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  },
  /** Large body — `text-[15px]`, used by the big button. */
  bodyLarge: {
    fontFamily: fontFamily.sans.medium,
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
  },
  /** Caption — `text-xs`. */
  caption: {
    fontFamily: fontFamily.sans.regular,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
  },
  /** Caption with emphasis — `text-xs font-medium`. */
  captionMedium: {
    fontFamily: fontFamily.sans.medium,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
  },
  /** Strong caption — `text-xs font-semibold`. */
  captionStrong: {
    fontFamily: fontFamily.sans.semibold,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
  },
  /** Money — tabular figures so columns line up. */
  amount: {
    fontFamily: fontFamily.sans.semibold,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontVariant: tabularFigures,
  },
  /** The hero figure on a dashboard card. */
  amountHero: {
    fontFamily: fontFamily.sans.semibold,
    fontSize: fontSize.xxxl,
    lineHeight: lineHeight.xxxl,
    letterSpacing: tight(fontSize.xxxl),
    fontVariant: tabularFigures,
  },
  /** Inline code — `font-mono text-xs`. */
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
  },
  /** "See all N" — `text-sm font-medium`, tinted to the accent. */
  link: {
    fontFamily: fontFamily.sans.medium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    letterSpacing: tight(fontSize.sm),
  },
  /** Alias for `link`, kept for the template's `linkPrimary` type. */
  linkPrimary: {
    fontFamily: fontFamily.sans.medium,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    letterSpacing: tight(fontSize.sm),
  },
} satisfies Record<string, TextStyle>;

export type TextStyleName = keyof typeof text;