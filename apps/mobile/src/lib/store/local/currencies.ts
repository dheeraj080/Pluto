import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';

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
 * An empty cache is only authoritative once a fetch has seeded it, which the
 * `sync_meta` marker records: a device that has never reached the endpoint must
 * surface the real error rather than present "no currencies".
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

/** Best-effort refresh used by the sync engine so the cache is warm offline. */
export async function refreshLocalCurrencies(database: SQLite.SQLiteDatabase): Promise<void> {
  const remote = await api.get<SupportedCurrencyDto[]>('/rates/supported-currencies');
  await replaceLocalCurrencies(database, remote);
  await markCurrencyCacheSeeded(database);
}
