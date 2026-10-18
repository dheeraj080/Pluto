import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';

import type { ExpenseListFilters } from '@/lib/query-keys';
import { randomUuid } from '@/lib/uuid';
import type { CreateExpenseInput, ExpenseDto } from '../types';
import {
  deleteActionFor,
  deleteMutations,
  editOp,
  getPendingOp,
  hasPendingMutation,
  replaceMutation,
  type ExpenseMutationPayload,
  type PendingMutation,
} from './mutations';

/** Fallback colour for a category the mirror does not know (deleted mid-flight). */
export const CATEGORY_FALLBACK_COLOR = '#9ca3af';

interface ExpenseRow {
  id: string;
  category_id: string;
  amount: number;
  currency: string;
  description: string | null;
  payment_method: string | null;
  incurred_on: string;
  recurring_expense_id: string | null;
  client_updated_at: string;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
  sync_state: string;
  category_name?: string | null;
  category_color?: string | null;
}

const SELECT_WITH_CATEGORY = `
  SELECT e.*, c.name AS category_name, c.color AS category_color
  FROM expenses e
  LEFT JOIN categories c ON c.id = e.category_id
`;

function toExpenseDto(row: ExpenseRow): ExpenseDto {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? '',
    categoryColor: row.category_color ?? CATEGORY_FALLBACK_COLOR,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    incurredOn: row.incurred_on,
    paymentMethod: row.payment_method,
    recurringExpenseId: row.recurring_expense_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Mirrors the server's sort options so paging order matches online exactly. */
export function orderByClause(sort: ExpenseListFilters['sort']): string {
  switch (sort) {
    case 'date_asc':
      return 'e.incurred_on ASC, e.created_at ASC';
    case 'amount_desc':
      return 'e.amount DESC, e.id ASC';
    case 'amount_asc':
      return 'e.amount ASC, e.id ASC';
    default:
      return 'e.incurred_on DESC, e.created_at DESC';
  }
}

/**
 * Builds the `WHERE` fragment (and its bound params) for a filtered list.
 *
 * Derived from the server's `buildExpenseFilter` so an offline list and an
 * online one select the same rows: soft-deleted rows are always excluded, and
 * search is a case-insensitive `description` match.
 */
export function buildExpenseFilterSql(filters: ExpenseListFilters): {
  where: string;
  params: (string | number)[];
} {
  const clauses: string[] = ['e.deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (filters.categoryId) {
    clauses.push('e.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.currency) {
    clauses.push('e.currency = ?');
    params.push(filters.currency.toUpperCase());
  }
  const search = filters.search?.trim();
  if (search) {
    // SQLite's LIKE is case-insensitive for ASCII, matching the server's
    // `mode: 'insensitive'` contains filter.
    clauses.push('e.description LIKE ?');
    params.push(`%${search}%`);
  }
  if (filters.from) {
    clauses.push('e.incurred_on >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push('e.incurred_on <= ?');
    params.push(filters.to);
  }

  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

export async function listLocalExpenses(
  database: SQLite.SQLiteDatabase,
  filters: ExpenseListFilters,
  page: number,
  limit: number,
): Promise<Schemas['PaginatedExpensesResponseDto']> {
  const { where, params } = buildExpenseFilterSql(filters);
  const offset = Math.max(0, (page - 1) * limit);

  const count = await database.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM expenses e ${where}`,
    params,
  );
  const rows = await database.getAllAsync<ExpenseRow>(
    `${SELECT_WITH_CATEGORY} ${where} ORDER BY ${orderByClause(filters.sort)} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { items: rows.map(toExpenseDto), page, limit, total: count?.total ?? 0 };
}

export async function getLocalExpense(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<ExpenseDto> {
  const row = await database.getFirstAsync<ExpenseRow>(
    `${SELECT_WITH_CATEGORY} WHERE e.id = ? AND e.deleted_at IS NULL`,
    [id],
  );
  if (!row) throw new Error('Expense not found');
  return toExpenseDto(row);
}

/**
 * Writes one expense row and its queued `create` inside an open transaction.
 *
 * Shared by the ordinary create path and the offline occurrence confirm, whose
 * expense, action and status flip must commit together. `recurring_expense_id`
 * is carried in the payload so a confirm replays with the rule it came from.
 */
export async function writeQueuedExpense(
  txn: SQLite.SQLiteDatabase,
  params: { id: string; now: string; payload: ExpenseMutationPayload },
): Promise<void> {
  await txn.runAsync(
    `INSERT INTO expenses
       (id, category_id, amount, currency, description, payment_method, incurred_on,
        recurring_expense_id, client_updated_at, updated_at, created_at, deleted_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      params.id,
      params.payload.categoryId,
      params.payload.amount,
      params.payload.currency,
      params.payload.description,
      params.payload.paymentMethod,
      params.payload.incurredOn,
      params.payload.recurringExpenseId,
      params.now,
      params.now,
      params.now,
    ],
  );
  await replaceMutation(txn, 'expense', {
    entityId: params.id,
    op: 'create',
    clientUpdatedAt: params.now,
    payload: params.payload,
  });
}

/**
 * Removes a never-pushed expense and its queued create together.
 *
 * Used where the row is withdrawn rather than tombstoned — deleting a local
 * row, retiring the stand-in of a confirm the server has now recorded. Such a
 * row never reached the server (nothing pushes a queued create while the
 * delete/confirm that owns it is unresolved), so both sides agree the moment
 * both copies are gone.
 */
export async function dropQueuedExpense(
  txn: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  await txn.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  await deleteMutations(txn, 'expense', id);
}

/** Whether a live (non-deleted) expense row exists. */
export async function getLocalExpenseExists(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<boolean> {
  const row = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM expenses WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row !== null;
}

/**
 * A queued confirm's replay payload: the expense's *current* field values, so
 * edits made to the stand-in before reconnecting are what the server records.
 */
export async function readQueuedExpenseOverrides(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<Record<string, unknown> | null> {
  const row = await database.getFirstAsync<ExpenseRow>(
    'SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  if (!row) return null;
  return {
    categoryId: row.category_id,
    amount: row.amount,
    currency: row.currency,
    incurredOn: row.incurred_on,
    ...(row.description !== null ? { description: row.description } : {}),
    ...(row.payment_method !== null ? { paymentMethod: row.payment_method } : {}),
  };
}

export async function createLocalExpense(
  database: SQLite.SQLiteDatabase,
  input: CreateExpenseInput,
): Promise<ExpenseDto> {
  const id = randomUuid();
  const now = new Date().toISOString();
  const payload: ExpenseMutationPayload = {
    categoryId: input.categoryId,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    description: input.description ?? null,
    paymentMethod: input.paymentMethod ?? null,
    incurredOn: input.incurredOn,
    recurringExpenseId: null,
  };

  await database.withExclusiveTransactionAsync(async (txn) => {
    await writeQueuedExpense(txn, { id, now, payload });
  });

  return getLocalExpense(database, id);
}

export async function updateLocalExpense(
  database: SQLite.SQLiteDatabase,
  id: string,
  input: Schemas['UpdateExpenseDto'],
): Promise<ExpenseDto> {
  const now = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<ExpenseRow>(
      'SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    if (!existing) throw new Error('Expense not found');

    const merged: ExpenseMutationPayload = {
      categoryId: input.categoryId ?? existing.category_id,
      amount: input.amount ?? existing.amount,
      currency: (input.currency ?? existing.currency).toUpperCase(),
      description: input.description !== undefined ? input.description : existing.description,
      paymentMethod:
        input.paymentMethod !== undefined ? input.paymentMethod : existing.payment_method,
      incurredOn: input.incurredOn ?? existing.incurred_on,
      recurringExpenseId: existing.recurring_expense_id,
    };

    // Keep the row a `create` while it has never reached the server, so the
    // queued change stays a single upsert rather than a create-then-update pair.
    const op = editOp(await getPendingOp(txn, 'expense', id));

    await txn.runAsync(
      `UPDATE expenses
         SET category_id = ?, amount = ?, currency = ?, description = ?, payment_method = ?,
             incurred_on = ?, client_updated_at = ?, updated_at = ?, sync_state = 'pending'
       WHERE id = ?`,
      [
        merged.categoryId,
        merged.amount,
        merged.currency,
        merged.description,
        merged.paymentMethod,
        merged.incurredOn,
        now,
        now,
        id,
      ],
    );
    await replaceMutation(txn, 'expense', {
      entityId: id,
      op,
      clientUpdatedAt: now,
      payload: merged,
    });
  });

  return getLocalExpense(database, id);
}

export async function deleteLocalExpense(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  const now = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [
      id,
    ]);
    if (!existing) return;

    // A row the server never saw needs no tombstone: dropping it (and its
    // queued create) leaves both sides agreeing without a pointless round trip.
    const queuedOp = await getPendingOp(txn, 'expense', id);
    if (deleteActionFor(queuedOp) === 'drop') {
      await txn.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
      await deleteMutations(txn, 'expense', id);
      return;
    }

    await txn.runAsync(
      `UPDATE expenses
         SET deleted_at = ?, client_updated_at = ?, updated_at = ?, sync_state = 'pending'
       WHERE id = ?`,
      [now, now, now, id],
    );
    await replaceMutation(txn, 'expense', {
      entityId: id,
      op: 'delete',
      clientUpdatedAt: now,
      payload: null,
    });
  });
}

/**
 * How a pulled row applies to the mirror, given whether this device still has a
 * queued change for it.
 *
 * `skip` is the important one: a queued change means the user edited or deleted
 * the row offline, so the pending mutation — not the server's older copy — is
 * the truth until it is pushed. `delete` applies a tombstone; `upsert` writes
 * the row.
 */
export function pullActionFor(
  remote: Pick<Schemas['SyncedExpenseDto'], 'deletedAt'>,
  hasQueuedChange: boolean,
): 'skip' | 'delete' | 'upsert' {
  if (hasQueuedChange) return 'skip';
  return remote.deletedAt ? 'delete' : 'upsert';
}

/**
 * Merges a batch of pulled rows into the mirror.
 *
 * A row with a queued change is skipped outright: this device owns it until its
 * mutation is pushed, and writing over it would silently discard an offline
 * write. Tombstones remove the row locally instead of being stored, because the
 * queue is the only local writer and already blocks a resurrection.
 */
export async function applyPulledExpenses(
  database: SQLite.SQLiteDatabase,
  expenses: Schemas['SyncedExpenseDto'][],
): Promise<void> {
  if (expenses.length === 0) return;

  // Exclusive: each step reads the queue and then writes, so this must not
  // interleave with a user write landing between those two statements.
  await database.withExclusiveTransactionAsync(async (txn) => {
    for (const remote of expenses) {
      const hasQueuedChange = await hasPendingMutation(txn, 'expense', remote.id);
      const action = pullActionFor(remote, hasQueuedChange);
      if (action === 'skip') continue;

      if (action === 'delete') {
        await txn.runAsync('DELETE FROM expenses WHERE id = ?', [remote.id]);
        continue;
      }

      await txn.runAsync(
        `INSERT INTO expenses
           (id, category_id, amount, currency, description, payment_method, incurred_on,
            recurring_expense_id, client_updated_at, updated_at, created_at, deleted_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced')
         ON CONFLICT(id) DO UPDATE SET
           category_id = excluded.category_id,
           amount = excluded.amount,
           currency = excluded.currency,
           description = excluded.description,
           payment_method = excluded.payment_method,
           incurred_on = excluded.incurred_on,
           recurring_expense_id = excluded.recurring_expense_id,
           client_updated_at = excluded.client_updated_at,
           updated_at = excluded.updated_at,
           deleted_at = NULL,
           sync_state = 'synced'`,
        [
          remote.id,
          remote.categoryId,
          remote.amount,
          remote.currency,
          remote.description ?? null,
          remote.paymentMethod ?? null,
          remote.incurredOn,
          remote.recurringExpenseId ?? null,
          remote.clientUpdatedAt,
          remote.updatedAt,
          // The pull DTO omits `createdAt`; `updatedAt` is a safe stand-in for
          // the tie-break ordering and is never surfaced to the user.
          remote.updatedAt,
        ],
      );
    }
  });
}

/**
 * Retires a queued mutation after the server accepted (or superseded) it.
 *
 * The mutation is only dropped and the row only marked `synced` when no newer
 * change is queued for it — otherwise a write made during the round trip would
 * be silently discarded.
 */
export async function resolvePushedMutation(
  database: SQLite.SQLiteDatabase,
  mutation: PendingMutation,
  result: { status: string; serverUpdatedAt?: string | null },
): Promise<void> {
  // A rejected change stays queued: the next sync retries it rather than the
  // user's entry vanishing. (`failed` here means the server refused it, e.g. an
  // unknown category; the local row is kept either way.)
  if (result.status === 'failed') return;

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM mutations WHERE id = ?', [mutation.id]);

    const stillQueued = await hasPendingMutation(txn, 'expense', mutation.entityId);
    if (stillQueued) return;

    if (mutation.op === 'delete') {
      await txn.runAsync('DELETE FROM expenses WHERE id = ?', [mutation.entityId]);
      return;
    }

    await txn.runAsync(
      `UPDATE expenses SET sync_state = 'synced', updated_at = COALESCE(?, updated_at) WHERE id = ?`,
      [result.serverUpdatedAt ?? null, mutation.entityId],
    );
  });
}
