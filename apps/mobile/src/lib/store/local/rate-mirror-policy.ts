/**
 * When the rate mirror needs refreshing, as a pure decision.
 *
 * The mirror is the offline/online boundary for reports: what it covers is
 * converted on-device, and the provenance labels the engine attaches (`estimate`,
 * `unavailable`) mark any part it could not. That boundary is worth stating —
 * and testing — without a database or a network in the way, so this module
 * holds only the arithmetic and `report-mirror` does the I/O.
 */

import { isoDaysAgo } from '@pluto/domain';

/**
 * The warm prefetch window: how much history a sync mirrors before anything
 * asks for more.
 *
 * The app's report presets reach back twelve months and a yearly budget starts
 * on 1 January, so 400 days covers every current-window report and the
 * dashboard's month-to-date comparison out of the box. It is a starting depth,
 * not a cap: an older expense or an earlier budget start deepens the mirror on
 * demand (bottom-up, in chunks — see `report-mirror`), and the mirror keeps
 * whatever it has fetched. The depth guard is `rates_requested_from`, which
 * records how far back the provider has already been asked.
 */
export const RATE_MIRROR_DAYS = 400;

/** How far back a freshness refresh reaches: just the newest snapshots. */
export const RATE_TAIL_DAYS = 7;

/** A mirror already this fresh is left alone unless a wider window is needed. */
export const RATE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface RateMirrorState {
  /** Oldest mirrored snapshot across every base (`YYYY-MM-DD`), or null when empty. */
  floor: string | null;
  /** When the mirror for this base was last fetched, or null when never. */
  refreshedAt: string | null;
  /**
   * Deepest `from` a completed fetch has ever requested for this base, or null
   * when never. The provider-exhaustion guard: a fetch from here that produced
   * no older rows means the provider holds nothing older, so the same deepen
   * must not be planned again.
   */
  requestedFrom: string | null;
}

export type RateRefreshMode = 'none' | 'deepen' | 'tail';

export interface RateRefreshPlan {
  /** What a fetch should do now. */
  mode: RateRefreshMode;
  /** True when the mirror can serve `needFrom` without fetching anything. */
  covered: boolean;
  /**
   * Inclusive request lower bound (`YYYY-MM-DD`) when a fetch runs: `needFrom`
   * for a deepen, the tail-window start for a freshness refresh.
   */
  from: string;
}

/**
 * Decides whether to fetch, and from where.
 *
 * - **deepen** — the mirror cannot serve `needFrom` and the provider has not
 *   already been asked that far back. The request starts at `needFrom`; older
 *   mirrored rows are kept (see `mergeLocalRateTables`).
 * - **tail** — covered but stale: fetch only the newest snapshots so a report
 *   never converts with an out-of-date rate, without touching history.
 * - **none** — covered and fresh.
 *
 * `covered` also honours the exhaustion guard: a completed request from
 * `needFrom` with no rows that deep means the provider has nothing older, and
 * the range serves from whatever the floor does hold — labelled by the engine
 * rather than sent back online.
 */
export function planRateRefresh(
  state: RateMirrorState,
  needFrom: string,
  now: number = Date.now(),
  refreshIntervalMs: number = RATE_REFRESH_INTERVAL_MS,
): RateRefreshPlan {
  const fresh =
    state.refreshedAt !== null && now - Date.parse(state.refreshedAt) < refreshIntervalMs;

  const covered =
    (state.floor !== null && state.floor <= needFrom) ||
    (state.requestedFrom !== null && state.requestedFrom <= needFrom);

  if (!covered) return { mode: 'deepen', covered: false, from: needFrom };
  if (!fresh) {
    return { mode: 'tail', covered: true, from: isoDaysAgo(RATE_TAIL_DAYS, new Date(now)) };
  }
  return { mode: 'none', covered: true, from: needFrom };
}
