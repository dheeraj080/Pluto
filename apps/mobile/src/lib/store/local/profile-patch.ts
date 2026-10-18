import type * as SQLite from 'expo-sqlite';
import type { Schemas } from '@pluto/api-client';

import { isTransientApiError } from './network-errors';

/**
 * The queued profile write.
 *
 * The profile is the one account-level document the app mutates (today: the
 * base currency, from the Pair picker). It is not an expense-shaped row, so it
 * cannot ride `/sync/push` — instead a failed `PATCH /users/me` parks its
 * payload here, at most one row (a newer choice supersedes an older one), and
 * the sync engine replays it verbatim against the endpoint when the server
 * answers again.
 *
 * The write is "try first, park on failure": online behaviour — including a
 * server-side rejection rolling the optimistic value back — is exactly what it
 * was before the queue existed; only an unreachable server leaves a row behind.
 */

export type ProfilePatch = Schemas['UpdateUserDto'];

export interface PendingProfilePatch {
  payload: ProfilePatch;
  clientUpdatedAt: string;
}

interface PendingProfileRow {
  payload: string;
  client_updated_at: string;
}

/** Queues (replacing any older patch) a profile write the server could not take. */
export async function queueProfilePatch(
  database: SQLite.SQLiteDatabase,
  patch: ProfilePatch,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO pending_profile (id, payload, client_updated_at) VALUES (0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, client_updated_at = excluded.client_updated_at`,
    [JSON.stringify(patch), new Date().toISOString()],
  );
}

/** The queued patch, or null when the profile is fully in step with the server. */
export async function readProfilePatch(
  database: SQLite.SQLiteDatabase,
): Promise<PendingProfilePatch | null> {
  const row = await database.getFirstAsync<PendingProfileRow>(
    'SELECT payload, client_updated_at FROM pending_profile WHERE id = 0',
  );
  if (!row) return null;
  return {
    payload: JSON.parse(row.payload) as ProfilePatch,
    clientUpdatedAt: row.client_updated_at,
  };
}

/** Drops the queued patch — the server has it, or has refused it for good. */
export async function clearProfilePatch(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.runAsync('DELETE FROM pending_profile WHERE id = 0');
}

/**
 * What a failed profile write means for the queued patch.
 *
 * - `keep` — the server did not get to read the patch (unreachable, stale
 *   access token, transient 5xx, or a non-HTTP failure, per
 *   `isTransientApiError`): replaying later can still succeed, and dropping
 *   the row here would lose the user's choice.
 * - `drop` — a 4xx the server *did* answer: it refused the patch, replaying
 *   can only fail the same way, so the queue must not retry forever; the
 *   caller rolls the optimistic session value back.
 */
export function profilePatchDisposition(error: unknown): 'keep' | 'drop' {
  return isTransientApiError(error) ? 'keep' : 'drop';
}
