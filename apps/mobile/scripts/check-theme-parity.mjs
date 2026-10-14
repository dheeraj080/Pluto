/**
 * Guards the mobile dark palette against the design system's source of truth.
 *
 * The web app's `globals.css` owns the dark colour tokens; `src/theme/palette.ts`
 * mirrors them for React Native, which cannot read CSS. A mirror drifts the
 * first time someone edits one side, so this script cross-checks every mapped
 * token and fails `typecheck` on any difference.
 *
 * It compares *values only*, and only the `darkPalette`: the light palette is a
 * mobile-only invention (the web has no light theme) and is deliberately not
 * asserted against anything.
 *
 * Both files are hand-written, so the parsers are deliberately simple. A
 * reflowed file fails loudly rather than silently skipping a token.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

const CSS_FILE = path.join(repoRoot, 'apps/web/src/app/globals.css');
const PALETTE_FILE = path.join(repoRoot, 'apps/mobile/src/theme/palette.ts');

/** CSS custom property -> key path inside `darkPalette` (dots for nesting). */
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

/** Colour comparison ignores case, spacing and hex-case. */
function normalise(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

/** Reads the `:root { … }` custom properties out of globals.css. */
function parseCssTokens(source) {
  const start = source.indexOf(':root');
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);

  if (start < 0 || open < 0 || close < 0) {
    throw new Error(`Could not find the :root block in ${CSS_FILE}`);
  }

  const tokens = {};
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = pattern.exec(source.slice(open + 1, close))) !== null) {
    tokens[match[1]] = match[2].trim();
  }

  return tokens;
}

/** Reads the top level and one level of nesting out of a `darkPalette` object. */
function parsePaletteObject(source) {
  const start = source.indexOf('export const darkPalette');
  const open = source.indexOf('{', start);

  if (start < 0 || open < 0) {
    throw new Error(`Could not find \`darkPalette\` in ${PALETTE_FILE}`);
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
    throw new Error(`Unbalanced braces in \`darkPalette\` (${PALETTE_FILE})`);
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
      if (stack.length === 1) throw new Error(`Unexpected closing brace in \`darkPalette\` (${PALETTE_FILE})`);
      stack.pop();
      continue;
    }

    const pair = line.match(/^(\w+)\s*:\s*'([^']*)',$/);
    if (pair) {
      stack[stack.length - 1][pair[1]] = pair[2];
      continue;
    }

    throw new Error(`Unparsed line in \`darkPalette\`: ${line}`);
  }

  if (stack.length !== 1) throw new Error(`Unbalanced braces in \`darkPalette\` (${PALETTE_FILE})`);

  return values;
}

function lookup(object, keyPath) {
  return keyPath.split('.').reduce((node, key) => (node == null ? undefined : node[key]), object);
}

const [cssSource, paletteSource] = await Promise.all([
  readFile(CSS_FILE, 'utf8'),
  readFile(PALETTE_FILE, 'utf8'),
]);

const css = parseCssTokens(cssSource);
const palette = parsePaletteObject(paletteSource);

const problems = [];

for (const [token, keyPath] of Object.entries(MAP)) {
  const fromCss = css[token];
  const fromPalette = lookup(palette, keyPath);

  if (fromCss === undefined) {
    problems.push(`globals.css is missing --${token} (mapped to darkPalette.${keyPath})`);
    continue;
  }

  if (fromPalette === undefined) {
    problems.push(`darkPalette.${keyPath} is missing (expected --${token}: ${fromCss})`);
    continue;
  }

  if (normalise(fromCss) !== normalise(fromPalette)) {
    problems.push(
      `--${token} mismatch: globals.css has "${fromCss}", darkPalette.${keyPath} has "${fromPalette}"`,
    );
  }
}

if (problems.length > 0) {
  console.error(`Theme parity check failed (${problems.length} problem${problems.length === 1 ? '' : 's'}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\nThe dark palette must mirror apps/web/src/app/globals.css. Update apps/mobile/src/theme/palette.ts.`,
  );
  process.exit(1);
}

console.log(`Theme parity OK — ${Object.keys(MAP).length} tokens match globals.css.`);
