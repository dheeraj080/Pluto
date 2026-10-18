import type * as SQLite from 'expo-sqlite';

import { todayIso } from '@pluto/domain';
import type { RateSnapshot, RateTable } from '@pluto/domain';

import { getSyncMeta, setSyncMeta } from './meta';

interface RateTableRow {
  base_currency: string;
  effective_date: string;
  version: number;
  provider: string;
  rates: string;
  dates: string | null;
}

/** When the rate window for a base was last refreshed from the server. */
function refreshedAtKey(base: string): string {
  return `rates_refreshed_at:${base.toUpperCase()}`;
}

/**
 * The deepest `from` a *completed* fetch has ever requested for a base.
 *
 * This is the provider-exhaustion guard: when a fetch from `X` succeeded and
 * the mirror's floor still sits above `X`, the provider simply has nothing
 * older — recording `X` stops the same deepen from being planned on every
 * sync, whatever the account's oldest expense happens to be.
 */
function requestedFromKey(base: string): string {
  return `rates_requested_from:${base.toUpperCase()}`;
}

function parseMap(json: string): Record<string, string> | undefined {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : undefined;
  } catch {
    return undefined;
  }
}

function toRateTable(row: RateTableRow): RateTable {
  const dates = row.dates ? parseMap(row.dates) : undefined;
  return {
    version: row.version,
    baseCurrency: row.base_currency,
    effectiveDate: row.effective_date,
    provider: row.provider,
    rates: parseMap(row.rates) ?? {},
    ...(dates ? { dates } : {}),
  };
}

/**
 * Re-expresses a mirrored table against `base` — the on-device counterpart of
 * the server's `deriveRows` (`rates.service.ts`):
 * `derived[code] = rates[code] / rates[base]`, every row dated the *older* of
 * its two legs (a pair is only as fresh as its stalest component), and the new
 * base quoted at exactly 1 as of its own leg date.
 *
 * Returns null when the table cannot be re-expressed (`base` is not quoted, or
 * a leg is not a usable number); callers drop such tables rather than convert
 * from wrong rates.
 */
export function rebaseRateTable(table: RateTable, base: string): RateTable | null {
  const target = base.toUpperCase();
  if (table.baseCurrency.toUpperCase() === target) return table;

  const targetRate = Number(table.rates[target] ?? '');
  if (!Number.isFinite(targetRate) || targetRate <= 0) return null;

  const targetLegDate = table.dates?.[target] ?? table.effectiveDate;
  const rates: Record<string, string> = {};
  const dates: Record<string, string> = {};

  for (const [code, value] of Object.entries(table.rates)) {
    const rate = Number(value);
    if (!Number.isFinite(rate)) continue;
    rates[code] = (rate / targetRate).toFixed(6);
    const legDate = table.dates?.[code] ?? table.effectiveDate;
    dates[code] = legDate < targetLegDate ? legDate : targetLegDate;
  }
  // Guarantee the requested base quotes exactly 1.0.
  rates[target] = (1).toFixed(6);
  dates[target] = targetLegDate;

  return {
    version: table.version,
    baseCurrency: target,
    effectiveDate: table.effectiveDate,
    provider: table.provider,
    rates,
    dates,
  };
}

/**
 * Re-expresses a window of tables against `base`.
 *
 * Tables whose rates cannot yield `base` are dropped rather than passed on
 * mis-based; every table a single fetch returns quotes the same currencies, so
 * in practice this is all-or-nothing.
 */
export function rebaseRateTables(tables: readonly RateTable[], base: string): RateTable[] {
  const rebased: RateTable[] = [];
  for (const table of tables) {
    const result = rebaseRateTable(table, base);
    if (result) rebased.push(result);
  }
  return rebased;
}

/**
 * Merges one fetched window into the mirrored rate history for `base`.
 *
 * Everything at or above `fromIso` is replaced — that is the range the request
 * covered, so an amended or withdrawn snapshot cannot linger — while rows below
 * `fromIso` are left alone: what lets a tail refresh keep a deep history and a
 * deepen extend it, with neither trimming the other. The response itself
 * upserts because it carries the carry-in snapshot from below `fromIso`, which
 * may already be mirrored.
 */
export async function mergeLocalRateTables(
  database: SQLite.SQLiteDatabase,
  base: string,
  fromIso: string,
  tables: readonly RateTable[],
): Promise<void> {
  const baseCurrency = base.toUpperCase();

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM rate_tables WHERE base_currency = ? AND effective_date >= ?', [
      baseCurrency,
      fromIso,
    ]);
    for (const table of tables) {
      await txn.runAsync(
        `INSERT INTO rate_tables
           (base_currency, effective_date, version, provider, rates, dates)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(base_currency, effective_date) DO UPDATE SET
           version = excluded.version,
           provider = excluded.provider,
           rates = excluded.rates,
           dates = excluded.dates`,
        [
          baseCurrency,
          table.effectiveDate,
          table.version,
          table.provider,
          JSON.stringify(table.rates),
          table.dates ? JSON.stringify(table.dates) : null,
        ],
      );
    }
  });
}

async function readRateRows(
  database: SQLite.SQLiteDatabase,
  baseCurrency: string,
  endIso?: string,
): Promise<RateTableRow[]> {
  return endIso
    ? database.getAllAsync<RateTableRow>(
        `SELECT * FROM rate_tables WHERE base_currency = ? AND effective_date <= ?
         ORDER BY effective_date ASC`,
        [baseCurrency, endIso],
      )
    : database.getAllAsync<RateTableRow>(
        'SELECT * FROM rate_tables WHERE base_currency = ? ORDER BY effective_date ASC',
        [baseCurrency],
      );
}

/** The base holding the oldest mirrored snapshot, excluding `base` itself. */
async function pickDeepestOtherBase(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<{ base: string; floor: string } | null> {
  const row = await database.getFirstAsync<{ base_currency: string; floor: string }>(
    `SELECT base_currency, MIN(effective_date) AS floor FROM rate_tables
     WHERE base_currency != ?
     GROUP BY base_currency
     ORDER BY MIN(effective_date) ASC, base_currency ASC
     LIMIT 1`,
    [base],
  );
  return row ? { base: row.base_currency, floor: row.floor } : null;
}

/**
 * Every mirrored snapshot on or before `endIso`, oldest first, expressed
 * against `base`.
 *
 * Exact-base rows are the server's own answer and are used as-is; when they
 * are missing or shallower than another base's window (the profile's base
 * currency changed), the deepest other base is re-expressed into `base` and
 * merged in, with exact rows winning any date collision. A device therefore
 * keeps its full conversion depth across a base change instead of starting
 * from an empty mirror.
 */
export async function getLocalRateTables(
  database: SQLite.SQLiteDatabase,
  base: string,
  endIso?: string,
): Promise<RateTable[]> {
  const code = base.toUpperCase();
  const exact = await readRateRows(database, code, endIso);
  const other = await pickDeepestOtherBase(database, code);
  // No other base, or the other windows sit at or above this base's floor
  // (both draw on the same publish days, so they add nothing): exact rows are
  // the server's own answer — use them untouched.
  const exactFloor = exact.length > 0 ? exact[0].effective_date : null;
  if (other === null || (exactFloor !== null && exactFloor <= other.floor)) {
    return exact.map(toRateTable);
  }

  const others = await readRateRows(database, other.base, endIso);
  const merged = new Map<string, RateTable>();
  for (const table of others.map(toRateTable)) {
    const rebased = rebaseRateTable(table, code);
    if (rebased) merged.set(rebased.effectiveDate, rebased);
  }
  for (const table of exact.map(toRateTable)) merged.set(table.effectiveDate, table);
  return [...merged.values()].sort((a, b) =>
    a.effectiveDate < b.effectiveDate ? -1 : a.effectiveDate > b.effectiveDate ? 1 : 0,
  );
}

/** Maps a mirrored table onto the `/rates/latest` snapshot shape. */
export function snapshotFromRateTable(table: RateTable): RateSnapshot {
  return {
    version: table.version,
    baseCurrency: table.baseCurrency,
    effectiveDate: table.effectiveDate,
    // `fetchedAt`/`etag` are client-cache metadata the conversion helpers never
    // read, so they are derived rather than stored.
    fetchedAt: `${table.effectiveDate}T00:00:00.000Z`,
    provider: table.provider,
    etag: `local-${table.version}`,
    rates: table.rates,
  };
}

/**
 * The latest mirrored snapshot on or before today, expressed against `base` —
 * the offline stand-in for `GET /rates/latest`, which the display-only
 * conversion previews use. `null` when nothing is mirrored and the caller must
 * surface the error.
 */
export async function getLocalLatestRateSnapshot(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<RateSnapshot | null> {
  const tables = await getLocalRateTables(database, base, todayIso());
  const latest = tables[tables.length - 1];
  return latest ? snapshotFromRateTable(latest) : null;
}

/**
 * The oldest mirrored snapshot across every base, or null when nothing is
 * mirrored.
 *
 * Reads can re-express any base into the requested one (see
 * `rebaseRateTable`), so the coverage floor is the deepest *any* base has
 * fetched: a profile base change must not make a device forget how far back
 * it can convert.
 */
export async function getLocalRatesFloor(database: SQLite.SQLiteDatabase): Promise<string | null> {
  const row = await database.getFirstAsync<{ floor: string | null }>(
    'SELECT MIN(effective_date) AS floor FROM rate_tables',
  );
  return row?.floor ?? null;
}

export function getLocalRatesRefreshedAt(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<string | null> {
  return getSyncMeta(database, refreshedAtKey(base));
}

export function setLocalRatesRefreshedAt(
  database: SQLite.SQLiteDatabase,
  base: string,
  atIso: string,
): Promise<void> {
  return setSyncMeta(database, refreshedAtKey(base), atIso);
}

export function getLocalRatesRequestedFrom(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<string | null> {
  return getSyncMeta(database, requestedFromKey(base));
}

/**
 * Records that a fetch completed for `[fromIso..today]`, keeping the deepest
 * (oldest) ask — a later shallower request says nothing new about what the
 * provider holds.
 */
export async function lowerLocalRatesRequestedFrom(
  database: SQLite.SQLiteDatabase,
  base: string,
  fromIso: string,
): Promise<void> {
  const key = requestedFromKey(base);
  const existing = await getSyncMeta(database, key);
  if (existing !== null && existing <= fromIso) return;
  await setSyncMeta(database, key, fromIso);
}
