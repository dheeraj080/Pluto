/**
 * Shared brand-mark geometry as a standalone SVG string.
 *
 * Used by the generated app icon and the Open Graph image, whose renderers
 * (Satori) consume an inline SVG data URI rather than React components.
 */

export const BRAND = {
  canvas: "#0B0C0E",
  surface: "#131518",
  raised: "#1B1E22",
  ink: "#F2F4F5",
  muted: "#A4ABB2",
  emerald: "#34D399",
  emeraldDeep: "#10B981",
  mint: "#6EE7B7",
  /** Pale mint used for the planet so it reads on dark surfaces. */
  planetDark: "#A7F3D0",
  /** Near-black used for the planet so it reads on light surfaces. */
  planetLight: "#0B0C0E",
} as const;

/**
 * The planet-and-orbit mark. `ink` paints the planet, `ring` the orbit arrow.
 * `background` is optional; when set, a rounded square is painted behind it.
 */
export function markSvg({
  ink,
  ring,
  background,
  radius = 7,
  strokeWidth = 2.4,
  viewBox = 32,
}: {
  ink: string;
  ring: string;
  background?: string;
  radius?: number;
  strokeWidth?: number;
  viewBox?: number;
}): string {
  const bg = background
    ? `<rect width="32" height="32" rx="${radius}" fill="${background}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}" width="${viewBox}" height="${viewBox}">` +
    bg +
    `<g transform="translate(4 4)">` +
    `<g transform="rotate(-24 12 12)">` +
    `<path d="M2.4 10.6 A10 4.2 0 0 1 20.6 10.2" stroke="${ring}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>` +
    `</g>` +
    `<circle cx="12" cy="12" r="5.5" fill="${ink}"/>` +
    `<g transform="rotate(-24 12 12)">` +
    `<path d="M20.6 13.8 A10 4.2 0 0 1 2.4 10.6" stroke="${ring}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>` +
    `<polygon points="19.1 11.3 22.6 12 21.5 8.5" fill="${ring}"/>` +
    `</g>` +
    `</g>` +
    `</svg>`
  );
}

/** Base64 data URI for embedding the mark in Satori-rendered images. */
export function markDataUri(options: Parameters<typeof markSvg>[0]): string {
  const svg = markSvg(options);
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf8").toString("base64")
      : btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}
