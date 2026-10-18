import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { getQueryClient } from '@/lib/query-client';
import { getSessionState, setUser } from '@/lib/session';
import { categoryStore, localStoreEnabled } from '@/lib/store';
import { resolvePushedBudgetMutation } from '@/lib/store/local/budgets';
import { getDatabase } from '@/lib/store/local/database';
import {
  applyPulledExpenses,
  resolvePushedMutation as resolvePushedExpenseMutation,
} from '@/lib/store/local/expenses';
import { resolvePushedCategoryMutation } from '@/lib/store/local/categories';
import { currencyCacheSeeded, refreshLocalCurrencies } from '@/lib/store/local/currencies';
import {
  clearSyncMeta,
  getSyncMeta,
  setSyncMeta,
  SYNC_CURSOR_KEY,
} from '@/lib/store/local/meta';
import { listPendingMutations } from '@/lib/store/local/mutations';
import {
  clearProfilePatch,
  profilePatchDisposition,
  readProfilePatch,
} from '@/lib/store/local/profile-patch';
import {
  cancelQueuedConfirm,
  confirmActionExpenseExists,
  confirmOverridesFor,
  listQueuedConfirmExpenseIds,
  listRecurringActions,
  recurringActionDisposition,
  retireConfirmAction,
  retireSkippedAction,
} from '@/lib/store/local/recurring-actions';
import {
  acceptRuleCreate,
  acceptRuleUpdate,
  listQueuedRecurrenceExpenseIds,
  listRuleActions,
  recurrenceExpenseBody,
  refuseRuleCreate,
  retireRuleAction,
  ruleActionDisposition,
  ruleCreateBody,
  ruleUpdateBody,
  settleRecurrenceCreate,
} from '@/lib/store/local/recurring-rules';
import { refreshReportMirrors } from '@/lib/store/local/report-mirror';

export interface SyncOutcome {
  /** Queued changes the server accepted (or superseded). */
  pushed: number;
  /** Server rows applied to the local mirror (including deletions). */
  pulled: number;
  /** Queued changes the server refused; they stay queued for the next attempt. */
  failed: number;
  /** True when sync was a no-op because this platform has no local store. */
  disabled: boolean;
  /** Set when the attempt could not complete (offline, server error). */
  error?: unknown;
}

const DISABLED: SyncOutcome = { pushed: 0, pulled: 0, failed: 0, disabled: true };

/** The server's reporting default, used until the profile supplies a base. */
const DEFAULT_BASE_CURRENCY = 'USD';

/** Guards against overlapping runs: a timer tick and a reconnect can race. */
let inFlight: Promise<SyncOutcome> | null = null;

/** Pull page bound; the loop keeps pulling while the server reports `hasMore`. */
const MAX_PULL_PAGES = 50;

/**
 * Reconciles the local store with the server: replay offline decisions, push
 * the queue, then pull changes.
 *
 * Safe to call at any time and from anywhere — concurrent calls share one run,
 * and a failure resolves (never rejects) so fire-and-forget callers cannot
 * produce an unhandled rejection.
 */
export function syncNow(): Promise<SyncOutcome> {
  if (!localStoreEnabled) return Promise.resolve(DISABLED);
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runSync(): Promise<SyncOutcome> {
  let pushed = 0;
  let failed = 0;
  let pulled = 0;
  let replayedOffline = 0;

  try {
    const database = await getDatabase();

    // Offline decisions first, before anything is pushed: a queued confirm is
    // a promise the server has not heard yet, and its stand-in expense must
    // never travel the ordinary push ahead of the decision itself. Queued rule
    // writes come next — a rule the expense form's "repeat" option created also
    // owns a stand-in expense, held back for the same reason.
    replayedOffline += await replayProfilePatch(database);
    replayedOffline += await replayRecurringActions(database);
    replayedOffline += await replayRuleActions(database);

    const pushResult = await pushPending(database);
    pushed = pushResult.pushed;
    failed = pushResult.failed;

    // A superseded *expense* means the server holds a newer row than this
    // device. That row's `updatedAt` can predate the cursor, so a delta pull
    // would miss it — drop the cursor to take a full snapshot and converge.
    // Budgets are not cursor-based, so their skips need no reset.
    if (pushResult.skippedExpense > 0) {
      await clearSyncMeta(database, SYNC_CURSOR_KEY);
    }

    pulled = await pullChanges(database);

    // Best-effort: a failed category refresh must not fail the whole sync.
    try {
      await categoryStore.refresh();
      void getQueryClient().invalidateQueries({ queryKey: queryKeys.categories.all });
    } catch {
      /* Offline or transient: keep the cached mirror. */
    }

    // The supported-currency list feeds every currency picker; fetch the
    // provider's quotable set once so a fetched (possibly narrower than the
    // bundled registry) list lands. Best-effort, like the refresh above.
    if (!(await currencyCacheSeeded(database))) {
      try {
        await refreshLocalCurrencies(database);
      } catch {
        /* Offline or transient: try again on the next sync. */
      }
    }

    // Rate + budget mirrors: what the Reports and Budgets tabs convert with
    // when the device is offline. The rate window starts at the warm default
    // and covers the account's own history (oldest expense, earliest budget).
    // Best-effort, like the category refresh.
    await refreshReportMirrors(
      database,
      getSessionState().user?.baseCurrency ?? DEFAULT_BASE_CURRENCY,
    );
  } catch (error) {
    if (pushed > 0 || pulled > 0 || replayedOffline > 0) {
      invalidateSyncedQueries(replayedOffline > 0);
    }
    return { pushed, pulled, failed, disabled: false, error };
  }

  if (pushed > 0 || pulled > 0 || replayedOffline > 0) {
    invalidateSyncedQueries(replayedOffline > 0);
  }
  return { pushed, pulled, failed, disabled: false };
}

/**
 * A sync may have changed expenses and/or budgets; refetch whichever screens
 * are mounted. A replayed offline change also touches the recurring namespace —
 * the occurrences and rules a decision or a rule write settled.
 */
function invalidateSyncedQueries(replayedOffline = false): void {
  const client = getQueryClient();
  void client.invalidateQueries({ queryKey: queryKeys.expenses.all });
  void client.invalidateQueries({ queryKey: queryKeys.budgets.all });
  if (replayedOffline) {
    void client.invalidateQueries({ queryKey: queryKeys.recurring.all });
  }
}

/**
 * Replays the parked profile patch (`PATCH /users/me`) against the server.
 *
 * Returns how many patches actually reached it — the session store already
 * carries the applied values, so a replay needs no query invalidation. A
 * failure never aborts the sync: a transient one leaves the patch parked for
 * the next run, and a definitive 4xx voids it (replaying could only fail the
 * same way) while the optimistic session value stays as the user last saw it.
 */
async function replayProfilePatch(database: SQLite.SQLiteDatabase): Promise<number> {
  const patch = await readProfilePatch(database);
  if (!patch) return 0;

  try {
    const profile = await api.patch<Schemas['UserProfileDto']>('/users/me', patch.payload);
    await clearProfilePatch(database);
    if (getSessionState().status === 'signed-in') setUser(profile);
    return 1;
  } catch (error) {
    if (profilePatchDisposition(error) === 'drop') await clearProfilePatch(database);
    return 0;
  }
}

/**
 * Replays the parked occurrence decisions, oldest first.
 *
 * Each confirm posts its stand-in expense's *current* field values as the
 * confirm's overrides, so offline edits are what the server records, and then
 * retires the stand-in in favour of the server's own copy. A failure never
 * aborts the sync — `pushPending`'s filter already keeps queued confirm
 * expenses off the wire — it just stops the replay: a transient error leaves
 * the remaining decisions for the next run, while a 4xx verdict retires
 * exactly the decision it judged and carries on.
 */
async function replayRecurringActions(database: SQLite.SQLiteDatabase): Promise<number> {
  const actions = await listRecurringActions(database);
  let settled = 0;

  for (const action of actions) {
    try {
      if (action.action === 'skip') {
        await api.post(`/expenses/recurring/occurrences/${action.occurrenceId}/skip`, {});
        await retireSkippedAction(database, action);
        settled += 1;
        continue;
      }

      // A vanished stand-in means the user deleted the expense before this
      // replay ran — the decision is withdrawn, and the occurrence returns to
      // pending rather than being confirmed against the user's intent.
      if (!(await confirmActionExpenseExists(database, action))) {
        await cancelQueuedConfirm(database, action);
        settled += 1;
        continue;
      }

      const overrides = await confirmOverridesFor(database, action);
      const expense = await api.post<Schemas['ExpenseDto']>(
        `/expenses/recurring/occurrences/${action.occurrenceId}/confirm`,
        overrides ?? {},
      );
      await retireConfirmAction(database, action, expense);
      settled += 1;
    } catch (error) {
      if (recurringActionDisposition(error) === 'retry') break;
      // A 4xx verdict retires just this decision and moves on.
      if (action.action === 'skip') await retireSkippedAction(database, action);
      else await retireConfirmAction(database, action, null);
      settled += 1;
    }
  }

  return settled;
}

/**
 * Replays the queued rule writes, oldest first.
 *
 * Three shapes of change, each settled against the server's own answer:
 *
 * - a `create` posts the rule (`POST /expenses/recurring`) and replaces the
 *   local row with the server's copy, re-keying anything that referenced the
 *   provisional id. A rule born from the expense form instead replays as one
 *   `POST /expenses` with a recurrence — the same request going online would
 *   have made — so the server mints the rule and its first confirmed charge
 *   together; if the stand-in charge was deleted meanwhile, the rule is created
 *   on its own;
 * - an `update` patches the fields the user changed;
 * - a `delete` removes the rule.
 *
 * Like the decision replay, a failure never aborts the sync: a transient error
 * leaves the rest for the next run, while a 4xx verdict discards exactly the
 * change it judged — a refused create takes its mirror row (and stand-in) with
 * it, since nothing server-side will ever exist to reconcile against.
 */
async function replayRuleActions(database: SQLite.SQLiteDatabase): Promise<number> {
  const actions = await listRuleActions(database);
  let settled = 0;

  for (const action of actions) {
    try {
      if (action.op === 'delete') {
        await api.delete(`/expenses/recurring/${action.ruleId}`);
        await retireRuleAction(database, action);
        settled += 1;
        continue;
      }

      if (action.op === 'update') {
        const rule = await api.patch<Schemas['RecurringExpenseDto']>(
          `/expenses/recurring/${action.ruleId}`,
          ruleUpdateBody(action.payload),
        );
        await acceptRuleUpdate(database, action, rule);
        settled += 1;
        continue;
      }

      // Create. A recurrence create with a live stand-in expense replays as the
      // single request that mints the rule and its first charge together.
      if (action.firstExpenseId) {
        const body = await recurrenceExpenseBody(database, action);
        if (body) {
          const expense = await api.post<Schemas['ExpenseDto']>('/expenses', body);
          await settleRecurrenceCreate(database, action, expense);
          settled += 1;
          continue;
        }
        // The stand-in is gone: the user withdrew the charge, not the cadence.
      }

      const created = await api.post<Schemas['RecurringExpenseDto']>(
        '/expenses/recurring',
        ruleCreateBody(action.payload),
      );
      // The server always creates a rule `ACTIVE`; a pause queued before the
      // first sync is therefore replayed as a follow-up the moment it has an id.
      const desiredStatus = action.payload?.status;
      const rule =
        desiredStatus && desiredStatus !== 'ACTIVE'
          ? await api.patch<Schemas['RecurringExpenseDto']>(
              `/expenses/recurring/${created.id}`,
              { status: desiredStatus },
            )
          : created;
      await acceptRuleCreate(database, action, rule);
      settled += 1;
    } catch (error) {
      if (ruleActionDisposition(error) === 'retry') break;
      if (action.op === 'create') await refuseRuleCreate(database, action);
      else await retireRuleAction(database, action);
      settled += 1;
    }
  }

  return settled;
}

async function pushPending(database: SQLite.SQLiteDatabase): Promise<{
  pushed: number;
  failed: number;
  skipped: number;
  /** Skips of *expense* changes; only these invalidate the delta-pull cursor. */
  skippedExpense: number;
}> {
  const pending = await listPendingMutations(database);
  if (pending.length === 0) return { pushed: 0, failed: 0, skipped: 0, skippedExpense: 0 };

  // Hold back the stand-in expenses of queued confirms: their replay posts
  // them (with the device's current edits) as the confirm's overrides, so
  // pushing the rows themselves would mint a second, decision-less expense.
  // The same goes for the first expense of a queued recurrence create, which
  // its replay posts as the `POST /expenses` body. Read *after* the batch above
  // — a decision or rule create and its expense commit in one transaction, so
  // anything in the batch whose action this later read cannot see cannot exist.
  const confirmExpenseIds = await listQueuedConfirmExpenseIds(database);
  const recurrenceExpenseIds = await listQueuedRecurrenceExpenseIds(database);
  const heldBack = new Set([...confirmExpenseIds, ...recurrenceExpenseIds]);
  const batch = heldBack.size
    ? pending.filter(
        (mutation) => mutation.entity !== 'expense' || !heldBack.has(mutation.entityId),
      )
    : pending;
  if (batch.length === 0) return { pushed: 0, failed: 0, skipped: 0, skippedExpense: 0 };

  const body: Schemas['SyncPushDto'] = {
    changes: batch.map((mutation) => ({
      entity: mutation.entity,
      id: mutation.entityId,
      op: mutation.op,
      clientUpdatedAt: mutation.clientUpdatedAt,
      // Deletes carry no payload; the server only needs the id and the clock.
      ...(mutation.payload ? { data: mutation.payload as Schemas['SyncPushDto']['changes'][number]['data'] } : {}),
    })),
  };

  const response = await api.post<Schemas['SyncPushResponseDto']>('/sync/push', body);
  const results = new Map(response.results.map((result) => [result.id, result]));

  let pushed = 0;
  let failed = 0;
  let skipped = 0;
  let skippedExpense = 0;
  for (const mutation of batch) {
    const result = results.get(mutation.entityId);
    if (!result || result.status === 'failed') {
      failed += 1;
      continue;
    }
    if (result.status === 'skipped') {
      skipped += 1;
      if (mutation.entity === 'expense') skippedExpense += 1;
    }

    if (mutation.entity === 'budget') {
      await resolvePushedBudgetMutation(database, mutation, result);
    } else if (mutation.entity === 'category') {
      await resolvePushedCategoryMutation(database, mutation, result);
    } else {
      await resolvePushedExpenseMutation(database, mutation, result);
    }
    pushed += 1;
  }

  return { pushed, failed, skipped, skippedExpense };
}

async function pullChanges(database: SQLite.SQLiteDatabase): Promise<number> {
  let cursor = await getSyncMeta(database, SYNC_CURSOR_KEY);
  let pulled = 0;

  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const response = await api.get<Schemas['SyncPullResponseDto']>('/sync/pull', {
      query: { since: cursor },
    });

    await applyPulledExpenses(database, response.expenses);
    pulled += response.expenses.length;

    // Stop on an empty page or a cursor that refused to move: either would
    // otherwise spin until the page cap chasing rows the server already sent.
    if (response.expenses.length === 0 || response.cursor === cursor) break;

    cursor = response.cursor;
    await setSyncMeta(database, SYNC_CURSOR_KEY, cursor);

    if (!response.hasMore) break;
  }

  return pulled;
}
