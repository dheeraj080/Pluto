/**
 * Generates the app's launcher icons, splash mark and favicon from the Pluto
 * brand geometry, so they can never drift from `lib/brand-mark.ts` on the web.
 *
 * The mark is the same planet-plus-orbit shape as the in-app `PlutoMark`
 * (`src/components/logo.tsx`), rendered here as a standalone SVG string and
 * rasterised with sharp.
 *
 * Run with `npm run assets:brand` from `apps/mobile`. `sharp` is resolved from
 * the workspace root (Next.js depends on it), so this is a developer tool, not
 * part of the build or CI.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const BRAND = {
  canvas: '#0B0C0E',
  emerald: '#34D399',
  /** Pale mint, so the planet reads against the near-black canvas. */
  planet: '#A7F3D0',
};

/**
 * The mark as a bare group on a 32×32 grid: a faint orbit, the planet, then the
 * front half of the ring closing with an exchange arrowhead. Same geometry as
 * `markSvg` in the web's `lib/brand-mark.ts`.
 */
function markBody({ ink, ring, strokeWidth = 2.6 }) {
  return [
    '<g transform="translate(4 4)">',
    '<g transform="rotate(-24 12 12)">',
    `<path d="M2.4 10.6 A10 4.2 0 0 1 20.6 10.2" stroke="${ring}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>`,
    '</g>',
    `<circle cx="12" cy="12" r="5.6" fill="${ink}"/>`,
    '<g transform="rotate(-24 12 12)">',
    `<path d="M20.6 13.8 A10 4.2 0 0 1 2.4 10.6" stroke="${ring}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>`,
    '<polygon points="19.0 11.2 22.8 12 21.6 8.4" fill="' + ring + '"/>',
    '</g>',
    '</g>',
  ].join('');
}

/**
 * An SVG at `viewBox` with a solid canvas plate behind the mark. The plate is
 * what gives the launcher icon its full-bleed background.
 */
function iconSvg(viewBox) {
  const [, , width, height] = viewBox.split(' ').map(Number);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${BRAND.canvas}"/>
  ${markBody({ ink: BRAND.planet, ring: BRAND.emerald })}
</svg>`;
}

/** Just the mark on transparency, for adaptive layers and the splash. */
function markSvg(viewBox, ink = BRAND.planet, ring = BRAND.emerald) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  ${markBody({ ink, ring })}
</svg>`;
}

/** A flat canvas plate, for the Android adaptive background layer. */
const PLATE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10">
  <rect x="0" y="0" width="10" height="10" fill="${BRAND.canvas}"/>
</svg>`;

const OUT = path.resolve(fileURLToPath(new URL('../assets/images', import.meta.url)));

async function render(svg, size, file) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(path.join(OUT, file), png);

  return file;
}

const written = [];

// Full-bleed app icon; the OS applies its own mask.
written.push(await render(iconSvg('0 0 32 32'), 1024, 'icon.png'));
// Android adaptive icon: plate, a mark that stays inside the safe zone, and a
// flat white monochrome layer for themed icons.
written.push(await render(PLATE_SVG, 1024, 'android-icon-background.png'));
written.push(await render(markSvg('-4 -4 40 40'), 1024, 'android-icon-foreground.png'));
written.push(await render(markSvg('-4 -4 40 40', '#FFFFFF', '#FFFFFF'), 1024, 'android-icon-monochrome.png'));
// Splash mark, drawn at `imageWidth` points over the splash background colour.
// Two variants: the pale mint reads on the near-black canvas, and the brand's
// own darkest ink carries the light-mode splash.
written.push(await render(markSvg('-2 -2 36 36'), 512, 'splash-icon.png'));
written.push(await render(markSvg('-2 -2 36 36', BRAND.canvas, '#059669'), 512, 'splash-icon-light.png'));
written.push(await render(iconSvg('0 0 32 32'), 48, 'favicon.png'));

console.log(`Wrote ${written.length} brand assets to ${path.relative(process.cwd(), OUT)}:`);
for (const file of written) console.log(`  ${file}`);
