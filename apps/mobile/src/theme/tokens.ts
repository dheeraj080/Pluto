/**
 * Pluto layout tokens: spacing, radii, control sizes and page metrics.
 *
 * The web app expresses these as Tailwind utilities; the mapping is noted
 * against each value so the two stay comparable. Everything sits on a 4pt
 * grid.
 */

import { StyleSheet } from 'react-native';

/** 4pt grid. */
export const spacing = {
  none: 0,
  /** 4 — `gap-1`. */
  xs: 4,
  /** 8 — `gap-2`. */
  sm: 8,
  /** 12 — `gap-3`. */
  md: 12,
  /** 16 — `gap-4` / card padding at the sm breakpoint. */
  lg: 16,
  /** 20 — `gap-5`. */
  xl: 20,
  /** 24 — `p-6`, the desktop card padding. */
  xxl: 24,
  /** 32 — `gap-8`. */
  xxxl: 32,
  /** 48 — section rhythm. */
  huge: 48,
} as const;

/**
 * Corner radii, named after their Tailwind equivalents:
 * `sm` = `rounded-lg`, `lg` = `rounded-xl`, `xl` = `rounded-2xl`,
 * `xxxl` = `rounded-3xl`, `md` = `rounded-[10px]` (segmented options).
 */
export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  pill: 999,
} as const;

/** Button heights: `h-8` / `h-10` / `h-11`. */
export const controlHeight = {
  sm: 32,
  md: 40,
  lg: 44,
} as const;

/**
 * Hairline for separators and card borders. `StyleSheet.hairlineWidth` keeps
 * the 1px web border from turning into a heavy slab on a 3x display.
 */
export const borderWidth = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  thick: 2,
} as const;

export const layout = {
  /** Horizontal page gutter, matching the web's `px-4`. */
  gutter: spacing.lg,
  /** Long-form content stops widening here (the web uses `max-w-*`). */
  maxContentWidth: 800,
} as const;
