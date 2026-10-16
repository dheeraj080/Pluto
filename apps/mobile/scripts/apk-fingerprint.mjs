#!/usr/bin/env node
/**
 * Prints the signing certificate of a built APK — the package name + SHA-1 pair
 * Google Cloud Console wants on the *Android* OAuth client.
 *
 * Why this exists: Google rejects Android sign-in with `DEVELOPER_ERROR` (status
 * code 10) unless a registered Android OAuth client lists the app's package name
 * *and* the SHA-1 of the certificate that signed the installed APK. The usual
 * tools for reading it are unavailable in this repo: there is no Android SDK (so
 * no `apksigner`), `keytool -printcert -jarfile` reads only the v1 JAR signature
 * that a modern APK no longer carries, and the library's own `config-doctor`
 * needs a paid licence. This script needs nothing but the Node you already have.
 *
 * The signature lives in the APK Signing Block — the region immediately before
 * the ZIP central directory — and each certificate is a DER blob inside it. The
 * newest scheme present wins, matching Android's own preference order.
 *
 * Usage:
 *   npm run apk:fingerprint --workspace pluto-mobile -- ../../internal/app-debug.apk
 *   node scripts/apk-fingerprint.mjs app.apk --package com.example.app
 *   node scripts/apk-fingerprint.mjs app.apk --sha1   # one line, for scripts
 */

import { createHash, X509Certificate } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(projectRoot, '..', '..');

/** Android's own preference order: the newest signature scheme wins. */
const SCHEMES = [
  { id: 0x1b93ad61, label: 'v3.1' },
  { id: 0xf05368c0, label: 'v3' },
  { id: 0x7109871a, label: 'v2' },
];

const EOCD_SIGNATURE = 0x06054b50;
const SIGNING_BLOCK_MAGIC = 'APK Sig Block 42';
/** The EOCD record is 22 bytes; a ZIP comment can push it up to 64 KiB earlier. */
const MAX_ZIP_COMMENT = 0xffff;

function usage() {
  console.error('Usage: node scripts/apk-fingerprint.mjs <apk> [--package <name>] [--sha1]');
  process.exit(2);
}

/** Index of the End Of Central Directory record, or -1. */
function findEndOfCentralDirectory(apk) {
  const earliest = Math.max(0, apk.length - (MAX_ZIP_COMMENT + 22));
  for (let at = apk.length - 22; at >= earliest; at--) {
    if (apk.readUInt32LE(at) === EOCD_SIGNATURE) return at;
  }
  return -1;
}

/**
 * The ID/value pairs of the APK Signing Block, or `null` when there is none
 * (an unsigned or v1-only APK).
 */
function readSigningBlock(apk, centralDirectory) {
  const magicAt = centralDirectory - 16;
  if (magicAt < 0 || apk.toString('latin1', magicAt, magicAt + 16) !== SIGNING_BLOCK_MAGIC) {
    return null;
  }

  // The block is bracketed by the same 8-byte size, so reading it twice proves
  // the arithmetic before we trust the offsets inside it.
  const size = Number(apk.readBigUInt64LE(centralDirectory - 24));
  const blockStart = centralDirectory - 8 - size;
  if (blockStart < 0 || Number(apk.readBigUInt64LE(blockStart)) !== size) {
    throw new Error('The APK Signing Block is malformed.');
  }

  const pairs = [];
  const pairsEnd = centralDirectory - 24;
  let cursor = blockStart + 8;
  while (cursor < pairsEnd) {
    const length = Number(apk.readBigUInt64LE(cursor));
    cursor += 8;
    pairs.push({ id: apk.readUInt32LE(cursor), start: cursor + 4, length: length - 4 });
    cursor += length;
  }
  return pairs;
}

/**
 * The certificate DER blobs of a v2/v3/v3.1 block.
 *
 * Layout, once unwrapped: a list of signers; each signer holds a signed-data
 * blob, whose first two length-prefixed fields are the digests and then the
 * certificates. Digests are skipped, certificates are collected, and the rest of
 * the signer (signatures, public key — and for v3 the SDK range) is stepped over
 * by the signer's own length.
 */
function readCertificates(apk, pair) {
  let cursor = pair.start;
  const signersLength = apk.readUInt32LE(cursor);
  cursor += 4;
  const signersEnd = cursor + signersLength;

  const certificates = [];
  while (cursor < signersEnd) {
    const signerLength = apk.readUInt32LE(cursor);
    cursor += 4;
    const signerEnd = cursor + signerLength;

    cursor += 4; // the signed-data length; its contents follow it
    const digestsLength = apk.readUInt32LE(cursor);
    cursor += 4 + digestsLength;

    const certificatesLength = apk.readUInt32LE(cursor);
    cursor += 4;
    const certificatesEnd = cursor + certificatesLength;
    while (cursor < certificatesEnd) {
      const certificateLength = apk.readUInt32LE(cursor);
      cursor += 4;
      certificates.push(Buffer.from(apk.subarray(cursor, cursor + certificateLength)));
      cursor += certificateLength;
    }

    cursor = signerEnd;
  }
  return certificates;
}

function fingerprint(der, algorithm) {
  const hex = createHash(algorithm).update(der).digest('hex');
  return (hex.toUpperCase().match(/../g) ?? []).join(':');
}

function describe(der) {
  try {
    return new X509Certificate(der).subject.split('\n').join(', ');
  } catch {
    return '(unreadable certificate)';
  }
}

/** The `android.package` from app.config.ts, unless `--package` overrides it. */
function configuredPackageName() {
  try {
    const config = readFileSync(resolve(projectRoot, 'app.config.ts'), 'utf8');
    return config.match(/^\s*package:\s*'([^']+)'/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

const argv = process.argv.slice(2);
let apkArgument = null;
let packageName = null;
let sha1Only = false;
for (let index = 0; index < argv.length; index++) {
  if (argv[index] === '--package') packageName = argv[++index];
  else if (argv[index] === '--sha1') sha1Only = true;
  else if (argv[index] === '--help' || argv[index] === '-h') usage();
  else if (apkArgument === null) apkArgument = argv[index];
  else usage();
}
if (apkArgument === null) usage();

// Accept a path relative to wherever the script was invoked, but fall back to
// the app and repo roots so a workspace invocation does not need a long `../`.
const apkPath = [
  resolve(apkArgument),
  resolve(projectRoot, apkArgument),
  resolve(repoRoot, apkArgument),
].find(existsSync);
if (!apkPath) {
  console.error(`No such APK: ${apkArgument}`);
  process.exit(1);
}

const apk = readFileSync(apkPath);
const eocd = findEndOfCentralDirectory(apk);
if (eocd < 0) {
  console.error(`Not a ZIP/APK: ${apkPath}`);
  process.exit(1);
}

let signed = null;
try {
  const pairs = readSigningBlock(apk, apk.readUInt32LE(eocd + 16));
  if (pairs) {
    for (const scheme of SCHEMES) {
      const pair = pairs.find((candidate) => candidate.id === scheme.id);
      if (!pair) continue;
      const certificates = readCertificates(apk, pair);
      if (certificates.length > 0) {
        signed = { scheme: scheme.label, certificates };
        break;
      }
    }
  }
} catch (error) {
  console.error(`${apkPath}\n  ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!signed) {
  console.error(
    `${apkPath}\n` +
      '  No APK Signing Block (v2/v3/v3.1) found — the APK is unsigned or v1-only,\n' +
      '  and its JAR signature is the one case `keytool -printcert -jarfile` does read.',
  );
  process.exit(1);
}

// The machine-readable form: one line, no decoration, so CI can read the
// artifact's fingerprint without depending on another tool's output format.
if (sha1Only) {
  console.log(fingerprint(signed.certificates[0], 'sha1'));
  process.exit(0);
}

console.log(`\n  APK           ${apkPath}`);
console.log(
  `  Package name  ${packageName ?? configuredPackageName() ?? '(unknown — pass --package)'}`,
);
console.log(`  Signature     ${signed.scheme}`);
for (const certificate of signed.certificates) {
  console.log(`  Subject       ${describe(certificate)}`);
  console.log(`  SHA-1         ${fingerprint(certificate, 'sha1')}`);
  console.log(`  SHA-256       ${fingerprint(certificate, 'sha256')}`);
}

console.log(
  '\n  Add the package name and SHA-1 above to an *Android* OAuth client\n' +
    '  (Google Cloud Console → APIs & Services → Credentials), in the same project\n' +
    '  as the web client the app signs in with. Each signing configuration needs its\n' +
    '  own entry: local debug, the CI dev client, EAS preview/release, Play signing.\n',
);
