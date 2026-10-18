import * as SQLite from 'expo-sqlite';

import { ensureCurrencySeed } from './currencies';
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_VERSION } from './schema';

const DATABASE_NAME = 'pluto.db';

/**
 * The ordered schema steps. Each statement is written to be safe to re-run
 * (`CREATE TABLE IF NOT EXISTS`), but a step only executes when the stored
 * `user_version` is behind it, so an upgrade applies exactly the new steps.
 */
const MIGRATIONS: readonly { version: number; sql: string }[] = [
  { version: 1, sql: SCHEMA_V1 },
  { version: 2, sql: SCHEMA_V2 },
  { version: 3, sql: SCHEMA_V3 },
  { version: 4, sql: SCHEMA_V4 },
];

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens and migrates the on-device database.
 *
 * The handle is created once per process and reused: `expo-sqlite` serialises
 * work per connection, and reopening on every call would defeat that. The
 * promise is cached (not the resolved value) so concurrent first callers share
 * a single open.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) databasePromise = openDatabase();
  return databasePromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync('PRAGMA journal_mode = WAL;');

  const version =
    (await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'))?.user_version ??
    0;

  for (const migration of MIGRATIONS) {
    if (version < migration.version) await database.execAsync(migration.sql);
  }
  if (version < SCHEMA_VERSION) {
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  // Cold-start currency seed: the pickers must render on a device that has
  // never reached the server. Idempotent — a table a fetch has filled is left
  // alone (see `ensureCurrencySeed`).
  await ensureCurrencySeed(database);

  return database;
}

/**
 * Removes every local row.
 *
 * Called on sign-out: without it a second account would briefly read the first
 * account's expenses from the mirror (and, worse, a queued mutation from the
 * first account could be pushed under the second's token).
 *
 * The currency table is wiped with the rest and then re-seeded from the
 * bundled registry: the registry is not account data, and the next account's
 * first fetch replaces it wholesale anyway.
 */
export async function clearLocalDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(
    'DELETE FROM mutations; DELETE FROM expenses; DELETE FROM categories; DELETE FROM rate_tables; DELETE FROM budgets; DELETE FROM sync_meta; DELETE FROM pending_profile; DELETE FROM occurrences; DELETE FROM recurring_actions; DELETE FROM recurring_rules; DELETE FROM rule_actions; DELETE FROM currencies;',
  );
  await ensureCurrencySeed(database);
}
