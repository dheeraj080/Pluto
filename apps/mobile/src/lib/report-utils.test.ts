/**
 * Report formatting and bucket arithmetic.
 *
 * The bucket bounds are plain calendar arithmetic on inclusive `YYYY-MM-DD`
 * strings, so they are time-zone independent. The weekday rows are the one
 * subtle case: a total is divided by how often that weekday actually occurs in
 * the range, so the chart is a fair per-day average rather than a raw sum. The
 * heading/label helpers are locale-sensitive, so they are asserted loosely —
 * the contract worth pinning is that the right period appears, not the glyphs
 * a locale chooses.
 */
import { describe, expect, it } from 'vitest';

import type { DayOfWeekItem } from './report-types';
import {
  bucketAxis,
  bucketBounds,
  bucketHeading,
  dayOfWeekRows,
  effectiveRate,
  formatRateValue,
  peakShare,
  rateDate,
} from './report-utils';

describe('bucketBounds', () => {
  it('spans a real calendar month, leap February included', () => {
    expect(bucketBounds('2024-02', 'month')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(bucketBounds('2025-02', 'month')).toEqual({ from: '2025-02-01', to: '2025-02-28' });
    expect(bucketBounds('2026-03', 'month')).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('runs a week from the bucket through six days later', () => {
    expect(bucketBounds('2026-02-16', 'week')).toEqual({ from: '2026-02-16', to: '2026-02-22' });
    // The last week of a month may end in the next one.
    expect(bucketBounds('2026-02-23', 'week')).toEqual({ from: '2026-02-23', to: '2026-03-01' });
  });

  it('is a single day for day buckets', () => {
    expect(bucketBounds('2026-02-21', 'day')).toEqual({ from: '2026-02-21', to: '2026-02-21' });
  });
});

describe('bucket headings and axis ticks', () => {
  it('names the month a month bucket covers', () => {
    expect(bucketHeading('2026-02', 'month')).toContain('2026');
    expect(bucketAxis('2026-02', 'month')).toContain('2026');
  });

  it('spells out the whole week for a week bucket', () => {
    expect(bucketHeading('2026-02-16', 'week')).toContain('Week of');
    expect(bucketHeading('2026-02-16', 'week')).toContain('16');
    // The axis stays compact: just the start of the week.
    expect(bucketAxis('2026-02-16', 'week')).toContain('16');
  });

  it('shows the day itself for a day bucket', () => {
    expect(bucketHeading('2026-02-21', 'day')).toContain('21');
    expect(bucketAxis('2026-02-21', 'day')).toContain('21');
  });
});

describe('formatRateValue', () => {
  it('keeps two fraction digits at 100 and above', () => {
    expect(formatRateValue(123.4567)).toMatch(/^123[.,]46$/);
    expect(formatRateValue(100)).toMatch(/^100$/);
  });

  it('keeps four fraction digits below 100', () => {
    expect(formatRateValue(1.234567)).toMatch(/^1[.,]2346$/);
  });

  it('never pads forced trailing zeros', () => {
    expect(formatRateValue(2)).toMatch(/^2$/);
    expect(formatRateValue(120.5)).toMatch(/^120[.,]5$/);
  });
});

describe('effectiveRate', () => {
  it('returns null when either figure is missing', () => {
    expect(effectiveRate(null, 10)).toBeNull();
    expect(effectiveRate(10, null)).toBeNull();
    expect(effectiveRate(undefined, 10)).toBeNull();
    expect(effectiveRate(10, undefined)).toBeNull();
  });

  it('returns null when nothing was spent', () => {
    expect(effectiveRate(0, 10)).toBeNull();
    expect(effectiveRate(-5, 10)).toBeNull();
  });

  it('is the secondary per unit of primary', () => {
    expect(effectiveRate(100, 120)).toBeCloseTo(1.2, 10);
  });
});

describe('rateDate', () => {
  it('reads back a non-empty string', () => {
    expect(rateDate('2026-10-09')).toBe('2026-10-09');
  });

  it('rejects anything that is not a non-empty string', () => {
    expect(rateDate('')).toBeNull();
    expect(rateDate(null)).toBeNull();
    expect(rateDate(undefined)).toBeNull();
    expect(rateDate(20261009)).toBeNull();
    expect(rateDate({})).toBeNull();
  });
});

/** A server weekday item with just the fields a test cares about. */
function item(overrides: Partial<DayOfWeekItem> & { dow: number }): DayOfWeekItem {
  return { label: '', total: 0, count: 0, average: 0, ...overrides };
}

describe('dayOfWeekRows', () => {
  it('lists the week Monday-first', () => {
    const rows = dayOfWeekRows([], '2026-02-02', '2026-03-01');

    expect(rows.map((row) => row.dow)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(rows[0].label).toBe('Mon');
    expect(rows[6].label).toBe('Sun');
  });

  it('counts how many times a weekday occurs inside an inclusive range', () => {
    // 2026-02-02 is a Monday and 2026-03-01 a Sunday — exactly four weeks.
    const rows = dayOfWeekRows([], '2026-02-02', '2026-03-01');

    expect(rows.find((row) => row.dow === 1)?.occurrences).toBe(4); // Mondays
    expect(rows.find((row) => row.dow === 0)?.occurrences).toBe(4); // Sundays
  });

  it('gives an absent weekday a zero total but its real occurrences', () => {
    // A 29-day range: Monday lands five times, every other weekday four.
    const rows = dayOfWeekRows([], '2026-02-02', '2026-03-02');

    expect(rows.find((row) => row.dow === 1)).toMatchObject({
      total: 0,
      count: 0,
      average: 0,
      occurrences: 5,
    });
  });

  it('averages a weekday total over its occurrences', () => {
    const rows = dayOfWeekRows(
      [item({ dow: 1, total: 100, count: 3, secondaryTotal: 50 })],
      '2026-02-02',
      '2026-03-02',
    );

    expect(rows.find((row) => row.dow === 1)?.average).toBe(20);
    expect(rows.find((row) => row.dow === 1)?.secondaryAverage).toBe(10);
  });

  it('has no secondary average when the item carries no secondary total', () => {
    const rows = dayOfWeekRows([item({ dow: 2, total: 40 })], '2026-02-02', '2026-03-01');
    const tuesday = rows.find((row) => row.dow === 2);

    expect(tuesday?.average).toBe(10);
    expect(tuesday?.secondaryAverage).toBeNull();
  });
});

describe('peakShare', () => {
  it('is zero without a peak', () => {
    const rows = dayOfWeekRows([item({ dow: 1, total: 40 })], '2026-02-02', '2026-03-01');

    expect(peakShare(rows, null)).toBe(0);
  });

  it('is zero when every row totals nothing', () => {
    const rows = dayOfWeekRows([], '2026-02-02', '2026-03-01');

    expect(peakShare(rows, rows[0])).toBe(0);
  });

  it("is the peak's share of every row's total", () => {
    const rows = dayOfWeekRows(
      [item({ dow: 1, total: 40 }), item({ dow: 2, total: 60 })],
      '2026-02-02',
      '2026-03-01',
    );
    const peak = rows.find((row) => row.dow === 2) ?? null;

    expect(peakShare(rows, peak)).toBeCloseTo(60, 10);
  });
});
