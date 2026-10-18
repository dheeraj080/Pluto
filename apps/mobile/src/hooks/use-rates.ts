import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { toRateSnapshot } from '@/lib/convert';
import { queryKeys, type RateHistoryParams } from '@/lib/query-keys';
import { getSessionState } from '@/lib/session';
import { localStoreEnabled } from '@/lib/store';
import { getDatabase } from '@/lib/store/local/database';
import { getLocalLatestRateSnapshot } from '@/lib/store/local/rates';
import { useSession } from '@/hooks/use-session';

export type RateHistory = Schemas['RateHistoryResponseDto'];

/** Matches the server's reporting default when no base is known locally. */
const DEFAULT_BASE_CURRENCY = 'USD';

/**
 * The latest published rate snapshot, for display-only conversion previews.
 *
 * Failure is non-fatal — a card that wanted a snapshot simply hides the figure
 * it would have converted — so callers must tolerate `data` staying undefined.
 * Snapshots change at most once a day, hence the long `staleTime`.
 *
 * On native the endpoint's mirror (`/rates/tables`, kept for the Reports
 * conversion) is the offline stand-in: the newest snapshot for the same base on
 * or before today. The mirror holds only the session base, which is what every
 * caller asks for; anything else still needs the API.
 */
export function useRateSnapshot(base?: string | null) {
  return useQuery({
    queryKey: queryKeys.rates.latest(base ?? undefined),
    staleTime: 6 * 60 * 60_000,
    queryFn: async () => {
      try {
        return toRateSnapshot(
          await api.get<Schemas['RateSnapshotResponseDto']>('/rates/latest', {
            query: { base: base ?? undefined },
          }),
        );
      } catch (error) {
        if (!localStoreEnabled) throw error;
        const code = base ?? getSessionState().user?.baseCurrency ?? DEFAULT_BASE_CURRENCY;
        const snapshot = await getLocalLatestRateSnapshot(await getDatabase(), code);
        if (!snapshot) throw error;
        return snapshot;
      }
    },
  });
}

/**
 * Exchange-rate history for one pair, oldest first.
 *
 * Disabled until a quote currency exists, because the endpoint requires one —
 * a user who never crosses borders should not produce a request that can only
 * fail. The 30-day window that drives the dashboard sparkline is the caller's
 * choice of `from`/`to`.
 */
export function useRateHistory(params: {
  base?: string | null;
  quote?: string | null;
  from?: string;
  to?: string;
}) {
  const { status } = useSession();
  const key: RateHistoryParams = {
    base: params.base ?? undefined,
    quote: params.quote ?? undefined,
    from: params.from,
    to: params.to,
  };

  return useQuery({
    queryKey: queryKeys.rates.history(key),
    enabled: status === 'signed-in' && Boolean(params.quote),
    queryFn: () => api.get<RateHistory>('/rates/history', { query: key }),
  });
}
