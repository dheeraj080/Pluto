import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';
import { CURRENCY_REGISTRY } from '@pluto/domain';

import { api } from '@/lib/api';
import { getSyncMeta, setSyncMeta } from './meta';

export type SupportedCurrencyDto = Schemas['SupportedCurrencyDto'];

/**
 * The currency-list cache.
 *
 * The rate provider's quotable set is what the pickers must offer (the server
 * accepts any ISO code when *recording* an expense but can only convert these),
 * and it is effectively static. Caching it is what lets the expense form, the
 * budget and recurring sheets, and the Settings currency selectors render — and
 * change a currency — with no connection.
 *
 * Two layers feed the table:
 *
 * - the bundled registry (`ensureCurrencySeed`, run when the database opens
 *   and again after a sign-out wipe), so the pickers work on a device that has
 *   never reached the server;
 * - the fetched list, which replaces it wholesale and may be narrower than the
 *   registry when the operator pins `SUPPORTED_CURRENCIES`.
 *
 * The `currencies_seeded` marker records only the *fetch*: an empty table is
 * an authoritative answer (the server genuinely listed nothing) only once a
 * fetch has produced it, so a device with neither fetch nor seed must surface
 * the real error rather than present "no currencies".
 */
const CURRENCIES_SEEDED_KEY = 'currencies_seeded';

interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
}

export async function listLocalCurrencies(
  database: SQLite.SQLiteDatabase,
): Promise<SupportedCurrencyDto[]> {
  const rows = await database.getAllAsync<CurrencyRow>(
    'SELECT code, name, symbol FROM currencies ORDER BY code ASC',
  );
  return rows.map((row) => ({ code: row.code, name: row.name, symbol: row.symbol }));
}

/** Replaces the cache wholesale; the list is small and effectively immutable. */
export async function replaceLocalCurrencies(
  database: SQLite.SQLiteDatabase,
  currencies: readonly SupportedCurrencyDto[],
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM currencies');
    for (const currency of currencies) {
      await txn.runAsync('INSERT INTO currencies (code, name, symbol) VALUES (?, ?, ?)', [
        currency.code,
        currency.name,
        currency.symbol,
      ]);
    }
  });
}

/** Whether a fetch has ever populated the cache. */
export async function currencyCacheSeeded(database: SQLite.SQLiteDatabase): Promise<boolean> {
  return (await getSyncMeta(database, CURRENCIES_SEEDED_KEY)) !== null;
}

export async function markCurrencyCacheSeeded(database: SQLite.SQLiteDatabase): Promise<void> {
  await setSyncMeta(database, CURRENCIES_SEEDED_KEY, new Date().toISOString());
}

/**
 * Fills an empty table from the shared ISO 4217 registry.
 *
 * This is the offline floor for a device that has never reached
 * `/rates/supported-currencies`: the pickers render the full list before the
 * first sync instead of surfacing a network error. It deliberately does *not*
 * set `currencies_seeded` — that marker means "the server's list was fetched",
 * which is what distinguishes an authoritative empty answer from a cache no
 * fetch has ever filled.
 *
 * Only an empty table is seeded: anything else is a fetched list (possibly
 * narrower than the registry) that must not be widened behind the operator's
 * back.
 */
export async function ensureCurrencySeed(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM currencies');
    if (row && row.count > 0) return;
    for (const [code, meta] of Object.entries(CURRENCY_REGISTRY)) {
      await txn.runAsync('INSERT INTO currencies (code, name, symbol) VALUES (?, ?, ?)', [
        code,
        meta.name,
        meta.symbol,
      ]);
    }
  });
}

/** Best-effort refresh used by the sync engine so the cache is warm offline. */
export async function refreshLocalCurrencies(database: SQLite.SQLiteDatabase): Promise<void> {
  const remote = await api.get<SupportedCurrencyDto[]>('/rates/supported-currencies');
  await replaceLocalCurrencies(database, remote);
  await markCurrencyCacheSeeded(database);
}
