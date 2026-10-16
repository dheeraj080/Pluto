/**
 * Pluto typography.
 *
 * The web app loads Inter (body), Space Grotesk (display/headings) and Geist
 * Mono via `next/font`. React Native has no CSS cascade, so every style states
 * its family and weight explicitly — and because Android will not reliably
 * pick a weight out of a bundled variable family, each weight is its own
 * registered family name (see `app/_layout.tsx`).
 *
 * Sizes and line heights mirror the Tailwind scale the web app actually uses
 * in the signed-in product (`text-sm` body, `text-xs` captions, `text-2xl`
 * page and stat titles). The two exceptions — the 15px button size and the
 * 18px display leading — are listed in `scripts/check-theme-parity.mjs`
 * alongside the web class each one stands in for. Geist Mono is only used on
 * admin and marketing screens, so mobile falls back to the platform monospace.
 */

import { Platform, type TextStyle } from 'react-native';

export const fontFamily = {
  /** Inter — body copy, labels, controls. */
  sans: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  /** Space Grotesk — page titles and the wordmark only. */
  display: {
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  base: 22,
  md: 24,
  /** 26, not `text-lg`'s 28, so the 18px display and subtitle share one leading. */
  lg: 26,
  xl: 28,
  xxl: 32,
  xxxl: 36,
} as const;

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