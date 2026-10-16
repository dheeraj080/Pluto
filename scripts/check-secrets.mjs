#!/usr/bin/env node
/**
 * Fails when a secret is about to be committed (or already is).
 *
 * Why this exists: `apps/server/.env` holds DATABASE_URL and the JWT secret,
 * `apps/mobile` ships a keystore-derived signing certificate into Google
 * Cloud, and an OAuth client secret in a public repo is a credential that has
 * to be revoked rather than removed. Gitignore catches the usual accidents;
 * this catches the rest - a secret pasted into a config file, a key committed
 * under an unexpected name, or an env file force-added with `git add -f`.
 *
 * Two passes:
 *   1. Filenames - anything that is by convention a credential (env files,
 *      keystores, private keys, provisioning profiles).
 *   2. Contents - known secret shapes anywhere in a tracked text file. The
 *      match list is deliberately small: every pattern is one this repo has
 *      actually used (Google's `GOCSPX-` client secrets, Neon's `npg_`
 *      passwords, AWS key IDs, PEM blocks).
 *
 * Files that legitimately contain a pattern - the committed `.env.example`
 * templates and the validation code that rejects the known-unsafe dev default
 * - are listed explicitly, so extending the pattern list never silently
 * silences the check.
 *
 * Usage: node scripts/check-secrets.mjs   (or `npm run secrets:check`)
 */

import { execFileSync } from 'node:child_process';

/** Credential-shaped filenames that must never be tracked. */
const FORBIDDEN_PATH = [
  { pattern: /(^|\/)\.env(?!\.example|\.sample|\.template)/, reason: 'env file (only *.example may be committed)' },
  { pattern: /\.(keystore|jks|p12|pfx|p8|mobileprovision)$/i, reason: 'signing credential' },
  { pattern: /\.pem$|\.key$|\.cert$/i, reason: 'private key or certificate' },
  { pattern: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/, reason: 'SSH key' },
  { pattern: /(^|\/)(credentials|service-account)(\.\w+)?$/i, reason: 'cloud credentials' },
];

/** Secret shapes in tracked file contents. */
const CONTENT_PATTERNS = [
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, reason: 'PEM private key' },
  { pattern: /GOCSPX-[A-Za-z0-9_-]{10,}/, reason: 'Google OAuth client secret' },
  { pattern: /\bnpg_[A-Za-z0-9]{10,}/, reason: 'Neon database password' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, reason: 'AWS access key id' },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/, reason: 'Slack token' },
  {
    pattern: /development_jwt_access_secret_min_32_characters_long_12345/,
    reason: 'known-unsafe dev JWT secret',
    allow: [
      'apps/server/.env.example',
      'apps/server/src/config/env.validation.ts',
      'apps/server/src/config/env.validation.spec.ts',
    ],
  },
];

/** Files skipped by the content pass (large or generated). */
const CONTENT_SKIP = [/^package-lock\.json$/, /\.svg$/, /^apps\/server\/openapi\.json$/];

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

/** Reads a tracked file as text, or returns null for binary/large files. */
function readText(file) {
  const out = execFileSync('git', ['show', `:${file}`], {
    encoding: 'buffer',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (out.includes(0)) return null; // binary
  return out.toString('utf8');
}

const files = trackedFiles();
const failures = [];

for (const file of files) {
  for (const { pattern, reason } of FORBIDDEN_PATH) {
    if (pattern.test(file)) failures.push(`${file}\n    ${reason}`);
  }
}

for (const file of files) {
  if (CONTENT_SKIP.some((re) => re.test(file))) continue;
  let text;
  try {
    text = readText(file);
  } catch {
    continue; // deleted-then-staged or otherwise unreadable
  }
  if (text === null) continue;

  for (const { pattern, reason, allow = [] } of CONTENT_PATTERNS) {
    if (allow.includes(file)) continue;
    if (pattern.test(text)) failures.push(`${file}\n    ${reason}`);
  }
}

if (failures.length > 0) {
  console.error('✗ Secrets check failed:\n');
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    '\nRemove the value, keep only a template (*.example), and rotate anything' +
      '\nthat was genuinely committed - deleting it from the tree does not revoke it.',
  );
  process.exit(1);
}

console.log(`✓ No secrets among ${files.length} tracked files.`);
