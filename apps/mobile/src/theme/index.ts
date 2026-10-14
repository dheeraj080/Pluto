/**
 * The Pluto design system, in one import.
 *
 * `@/theme` is the only place a colour, a radius, a spacing step or a text
 * style should come from. Screens compose those raw tokens; they do not invent
 * values, and they do not read `globals.css`.
 */

import type { Palette } from './palette';

export {
  darkPalette,
  lightPalette,
  palettes,
  paletteFor,
  type ColorScheme,
  type Palette,
} from './palette';
export { fontFamily, fontSize, lineHeight, tabularNums, text } from './typography';
export { borderWidth, controlHeight, layout, radius, spacing } from './tokens';

/** The active colour tokens. Alias for `Palette`, for use in prop types. */
export type Theme = Palette;
