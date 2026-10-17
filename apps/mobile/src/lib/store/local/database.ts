import * as SQLite from 'expo-sqlite';

import { SCHEMA_V1, SCHEMA_VERSION } from './schema';

const DATABASE_NAME = 'pluto.db';

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

  if (version < SCHEMA_VERSION) {
    await database.execAsync(SCHEMA_V1);
    await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  return database;
}

/**
 * Removes every local row.
 *
 * Called on sign-out: without it a second account would briefly read the first
 * account's expenses from the mirror (and, worse, a queued mutation from the
 * first account could be pushed under the second's token).
 */
export async function clearLocalDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(
    'DELETE FROM mutations; DELETE FROM expenses; DELETE FROM categories; DELETE FROM sync_meta;',
  );
}
