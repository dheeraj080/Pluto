import type * as SQLite from 'expo-sqlite';
import type { Schemas } from '@pluto/api-client';

import {
  applyPulledExpenses,
  dropQueuedExpense,
  getLocalExpenseExists,
  readQueuedExpenseOverrides,
  syncedExpenseFromDto,
  writeQueuedExpense,
} from './expenses';
import { isTransientApiError } from './network-errors';
import type { OccurrenceDto } from './occurrences';
import { upsertLocalOccurrence } from './occurrences';
import { randomUuid } from '@/lib/uuid';

/**
 * The recurring decision queue.
 *
 * Confirming or skipping an occurrence is normally a request the server
 * answers (`POST /expenses/recurring/occurrences/:id/confirm|skip`). Offline,
 * the *decision* is still real — the user said yes or no to a charge that is
 * sitting right there on screen — so the decision is written here, next to the
 * mirror it flips, and the sync engine replays it the moment the server
 * answers again.
 *
 * A queued `confirm` also mints the local expense it would have produced (a
 * queued `create`, exactly like an expense typed offline): the user sees the
 * money move immediately, edits it like any other pending expense, and the
 * replay posts those current field values as the confirm's overrides — so what
 * the server records is what the mirror shows. The expense is never pushed
 * through `/sync/push` while its action is queued (`pushPending` filters it);
 * the replay settles it first and retires the local stand-in the moment the
 * server mints its own copy.
 *
 * The queue is also where "one decision per occurrence" lives: re-deciding an
 * occurrence that is already queued either reinforces the same decision or
 * withdraws the old one, in the same transaction — never both.
 */
export type RecurringActionKind = 'confirm' | 'skip';

export interface PendingRecurringAction {
  occurrenceId: string;
  action: RecurringActionKind;
  /** The local stand-in expense a queued `confirm` created; null for `skip`. */
  localExpenseId: string | null;
  createdAt: string;
}

interface ActionRow {
  occurrence_id: string;
  action: string;
  local_expense_id: string | null;
  created_at: string;
}

function toAction(row: ActionRow): PendingRecurringAction {
  return {
    occurrenceId: row.occurrence_id,
    action: row.action as RecurringActionKind,
    localExpenseId: row.local_expense_id,
    createdAt: row.created_at,
  };
}

/**
 * Parks a decision for replay, flipping the mirrored occurrence in the same
 * transaction so the pending list can never still show a charge the user
 * already answered.
 *
 * Re-deciding an occurrence that is already queued resolves in favour of the
 * existing decision: the same decision is a no-op, and an opposite one
 * withdraws what it replaced (a withdrawn confirm drops its local expense and
 * the queued create with it — that row never reached the server, because no
 * replay could run while its action existed).
 */
export async function queueOccurrenceDecision(
  database: SQLite.SQLiteDatabase,
  occurrence: OccurrenceDto,
  action: RecurringActionKind,
): Promise<{ localExpenseId: string | null }> {
  const now = new Date().toISOString();
  let localExpenseId: string | null = null;

  await database.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<ActionRow>(
      `SELECT occurrence_id, action, local_expense_id, created_at
         FROM recurring_actions WHERE occurrence_id = ?`,
      [occurrence.id],
    );

    if (existing?.action === action) {
      // Already parked as this decision: keep its expense (and its id) and
      // just make sure the mirror still reflects the flip.
      localExpenseId = existing.local_expense_id;
      await upsertLocalOccurrence(txn, occurrence, {
        status: action === 'confirm' ? 'CONFIRMED' : 'SKIPPED',
        expenseId: localExpenseId,
        confirmedAt: action === 'confirm' ? now : null,
      });
      return;
    }

    if (existing?.local_expense_id) {
      // Withdrawing a queued confirm: its local expense never reached the
      // server, so dropping the row and the queued create leaves nothing to
      // reconcile.
      await dropQueuedExpense(txn, existing.local_expense_id);
    }

    if (action === 'confirm') {
      localExpenseId = randomUuid();
      await writeQueuedExpense(txn, {
        id: localExpenseId,
        now,
        payload: {
          categoryId: occurrence.categoryId,
          amount: occurrence.amount,
          currency: occurrence.currency.toUpperCase(),
          description: occurrence.description ?? null,
          paymentMethod: occurrence.paymentMethod ?? null,
          incurredOn: occurrence.dueOn,
          recurringExpenseId: occurrence.recurringExpenseId,
        },
      });
    }

    await txn.runAsync(
      `INSERT INTO recurring_actions (occurrence_id, action, local_expense_id, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(occurrence_id) DO UPDATE SET
         action = excluded.action,
         local_expense_id = excluded.local_expense_id,
         created_at = excluded.created_at`,
      [occurrence.id, action, localExpenseId, now],
    );
    await upsertLocalOccurrence(txn, occurrence, {
      status: action === 'confirm' ? 'CONFIRMED' : 'SKIPPED',
      expenseId: localExpenseId,
      confirmedAt: action === 'confirm' ? now : null,
    });
  });

  return { localExpenseId };
}

/** The queued decisions, oldest first — the replay order. */
export async function listRecurringActions(
  database: SQLite.SQLiteDatabase,
): Promise<PendingRecurringAction[]> {
  const rows = await database.getAllAsync<ActionRow>(
    `SELECT occurrence_id, action, local_expense_id, created_at
       FROM recurring_actions ORDER BY created_at ASC`,
  );
  return rows.map(toAction);
}

/**
 * The queued confirm expenses, for `pushPending` to hold back.
 *
 * Read *after* the mutation batch in `pushPending`, which makes the pairing
 * airtight: a decision and its expense commit in one transaction, so an
 * expense present in the batch cannot have an action this later read missed.
 */
export async function listQueuedConfirmExpenseIds(
  database: SQLite.SQLiteDatabase,
): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ local_expense_id: string }>(
    'SELECT local_expense_id FROM recurring_actions WHERE local_expense_id IS NOT NULL',
  );
  return new Set(rows.map((row) => row.local_expense_id));
}

/**
 * What a failed replay means for a queued decision.
 *
 * `retry` — the server never read it (unreachable, stale token, transient
 * 5xx): keep the queue and try again on the next sync. `drop` — a 4xx the
 * server *did* answer: the occurrence was already handled elsewhere (409), is
 * gone (404), or the request was refused outright (400/403/422); replaying can
 * only fail the same way, so the queue retires the decision instead.
 */
export function recurringActionDisposition(error: unknown): 'retry' | 'drop' {
  return isTransientApiError(error) ? 'retry' : 'drop';
}

/**
 * Whether the stand-in expense a confirm action created still exists — its
 * absence means the user withdrew the decision by deleting the expense.
 */
export async function confirmActionExpenseExists(
  database: SQLite.SQLiteDatabase,
  action: PendingRecurringAction,
): Promise<boolean> {
  if (!action.localExpenseId) return false;
  return getLocalExpenseExists(database, action.localExpenseId);
}

/**
 * The overrides a queued confirm replays with: the stand-in expense's current
 * field values, so offline edits are what the server records.
 *
 * Only non-null values are sent — the server merges with `??`, so an omitted
 * field keeps the occurrence's original, which is also the only way a cleared
 * note or payment method resolves (it falls back to the original; accepted).
 */
export async function confirmOverridesFor(
  database: SQLite.SQLiteDatabase,
  action: PendingRecurringAction,
): Promise<Record<string, unknown> | null> {
  if (!action.localExpenseId) return null;
  return readQueuedExpenseOverrides(database, action.localExpenseId);
}

/**
 * Records a server-answered confirm in the mirror: the expense lands in the
 * expense store exactly as a pull would write it, and the occurrence flips
 * with the id the server minted — so the pending list and Activity are right
 * immediately, without waiting for a sync. The `confirmedAt` here is an
 * approximation of the server's clock; the next occurrence fetch overwrites it
 * with the truth.
 */
export async function recordServerConfirm(
  database: SQLite.SQLiteDatabase,
  occurrence: OccurrenceDto,
  expense: Schemas['ExpenseDto'],
): Promise<void> {
  await applyPulledExpenses(database, [syncedExpenseFromDto(expense)]);
  await upsertLocalOccurrence(database, occurrence, {
    status: 'CONFIRMED',
    expenseId: expense.id,
    confirmedAt: new Date().toISOString(),
  });
}

/**
 * Records a server-answered skip in the mirror. The expense id stays null —
 * skipping records no money — and only the next fetch carries the server's
 * own bookkeeping, if any.
 */
export async function recordServerSkip(
  database: SQLite.SQLiteDatabase,
  occurrence: OccurrenceDto,
): Promise<void> {
  await upsertLocalOccurrence(database, occurrence, {
    status: 'SKIPPED',
    expenseId: null,
    confirmedAt: null,
  });
}

/**
 * Retires a confirm the server has now recorded (or refused for good).
 *
 * The local stand-in and its queued create go in the same transaction as the
 * action row — with `serverExpense`, the server's own copy is written right
 * after, so Activity keeps showing the expense across the swap. Ordering
 * matters for crash-safety: retire first, insert second. A kill between the
 * two leaves no action (so no second replay) and no stand-in, and the next
 * pull — whose cursor never advanced past the confirm — brings the server's
 * copy anyway.
 *
 * With no `serverExpense` (a drop: the occurrence was handled elsewhere or no
 * longer exists) the stand-in is simply removed: pushing it would resurrect a
 * charge the server deliberately did not create.
 */
export async function retireConfirmAction(
  database: SQLite.SQLiteDatabase,
  action: PendingRecurringAction,
  serverExpense: Schemas['ExpenseDto'] | null,
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM recurring_actions WHERE occurrence_id = ?', [
      action.occurrenceId,
    ]);
    if (action.localExpenseId) {
      await dropQueuedExpense(txn, action.localExpenseId);
    }
  });

  if (serverExpense) {
    await applyPulledExpenses(database, [syncedExpenseFromDto(serverExpense)]);
  }
}

/** Retires a skip the server has now recorded (or refused for good). */
export async function retireSkippedAction(
  database: SQLite.SQLiteDatabase,
  action: PendingRecurringAction,
): Promise<void> {
  await database.runAsync('DELETE FROM recurring_actions WHERE occurrence_id = ?', [
    action.occurrenceId,
  ]);
}

/**
 * Cancels a queued confirm whose stand-in expense has vanished — the user
 * deleted it before the replay ran, which withdraws the decision. The
 * occurrence returns to `PENDING`, both here and on the next server truth.
 */
export async function cancelQueuedConfirm(
  database: SQLite.SQLiteDatabase,
  action: PendingRecurringAction,
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM recurring_actions WHERE occurrence_id = ?', [
      action.occurrenceId,
    ]);
    await txn.runAsync(
      `UPDATE occurrences
         SET status = 'PENDING', expense_id = NULL, confirmed_at = NULL
       WHERE id = ?`,
      [action.occurrenceId],
    );
  });
}
