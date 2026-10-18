/**
 * When the rate mirror refreshes, and from where.
 *
 * `planRateRefresh` decides whether an on-device report can convert from the
 * mirror at all (`covered`) and what a fetch must do about it — deepen a too-
 * shallow window, top up a stale one, or do nothing — so these cases pin that
 * decision, including the exhaustion guard that stops an oldest-expense older
 * than the provider's history from refetching forever.
 */
import { describe, expect, it } from 'vitest';

import { isoDaysAgo } from '@pluto/domain';

import {
  planRateRefresh,
  RATE_REFRESH_INTERVAL_MS,
  RATE_TAIL_DAYS,
  type RateMirrorState,
} from './rate-mirror-policy';

/** A fixed clock so `isoDaysAgo` and the freshness window are deterministic. */
const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const day = (ago: number) => isoDaysAgo(ago, new Date(NOW));
const freshAt = new Date(NOW - 60 * 60 * 1000).toISOString();
const staleAt = new Date(NOW - RATE_REFRESH_INTERVAL_MS - 60 * 1000).toISOString();

/** A state that needs no bookkeeping entries for the case at hand. */
const state = (partial: Partial<RateMirrorState>): RateMirrorState => ({
  floor: null,
  refreshedAt: null,
  requestedFrom: null,
  ...partial,
});

describe('planRateRefresh', () => {
  it('deepens from the requested window when nothing is mirrored', () => {
    const plan = planRateRefresh(state({}), day(10), NOW);
    expect(plan).toEqual({ mode: 'deepen', covered: false, from: day(10) });
  });

  it('leaves a covered, fresh mirror alone', () => {
    const plan = planRateRefresh(state({ floor: day(30), refreshedAt: freshAt }), day(10), NOW);
    expect(plan).toEqual({ mode: 'none', covered: true, from: day(10) });
  });

  it('tails a covered but stale mirror instead of re-requesting history', () => {
    const plan = planRateRefresh(state({ floor: day(30), refreshedAt: staleAt }), day(10), NOW);
    expect(plan.mode).toBe('tail');
    expect(plan.covered).toBe(true);
    expect(plan.from).toBe(day(RATE_TAIL_DAYS));
  });

  it('deepens when the mirror does not reach back far enough', () => {
    const plan = planRateRefresh(state({ floor: day(5), refreshedAt: freshAt }), day(30), NOW);
    expect(plan).toEqual({ mode: 'deepen', covered: false, from: day(30) });
  });

  it('never lets a shallower need trim an already-deep history', () => {
    // The mirror reaches back 60 days; a 10-day report tops it up in place
    // (tail from = now - RATE_TAIL_DAYS), leaving older rows untouched.
    const plan = planRateRefresh(state({ floor: day(60), refreshedAt: staleAt }), day(10), NOW);
    expect(plan.mode).toBe('tail');
    expect(plan.from).toBe(day(RATE_TAIL_DAYS));
    expect(plan.covered).toBe(true);
  });

  it('deepens past the default window on demand — the mirror is uncapped', () => {
    const needFrom = day(1200);
    const plan = planRateRefresh(
      state({ floor: day(30), refreshedAt: freshAt, requestedFrom: null }),
      needFrom,
      NOW,
    );
    expect(plan).toEqual({ mode: 'deepen', covered: false, from: needFrom });
  });

  it('honours a completed request when the provider has nothing older', () => {
    // A fetch from `needFrom` succeeded and produced no rows that deep: the
    // provider's history simply ends where the floor sits, so the range serves
    // from the mirror (labelled) rather than deepening on every sync.
    const needFrom = day(1400);
    const plan = planRateRefresh(
      state({ floor: day(405), refreshedAt: freshAt, requestedFrom: needFrom }),
      needFrom,
      NOW,
    );
    expect(plan.covered).toBe(true);
    expect(plan.mode).toBe('none');
  });

  it('does not deepen again when a completed request already reached past the need', () => {
    const plan = planRateRefresh(
      state({ floor: day(405), refreshedAt: freshAt, requestedFrom: day(1500) }),
      day(1400),
      NOW,
    );
    expect(plan.covered).toBe(true);
    expect(plan.mode).toBe('none');
  });

  it('deepens when the recorded request is shallower than the need', () => {
    const plan = planRateRefresh(
      state({ floor: day(405), refreshedAt: freshAt, requestedFrom: day(300) }),
      day(1400),
      NOW,
    );
    expect(plan).toEqual({ mode: 'deepen', covered: false, from: day(1400) });
  });

  it('treats an empty floor as uncovered regardless of freshness', () => {
    const plan = planRateRefresh(state({ refreshedAt: freshAt }), day(10), NOW);
    expect(plan.covered).toBe(false);
    expect(plan.mode).toBe('deepen');
  });

  it('never fetches when fresh and covered', () => {
    const plan = planRateRefresh(
      state({ floor: day(400), refreshedAt: freshAt, requestedFrom: null }),
      day(365),
      NOW,
    );
    expect(plan.mode).toBe('none');
  });
});
