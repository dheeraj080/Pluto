/**
 * Transitional token exports.
 *
 * `@/theme` is the design system; this module exists only so the screens
 * written before it keep compiling, by re-stating the old template's token
 * *names* on top of the Pluto palette. The shell/screen pass deletes it.
 *
 * **New code must import from `@/theme`.**
 */

import { layout, palettes, type Palette } from '@/theme';

/** Old surface/text names, kept as aliases onto their Pluto equivalents. */
type LegacyKey = 'text' | 'background' | 'backgroundElement' | 'backgroundSelected' | 'textSecondary';

/** The palette plus its deprecated names — what `useTheme()` returns today. */
export type ThemedColors = Palette & Record<LegacyKey, string>;

/** Every token `ThemedText`/`ThemedView` can address by name. */
type StringKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

export type ThemeColor =
  | StringKeys<Palette>
  | LegacyKey
  | 'textPrimary'
  | 'textDanger'
  | 'textSuccess'
  | 'textWarning'
  | 'textGold'
  | 'textAccent'
  | 'textInk'
  | 'textMuted';

/** The palette per colour scheme, plus the deprecated aliases. */
export const Colors = {
  light: {
    ...palettes.light,
    text: palettes.light.ink,
    background: palettes.light.canvas,
    backgroundElement: palettes.light.surfaceMuted,
    backgroundSelected: palettes.light.surface,
    textSecondary: palettes.light.muted,
  },
  dark: {
    ...palettes.dark,
    text: palettes.dark.ink,
    background: palettes.dark.canvas,
    backgroundElement: palettes.dark.surfaceMuted,
    backgroundSelected: palettes.dark.surface,
    textSecondary: palettes.dark.muted,
  },
} as const;

/**
 * @deprecated Use `spacing` from `@/theme`.
 *
 * A literal rather than an alias: the old scale has a 2pt and a 64pt step that
 * the 4pt grid in `@/theme` does not carry.
 */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** @deprecated Use `layout.tabBarInset` from `@/theme`. */
export const BottomTabInset = layout.tabBarInset;

/** @deprecated Use `layout.maxContentWidth` from `@/theme`. */
export const MaxContentWidth = layout.maxContentWidth;

/** Resolves a semantic colour name onto the palette, including aliases such
 * as `text-primary` (the web's `text-primary` utility). */
export function resolveThemeColor(theme: ThemedColors, key: ThemeColor): string {
  switch (key) {
    case 'text':
    case 'textInk':
      return theme.ink;
    case 'background':
      return theme.canvas;
    case 'backgroundElement':
      return theme.surfaceMuted;
    case 'backgroundSelected':
      return theme.surface;
    case 'textSecondary':
    case 'textMuted':
      return theme.muted;
    case 'textPrimary':
      return theme.primary;
    case 'textDanger':
      return theme.danger;
    case 'textSuccess':
      return theme.success;
    case 'textWarning':
      return theme.warning;
    case 'textGold':
      return theme.gold;
    case 'textAccent':
      return theme.accent;
    default:
      return theme[key] as string;
  }
}