import type * as SQLite from 'expo-sqlite';

export type MutationOp = 'create' | 'update' | 'delete';

/** The entity kinds the sync queue can carry. Mirrors the server's `entity`. */
export type SyncEntity = 'expense' | 'budget' | 'category';

/**
 * The payload the sync API expects for an expense create/update.
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

/** The payload `POST /sync/push` expects for a budget create/update. */
/** The two periods the server accepts, matching its Prisma enum. */
export type BudgetPeriodValue = 'MONTHLY' | 'YEARLY';

export interface BudgetMutationPayload {
  categoryId: string | null;
  amount: number;
  currency: string;
  period: BudgetPeriodValue;
  startDate: string;
}

export interface CategoryMutationPayload {
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
}

/** A create/update payload; the queued row's `entity` selects which it is. */
export type MutationPayload = ExpenseMutationPayload | BudgetMutationPayload | CategoryMutationPayload;

export interface PendingMutation {
  id: number;
  entity: SyncEntity;
  entityId: string;
  op: MutationOp;
  clientUpdatedAt: string;
  payload: MutationPayload | null;
}

interface MutationRow {
  id: number;
  entity: SyncEntity;
  entity_id: string;
  op: MutationOp;
  client_updated_at: string;
  payload: string | null;
}

/**
 * Replaces any queued change for a row with a single new one.
 *
 * At most one mutation per row is ever queued. The server applies `create` and
 * `update` identically (an upsert keyed by id), so an offline edit of a row
 * that has not synced yet can simply rewrite the pending create instead of
 * stacking a follow-up; likewise an edit removes a stale pending delete.
 */
export async function replaceMutation(
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
  mutation: {
    entityId: string;
    op: MutationOp;
    clientUpdatedAt: string;
    payload: MutationPayload | null;
  },
): Promise<void> {
  await database.runAsync(`DELETE FROM mutations WHERE entity = ? AND entity_id = ?`, [
    entity,
    mutation.entityId,
  ]);
  await database.runAsync(
    `INSERT INTO mutations (entity, entity_id, op, client_updated_at, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entity,
      mutation.entityId,
      mutation.op,
      mutation.clientUpdatedAt,
      mutation.payload ? JSON.stringify(mutation.payload) : null,
      new Date().toISOString(),
    ],
  );
}

export async function deleteMutations(
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
  entityId: string,
): Promise<void> {
  await database.runAsync(`DELETE FROM mutations WHERE entity = ? AND entity_id = ?`, [
    entity,
    entityId,
  ]);
}

/** The op currently queued for a row, or null when it has no pending change. */
export async function getPendingOp(
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
  entityId: string,
): Promise<MutationOp | null> {
  const row = await database.getFirstAsync<{ op: MutationOp }>(
    `SELECT op FROM mutations WHERE entity = ? AND entity_id = ? LIMIT 1`,
    [entity, entityId],
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
export async function hasPendingMutation(
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
  entityId: string,
): Promise<boolean> {
  const row = await database.getFirstAsync<{ id: number }>(
    `SELECT id FROM mutations WHERE entity = ? AND entity_id = ? LIMIT 1`,
    [entity, entityId],
  );
  return row !== null;
}

/**
 * The ids of every row with a queued change for `entity`.
 *
 * Used to protect locally-owned rows when the server list is mirrored wholesale
 * (budgets): a row the device has not pushed yet must survive the overwrite.
 */
export async function listPendingEntityIds(
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ entity_id: string }>(
    `SELECT entity_id FROM mutations WHERE entity = ?`,
    [entity],
  );
  return new Set(rows.map((row) => row.entity_id));
}

/** The queued changes, oldest first, ready to be replayed through `POST /sync/push`. */
export async function listPendingMutations(
  database: SQLite.SQLiteDatabase,
): Promise<PendingMutation[]> {
  const rows = await database.getAllAsync<MutationRow>(
    `SELECT id, entity, entity_id, op, client_updated_at, payload FROM mutations ORDER BY id ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    op: row.op,
    clientUpdatedAt: row.client_updated_at,
    payload: row.payload ? (JSON.parse(row.payload) as MutationPayload) : null,
  }));
}
