import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { toRateSnapshot } from '@/lib/convert';
import { queryKeys, type RateHistoryParams } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

export type RateHistory = Schemas['RateHistoryResponseDto'];

/**
 * The latest published rate snapshot, for display-only conversion previews.
 *
 * Failure is non-fatal — a card that wanted a snapshot simply hides the figure
 * it would have converted — so callers must tolerate `data` staying undefined.
 * Snapshots change at most once a day, hence the long `staleTime`.
 */
export function useRateSnapshot(base?: string | null) {
  return useQuery({
    queryKey: queryKeys.rates.latest(base ?? undefined),
    staleTime: 6 * 60 * 60_000,
    queryFn: async () =>
      toRateSnapshot(
        await api.get<Schemas['RateSnapshotResponseDto']>('/rates/latest', {
          query: { base: base ?? undefined },
        }),
      ),
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
