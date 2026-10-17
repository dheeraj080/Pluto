import type * as SQLite from 'expo-sqlite';

export type MutationOp = 'create' | 'update' | 'delete';

/**
 * The payload the sync API expects for a create/update.
 *
 * Mirrors `SyncExpensePayloadDto`, but with the nullable fields *required*:
 * the store always writes an explicit `null` rather than `undefined`, which
 * SQLite would reject as a bound parameter.
 */
export interface ExpenseMutationPayload {
  categoryId: string;
  amount: number;
  currency: string;
  description: string | null;
  paymentMethod: string | null;
  incurredOn: string;
  recurringExpenseId: string | null;
}

export interface PendingMutation {
  id: number;
  entityId: string;
  op: MutationOp;
  clientUpdatedAt: string;
  payload: ExpenseMutationPayload | null;
}

interface MutationRow {
  id: number;
  entity_id: string;
  op: MutationOp;
  client_updated_at: string;
  payload: string | null;
}

const EXPENSE = 'expense';

/**
 * Replaces any queued change for a row with a single new one.
 *
 * At most one mutation per row is ever queued. The server applies `create` and
 * `update` identically (an upsert keyed by id), so an offline edit of a row
 * that has not synced yet can simply rewrite the pending create instead of
 * stacking a follow-up; likewise an edit removes a stale pending delete.
 */
export async function replaceExpenseMutation(
  database: SQLite.SQLiteDatabase,
  mutation: {
    entityId: string;
    op: MutationOp;
    clientUpdatedAt: string;
    payload: ExpenseMutationPayload | null;
  },
): Promise<void> {
  await database.runAsync(`DELETE FROM mutations WHERE entity = ? AND entity_id = ?`, [
    EXPENSE,
    mutation.entityId,
  ]);
  await database.runAsync(
    `INSERT INTO mutations (entity, entity_id, op, client_updated_at, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      EXPENSE,
      mutation.entityId,
      mutation.op,
      mutation.clientUpdatedAt,
      mutation.payload ? JSON.stringify(mutation.payload) : null,
      new Date().toISOString(),
    ],
  );
}

export async function deleteExpenseMutations(
  database: SQLite.SQLiteDatabase,
  entityId: string,
): Promise<void> {
  await database.runAsync(`DELETE FROM mutations WHERE entity = ? AND entity_id = ?`, [
    EXPENSE,
    entityId,
  ]);
}

/** The op currently queued for a row, or null when it has no pending change. */
export async function getPendingExpenseOp(
  database: SQLite.SQLiteDatabase,
  entityId: string,
): Promise<MutationOp | null> {
  const row = await database.getFirstAsync<{ op: MutationOp }>(
    `SELECT op FROM mutations WHERE entity = ? AND entity_id = ? LIMIT 1`,
    [EXPENSE, entityId],
  );
  return row?.op ?? null;
}

/**
 * The op an offline edit collapses to, given what is already queued.
 *
 * A row that has never reached the server stays a `create` rather than becoming
 * a create-then-update pair: the server treats both as an upsert, and one
 * mutation per row keeps the queue — and its replay — trivial.
 */
export function editOp(queuedOp: MutationOp | null): MutationOp {
  return queuedOp === 'create' ? 'create' : 'update';
}

/**
 * What an offline delete should do, given what is already queued.
 *
 * `drop` (the row never reached the server) removes it locally with nothing to
 * send; `tombstone` keeps the row as a soft-deleted marker that must be pushed.
 */
export function deleteActionFor(queuedOp: MutationOp | null): 'drop' | 'tombstone' {
  return queuedOp === 'create' ? 'drop' : 'tombstone';
}

/** True when the row still has a queued change this device has not pushed. */
export async function hasPendingExpenseMutation(
  database: SQLite.SQLiteDatabase,
  entityId: string,
): Promise<boolean> {
  const row = await database.getFirstAsync<{ id: number }>(
    `SELECT id FROM mutations WHERE entity = ? AND entity_id = ? LIMIT 1`,
    [EXPENSE, entityId],
  );
  return row !== null;
}

/** The queued changes, oldest first, ready to be replayed through `POST /sync/push`. */
export async function listPendingMutations(
  database: SQLite.SQLiteDatabase,
): Promise<PendingMutation[]> {
  const rows = await database.getAllAsync<MutationRow>(
    `SELECT id, entity_id, op, client_updated_at, payload FROM mutations WHERE entity = ? ORDER BY id ASC`,
    [EXPENSE],
  );

  return rows.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    op: row.op,
    clientUpdatedAt: row.client_updated_at,
    payload: row.payload ? (JSON.parse(row.payload) as ExpenseMutationPayload) : null,
  }));
}
