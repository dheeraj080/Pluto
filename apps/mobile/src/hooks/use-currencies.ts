import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export type SupportedCurrency = Schemas['SupportedCurrencyDto'];

/**
 * Currencies the rate provider can quote.
 *
 * This is a different set from "valid ISO 4217 codes": the server accepts any
 * valid code when *recording* an expense but can only convert the ones listed
 * here, so the picker should not offer the wider set.
 */
export function useSupportedCurrencies() {
  return useQuery({
    queryKey: queryKeys.currencies.all,
    // Effectively static within a session.
    staleTime: 60 * 60_000,
    queryFn: () => api.get<Schemas['SupportedCurrencyDto'][]>('/rates/supported-currencies'),
  });
}
