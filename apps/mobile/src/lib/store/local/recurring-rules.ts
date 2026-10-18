import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';
import { todayIso } from '@pluto/domain';

import { nextDueOn, nextDueOnForNewRule, type RecurrenceFrequency } from '@/lib/recurring-schedule';
import { randomUuid } from '@/lib/uuid';
import type { CreateExpenseInput, ExpenseDto } from '../types';
import {
  applyPulledExpenses,
  CATEGORY_FALLBACK_COLOR,
  dropQueuedExpense,
  getLocalExpense,
  syncedExpenseFromDto,
  writeQueuedExpense,
} from './expenses';
import { getSyncMeta, setSyncMeta } from './meta';
import type { ExpenseMutationPayload } from './mutations';
import { isTransientApiError } from './network-errors';

/**
 * The recurring-rule mirror and its write-ahead queue.
 *
 * The Recurring screen has two halves: occurrences (the charges waiting for a
 * decision, mirrored in `occurrences.ts`) and the rules that produce them. This
 * module gives the rules the same treatment the rest of the app gives every
 * other record — a local mirror the screen can read with no connection, and a
 * queue (`rule_actions`) so a create, pause, edit or delete can be made offline
 * and replayed on the next connection.
 *
 * The rules list is served from the mirror rather than the API response for the
 * same reason budgets are: a rule created offline has no server id yet, and only
 * the mirror holds it.
 *
 * A rule created from the expense form's "repeat" option is special: one server
 * request (`POST /expenses` with a recurrence) mints the rule *and* its first,
 * already-confirmed charge. That action therefore also owns a stand-in expense
 * (`first_expense_id`), and its replay posts the current field values as one
 * request, exactly as going online would have.
 */
export type RecurringRuleDto = Schemas['RecurringExpenseDto'];
export type RecurringRuleStatus = RecurringRuleDto['status'];
export type RuleActionOp = 'create' | 'update' | 'delete';

/** The create payload, hand-written (see `use-recurring.ts`) to match the API. */
export interface CreateRecurringInput {
  categoryId: string;
  amount: number;
  currency: string;
  frequency: RecurrenceFrequency;
  /** Every Nth period; defaults to 1. */
  interval?: number;
  startDate: string;
  endDate?: string;
  description?: string;
  paymentMethod?: string;
}

/** The update payload; `null` for `endDate` clears the bound. */
export interface UpdateRecurringInput {
  categoryId?: string;
  amount?: number;
  currency?: string;
  frequency?: RecurrenceFrequency;
  interval?: number;
  startDate?: string;
  endDate?: string | null;
  description?: string;
  paymentMethod?: string;
  status?: RecurringRuleStatus;
}

/** A complete rule shape, as stored and as a create request needs it. */
interface RuleCreatePayload {
  categoryId: string;
  amount: number;
  currency: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  description: string | null;
  paymentMethod: string | null;
}

/**
 * What one queued change carries.
 *
 * A `create` holds the full rule; an `update` holds only the fields the user
 * changed, because the server treats an absent field as "keep" (and an explicit
 * `null` `endDate` as "clear"). `status` rides alongside because a create cannot
 * carry it — the server always creates a rule `ACTIVE`, so a pause queued before
 * the first sync is replayed as a follow-up patch.
 */
export interface RuleActionPayload extends Partial<RuleCreatePayload> {
  status?: RecurringRuleStatus;
}

export interface PendingRuleAction {
  ruleId: string;
  op: RuleActionOp;
  payload: RuleActionPayload | null;
  /** The stand-in expense a rule born from the expense form owns. */
  firstExpenseId: string | null;
  createdAt: string;
}

interface RuleRow {
  id: string;
  category_id: string;
  amount: number;
  currency: string;
  description: string | null;
  payment_method: string | null;
  frequency: string;
  interval: number;
  start_date: string;
  end_date: string | null;
  status: string;
  next_due_on: string | null;
  pending_count: number;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  category_color?: string | null;
}

interface ActionRow {
  rule_id: string;
  op: string;
  payload: string | null;
  first_expense_id: string | null;
  created_at: string;
}

const RULES_SEEDED_KEY = 'recurring_rules_seeded';

const SELECT_WITH_CATEGORY = `
  SELECT r.*, c.name AS category_name, c.color AS category_color
  FROM recurring_rules r
  LEFT JOIN categories c ON c.id = r.category_id
`;

function toRuleDto(row: RuleRow): RecurringRuleDto {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name ?? '',
    categoryColor: row.category_color ?? CATEGORY_FALLBACK_COLOR,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    paymentMethod: row.payment_method,
    frequency: row.frequency as RecurrenceFrequency,
    interval: row.interval,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as RecurringRuleStatus,
    nextDueOn: row.next_due_on,
    pendingCount: row.pending_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAction(row: ActionRow): PendingRuleAction {
  return {
    ruleId: row.rule_id,
    op: row.op as RuleActionOp,
    payload: row.payload ? (JSON.parse(row.payload) as RuleActionPayload) : null,
    firstExpenseId: row.first_expense_id,
    createdAt: row.created_at,
  };
}

/** Clamps a rule's interval to the server's accepted 1..12. */
function normaliseInterval(interval: number | undefined): number {
  if (interval === undefined) return 1;
  return Math.min(12, Math.max(1, Math.trunc(interval)));
}

// ---------------------------------------------------------------- mirror reads

/** The mirrored rules, in the shape the Recurring screen expects. */
export async function listLocalRules(
  database: SQLite.SQLiteDatabase,
): Promise<RecurringRuleDto[]> {
  const rows = await database.getAllAsync<RuleRow>(
    `${SELECT_WITH_CATEGORY} ORDER BY r.created_at ASC, r.id ASC`,
  );
  return rows.map(toRuleDto);
}

export async function getLocalRule(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<RecurringRuleDto> {
  const row = await database.getFirstAsync<RuleRow>(`${SELECT_WITH_CATEGORY} WHERE r.id = ?`, [id]);
  if (!row) throw new Error('Recurring expense not found');
  return toRuleDto(row);
}

/**
 * Whether a fetch has ever mirrored the rules. Like the occurrence mirror's
 * check, but a stored marker rather than a row count: a rule list is legitimately
 * empty, and an empty mirror must still answer offline once it was seeded.
 */
export async function rulesMirrorSeeded(database: SQLite.SQLiteDatabase): Promise<boolean> {
  return (await getSyncMeta(database, RULES_SEEDED_KEY)) !== null;
}

export async function markRulesMirrorSeeded(database: SQLite.SQLiteDatabase): Promise<void> {
  await setSyncMeta(database, RULES_SEEDED_KEY, new Date().toISOString());
}

// --------------------------------------------------------------- mirror writes

/**
 * How a fetched rule list reconciles against the mirror: server rows the
 * device has no queued change for replace their mirror copy, rows the server
 * no longer lists are dropped, and rows the device still owns (a queued create,
 * edit or delete) are left alone.
 */
export function planRuleMirror(
  localIds: readonly string[],
  remote: readonly RecurringRuleDto[],
  pendingIds: ReadonlySet<string>,
): { deleteIds: string[]; upsert: RecurringRuleDto[] } {
  const remoteIds = new Set(remote.map((rule) => rule.id));
  const deleteIds = localIds.filter((id) => !remoteIds.has(id) && !pendingIds.has(id));
  const upsert = remote.filter((rule) => !pendingIds.has(rule.id));
  return { deleteIds, upsert };
}

async function upsertRuleRow(
  txn: SQLite.SQLiteDatabase,
  rule: RecurringRuleDto,
): Promise<void> {
  await txn.runAsync(
    `INSERT INTO recurring_rules
       (id, category_id, amount, currency, description, payment_method, frequency, interval,
        start_date, end_date, status, next_due_on, pending_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       category_id = excluded.category_id,
       amount = excluded.amount,
       currency = excluded.currency,
       description = excluded.description,
       payment_method = excluded.payment_method,
       frequency = excluded.frequency,
       interval = excluded.interval,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       status = excluded.status,
       next_due_on = excluded.next_due_on,
       pending_count = excluded.pending_count,
       updated_at = excluded.updated_at`,
    [
      rule.id,
      rule.categoryId,
      rule.amount,
      rule.currency,
      rule.description ?? null,
      rule.paymentMethod ?? null,
      rule.frequency,
      rule.interval,
      rule.startDate,
      rule.endDate ?? null,
      rule.status,
      rule.nextDueOn ?? null,
      rule.pendingCount,
      rule.createdAt,
      rule.updatedAt,
    ],
  );
}

async function insertRuleRow(
  txn: SQLite.SQLiteDatabase,
  params: { id: string; create: RuleCreatePayload; status: RecurringRuleStatus; nextDueOn: string | null; now: string },
): Promise<void> {
  const { create } = params;
  await txn.runAsync(
    `INSERT INTO recurring_rules
       (id, category_id, amount, currency, description, payment_method, frequency, interval,
        start_date, end_date, status, next_due_on, pending_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      params.id,
      create.categoryId,
      create.amount,
      create.currency,
      create.description,
      create.paymentMethod,
      create.frequency,
      create.interval,
      create.startDate,
      create.endDate,
      params.status,
      params.nextDueOn,
      params.now,
      params.now,
    ],
  );
}

/** Applies one fetched rule list to the mirror, keeping queued rules intact. */
export async function replaceLocalRules(
  database: SQLite.SQLiteDatabase,
  remote: readonly RecurringRuleDto[],
): Promise<void> {
  const locals = await database.getAllAsync<{ id: string }>('SELECT id FROM recurring_rules');
  const actions = await database.getAllAsync<{ rule_id: string }>(
    'SELECT rule_id FROM rule_actions',
  );
  const plan = planRuleMirror(
    locals.map((row) => row.id),
    remote,
    new Set(actions.map((row) => row.rule_id)),
  );

  await database.withExclusiveTransactionAsync(async (txn) => {
    for (const rule of plan.upsert) {
      await upsertRuleRow(txn, rule);
    }
    for (const id of plan.deleteIds) {
      await txn.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
    }
  });
}

// ------------------------------------------------------------------ the queue

/** Parks (or replaces) the one queued change for a rule. */
async function queueRuleAction(
  txn: SQLite.SQLiteDatabase,
  action: PendingRuleAction,
): Promise<void> {
  await txn.runAsync('DELETE FROM rule_actions WHERE rule_id = ?', [action.ruleId]);
  await txn.runAsync(
    `INSERT INTO rule_actions (rule_id, op, payload, first_expense_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      action.ruleId,
      action.op,
      action.payload ? JSON.stringify(action.payload) : null,
      action.firstExpenseId,
      action.createdAt,
    ],
  );
}

async function deleteRuleAction(
  txn: SQLite.SQLiteDatabase,
  ruleId: string,
): Promise<void> {
  await txn.runAsync('DELETE FROM rule_actions WHERE rule_id = ?', [ruleId]);
}

/** The queued changes, oldest first — the replay order. */
export async function listRuleActions(
  database: SQLite.SQLiteDatabase,
): Promise<PendingRuleAction[]> {
  const rows = await database.getAllAsync<ActionRow>(
    'SELECT rule_id, op, payload, first_expense_id, created_at FROM rule_actions ORDER BY created_at ASC, rule_id ASC',
  );
  return rows.map(toAction);
}

/**
 * The stand-in expenses owned by queued recurrence creates, for `pushPending`
 * to hold back: the replay posts those rows itself (as the `POST /expenses`
 * body's expense half), so pushing the row alone would mint a duplicate that is
 * not linked to the rule.
 */
export async function listQueuedRecurrenceExpenseIds(
  database: SQLite.SQLiteDatabase,
): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ first_expense_id: string }>(
    'SELECT first_expense_id FROM rule_actions WHERE first_expense_id IS NOT NULL',
  );
  return new Set(rows.map((row) => row.first_expense_id));
}

/**
 * What a failed replay means for a queued rule change — the same rule as the
 * decision queue: a failure the server never answered is retried, a 4xx verdict
 * retires the change.
 */
export function ruleActionDisposition(error: unknown): 'retry' | 'drop' {
  return isTransientApiError(error) ? 'retry' : 'drop';
}

// -------------------------------------------------------------- user-initiated

/**
 * Creates a rule locally and queues it (`POST /expenses/recurring`).
 *
 * The rule appears on the Recurring screen immediately with a locally computed
 * "next due"; its occurrences do not, because confirming one needs the id the
 * server mints. The first fetch after the replay replaces the estimate.
 */
export async function createLocalRule(
  database: SQLite.SQLiteDatabase,
  input: CreateRecurringInput,
): Promise<RecurringRuleDto> {
  const id = randomUuid();
  const now = new Date().toISOString();
  const create: RuleCreatePayload = {
    categoryId: input.categoryId,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    frequency: input.frequency,
    interval: normaliseInterval(input.interval),
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    description: input.description ?? null,
    paymentMethod: input.paymentMethod ?? null,
  };

  await database.withExclusiveTransactionAsync(async (txn) => {
    await insertRuleRow(txn, {
      id,
      create,
      status: 'ACTIVE',
      nextDueOn: nextDueOnForNewRule(create, todayIso()),
      now,
    });
    await queueRuleAction(txn, {
      ruleId: id,
      op: 'create',
      payload: create,
      firstExpenseId: null,
      createdAt: now,
    });
  });

  return getLocalRule(database, id);
}

/**
 * Creates the expense form's "repeat this expense" pair with no connection.
 *
 * The server would do this in one request, producing a rule plus a first charge
 * that is already recorded and confirmed. Offline, the rule and a stand-in
 * expense are written locally and one queued action captures both; its replay
 * (`POST /expenses` with a recurrence) lets the server mint the pair exactly as
 * it would have. The stand-in expense rides the ordinary offline-expense shape —
 * editable, deletable — and is held back from `/sync/push` while its action is
 * queued (its rule id is local until then).
 */
export async function createLocalExpenseWithRecurrence(
  database: SQLite.SQLiteDatabase,
  input: CreateExpenseInput,
): Promise<ExpenseDto> {
  const recurrence = input.recurrence;
  if (!recurrence) throw new Error('A recurrence is required to create a recurring expense');

  const ruleId = randomUuid();
  const expenseId = randomUuid();
  const now = new Date().toISOString();
  const currency = input.currency.toUpperCase();
  const interval = normaliseInterval(recurrence.interval);
  const endDate = recurrence.endDate ?? null;
  const create: RuleCreatePayload = {
    categoryId: input.categoryId,
    amount: input.amount,
    currency,
    frequency: recurrence.frequency,
    interval,
    startDate: input.incurredOn,
    endDate,
    description: input.description ?? null,
    paymentMethod: input.paymentMethod ?? null,
  };

  await database.withExclusiveTransactionAsync(async (txn) => {
    await insertRuleRow(txn, {
      id: ruleId,
      create,
      status: 'ACTIVE',
      nextDueOn: nextDueOnForNewRule(create, todayIso()),
      now,
    });
    const payload: ExpenseMutationPayload = {
      categoryId: input.categoryId,
      amount: input.amount,
      currency,
      description: input.description ?? null,
      paymentMethod: input.paymentMethod ?? null,
      incurredOn: input.incurredOn,
      recurringExpenseId: ruleId,
    };
    await writeQueuedExpense(txn, { id: expenseId, now, payload });
    await queueRuleAction(txn, {
      ruleId,
      op: 'create',
      payload: create,
      firstExpenseId: expenseId,
      createdAt: now,
    });
  });

  return getLocalExpense(database, expenseId);
}

/** Merges a patch into a queued payload, ignoring absent (undefined) fields. */
export function mergeRulePayload(
  base: RuleActionPayload,
  patch: RuleActionPayload,
): RuleActionPayload {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as RuleActionPayload;
}

/**
 * Edits a rule locally and queues the change (`PATCH /expenses/recurring/:id`).
 *
 * A rule the server has not seen keeps its queued `create` (with the edit merged
 * in) rather than becoming a create-then-update pair, exactly like an offline
 * edit of an unsynced expense.
 */
export async function updateLocalRule(
  database: SQLite.SQLiteDatabase,
  id: string,
  input: UpdateRecurringInput,
): Promise<RecurringRuleDto> {
  const now = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<RuleRow>(
      'SELECT * FROM recurring_rules WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Recurring expense not found');
    const action = await txn.getFirstAsync<ActionRow>(
      'SELECT * FROM rule_actions WHERE rule_id = ?',
      [id],
    );

    const merged = {
      categoryId: input.categoryId ?? row.category_id,
      amount: input.amount ?? row.amount,
      currency: (input.currency ?? row.currency).toUpperCase(),
      frequency: (input.frequency ?? row.frequency) as RecurrenceFrequency,
      interval: input.interval !== undefined ? normaliseInterval(input.interval) : row.interval,
      startDate: input.startDate ?? row.start_date,
      endDate: input.endDate !== undefined ? input.endDate : row.end_date,
      description: input.description !== undefined ? input.description : row.description,
      paymentMethod: input.paymentMethod !== undefined ? input.paymentMethod : row.payment_method,
      status: input.status ?? (row.status as RecurringRuleStatus),
    };

    await txn.runAsync(
      `UPDATE recurring_rules
         SET category_id = ?, amount = ?, currency = ?, description = ?, payment_method = ?,
             frequency = ?, interval = ?, start_date = ?, end_date = ?, status = ?,
             next_due_on = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.categoryId,
        merged.amount,
        merged.currency,
        merged.description,
        merged.paymentMethod,
        merged.frequency,
        merged.interval,
        merged.startDate,
        merged.endDate,
        merged.status,
        nextDueOnForNewRule(merged, todayIso()),
        now,
        id,
      ],
    );

    const patch: RuleActionPayload = {};
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.currency !== undefined) patch.currency = merged.currency;
    if (input.frequency !== undefined) patch.frequency = input.frequency;
    if (input.interval !== undefined) patch.interval = merged.interval;
    if (input.startDate !== undefined) patch.startDate = input.startDate;
    if (input.endDate !== undefined) patch.endDate = input.endDate;
    if (input.description !== undefined) patch.description = input.description;
    if (input.paymentMethod !== undefined) patch.paymentMethod = input.paymentMethod;
    if (input.status !== undefined) patch.status = input.status;

    const op: RuleActionOp = action?.op === 'create' ? 'create' : 'update';
    const base = op === 'create' ? ((action?.payload ?? null) as RuleActionPayload) : {};
    await queueRuleAction(txn, {
      ruleId: id,
      op,
      payload: mergeRulePayload(base ?? {}, patch),
      firstExpenseId: action?.first_expense_id ?? null,
      createdAt: now,
    });
  });

  return getLocalRule(database, id);
}

/**
 * Deletes a rule locally and queues the change.
 *
 * A rule the server has never seen is simply dropped — with its queued `create`
 * and, when it was born from the expense form, its stand-in expense — since
 * nothing was ever sent. A synced rule keeps a queued `delete` (and loses its
 * mirrored rows, which the next server truth would remove anyway).
 */
export async function deleteLocalRule(
  database: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  const now = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (txn) => {
    const action = await txn.getFirstAsync<ActionRow>(
      'SELECT * FROM rule_actions WHERE rule_id = ?',
      [id],
    );

    await txn.runAsync('DELETE FROM recurring_rules WHERE id = ?', [id]);
    await txn.runAsync('DELETE FROM occurrences WHERE recurring_expense_id = ?', [id]);

    if (action?.op === 'create') {
      if (action.first_expense_id) await dropQueuedExpense(txn, action.first_expense_id);
      await deleteRuleAction(txn, id);
      return;
    }

    await queueRuleAction(txn, {
      ruleId: id,
      op: 'delete',
      payload: null,
      firstExpenseId: null,
      createdAt: now,
    });
  });
}

// ---------------------------------------------------------------- replay parts

/** The `POST /expenses/recurring` body for a queued create. */
export function ruleCreateBody(payload: RuleActionPayload | null): Record<string, unknown> {
  const create = payload ?? {};
  return {
    categoryId: create.categoryId,
    amount: create.amount,
    currency: create.currency,
    frequency: create.frequency,
    interval: create.interval ?? 1,
    startDate: create.startDate,
    ...(create.endDate ? { endDate: create.endDate } : {}),
    ...(create.description ? { description: create.description } : {}),
    ...(create.paymentMethod ? { paymentMethod: create.paymentMethod } : {}),
  };
}

/** The `PATCH /expenses/recurring/:id` body for a queued edit (nulls clear). */
export function ruleUpdateBody(payload: RuleActionPayload | null): Record<string, unknown> {
  const patch = payload ?? {};
  return {
    ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
    ...(patch.frequency !== undefined ? { frequency: patch.frequency } : {}),
    ...(patch.interval !== undefined ? { interval: patch.interval } : {}),
    ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
    ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.paymentMethod !== undefined ? { paymentMethod: patch.paymentMethod } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };
}

/**
 * The `POST /expenses` body for a queued recurrence create, read from the
 * stand-in expense's *current* values (so an offline edit of the charge is what
 * the server records) and the rule's cadence. `null` when the stand-in is gone —
 * the user deleted it, which withdraws the charge and leaves the rule alone.
 */
export async function recurrenceExpenseBody(
  database: SQLite.SQLiteDatabase,
  action: PendingRuleAction,
): Promise<Record<string, unknown> | null> {
  if (!action.firstExpenseId) return null;
  const row = await database.getFirstAsync<{
    category_id: string;
    amount: number;
    currency: string;
    description: string | null;
    payment_method: string | null;
    incurred_on: string;
  }>(
    `SELECT category_id, amount, currency, description, payment_method, incurred_on
       FROM expenses WHERE id = ? AND deleted_at IS NULL`,
    [action.firstExpenseId],
  );
  if (!row) return null;

  const payload = action.payload ?? {};
  return {
    categoryId: row.category_id,
    amount: row.amount,
    currency: row.currency,
    incurredOn: row.incurred_on,
    ...(row.description !== null ? { description: row.description } : {}),
    ...(row.payment_method !== null ? { paymentMethod: row.payment_method } : {}),
    recurrence: {
      frequency: payload.frequency,
      interval: payload.interval ?? 1,
      ...(payload.endDate ? { endDate: payload.endDate } : {}),
    },
  };
}

/** Repoints anything that referenced a rule's local id to its server id. */
async function repointRuleReferences(
  txn: SQLite.SQLiteDatabase,
  fromId: string,
  toId: string,
): Promise<void> {
  await txn.runAsync('UPDATE occurrences SET recurring_expense_id = ? WHERE recurring_expense_id = ?', [
    toId,
    fromId,
  ]);
  await txn.runAsync('UPDATE expenses SET recurring_expense_id = ? WHERE recurring_expense_id = ?', [
    toId,
    fromId,
  ]);
}

/** The server's own copy of a created rule replaces the local row. */
export async function acceptRuleCreate(
  database: SQLite.SQLiteDatabase,
  action: PendingRuleAction,
  rule: RecurringRuleDto,
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await deleteRuleAction(txn, action.ruleId);
    await txn.runAsync('DELETE FROM recurring_rules WHERE id = ?', [action.ruleId]);
    await repointRuleReferences(txn, action.ruleId, rule.id);
    await upsertRuleRow(txn, rule);
  });
}

/** The server's own copy of an edited rule replaces the local row. */
export async function acceptRuleUpdate(
  database: SQLite.SQLiteDatabase,
  action: PendingRuleAction,
  rule: RecurringRuleDto,
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await deleteRuleAction(txn, action.ruleId);
    await upsertRuleRow(txn, rule);
  });
}

/**
 * Settles a queued recurrence create against the server's expense.
 *
 * The response is an expense, not a rule, so the rule row is only re-keyed to
 * the server id with a locally recomputed "next due"; the follow-up rules fetch
 * carries the server's authoritative fields. The stand-in is dropped before the
 * server's expense is written, so a kill in between leaves no action to replay
 * and the next pull brings the row anyway.
 */
export async function settleRecurrenceCreate(
  database: SQLite.SQLiteDatabase,
  action: PendingRuleAction,
  expense: Schemas['ExpenseDto'],
): Promise<void> {
  const serverRuleId = expense.recurringExpenseId;
  if (!serverRuleId) throw new Error('The server did not link the recurring expense to a rule');

  const payload = action.payload ?? {};
  const nextDue =
    payload.frequency && (payload.startDate || expense.incurredOn)
      ? nextDueOn({
          startDate: payload.startDate ?? expense.incurredOn,
          frequency: payload.frequency,
          interval: payload.interval ?? 1,
          endDate: payload.endDate ?? null,
          after: expense.incurredOn,
        })
      : null;

  await database.withExclusiveTransactionAsync(async (txn) => {
    await deleteRuleAction(txn, action.ruleId);
    if (action.firstExpenseId) await dropQueuedExpense(txn, action.firstExpenseId);
    await txn.runAsync(
      `UPDATE recurring_rules
         SET id = ?, next_due_on = ?, pending_count = 0, updated_at = ?
       WHERE id = ?`,
      [serverRuleId, nextDue, new Date().toISOString(), action.ruleId],
    );
    await repointRuleReferences(txn, action.ruleId, serverRuleId);
  });

  await applyPulledExpenses(database, [syncedExpenseFromDto(expense)]);
}

/** Retires a queued change the server has answered (a delete) or refused. */
export async function retireRuleAction(
  database: SQLite.SQLiteDatabase,
  action: PendingRuleAction,
): Promise<void> {
  await deleteRuleAction(database, action.ruleId);
}

/**
 * Discards a queued create the server refused outright (an invalid category,
 * say): the rule never existed server-side, so neither should its mirror row,
 * its stand-in expense, or any occurrence hanging off it.
 */
export async function refuseRuleCreate(
  database: SQLite.SQLiteDatabase,
  action: PendingRuleAction,
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await deleteRuleAction(txn, action.ruleId);
    if (action.firstExpenseId) await dropQueuedExpense(txn, action.firstExpenseId);
    await txn.runAsync('DELETE FROM recurring_rules WHERE id = ?', [action.ruleId]);
    await txn.runAsync('DELETE FROM occurrences WHERE recurring_expense_id = ?', [action.ruleId]);
  });
}
