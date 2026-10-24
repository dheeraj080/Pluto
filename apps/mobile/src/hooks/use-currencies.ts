import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';
import { localStoreEnabled } from '@/lib/store';
import {
  currencyCacheSeeded,
  listLocalCurrencies,
  markCurrencyCacheSeeded,
  replaceLocalCurrencies,
} from '@/lib/store/local/currencies';
import { getDatabase } from '@/lib/store/local/database';
import { isNetworkLevelError } from '@/lib/store/local/network-errors';

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
 * the server never answered falls back to whatever the device holds — the
 * fetched list, or the bundled registry seed written when the database opens.
 * That is what lets a currency be chosen, and an expense typed with it, with
 * no connection. A definitive server answer (any real status code) still
 * surfaces instead of being papered over.
 */
export function useSupportedCurrencies() {
  const { status, mode } = useSession();
  return useQuery({
    queryKey: queryKeys.currencies.all,
    // Effectively static within a session.
    staleTime: 60 * 60_000,
    enabled: status === 'signed-in' || mode === 'local',
    retry: false,
    queryFn: async () => {
      if (!localStoreEnabled) {
        try {
          return await api.get<Schemas['SupportedCurrencyDto'][]>('/rates/supported-currencies');
        } catch {
          // Fallback to empty/local data
          throw new Error('Could not load currencies');
        }
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
        try {
          const database = await getDatabase();
          // A fetched list keeps mirror-beats-error: it is the server's own
          // answer, and the endpoint is effectively static.
          if (await currencyCacheSeeded(database)) return listLocalCurrencies(database);
          // Never fetched: a status the server did answer with surfaces as a
          // verdict, while a request that never got one falls back to the
          // bundled registry seed (quietly empty only when even that is gone).
          if (!isNetworkLevelError(error)) throw error;
          const cached = await listLocalCurrencies(database);
          if (cached.length > 0) return cached;
          // Return cached even if empty to avoid crashing
          return cached;
        } catch {
          // Last resort - return empty array
          return [];
        }
      }
    },
  });
}
