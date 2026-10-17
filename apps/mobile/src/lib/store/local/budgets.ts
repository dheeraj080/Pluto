import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';
import type { Budget } from '@pluto/domain';

import { randomUuid } from '@/lib/uuid';
import type { CreateBudgetInput, UpdateBudgetInput } from '../types';
import {
  deleteActionFor,
  deleteMutations,
  editOp,
  getPendingOp,
  hasPendingMutation,
  listPendingEntityIds,
  replaceMutation,
  type BudgetMutationPayload,
  type BudgetPeriodValue,
  type PendingMutation,
} from './mutations';

type BudgetDto = Schemas['BudgetDto'];

interface BudgetRow {
  id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  period: string;
  start_date: string;
  created_at: string;
}

const SELECT_WITH_CATEGORY = `
  SELECT b.*, c.name AS category_name
  FROM budgets b
  LEFT JOIN categories c ON c.id = b.category_id
`;

/** The mirrored budgets, in the shape the on-device engine expects. */
export async function listLocalBudgets(database: SQLite.SQLiteDatabase): Promise<Budget[]> {
  const rows = await database.getAllAsync<BudgetRow>('SELECT * FROM budgets ORDER BY start_date ASC');
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    amount: row.amount,
    currency: row.currency,
    period: row.period,
    startDate: row.start_date,
  }));
}

/**
 * The mirror-merge decision, split out so it can be tested without a database.
 *
 * A remote row is never written over a local row with a queued change, and a
 * local row is only removed when the server no longer lists it *and* the device
 * does not still own it. Both guards exist for the same reason: a pending
 * mutation is the truth until it is pushed.
 */
export function planBudgetMirror(
  localIds: readonly string[],
  remote: readonly BudgetDto[],
  pendingIds: ReadonlySet<string>,
): { deleteIds: string[]; upsert: BudgetDto[] } {
  const remoteIds = new Set(remote.map((budget) => budget.id));
  return {
    deleteIds: localIds.filter((id) => !remoteIds.has(id) && !pendingIds.has(id)),
    upsert: remote.filter((budget) => !pendingIds.has(budget.id)),
  };
}

/**
 * Replaces the whole budget mirror from a server list.
 *
 * Budgets are few and small, so a wholesale swap is simpler (and safer) than a
 * cursor — which also means a server-side delete propagates simply by vanishing
 * from the list. The one exception is a row this device still owns (a queued
 * create/edit/delete): it is kept untouched, because the pending mutation — not
 * the server's older copy — is the truth until it is pushed.
 */
export async function replaceLocalBudgets(
  database: SQLite.SQLiteDatabase,
  budgets: readonly BudgetDto[],
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    const pending = await listPendingEntityIds(txn, 'budget');
    const localRows = await txn.getAllAsync<{ id: string }>('SELECT id FROM budgets');

    const plan = planBudgetMirror(
      localRows.map((row) => row.id),
      budgets,
      pending,
    );

    for (const id of plan.deleteIds) {
      await txn.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
    }

    for (const budget of plan.upsert) {
      await txn.runAsync(
        `INSERT INTO budgets (id, category_id, amount, currency, period, start_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           category_id = excluded.category_id,
           amount = excluded.amount,
           currency = excluded.currency,
           period = excluded.period,
           start_date = excluded.start_date,
           created_at = excluded.created_at`,
        [
          budget.id,
          budget.categoryId ?? null,
          budget.amount,
          budget.currency,
          budget.period,
          budget.startDate,
          budget.createdAt,
        ],
      );
    }
  });
}

/** Writes a budget locally and queues its `create` for the next sync. */
export async function createLocalBudget(
  database: SQLite.SQLiteDatabase,
  input: CreateBudgetInput,
): Promise<BudgetDto> {
  const id = randomUuid();
  const now = new Date().toISOString();
  const categoryId = input.categoryId ?? null;
  const period = input.period;
  const currency = input.currency.toUpperCase();
  const startDate = input.startDate ?? now.slice(0, 10);
  const amount = input.amount;

  const payload: BudgetMutationPayload = { categoryId, amount, currency, period, startDate };

  await database.withExclusiveTransactionAsync(async (txn) => {
    await assertBudgetSlotFree(txn, categoryId, period);
    await txn.runAsync(
      `INSERT INTO budgets (id, category_id, amount, currency, period, start_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, categoryId, amount, currency, period, startDate, now],
    );
    await replaceMutation(txn, 'budget', {
      entityId: id,
      op: 'create',
      clientUpdatedAt: now,
      payload,
    });
  });

  return getLocalBudgetDto(database, id);
}

/** Applies an edit locally and queues it, collapsing to the queued op. */
export async function updateLocalBudget(
  database: SQLite.SQLiteDatabase,
  id: string,
  input: UpdateBudgetInput,
): Promise<BudgetDto> {
  const now = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<BudgetRow>('SELECT * FROM budgets WHERE id = ?', [id]);
    if (!existing) throw new Error('Budget not found');

    const amount = input.amount;
    const startDate = input.startDate ?? existing.start_date;
    const payload: BudgetMutationPayload = {
      categoryId: existing.category_id,
      amount,
      currency: existing.currency,
      period: existing.period as BudgetPeriodValue,
      startDate,
    };

    // The server's budget update is whole-row too, so a never-synced row keeps
    // its queued `create` and only a synced row becomes an `update`.
    const op = editOp(await getPendingOp(txn, 'budget', id));

    await txn.runAsync('UPDATE budgets SET amount = ?, start_date = ? WHERE id = ?', [
      amount,
      startDate,
      id,
    ]);
    await replaceMutation(txn, 'budget', {
      entityId: id,
      op,
      clientUpdatedAt: now,
      payload,
    });
  });

  return getLocalBudgetDto(database, id);
}

/**
 * Removes a budget locally and queues the delete.
 *
 * Budgets are hard-deleted on the server, so the local row always goes; the
 * queue only distinguishes "tell the server" (a synced row) from "it never got
 * there" (a row whose `create` is still queued).
 */
export async function deleteLocalBudget(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  const now = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<{ id: string }>('SELECT id FROM budgets WHERE id = ?', [
      id,
    ]);
    if (!existing) return;

    const queuedOp = await getPendingOp(txn, 'budget', id);
    await txn.runAsync('DELETE FROM budgets WHERE id = ?', [id]);

    if (deleteActionFor(queuedOp) === 'drop') {
      await deleteMutations(txn, 'budget', id);
      return;
    }

    await replaceMutation(txn, 'budget', {
      entityId: id,
      op: 'delete',
      clientUpdatedAt: now,
      payload: null,
    });
  });
}

/**
 * Retires a queued budget mutation after the server accepted (or superseded) it.
 *
 * On a `duplicate` skip the local row is dropped: the (category, period) slot
 * belongs to a different server row, which the next mirror refresh brings in.
 * Any other outcome leaves the row — an `applied` edit is already correct, and a
 * `stale` skip is overwritten by the newer server copy on the next refresh.
 */
export async function resolvePushedBudgetMutation(
  database: SQLite.SQLiteDatabase,
  mutation: PendingMutation,
  result: { status: string; reason?: string | null },
): Promise<void> {
  if (result.status === 'failed') return;

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM mutations WHERE id = ?', [mutation.id]);

    // A write made during the round trip owns the row now; leave it alone.
    const stillQueued = await hasPendingMutation(txn, 'budget', mutation.entityId);
    if (stillQueued) return;

    if (mutation.op === 'delete' || result.reason === 'duplicate') {
      await txn.runAsync('DELETE FROM budgets WHERE id = ?', [mutation.entityId]);
    }
  });
}

async function getLocalBudgetDto(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<BudgetDto> {
  const row = await database.getFirstAsync<BudgetRow & { category_name: string | null }>(
    `${SELECT_WITH_CATEGORY} WHERE b.id = ?`,
    [id],
  );
  if (!row) throw new Error('Budget not found');
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    amount: row.amount,
    currency: row.currency,
    period: row.period as BudgetDto['period'],
    startDate: row.start_date,
    createdAt: row.created_at,
  };
}

/**
 * Refuses an offline create that would collide with an existing (category,
 * period) budget, mirroring the server's `ConflictException`.
 *
 * A queued delete for a colliding row removes it locally first, so the slot is
 * genuinely free when this runs.
 */
async function assertBudgetSlotFree(
  txn: SQLite.SQLiteDatabase,
  categoryId: string | null,
  period: BudgetPeriodValue,
): Promise<void> {
  const duplicate = await txn.getFirstAsync<{ id: string }>(
    categoryId === null
      ? 'SELECT id FROM budgets WHERE category_id IS NULL AND period = ?'
      : 'SELECT id FROM budgets WHERE category_id = ? AND period = ?',
    categoryId === null ? [period] : [categoryId, period],
  );
  if (!duplicate) return;

  const name = categoryId
    ? ((
        await txn.getFirstAsync<{ name: string }>('SELECT name FROM categories WHERE id = ?', [
          categoryId,
        ])
      )?.name ?? null)
    : null;
  throw new Error(`A ${period.toLowerCase()} budget for ${name ?? 'all expenses'} already exists`);
}
