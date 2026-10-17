import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';
import { isoDaysAgo, todayIso, type RateTable } from '@pluto/domain';

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
  replaceLocalRateTables,
  setLocalRatesRefreshedAt,
} from './rates';

/** In-flight rate refreshes per base: parallel report queries share one fetch. */
const rateInFlight = new Map<string, Promise<void>>();
let budgetInFlight: Promise<void> | null = null;

/**
 * Ensures the mirrored rate window covers `needFrom`..today for `base`.
 *
 * Returns true when the mirror can convert a report starting at `needFrom`
 * entirely on-device. A range below {@link RATE_MIRROR_DAYS} can never be
 * covered, so it returns false and the caller falls back to the online API;
 * otherwise it refreshes the window first (best-effort — offline, it simply
 * uses whatever is already mirrored).
 */
export async function ensureRateMirror(
  database: SQLite.SQLiteDatabase,
  base: string,
  needFrom: string,
): Promise<boolean> {
  const code = base.toUpperCase();
  const plan = planRateRefresh(await readMirrorState(database, code), needFrom);

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

  if (plan.beyondMirror) return false;

  const floor = await getLocalRatesFloor(database, code);
  return floor !== null && floor <= needFrom;
}

/**
 * Best-effort mirror refresh used by the sync engine.
 *
 * Pulls the default rate window for `base` and the account's budgets so both are
 * available offline once the device has synced at least once. Resolves even when
 * offline — the mirrors simply keep their previous contents.
 */
export async function refreshReportMirrors(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<void> {
  await ensureRateMirror(database, base, isoDaysAgo(RATE_MIRROR_DAYS)).catch(() => undefined);
  await ensureBudgetMirror(database).catch(() => undefined);
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
  const [floor, refreshedAt] = await Promise.all([
    getLocalRatesFloor(database, base),
    getLocalRatesRefreshedAt(database, base),
  ]);
  return { floor, refreshedAt };
}

async function refreshRateMirror(
  database: SQLite.SQLiteDatabase,
  base: string,
  needFrom: string,
): Promise<void> {
  const plan = planRateRefresh(await readMirrorState(database, base), needFrom);
  if (!plan.fetch) return;

  const response = await api.get<Schemas['RateTableDto'][]>('/rates/tables', {
    query: { base, from: plan.from, to: todayIso() },
  });
  // `rates`/`dates` generate as `Record<string, never>` (the generator renders
  // an untyped map as an empty object); the runtime values are decimal-string
  // maps, which is what the engine reads.
  await replaceLocalRateTables(database, base, response as unknown as RateTable[]);
  await setLocalRatesRefreshedAt(database, base, new Date().toISOString());
}
