/**
 * The on-device database, web target.
 *
 * The browser has no local store. `expo-sqlite`'s web build is SQLite compiled
 * to WebAssembly and needs COOP/COEP headers (for `SharedArrayBuffer`) that the
 * static web target does not serve, so the web build reads and writes through
 * the API instead (`src/lib/store/index.ts`).
 *
 * This file exists so the web bundle never reaches `expo-sqlite` at all. The
 * native module imports it as a *value*, and its web build drags a 600 KB WASM
 * binary plus a separate web-worker chunk into a bundle that never opens a
 * database — and Metro cannot resolve `.wasm` at all without extra resolver
 * configuration, which fails the whole web build.
 *
 * Metro resolves this file instead of `database.ts` when targeting web, so the
 * two must keep the same exported signature.
 */
import type * as SQLite from 'expo-sqlite';

/**
 * There is no database to open in the browser.
 *
 * Every caller guards on `localStoreEnabled`, so a rejection here means that
 * guard was bypassed — which is worth an error rather than a silent no-op.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return Promise.reject(
    new Error(
      'The local database is not available in the web preview. Use the web app, or run the mobile app on a device.',
    ),
  );
}

/**
 * Nothing to clear: the browser keeps no local rows.
 *
 * The native implementation wipes the mirror on sign-out so a second account
 * cannot read the first account's data (see `database.ts`). The web build has
 * no mirror to wipe — its rows live on the server.
 */
export async function clearLocalDatabase(): Promise<void> {
  // No-op.
}
