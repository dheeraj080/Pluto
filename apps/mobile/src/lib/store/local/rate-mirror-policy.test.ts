/**
 * The offline/online boundary for reports.
 *
 * `planRateRefresh` decides whether an on-device report can be converted from
 * the mirror or must go online, so these cases pin that decision — including the
 * freshness rule and the "keep the widest window" rule that stops a narrow
 * report from trimming a wide one away.
 */
import { describe, expect, it } from 'vitest';

import { isoDaysAgo } from '@pluto/domain';

import { planRateRefresh, RATE_MIRROR_DAYS, RATE_REFRESH_INTERVAL_MS } from './rate-mirror-policy';

/** A fixed clock so `isoDaysAgo` and the freshness window are deterministic. */
const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const day = (ago: number) => isoDaysAgo(ago, new Date(NOW));
const freshAt = new Date(NOW - 60 * 60 * 1000).toISOString();
const staleAt = new Date(NOW - RATE_REFRESH_INTERVAL_MS - 60 * 1000).toISOString();

describe('planRateRefresh', () => {
  it('fetches the requested window when nothing is mirrored', () => {
    const plan = planRateRefresh({ floor: null, refreshedAt: null }, day(10), NOW);
    expect(plan).toEqual({ fetch: true, from: day(10), beyondMirror: false });
  });

  it('leaves a covered, fresh mirror alone', () => {
    const plan = planRateRefresh({ floor: day(30), refreshedAt: freshAt }, day(10), NOW);
    expect(plan.fetch).toBe(false);
    expect(plan.beyondMirror).toBe(false);
  });

  it('fetches a covered but stale mirror to pick up a newer snapshot', () => {
    const plan = planRateRefresh({ floor: day(30), refreshedAt: staleAt }, day(10), NOW);
    expect(plan.fetch).toBe(true);
  });

  it('fetches when the mirror does not reach back far enough', () => {
    const plan = planRateRefresh({ floor: day(5), refreshedAt: freshAt }, day(30), NOW);
    expect(plan).toEqual({ fetch: true, from: day(30), beyondMirror: false });
  });

  it('keeps the widest window already mirrored', () => {
    // The mirror reaches back 60 days; a 10-day report must not trim it to 10.
    const plan = planRateRefresh({ floor: day(60), refreshedAt: staleAt }, day(10), NOW);
    expect(plan.from).toBe(day(60));
  });

  it('flags a range older than the mirror as online-only', () => {
    const needFrom = day(RATE_MIRROR_DAYS + 30);
    // A mirror that already reaches past the default window and is fresh needs
    // no fetch, even though the requested range itself stays online-only.
    const plan = planRateRefresh(
      { floor: day(RATE_MIRROR_DAYS + 5), refreshedAt: freshAt },
      needFrom,
      NOW,
    );
    expect(plan.beyondMirror).toBe(true);
    expect(plan.fetch).toBe(false);
  });

  it('still warms the default window for an online-only range when stale', () => {
    const needFrom = day(RATE_MIRROR_DAYS + 30);
    const plan = planRateRefresh({ floor: day(30), refreshedAt: staleAt }, needFrom, NOW);
    expect(plan.beyondMirror).toBe(true);
    expect(plan.fetch).toBe(true);
    expect(plan.from).toBe(day(RATE_MIRROR_DAYS));
  });
});
