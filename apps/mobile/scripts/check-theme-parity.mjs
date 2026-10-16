/**
 * Guards the mobile palettes against the design system's source of truth.
 *
 * The web app's `globals.css` owns the colour tokens; `src/theme/palette.ts`
 * mirrors them for React Native, which cannot read CSS. A mirror drifts the
 * first time someone edits one side, so this script cross-checks every mapped
 * token and fails `typecheck` on any difference.
 *
 * Both ramps are asserted: `:root` in the CSS is the dark theme and mirrors
 * `darkPalette`, and the `:root[data-theme="light"]` block mirrors
 * `lightPalette`. It compares *values only*.
 *
 * Both files are hand-written, so the parsers are deliberately simple. A
 * reflowed file fails loudly rather than silently skipping a token.
 *
 * The remaining scales — spacing, radii, control heights and type — are
 * declared nowhere in the web app: it uses Tailwind's utilities, so
 * `tailwindcss/theme.css` is their source of truth, with any `@theme` override
 * in `globals.css` layered on top. `src/theme/tokens.ts` and
 * `src/theme/typography.ts` mirror those, and the handful of tokens that
 * deliberately do not are listed in `DEVIATIONS`, so an accidental drift still
 * fails while an intentional one stays visible.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

const CSS_FILE = path.join(repoRoot, 'apps/web/src/app/globals.css');
const PALETTE_FILE = path.join(repoRoot, 'apps/mobile/src/theme/palette.ts');
const TOKENS_FILE = path.join(repoRoot, 'apps/mobile/src/theme/tokens.ts');
const TYPOGRAPHY_FILE = path.join(repoRoot, 'apps/mobile/src/theme/typography.ts');
/** Tailwind v4's default theme: the source of the spacing, type and radius scales. */
const TAILWIND_THEME_FILE = path.join(repoRoot, 'node_modules/tailwindcss/theme.css');

/** CSS custom property -> key path inside the palette (dots for nesting). */
const MAP = {
  canvas: 'canvas',
  surface: 'surface',
  'surface-muted': 'surfaceMuted',
  ink: 'ink',
  muted: 'muted',
  border: 'border',
  'border-strong': 'borderStrong',
  primary: 'primary',
  'primary-hover': 'primaryHover',
  'primary-active': 'primaryActive',
  'primary-subtle': 'primarySubtle',
  'on-primary': 'onPrimary',
  accent: 'accent',
  'accent-hover': 'accentHover',
  'accent-strong': 'accentStrong',
  'accent-subtle': 'accentSubtle',
  'on-accent': 'onAccent',
  gold: 'gold',
  'gold-subtle': 'goldSubtle',
  danger: 'danger',
  'danger-hover': 'dangerHover',
  'danger-solid': 'dangerSolid',
  'danger-solid-hover': 'dangerSolidHover',
  'danger-subtle': 'dangerSubtle',
  'on-danger': 'onDanger',
  success: 'success',
  'success-subtle': 'successSubtle',
  warning: 'warning',
  'warning-subtle': 'warningSubtle',
  'cat-mint': 'cat.mint',
  'cat-sky': 'cat.sky',
  'cat-amber': 'cat.amber',
  'cat-rose': 'cat.rose',
  'cat-violet': 'cat.violet',
  'cat-slate': 'cat.slate',
  'chart-secondary': 'chartSecondary',
  'focus-ring': 'focusRing',
  glow: 'glow',
  'glow-strong': 'glowStrong',
};

/** Which CSS selector mirrors which `palette.ts` export. */
const THEMES = [
  { label: 'dark', selector: ':root', exportName: 'darkPalette' },
  { label: 'light', selector: ':root[data-theme="light"]', exportName: 'lightPalette' },
];

/** Colour comparison ignores case, spacing and hex-case. */
function normalise(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

/** Reads the custom properties out of one CSS rule block. */
function parseCssTokens(source, selector, { label }) {
  // Anchor to a line start so a selector quoted inside a comment (like the
  // `:root[data-theme="light"]` mention in the file header) is not mistaken
  // for the rule itself.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`^${escaped}\\s*\\{`, 'm');
  const match = rule.exec(source);

  if (!match) {
    throw new Error(`Could not find the "${selector}" (${label}) block in ${CSS_FILE}`);
  }

  const open = source.indexOf('{', match.index);
  const close = source.indexOf('}', open);

  if (open < 0 || close < 0) {
    throw new Error(`Could not find the "${selector}" (${label}) block in ${CSS_FILE}`);
  }

  const tokens = {};
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let token;

  while ((token = pattern.exec(source.slice(open + 1, close))) !== null) {
    tokens[token[1]] = token[2].trim();
  }

  return tokens;
}

/** Reads the top level and one level of nesting out of a palette object. */
function parsePaletteObject(source, exportName) {
  const start = source.indexOf(`export const ${exportName}`);
  const open = source.indexOf('{', start);

  if (start < 0 || open < 0) {
    throw new Error(`Could not find \`${exportName}\` in ${PALETTE_FILE}`);
  }

  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }

  if (close < 0) {
    throw new Error(`Unbalanced braces in \`${exportName}\` (${PALETTE_FILE})`);
  }

  const values = {};
  const stack = [values];

  for (const raw of source.slice(open + 1, close).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    const nested = line.match(/^(\w+)\s*:\s*\{$/);
    if (nested) {
      const child = {};
      stack[stack.length - 1][nested[1]] = child;
      stack.push(child);
      continue;
    }

    if (line === '}' || line === '},') {
      if (stack.length === 1) throw new Error(`Unexpected closing brace in \`${exportName}\` (${PALETTE_FILE})`);
      stack.pop();
      continue;
    }

    const pair = line.match(/^(\w+)\s*:\s*'([^']*)',$/);
    if (pair) {
      stack[stack.length - 1][pair[1]] = pair[2];
      continue;
    }

    throw new Error(`Unparsed line in \`${exportName}\`: ${line}`);
  }

  if (stack.length !== 1) throw new Error(`Unbalanced braces in \`${exportName}\` (${PALETTE_FILE})`);

  return values;
}

function lookup(object, keyPath) {
  return keyPath.split('.').reduce((node, key) => (node == null ? undefined : node[key]), object);
}

/* ------------------------------------------------------------------ */
/* The numeric scales (spacing, radii, controls, type)                */
/* ------------------------------------------------------------------ */

/**
 * Where each mobile token lands on Tailwind's scale. The value is the Tailwind
 * step number for spacing/controls (e.g. `4` is `gap-4`) or the token name for
 * radii and type (e.g. `lg` is `rounded-lg` / `text-lg`).
 */
const ROOT_FONT_PX = 16;

const SPACING_STEPS = { none: 0, xs: 1, sm: 2, md: 3, lg: 4, xl: 5, xxl: 6, xxxl: 8, huge: 12 };
const CONTROL_STEPS = { sm: 8, md: 10, lg: 11 };
const RADIUS_TOKENS = { xs: 'md', sm: 'lg', lg: 'xl', xl: '2xl', xxxl: '3xl' };
const TEXT_TOKENS = { xs: 'xs', sm: 'sm', md: 'base', lg: 'lg', xl: 'xl', xxl: '2xl', xxxl: '3xl' };

/**
 * Tokens that deliberately do not mirror Tailwind, and why. These are reported
 * but never compared, so a conscious deviation does not read as a bug — while
 * anything *not* listed here still has to match. Each arbitrary value is one
 * the web app also spells out (`rounded-[10px]`, `text-[15px]`, …).
 */
const DEVIATIONS = {
  spacing: {},
  controlHeight: {},
  radius: {
    md: 'rounded-[10px] (segmented options)',
    xxl: 'rounded-[20px] (chart cards)',
    pill: 'RN has no `rounded-full`/infinity radius',
  },
  fontSize: { base: 'text-[15px] (the big button)' },
  lineHeight: {
    base: 'follows text-[15px]',
    lg: 'mobile display leading; `amount.tsx` pins the same 26 by hand',
  },
};

/** Removes CSS comments so a commented-out property is never read. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Flattens every `--name: value;` declaration in a stylesheet. */
function parseCustomProperties(css) {
  const tokens = {};
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let token;
  while ((token = pattern.exec(css)) !== null) tokens[token[1]] = token[2].trim();
  return tokens;
}

/** `0.25rem` / `4px` / `0` -> pixels. Returns null for anything else. */
function lengthToPx(value) {
  const rem = /^(-?[\d.]+)rem$/.exec(value);
  if (rem) return Number(rem[1]) * ROOT_FONT_PX;
  const px = /^(-?[\d.]+)px$/.exec(value);
  if (px) return Number(px[1]);
  if (value === '0') return 0;
  return null;
}

/** `calc(1.5 / 1)` or a bare number -> a unitless ratio. */
function ratioOf(value) {
  const calc = /^calc\(\s*([\d.]+)\s*\/\s*([\d.]+)\s*\)$/.exec(value);
  if (calc) return Number(calc[1]) / Number(calc[2]);
  const bare = Number(value);
  return Number.isFinite(bare) ? bare : null;
}

/** Reads `export const NAME = { key: number, ... }` out of a token file. */
function parseNumericObject(source, exportName, file) {
  const start = source.indexOf(`export const ${exportName}`);
  if (start < 0) throw new Error(`Could not find \`${exportName}\` in ${file}`);

  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  if (open < 0 || close < 0) throw new Error(`Could not find a body for \`${exportName}\` in ${file}`);

  const values = {};
  for (const raw of source.slice(open + 1, close).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    const pair = /^(\w+)\s*:\s*(-?[\d.]+),$/.exec(line);
    if (pair) {
      values[pair[1]] = Number(pair[2]);
      continue;
    }

    throw new Error(`Unparsed line in \`${exportName}\` (${file}): ${line}`);
  }

  return values;
}

/** Compares one mirrored scale against Tailwind, reporting any drift. */
function checkScale(label, mobile, expectedFor, deviations, problems) {
  for (const [key, value] of Object.entries(mobile)) {
    if (Object.prototype.hasOwnProperty.call(deviations, key)) continue;

    const expected = expectedFor(key);
    if (expected === undefined) {
      problems.push(`[${label}] ${key} (${value}) has no Tailwind mapping here`);
    } else if (expected === null) {
      problems.push(`[${label}] could not read the Tailwind value for ${key}`);
    } else if (Math.abs(value - expected) > 0.01) {
      problems.push(`[${label}] ${key} mismatch: mobile has ${value}, Tailwind has ${expected}`);
    }
  }
}

const [cssSource, paletteSource, tokensSource, typographySource, tailwindSource] = await Promise.all([
  readFile(CSS_FILE, 'utf8'),
  readFile(PALETTE_FILE, 'utf8'),
  readFile(TOKENS_FILE, 'utf8'),
  readFile(TYPOGRAPHY_FILE, 'utf8'),
  readFile(TAILWIND_THEME_FILE, 'utf8'),
]);

const problems = [];

for (const theme of THEMES) {
  const css = parseCssTokens(cssSource, theme.selector, theme);
  const palette = parsePaletteObject(paletteSource, theme.exportName);

  for (const [token, keyPath] of Object.entries(MAP)) {
    const fromCss = css[token];
    const fromPalette = lookup(palette, keyPath);

    if (fromCss === undefined) {
      problems.push(`[${theme.label}] globals.css is missing --${token} (mapped to ${theme.exportName}.${keyPath})`);
      continue;
    }

    if (fromPalette === undefined) {
      problems.push(`[${theme.label}] ${theme.exportName}.${keyPath} is missing (expected --${token}: ${fromCss})`);
      continue;
    }

    if (normalise(fromCss) !== normalise(fromPalette)) {
      problems.push(
        `[${theme.label}] --${token} mismatch: globals.css has "${fromCss}", ${theme.exportName}.${keyPath} has "${fromPalette}"`,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Scale parity                                                        */
/* ------------------------------------------------------------------ */

/** Tailwind's defaults, with any `@theme` override in globals.css layered on top. */
const tailwind = parseCustomProperties(stripComments(tailwindSource));
for (const block of stripComments(cssSource).matchAll(/@theme[^{]*\{([\s\S]*?)\}/g)) {
  Object.assign(tailwind, parseCustomProperties(block[1]));
}

const spacingPx = lengthToPx(tailwind.spacing ?? '');
if (spacingPx === null) throw new Error(`Could not read --spacing from ${TAILWIND_THEME_FILE}`);

const mobileSpacing = parseNumericObject(tokensSource, 'spacing', TOKENS_FILE);
const mobileRadius = parseNumericObject(tokensSource, 'radius', TOKENS_FILE);
const mobileControlHeight = parseNumericObject(tokensSource, 'controlHeight', TOKENS_FILE);
const mobileFontSize = parseNumericObject(typographySource, 'fontSize', TYPOGRAPHY_FILE);
const mobileLineHeight = parseNumericObject(typographySource, 'lineHeight', TYPOGRAPHY_FILE);

/** Tailwind spacing utilities are `calc(var(--spacing) * n)`. */
const stepPx = (step) => (step === undefined ? undefined : step * spacingPx);

checkScale('spacing', mobileSpacing, (key) => stepPx(SPACING_STEPS[key]), DEVIATIONS.spacing, problems);
checkScale(
  'controlHeight',
  mobileControlHeight,
  (key) => stepPx(CONTROL_STEPS[key]),
  DEVIATIONS.controlHeight,
  problems,
);
checkScale(
  'radius',
  mobileRadius,
  (key) => {
    const token = RADIUS_TOKENS[key];
    return token === undefined ? undefined : lengthToPx(tailwind[`radius-${token}`] ?? '');
  },
  DEVIATIONS.radius,
  problems,
);
checkScale(
  'fontSize',
  mobileFontSize,
  (key) => {
    const token = TEXT_TOKENS[key];
    return token === undefined ? undefined : lengthToPx(tailwind[`text-${token}`] ?? '');
  },
  DEVIATIONS.fontSize,
  problems,
);
checkScale(
  'lineHeight',
  mobileLineHeight,
  (key) => {
    const token = TEXT_TOKENS[key];
    if (token === undefined) return undefined;
    const size = lengthToPx(tailwind[`text-${token}`] ?? '');
    const ratio = ratioOf(tailwind[`text-${token}--line-height`] ?? '');
    return size === null || ratio === null ? null : size * ratio;
  },
  DEVIATIONS.lineHeight,
  problems,
);

const scaleCount = [mobileSpacing, mobileRadius, mobileControlHeight, mobileFontSize, mobileLineHeight]
  .reduce((total, scale) => total + Object.keys(scale).length, 0);
const deviationNames = Object.entries(DEVIATIONS).flatMap(([scale, group]) =>
  Object.keys(group).map((key) => `${scale}.${key}`),
);

if (problems.length > 0) {
  console.error(`Theme parity check failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\nColours must mirror apps/web/src/app/globals.css (src/theme/palette.ts); ` +
      `scales must mirror Tailwind (src/theme/tokens.ts, src/theme/typography.ts).`,
  );
  process.exit(1);
}

const colourCount = Object.keys(MAP).length;
console.log(
  `Theme parity OK — ${colourCount} colour tokens across ${THEMES.length} themes, ` +
    `${scaleCount - deviationNames.length} scale tokens match Tailwind.`,
);
if (deviationNames.length > 0) {
  console.log(`Deliberately off-scale (${deviationNames.length}): ${deviationNames.join(', ')}.`);
}
