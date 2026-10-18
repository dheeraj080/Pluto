import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';
import { addDaysIso, isoDaysAgo, todayIso, type RateTable } from '@pluto/domain';

import { api } from '@/lib/api';
import { replaceLocalBudgets } from './budgets';
import {
  planRateRefresh,
  RATE_MIRROR_DAYS,
  type RateMirrorState,
} from './rate-mirror-policy';
import {
  getLocalRatesFloor,
  getLocalRatesRefreshedAt,
  getLocalRatesRequestedFrom,
  lowerLocalRatesRequestedFrom,
  mergeLocalRateTables,
  setLocalRatesRefreshedAt,
} from './rates';

/** In-flight rate refreshes per base: parallel report queries share one fetch. */
const rateInFlight = new Map<string, Promise<void>>();
let budgetInFlight: Promise<void> | null = null;

/**
 * Widest single request (~18 months).
 *
 * A deepen that reaches further back arrives in bottom-up chunks of at most
 * this size: bounded response payloads for a window that can span decades, and
 * an interrupted fetch keeps the oldest chunks it managed to land.
 */
const RATE_CHUNK_DAYS = 548;

/**
 * Brings the mirrored rate window up to what `needFrom`..today needs for
 * `base` — best-effort: offline it simply uses whatever is already mirrored,
 * and the report engine's provenance labels (`estimate`/`unavailable`) mark
 * any part the mirror could not convert. Never throws.
 */
export async function ensureRateMirror(
  database: SQLite.SQLiteDatabase,
  base: string,
  needFrom: string,
): Promise<void> {
  const code = base.toUpperCase();
  let pending = rateInFlight.get(code);
  if (!pending) {
    pending = refreshRateMirror(database, code, needFrom).finally(() => {
      rateInFlight.delete(code);
    });
    rateInFlight.set(code, pending);
  }
  try {
    await pending;
  } catch {
    /* Offline or transient: fall back to whatever is already mirrored. */
  }
}

/**
 * Best-effort mirror refresh used by the sync engine.
 *
 * Pulls enough rate history for everything the account already holds — at
 * least {@link RATE_MIRROR_DAYS} back, deeper for the oldest live expense or
 * earliest budget start — plus the account's budgets, so Reports and Budgets
 * convert with no connection once the device has synced at least once.
 * Resolves even when offline: the mirrors simply keep their previous contents.
 */
export async function refreshReportMirrors(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<void> {
  await ensureRateMirror(database, base, await deepestRateNeedFrom(database)).catch(
    () => undefined,
  );
  await ensureBudgetMirror(database).catch(() => undefined);
}

/**
 * The deepest window the report engine will be asked about: the warm default,
 * or the account's own history when that reaches further back — an expense
 * filed three years ago must convert offline as happily as last week's.
 */
async function deepestRateNeedFrom(database: SQLite.SQLiteDatabase): Promise<string> {
  const [oldestExpense, oldestBudget] = await Promise.all([
    database.getFirstAsync<{ value: string | null }>(
      'SELECT MIN(incurred_on) AS value FROM expenses WHERE deleted_at IS NULL',
    ),
    database.getFirstAsync<{ value: string | null }>(
      'SELECT MIN(start_date) AS value FROM budgets',
    ),
  ]);

  let deepest = isoDaysAgo(RATE_MIRROR_DAYS);
  for (const candidate of [oldestExpense?.value, oldestBudget?.value]) {
    if (candidate !== null && candidate !== undefined && candidate < deepest) deepest = candidate;
  }
  return deepest;
}

/**
 * Refreshes the budget mirror, sharing one in-flight request.
 *
 * No time-based memo: a budget edit invalidates the status query, which lands
 * here, and must see the edit. The request is small and only fires when a
 * budget view (or a sync) asks for it.
 */
export async function ensureBudgetMirror(database: SQLite.SQLiteDatabase): Promise<void> {
  if (!budgetInFlight) {
    budgetInFlight = refreshBudgetMirror(database).finally(() => {
      budgetInFlight = null;
    });
  }
  await budgetInFlight;
}

async function refreshBudgetMirror(database: SQLite.SQLiteDatabase): Promise<void> {
  const budgets = await api.get<Schemas['BudgetDto'][]>('/expenses/budgets');
  await replaceLocalBudgets(database, budgets);
}

async function readMirrorState(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<RateMirrorState> {
  const [floor, refreshedAt, requestedFrom] = await Promise.all([
    getLocalRatesFloor(database),
    getLocalRatesRefreshedAt(database, base),
    getLocalRatesRequestedFrom(database, base),
  ]);
  return { floor, refreshedAt, requestedFrom };
}

async function refreshRateMirror(
  database: SQLite.SQLiteDatabase,
  base: string,
  needFrom: string,
): Promise<void> {
  const plan = planRateRefresh(await readMirrorState(database, base), needFrom);
  if (plan.mode === 'none') return;

  const to = todayIso();
  const from = plan.from < to ? plan.from : to;

  // A failed chunk throws past both markers: the mirror keeps whatever the
  // completed chunks landed, and an unrecorded `rates_requested_from` makes
  // the next pass deepen again — never the reverse.
  await fetchRateWindow(database, base, from, to);

  await setLocalRatesRefreshedAt(database, base, new Date().toISOString());
  await lowerLocalRatesRequestedFrom(database, base, from);
}

/**
 * Fetches `[from..to]` into the mirror, bottom-up in chunks of at most
 * {@link RATE_CHUNK_DAYS}.
 *
 * Bottom-up means the floor deepens first, so an interrupted fetch keeps the
 * oldest history it landed rather than leaving a recent-only window. Each
 * chunk merges its own range; the carry-in snapshot a chunk returns may repeat
 * the previous chunk's top row, and the merge upserts it.
 */
async function fetchRateWindow(
  database: SQLite.SQLiteDatabase,
  base: string,
  from: string,
  to: string,
): Promise<void> {
  let cursor = from;
  while (cursor <= to) {
    const spanEnd = addDaysIso(cursor, RATE_CHUNK_DAYS - 1);
    const chunkEnd = spanEnd < to ? spanEnd : to;
    const response = await api.get<Schemas['RateTableDto'][]>('/rates/tables', {
      query: { base, from: cursor, to: chunkEnd },
    });
    // `rates`/`dates` generate as `Record<string, never>` (the generator renders
    // an untyped map as an empty object); the runtime values are decimal-string
    // maps, which is what the engine reads.
    await mergeLocalRateTables(database, base, cursor, response as unknown as RateTable[]);
    if (chunkEnd >= to) return;
    cursor = addDaysIso(chunkEnd, 1);
  }
}
