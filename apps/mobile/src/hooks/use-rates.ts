import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { toRateSnapshot, type RateSnapshot } from '@/lib/convert';
import { queryKeys, type RateHistoryParams } from '@/lib/query-keys';
import { fetchPublicRates } from '@/lib/rates/public-fetch';
import { getSessionState } from '@/lib/session';
import { localStoreEnabled } from '@/lib/store';
import { getDatabase } from '@/lib/store/local/database';
import { getLocalLatestRateSnapshot, mergeLocalRateTables } from '@/lib/store/local/rates';
import { useSession } from '@/hooks/use-session';

export type RateHistory = Schemas['RateHistoryResponseDto'];

/** Matches the server's reporting default when no base is known locally. */
const DEFAULT_BASE_CURRENCY = 'USD';

/**
 * Writes a publicly fetched snapshot into the same mirror the Reports engine
 * reads, so an offline report (and the CSV export) converts at the free plan's
 * rates instead of reporting `unavailable`.
 *
 * Best-effort: the rate card works without it, and a storage failure must not
 * turn a successful fetch into an error.
 */
async function persistSnapshot(snapshot: RateSnapshot): Promise<void> {
  if (!localStoreEnabled) return;
  try {
    await mergeLocalRateTables(await getDatabase(), snapshot.baseCurrency, snapshot.effectiveDate, [
      {
        version: snapshot.version,
        baseCurrency: snapshot.baseCurrency,
        effectiveDate: snapshot.effectiveDate,
        provider: snapshot.provider,
        rates: snapshot.rates,
      },
    ]);
  } catch {
    /* Best-effort mirror; the in-memory snapshot still serves this session. */
  }
}

async function latestMirrored(base: string): Promise<RateSnapshot | null> {
  if (!localStoreEnabled) return null;
  try {
    return await getLocalLatestRateSnapshot(await getDatabase(), base);
  } catch {
    return null;
  }
}

/**
 * The latest published rate snapshot, for display-only conversion previews.
 *
 * Failure is non-fatal — a card that wanted a snapshot simply hides the figure
 * it would have converted — so callers must tolerate `data` staying undefined.
 * Snapshots change at most once a day, hence the long `staleTime`.
 *
 * Two paths, chosen by `mode`:
 *
 * - **Free/local** — fetch from the public provider (no account, no auth), then
 *   mirror it for offline use. If the network fails, the mirror is the answer;
 *   there is deliberately no API fallback, because a local session has no
 *   credential to send.
 * - **Account** — the API is the source, and the mirrored table is the offline
 *   stand-in (the newest snapshot on or before today, re-expressed from
 *   whichever base the mirror holds).
 */
export function useRateSnapshot(base?: string | null) {
  return useQuery({
    queryKey: queryKeys.rates.latest(base ?? undefined),
    staleTime: 6 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const session = getSessionState();
        const code = (base ?? session.user?.baseCurrency ?? DEFAULT_BASE_CURRENCY).toUpperCase();

        if ((session as any).mode === 'local') {
          try {
            const { snapshot } = await fetchPublicRates(code);
            await persistSnapshot(snapshot);
            return snapshot;
          } catch (error) {
            const cached = await latestMirrored(code);
            if (cached) return cached;
            // Don't throw, just return null-like behavior
            throw error;
          }
        }

        try {
          return toRateSnapshot(
            await api.get<Schemas['RateSnapshotResponseDto']>('/rates/latest', {
              query: { base: base ?? undefined },
            }),
          );
        } catch (error) {
          const cached = await latestMirrored(code);
          if (!cached) throw error;
          return cached;
        }
      } catch (error) {
        // Return cached if possible
        const session = getSessionState();
        const code = (base ?? session.user?.baseCurrency ?? DEFAULT_BASE_CURRENCY).toUpperCase();
        const cached = await latestMirrored(code);
        if (cached) return cached;
        throw error;
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
 *
 * The free plan has no account, so it has no server-side history. The query is
 * disabled there rather than firing a request that can only 401; callers
 * already tolerate a missing series (`data` stays undefined).
 */
export function useRateHistory(params: {
  base?: string | null;
  quote?: string | null;
  from?: string;
  to?: string;
}) {
  const { status, mode } = useSession();
  const key: RateHistoryParams = {
    base: params.base ?? undefined,
    quote: params.quote ?? undefined,
    from: params.from,
    to: params.to,
  };

  return useQuery({
    queryKey: queryKeys.rates.history(key),
    enabled: (mode as any) === 'account' && status === 'signed-in' && Boolean(params.quote),
    queryFn: () => api.get<RateHistory>('/rates/history', { query: key }),
  });
}
