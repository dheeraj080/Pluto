import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { toRateSnapshot, type RateSnapshot } from '@/lib/convert';
import { queryKeys } from '@/lib/query-keys';
import { fetchPublicRates } from '@/lib/rates/public-fetch';
import { getSessionState } from '@/lib/session';
import { localStoreEnabled } from '@/lib/store';
import { getDatabase } from '@/lib/store/local/database';
import { getLocalLatestRateSnapshot, mergeLocalRateTables } from '@/lib/store/local/rates';

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
  // Resolve the currency code once so the query key is stable: changing
  // `base` from null to the user's existing base currency must not bust the
  // cache and force a refetch that leaves the conversion preview blank.
  const session = getSessionState();
  const code = (base ?? session.user?.baseCurrency ?? DEFAULT_BASE_CURRENCY).toUpperCase();

  return useQuery({
    queryKey: queryKeys.rates.latest(code),
    staleTime: 24 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        if ((session as any).mode === 'local') {
          try {
            const { snapshot } = await fetchPublicRates(code);
            await persistSnapshot(snapshot);
            return snapshot;
          } catch (error) {
            // Best-effort: if fetch fails, fall back to the cached mirror.
            // Never throw — callers must tolerate data being unavailable.
            const cached = await latestMirrored(code);
            return cached ?? null;
          }
        }

        try {
          return toRateSnapshot(
            await api.get<Schemas['RateSnapshotResponseDto']>('/rates/latest', {
              query: { base: code },
            }),
          );
        } catch (error) {
          const cached = await latestMirrored(code);
          return cached ?? null;
        }
      } catch (error) {
        // Last resort: return null so callers render gracefully.
        return null;
      }
    },
  });
}


