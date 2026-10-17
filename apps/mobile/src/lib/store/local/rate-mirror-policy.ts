/**
 * When the rate mirror needs refreshing, as a pure decision.
 *
 * The mirror is the offline/online boundary for reports: a range it covers is
 * converted on-device, a range below it falls back to the API. That boundary is
 * worth stating — and testing — without a database or a network in the way, so
 * this module holds only the arithmetic and `report-mirror` does the I/O.
 */

import { isoDaysAgo } from '@pluto/domain';

/**
 * How much rate history the mirror keeps.
 *
 * The app's report presets reach back twelve months and a yearly budget starts on
 * 1 January, so a shorter window would send those views back to the network —
 * exactly the on-device behaviour Phase 2 is for. 400 days covers every
 * current-window report and the dashboard's month-to-date comparison. The one
 * range that still goes online is the twelve-month preset's *previous* window
 * (which reaches ~22 months back); the snapshots are small, so widening this
 * constant is the lever if that ever needs to move on-device too.
 */
export const RATE_MIRROR_DAYS = 400;

/** A mirror already this fresh is left alone unless a wider window is needed. */
export const RATE_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface RateMirrorState {
  /** Oldest mirrored snapshot date (`YYYY-MM-DD`), or null when empty. */
  floor: string | null;
  /** When the mirror was last refreshed, or null when never. */
  refreshedAt: string | null;
}

export interface RateRefreshPlan {
  /** True when the window should be fetched from the server now. */
  fetch: boolean;
  /** Inclusive lower bound to request (`YYYY-MM-DD`). */
  from: string;
  /**
   * True when `needFrom` predates the oldest date the mirror ever keeps. The
   * range cannot be served on-device at all, so the caller must go online; a
   * fetch still happens to keep the default window warm.
   */
  beyondMirror: boolean;
}

/**
 * Decides whether to fetch, and from where.
 *
 * A refresh happens when the mirror does not cover `needFrom` (a wider window is
 * needed) or when it is stale, so a report never converts with an out-of-date
 * snapshot. When it does fetch, the lower bound keeps the widest window already
 * mirrored: a report that reached further back must not be trimmed away by a
 * later, narrower one.
 */
export function planRateRefresh(
  state: RateMirrorState,
  needFrom: string,
  now: number = Date.now(),
  mirrorDays: number = RATE_MIRROR_DAYS,
  refreshIntervalMs: number = RATE_REFRESH_INTERVAL_MS,
): RateRefreshPlan {
  const oldest = isoDaysAgo(mirrorDays, new Date(now));
  const fresh =
    state.refreshedAt !== null && now - Date.parse(state.refreshedAt) < refreshIntervalMs;

  if (needFrom < oldest) {
    // Beyond the mirror's reach: keep the default window warm, but only when it
    // is not already fresh — an old report should not trigger a fetch each time.
    const covered = state.floor !== null && state.floor <= oldest;
    return { fetch: !(covered && fresh), from: oldest, beyondMirror: true };
  }

  const covered = state.floor !== null && state.floor <= needFrom;
  const from = state.floor !== null && state.floor < needFrom ? state.floor : needFrom;

  return { fetch: !(covered && fresh), from, beyondMirror: false };
}
