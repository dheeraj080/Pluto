#!/usr/bin/env node
/**
 * Starts Expo with `EXPO_PUBLIC_API_URL` pointed at this machine's LAN address.
 *
 * Why: `localhost` inside the app means the *device*, so a physical phone can
 * never reach the API through it. The LAN IP also works for the web preview, so
 * one value covers both — but the address changes with DHCP, which is why this
 * detects it instead of hard-coding it.
 *
 * Writes the resolved value into `apps/mobile/.env` (git-ignored) so the plain
 * `expo start` / `npm run dev` afterwards behaves consistently and so the value
 * is easy to inspect when debugging.
 *
 * Usage:
 *   npm run dev:lan --workspace pluto-mobile
 *   npm run dev:lan --workspace pluto-mobile -- --tunnel
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const API_PORT = process.env.PLUTO_API_PORT ?? '3000';
const ENV_KEY = 'EXPO_PUBLIC_API_URL';
const envPath = resolve(projectRoot, '.env');

/** Virtual adapters (WSL, Hyper-V, Docker, VPN) are never the phone's route. */
const VIRTUAL = /virtual|vethernet|vmware|vbox|hyper-v|docker|loopback|bluetooth|tailscale|zerotier|radmin/i;

function findLanAddress() {
  const candidates = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (address.address.startsWith('169.254.')) continue; // APIPA: not routable
      candidates.push({ name, address: address.address });
    }
  }
  if (candidates.length === 0) return null;

  const score = ({ name, address }) => {
    let value = 0;
    if (VIRTUAL.test(name)) value -= 100;
    if (/wi-?fi|wlan|wireless|ethernet/i.test(name)) value += 10;
    // Prefer RFC1918 space, which is what a phone on the same Wi-Fi can reach.
    if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(address)) value += 1;
    return value;
  };
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

const lan = findLanAddress();
if (!lan) {
  console.error(
    'Could not detect a LAN IPv4 address. Set EXPO_PUBLIC_API_URL in apps/mobile/.env manually.',
  );
  process.exit(1);
}

const url = `http://${lan.address}:${API_PORT}/v1`;

const line = `${ENV_KEY}=${url}`;
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const pattern = new RegExp(`^${ENV_KEY}=.*$`, 'm');
const next = pattern.test(existing)
  ? existing.replace(pattern, line)
  : `${existing.trimEnd()}${existing.trim() ? '\n' : ''}${line}\n`;
writeFileSync(envPath, next);

console.log(`\n  API base URL  ${url}`);
console.log(`  Via interface ${lan.name} (${lan.address})\n`);
console.log('  Make sure the API is running and reachable:');
console.log(`    npm run dev --workspace pluto-server`);
console.log(`    http://${lan.address}:${API_PORT}/v1/health`);
console.log('  (Windows Firewall must allow Node on private networks for ports 3000 and 8081.)\n');

// Resolve the Expo CLI directly instead of shelling out to npx: avoids
// Windows `.cmd` quoting problems and works the same on every platform.
const expoCli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [expoCli, 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  // Pin the project dir: Expo picks its project from cwd, so invoking this
  // script from the repo root would otherwise start the wrong app.
  cwd: projectRoot,
  env: { ...process.env, [ENV_KEY]: url },
});

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
