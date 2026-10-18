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
 * Replaces the whole mirrored rate window for one base.
 *
 * The window is always contiguous and ends at the day it was fetched, so a
 * wholesale swap is simpler — and safer — than a diff: a snapshot the server
 * has since amended cannot linger.
 */
export async function replaceLocalRateTables(
  database: SQLite.SQLiteDatabase,
  base: string,
  tables: readonly RateTable[],
): Promise<void> {
  const baseCurrency = base.toUpperCase();

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM rate_tables WHERE base_currency = ?', [baseCurrency]);
    for (const table of tables) {
      await txn.runAsync(
        `INSERT INTO rate_tables
           (base_currency, effective_date, version, provider, rates, dates)
         VALUES (?, ?, ?, ?, ?, ?)`,
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

/** Every mirrored snapshot for `base` on or before `endIso`, oldest first. */
export async function getLocalRateTables(
  database: SQLite.SQLiteDatabase,
  base: string,
  endIso?: string,
): Promise<RateTable[]> {
  const baseCurrency = base.toUpperCase();
  const rows = endIso
    ? await database.getAllAsync<RateTableRow>(
        `SELECT * FROM rate_tables WHERE base_currency = ? AND effective_date <= ?
         ORDER BY effective_date ASC`,
        [baseCurrency, endIso],
      )
    : await database.getAllAsync<RateTableRow>(
        'SELECT * FROM rate_tables WHERE base_currency = ? ORDER BY effective_date ASC',
        [baseCurrency],
      );
  return rows.map(toRateTable);
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
 * The latest mirrored snapshot for a base on or before today — the offline
 * stand-in for `GET /rates/latest`, which the display-only conversion previews
 * use. `null` when nothing is mirrored and the caller must surface the error.
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
 * The oldest mirrored snapshot for a base, or null when nothing is mirrored.
 *
 * This is the mirror's floor: a report whose `from` is on or after it can be
 * converted entirely on-device, because every row in range has a snapshot at or
 * before it (the carry-in snapshot the endpoint returns sits below the window).
 */
export async function getLocalRatesFloor(
  database: SQLite.SQLiteDatabase,
  base: string,
): Promise<string | null> {
  const row = await database.getFirstAsync<{ floor: string | null }>(
    'SELECT MIN(effective_date) AS floor FROM rate_tables WHERE base_currency = ?',
    [base.toUpperCase()],
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
