/**
 * The restrained category palette.
 *
 * Six muted-but-distinguishable hues chosen to sit calmly on the graphite
 * surfaces — no saturated rainbow. Category colours live per-row in the
 * database, so this module is the single source for:
 *
 * - the preset swatches offered when creating or editing a category,
 * - the default colour assigned to a brand-new category,
 * - a stable fallback when a stored colour is missing or a list is rendered
 *   without one.
 *
 * The hexes mirror the `--cat-*` tokens in `globals.css`; that file is the
 * source of truth for CSS, this one for anywhere a colour has to be an inline
 * value (chart strokes, `style={{ background }}` swatches).
 */

export interface CategoryHue {
  /** Stable key, also the CSS token suffix (`--cat-<key>`). */
  key: string;
  /** Human label, used as the swatch's accessible name. */
  label: string;
  hex: string;
}

export const CATEGORY_PALETTE: readonly CategoryHue[] = [
  { key: "mint", label: "Mint", hex: "#34d399" },
  { key: "sky", label: "Sky", hex: "#7dd3fc" },
  { key: "amber", label: "Amber", hex: "#fcd34d" },
  { key: "rose", label: "Rose", hex: "#fda4af" },
  { key: "violet", label: "Violet", hex: "#c4b5fd" },
  { key: "slate", label: "Slate", hex: "#94a3b8" },
] as const;

/** Colour for a brand-new category that has no colour of its own. */
export const DEFAULT_CATEGORY_COLOR = CATEGORY_PALETTE[0].hex;

/** Colour for a category at `index`, cycling through the palette. */
export function categoryColorAt(index: number): string {
  const size = CATEGORY_PALETTE.length;
  const wrapped = ((index % size) + size) % size;
  return CATEGORY_PALETTE[wrapped].hex;
}

/** True when `hex` is one of the preset swatches (case-insensitive). */
export function isPresetColor(hex: string): boolean {
  const normalized = hex.trim().toLowerCase();
  return CATEGORY_PALETTE.some((hue) => hue.hex.toLowerCase() === normalized);
}
