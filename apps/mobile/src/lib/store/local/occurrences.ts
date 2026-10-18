import type * as SQLite from 'expo-sqlite';
import type { Schemas } from '@pluto/api-client';

import { CATEGORY_FALLBACK_COLOR } from './expenses';

/**
 * The occurrence mirror.
 *
 * Occurrences are the recurring rules' due charges: the Recurring screen's
 * whole "decide before money moves" list. The mirror lets that list render —
 * and be decided — with no connection:
 *
 * - every successful fetch is written through (`replaceLocalOccurrences`), so
 *   the mirror is always the last server truth this device saw;
 * - an offline fetch reads the mirror back instead of failing;
 * - a queued decision flips the mirrored row immediately, which is what takes
 *   the occurrence off the pending list before the server has heard of it.
 *
 * Category name/colour are *not* stored here — the `categories` mirror owns
 * them, and the read joins them back in.
 */
export type OccurrenceDto = Schemas['RecurringOccurrenceDto'];
export type OccurrenceStatus = OccurrenceDto['status'];

interface OccurrenceRow {
  id: string;
  recurring_expense_id: string;
  due_on: string;
  status: string;
  amount: number;
  currency: string;
  category_id: string;
  description: string | null;
  payment_method: string | null;
  expense_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  category_name: string | null;
  category_color: string | null;
}

const SELECT_WITH_CATEGORY = `
  SELECT o.*, c.name AS category_name, c.color AS category_color
  FROM occurrences o
  LEFT JOIN categories c ON c.id = o.category_id
`;

function toOccurrenceDto(row: OccurrenceRow): OccurrenceDto {
  return {
    id: row.id,
    recurringExpenseId: row.recurring_expense_id,
    dueOn: row.due_on,
    status: row.status as OccurrenceStatus,
    amount: row.amount,
    currency: row.currency,
    categoryId: row.category_id,
    categoryName: row.category_name ?? '',
    categoryColor: row.category_color ?? CATEGORY_FALLBACK_COLOR,
    description: row.description,
    paymentMethod: row.payment_method,
    expenseId: row.expense_id,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}

/** Local adjustments a decision makes on top of the fetched DTO. */
export interface OccurrenceOverride {
  status?: OccurrenceStatus;
  expenseId?: string | null;
  confirmedAt?: string | null;
}

/**
 * Writes one occurrence row, applying any decision overrides.
 *
 * Usable both with a database handle (fetch write-through) and with an open
 * transaction (a queued decision must commit its expense, its action and this
 * status flip together).
 */
export async function upsertLocalOccurrence(
  database: SQLite.SQLiteDatabase,
  occurrence: OccurrenceDto,
  overrides: OccurrenceOverride = {},
): Promise<void> {
  await database.runAsync(
    `INSERT INTO occurrences
       (id, recurring_expense_id, due_on, status, amount, currency, category_id,
        description, payment_method, expense_id, confirmed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       recurring_expense_id = excluded.recurring_expense_id,
       due_on = excluded.due_on,
       status = excluded.status,
       amount = excluded.amount,
       currency = excluded.currency,
       category_id = excluded.category_id,
       description = excluded.description,
       payment_method = excluded.payment_method,
       expense_id = excluded.expense_id,
       confirmed_at = excluded.confirmed_at`,
    [
      occurrence.id,
      occurrence.recurringExpenseId,
      occurrence.dueOn,
      overrides.status ?? occurrence.status,
      occurrence.amount,
      occurrence.currency,
      occurrence.categoryId,
      occurrence.description ?? null,
      occurrence.paymentMethod ?? null,
      overrides.expenseId !== undefined ? overrides.expenseId : (occurrence.expenseId ?? null),
      overrides.confirmedAt !== undefined
        ? overrides.confirmedAt
        : (occurrence.confirmedAt ?? null),
      occurrence.createdAt,
    ],
  );
}

/**
 * The mirrored rows for one status window — the offline stand-in for
 * `GET /expenses/recurring/occurrences`.
 */
export async function listLocalOccurrences(
  database: SQLite.SQLiteDatabase,
  status: OccurrenceStatus | undefined,
  limit: number,
): Promise<OccurrenceDto[]> {
  const rows = status
    ? await database.getAllAsync<OccurrenceRow>(
        `${SELECT_WITH_CATEGORY} WHERE o.status = ? ORDER BY o.due_on ASC, o.created_at ASC LIMIT ?`,
        [status, limit],
      )
    : await database.getAllAsync<OccurrenceRow>(
        `${SELECT_WITH_CATEGORY} ORDER BY o.due_on ASC, o.created_at ASC LIMIT ?`,
        [limit],
      );
  return rows.map(toOccurrenceDto);
}

/**
 * Whether any occurrence has ever been mirrored.
 *
 * This is the offline fallback's honesty check: an *empty* mirror is only
 * evidence of "nothing due" if a fetch once ran and found nothing to store. A
 * device that has never seen the endpoint must surface the real error instead
 * of inventing an empty list.
 */
export async function occurrenceMirrorSeeded(database: SQLite.SQLiteDatabase): Promise<boolean> {
  const row = await database.getFirstAsync<{ n: number }>('SELECT COUNT(1) AS n FROM occurrences');
  return (row?.n ?? 0) > 0;
}

/**
 * How one fetched page reconciles against the mirror.
 *
 * Three protections, in order:
 *
 * 1. **Queued decisions win.** An occurrence the device still owes the server
 *    (see `recurring_actions`) keeps its local status, even though the server
 *    — which has not heard the decision yet — would describe it differently.
 *    The queued set is the only honest signal here: occurrence statuses are
 *    terminal server-side (a confirm/skip only ever claims a `PENDING` row),
 *    so a local row that diverges from a fetch is either a decision still in
 *    flight, or stale until the next fetch after the replay settles it.
 * 2. **Absence only proves something when the page is complete.** A page
 *    fetched under a limit may simply have cut off; deleting rows it did not
 *    mention would shred everything past the cut.
 * 3. **A filtered fetch speaks only for its filter.** A `PENDING` page cannot
 *    pronounce on a locally `CONFIRMED` row's existence — only on the pending
 *    ones it was asked for.
 */
export function planOccurrenceMirror(
  local: readonly { id: string; status: OccurrenceStatus }[],
  remote: readonly OccurrenceDto[],
  total: number,
  fetchedStatus: OccurrenceStatus | undefined,
  queuedIds: ReadonlySet<string>,
): { deleteIds: string[]; upsert: OccurrenceDto[] } {
  const remoteIds = new Set(remote.map((occurrence) => occurrence.id));
  const pageComplete = remote.length >= total;

  const deleteIds: string[] = [];
  if (pageComplete) {
    for (const row of local) {
      if (queuedIds.has(row.id)) continue;
      if (fetchedStatus !== undefined && row.status !== fetchedStatus) continue;
      if (remoteIds.has(row.id)) continue;
      deleteIds.push(row.id);
    }
  }

  const upsert = remote.filter((occurrence) => !queuedIds.has(occurrence.id));
  return { deleteIds, upsert };
}

/**
 * Applies one fetched page to the mirror.
 *
 * The queued-action ids are read from `recurring_actions` directly rather than
 * imported from its owner module: `recurring_actions` depends on *this* module
 * (a queued decision writes its occurrence row), and reading the table inline
 * is what keeps that dependency one-way.
 */
export async function replaceLocalOccurrences(
  database: SQLite.SQLiteDatabase,
  response: { items: OccurrenceDto[]; total: number },
  fetchedStatus: OccurrenceStatus | undefined,
): Promise<void> {
  const local = await database.getAllAsync<{ id: string; status: string }>(
    'SELECT id, status FROM occurrences',
  );
  const queued = await database.getAllAsync<{ occurrence_id: string }>(
    'SELECT occurrence_id FROM recurring_actions',
  );
  const plan = planOccurrenceMirror(
    local.map((row) => ({ id: row.id, status: row.status as OccurrenceStatus })),
    response.items,
    response.total,
    fetchedStatus,
    new Set(queued.map((row) => row.occurrence_id)),
  );

  await database.withExclusiveTransactionAsync(async (txn) => {
    for (const occurrence of plan.upsert) {
      await upsertLocalOccurrence(txn, occurrence);
    }
    for (const id of plan.deleteIds) {
      await txn.runAsync('DELETE FROM occurrences WHERE id = ?', [id]);
    }
  });
}
