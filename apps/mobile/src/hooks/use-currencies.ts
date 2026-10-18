import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { localStoreEnabled } from '@/lib/store';
import {
  currencyCacheSeeded,
  listLocalCurrencies,
  markCurrencyCacheSeeded,
  replaceLocalCurrencies,
} from '@/lib/store/local/currencies';
import { getDatabase } from '@/lib/store/local/database';

export type SupportedCurrency = Schemas['SupportedCurrencyDto'];

/**
 * Currencies the rate provider can quote.
 *
 * This is a different set from "valid ISO 4217 codes": the server accepts any
 * valid code when *recording* an expense but can only convert the ones listed
 * here, so the picker should not offer the wider set.
 *
 * On native the list is cached, because it is effectively static and it feeds
 * every currency picker in the app: a successful fetch is stored, and a fetch
 * the server never answered falls back to the cache — so a currency can be
 * chosen, and an expense typed with it, with no connection. A cache that was
 * never seeded is not authoritative; the real error surfaces instead.
 */
export function useSupportedCurrencies() {
  return useQuery({
    queryKey: queryKeys.currencies.all,
    // Effectively static within a session.
    staleTime: 60 * 60_000,
    queryFn: async () => {
      if (!localStoreEnabled) {
        return api.get<Schemas['SupportedCurrencyDto'][]>('/rates/supported-currencies');
      }

      try {
        const remote = await api.get<Schemas['SupportedCurrencyDto'][]>(
          '/rates/supported-currencies',
        );
        const database = await getDatabase();
        await replaceLocalCurrencies(database, remote);
        await markCurrencyCacheSeeded(database);
        return remote;
      } catch (error) {
        const database = await getDatabase();
        if (!(await currencyCacheSeeded(database))) throw error;
        return listLocalCurrencies(database);
      }
    },
  });
}
