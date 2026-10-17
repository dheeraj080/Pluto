import type * as SQLite from 'expo-sqlite';

/** Key under which the incremental-pull cursor is stored. */
export const SYNC_CURSOR_KEY = 'expense_cursor';

export async function getSyncMeta(
  database: SQLite.SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await database.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSyncMeta(
  database: SQLite.SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/**
 * Forgets a stored value, so the next read behaves like a first run.
 *
 * Used for the pull cursor: dropping it turns the next pull into a full
 * snapshot, which is how a replayed (superseded) change is corrected when the
 * server's winning row is older than the cursor.
 */
export async function clearSyncMeta(
  database: SQLite.SQLiteDatabase,
  key: string,
): Promise<void> {
  await database.runAsync('DELETE FROM sync_meta WHERE key = ?', [key]);
}
