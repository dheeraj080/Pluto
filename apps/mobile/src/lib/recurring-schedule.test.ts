/**
 * Cadence arithmetic for recurring rules — the parts a locally created rule
 * needs to show the same "next due" the server would compute.
 */
import { describe, expect, it } from 'vitest';

import {
  dueDates,
  nextDueOn,
  nextDueOnForNewRule,
  occurrenceAt,
  startOfPeriod,
} from './recurring-schedule';

describe('occurrenceAt', () => {
  it('steps weekly by whole days', () => {
    const spec = { startDate: '2026-10-05', frequency: 'WEEKLY' as const, interval: 1 };
    expect(occurrenceAt('2026-10-05', spec, 2)).toBe('2026-10-19');
  });

  it('honours the interval', () => {
    const spec = { startDate: '2026-10-05', frequency: 'WEEKLY' as const, interval: 3 };
    expect(occurrenceAt('2026-10-05', spec, 1)).toBe('2026-10-26');
  });

  it('clamps monthly occurrences to the target month length', () => {
    const spec = { startDate: '2026-01-31', frequency: 'MONTHLY' as const, interval: 1 };
    expect(occurrenceAt('2026-01-31', spec, 1)).toBe('2026-02-28');
    expect(occurrenceAt('2026-01-31', spec, 2)).toBe('2026-03-31');
  });

  it('clamps a leap-day yearly rule', () => {
    const spec = { startDate: '2024-02-29', frequency: 'YEARLY' as const, interval: 1 };
    expect(occurrenceAt('2024-02-29', spec, 1)).toBe('2025-02-28');
    expect(occurrenceAt('2024-02-29', spec, 4)).toBe('2028-02-29');
  });
});

describe('startOfPeriod', () => {
  it('anchors weeks on Monday', () => {
    expect(startOfPeriod('2026-10-18', 'WEEKLY')).toBe('2026-10-12');
  });

  it('anchors months and years on the first', () => {
    expect(startOfPeriod('2026-10-18', 'MONTHLY')).toBe('2026-10-01');
    expect(startOfPeriod('2026-10-18', 'YEARLY')).toBe('2026-01-01');
  });
});

describe('dueDates', () => {
  it('returns only dates strictly inside the window, oldest first', () => {
    const due = dueDates({
      startDate: '2026-08-15',
      frequency: 'MONTHLY',
      interval: 1,
      fromExclusive: '2026-09-30',
      toInclusive: '2026-12-01',
    });
    expect(due).toEqual(['2026-10-15', '2026-11-15']);
  });

  it('respects an end bound', () => {
    const due = dueDates({
      startDate: '2026-10-01',
      frequency: 'MONTHLY',
      interval: 1,
      endDate: '2026-11-30',
      fromExclusive: '2026-09-30',
      toInclusive: '2026-12-31',
    });
    expect(due).toEqual(['2026-10-01', '2026-11-01']);
  });

  it('is empty when the anchor is after the window', () => {
    expect(
      dueDates({
        startDate: '2026-12-01',
        frequency: 'WEEKLY',
        interval: 1,
        fromExclusive: '2026-11-30',
        toInclusive: '2026-10-18',
      }),
    ).toEqual([]);
  });
});

describe('nextDueOn', () => {
  it('finds the first occurrence after the cutoff', () => {
    expect(
      nextDueOn({
        startDate: '2026-08-15',
        frequency: 'MONTHLY',
        interval: 1,
        after: '2026-10-18',
      }),
    ).toBe('2026-11-15');
  });

  it('returns null once the series has ended', () => {
    expect(
      nextDueOn({
        startDate: '2026-01-01',
        frequency: 'MONTHLY',
        interval: 1,
        endDate: '2026-06-01',
        after: '2026-10-18',
      }),
    ).toBeNull();
  });
});

describe('nextDueOnForNewRule', () => {
  it('reports the current period charge a back-dated monthly rule will materialise', () => {
    expect(
      nextDueOnForNewRule(
        { startDate: '2026-08-15', frequency: 'MONTHLY', interval: 1 },
        '2026-10-18',
      ),
    ).toBe('2026-10-15');
  });

  it('reports the anchor for a rule that starts today', () => {
    expect(
      nextDueOnForNewRule(
        { startDate: '2026-10-18', frequency: 'MONTHLY', interval: 1 },
        '2026-10-18',
      ),
    ).toBe('2026-10-18');
  });

  it('reports the anchor for a rule that starts in the future', () => {
    expect(
      nextDueOnForNewRule(
        { startDate: '2026-12-01', frequency: 'WEEKLY', interval: 1 },
        '2026-10-18',
      ),
    ).toBe('2026-12-01');
  });
});
