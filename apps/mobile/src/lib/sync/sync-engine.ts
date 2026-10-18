import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { getQueryClient } from '@/lib/query-client';
import { getSessionState } from '@/lib/session';
import { categoryStore, localStoreEnabled } from '@/lib/store';
import { resolvePushedBudgetMutation } from '@/lib/store/local/budgets';
import { getDatabase } from '@/lib/store/local/database';
import {
  applyPulledExpenses,
  resolvePushedMutation as resolvePushedExpenseMutation,
} from '@/lib/store/local/expenses';
import { resolvePushedCategoryMutation } from '@/lib/store/local/categories';
import {
  clearSyncMeta,
  getSyncMeta,
  setSyncMeta,
  SYNC_CURSOR_KEY,
} from '@/lib/store/local/meta';
import { listPendingMutations } from '@/lib/store/local/mutations';
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
 * Reconciles the local store with the server: push the queue, then pull changes.
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

  try {
    const database = await getDatabase();

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

    // Rate + budget mirrors: what the Reports and Budgets tabs convert with
    // when the device is offline. Best-effort, like the category refresh.
    await refreshReportMirrors(
      database,
      getSessionState().user?.baseCurrency ?? DEFAULT_BASE_CURRENCY,
    );
  } catch (error) {
    if (pushed > 0 || pulled > 0) invalidateSyncedQueries();
    return { pushed, pulled, failed, disabled: false, error };
  }

  if (pushed > 0 || pulled > 0) invalidateSyncedQueries();
  return { pushed, pulled, failed, disabled: false };
}

/** A sync may have changed expenses and/or budgets; refetch whichever screens are mounted. */
function invalidateSyncedQueries(): void {
  const client = getQueryClient();
  void client.invalidateQueries({ queryKey: queryKeys.expenses.all });
  void client.invalidateQueries({ queryKey: queryKeys.budgets.all });
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

  const body: Schemas['SyncPushDto'] = {
    changes: pending.map((mutation) => ({
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
  for (const mutation of pending) {
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
