/**
 * Window math behind the dashboard and reports.
 *
 * Everything here is plain calendar arithmetic on inclusive `YYYY-MM-DD`
 * bounds, so the expectations are time-zone independent. The one thing worth
 * pinning repeatedly is that a *partial* period is never compared against a
 * *whole* one — see `monthToDate` and `compareWindows('month')`.
 */
import { describe, expect, it } from 'vitest';
import {
  REPORT_PRESETS,
  addDaysIso,
  compareWindows,
  diffDays,
  granularityFor,
  granularityLabel,
  monthEndIso,
  monthToDate,
  periodRange,
  reportRange,
  shiftMonth,
  startOfMonthIso,
  startOfWeekIso,
  windowFor,
  withPrevious,
} from './ranges';

/** 16 Oct 2026 — a Friday, and an anchor every window test can share. */
const NOW = new Date(2026, 9, 16);

describe('ISO arithmetic', () => {
  it('adds and subtracts whole days', () => {
    expect(addDaysIso('2026-03-15', 7)).toBe('2026-03-22');
    expect(addDaysIso('2026-03-15', -10)).toBe('2026-03-05');
    expect(diffDays('2026-03-15', '2026-03-22')).toBe(7);
  });

  it('walks over leap days', () => {
    expect(addDaysIso('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysIso('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDaysIso('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('ends each month on the real calendar day', () => {
    expect(monthEndIso('2024-02')).toBe('2024-02-29');
    expect(monthEndIso('2025-02')).toBe('2025-02-28');
    expect(monthEndIso('2026-03')).toBe('2026-03-31');
    expect(monthEndIso('2026-04')).toBe('2026-04-30');
  });

  it('shifts month buckets across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-03', -2)).toBe('2026-01');
  });
});

describe('withPrevious', () => {
  it('pairs a window with the equal-length window directly before it', () => {
    expect(withPrevious('2026-03-01', '2026-03-10')).toEqual({
      from: '2026-03-01',
      to: '2026-03-10',
      prevFrom: '2026-02-19',
      prevTo: '2026-02-28',
    });
  });

  it('pairs a single day with the day before', () => {
    expect(withPrevious('2026-03-15', '2026-03-15')).toEqual({
      from: '2026-03-15',
      to: '2026-03-15',
      prevFrom: '2026-03-14',
      prevTo: '2026-03-14',
    });
  });
});

describe('monthToDate', () => {
  it('compares month-to-date against the same days of last month', () => {
    expect(monthToDate(new Date(2026, 2, 15))).toEqual({
      from: '2026-03-01',
      to: '2026-03-15',
      prevFrom: '2026-02-01',
      prevTo: '2026-02-15',
      daysInMonth: 31,
      daysLeft: 16,
      todayDay: 15,
    });
  });

  it('caps the comparison at the end of a shorter previous month', () => {
    // March 31st has no counterpart in February; the window stops at the 28th
    // rather than spilling into March.
    expect(monthToDate(new Date(2026, 2, 31))).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      prevFrom: '2026-02-01',
      prevTo: '2026-02-28',
      daysInMonth: 31,
      daysLeft: 0,
      todayDay: 31,
    });
  });
});

describe('windowFor', () => {
  it('is the current day, ISO week and calendar month', () => {
    expect(windowFor('day', NOW)).toEqual(withPrevious('2026-10-16', '2026-10-16'));
    expect(windowFor('week', NOW)).toEqual(withPrevious('2026-10-12', '2026-10-16'));
    expect(windowFor('month', NOW)).toEqual(withPrevious('2026-10-01', '2026-10-16'));
  });

  it('starts the week on Monday', () => {
    expect(startOfWeekIso(new Date(2026, 9, 19))).toBe('2026-10-19'); // a Monday
    expect(startOfWeekIso(new Date(2026, 9, 18))).toBe('2026-10-12'); // a Sunday
  });
});

describe('compareWindows', () => {
  it('compares month-to-date with the same days last month', () => {
    expect(compareWindows('month', new Date(2026, 2, 15))).toEqual({
      current: { from: '2026-03-01', to: '2026-03-15' },
      previous: { from: '2026-02-01', to: '2026-02-15' },
      granularity: 'day',
    });
  });

  it('keeps trailing three-month windows the same length', () => {
    const windows = compareWindows('3m', new Date(2026, 2, 15));
    expect(windows.current).toEqual({ from: '2026-01-01', to: '2026-03-15' });
    expect(windows.previous).toEqual({ from: '2025-10-19', to: '2025-12-31' });
    expect(diffDays('2025-10-19', '2025-12-31')).toBe(
      diffDays('2026-01-01', '2026-03-15'),
    );
    expect(windows.granularity).toBe('day');
  });

  it('uses month buckets over twelve months', () => {
    expect(compareWindows('12m', new Date(2026, 2, 15))).toEqual({
      current: { from: '2025-04-01', to: '2026-03-15' },
      previous: { from: '2024-04-01', to: '2025-03-31' },
      granularity: 'month',
    });
  });
});

describe('periodRange', () => {
  it('resolves the standard periods against the anchor', () => {
    expect(periodRange('month', '', '', NOW).from).toBe('2026-10-01');
    expect(periodRange('30d', '', '', NOW).from).toBe('2026-09-17');
    expect(periodRange('year', '', '', NOW).from).toBe('2026-01-01');
  });

  it('marks all time as not comparable', () => {
    const range = periodRange('all', '', '', NOW);
    expect(range.from).toBe('1970-01-01');
    expect(range.to).toBe('2026-10-16');
    expect(range.comparable).toBe(false);
  });

  it('requires both custom bounds before a comparison is meaningful', () => {
    const full = periodRange('custom', '2026-08-01', '2026-08-31', NOW);
    expect(full.from).toBe('2026-08-01');
    expect(full.to).toBe('2026-08-31');
    expect(full.comparable).toBe(true);

    const open = periodRange('custom', '2026-08-01', '', NOW);
    expect(open.to).toBe('2026-10-16');
    expect(open.comparable).toBe(false);
  });
});

describe('reportRange', () => {
  it('resolves every preset to a trailing month window', () => {
    expect(reportRange('month', '', '', NOW).from).toBe('2026-10-01');
    expect(reportRange('3m', '', '', NOW).from).toBe('2026-08-01');
    expect(reportRange('6m', '', '', NOW).from).toBe('2026-05-01');
    expect(reportRange('12m', '', '', NOW).from).toBe('2025-11-01');
  });

  it('normalises a reversed custom range into ascending order', () => {
    const range = reportRange('custom', '2026-05-10', '2026-05-01', NOW);
    expect(range.from).toBe('2026-05-01');
    expect(range.to).toBe('2026-05-10');
    expect(range.preset).toBe('custom');
  });

  it('falls back to twelve months when custom bounds are missing', () => {
    expect(reportRange('custom', '', '', NOW).from).toBe('2025-11-01');
  });

  it('offers the five presets in order', () => {
    expect(REPORT_PRESETS.map((preset) => preset.value)).toEqual([
      'month',
      '3m',
      '6m',
      '12m',
      'custom',
    ]);
  });
});

describe('granularityFor', () => {
  it('buckets by day, then week, then month', () => {
    expect(granularityFor('2026-01-01', '2026-01-15')).toBe('day'); // 15 days
    expect(granularityFor('2026-01-01', '2026-02-14')).toBe('day'); // 45 days
    expect(granularityFor('2026-01-01', '2026-02-15')).toBe('week'); // 46 days
    expect(granularityFor('2026-01-01', '2026-04-30')).toBe('week'); // 120 days
    expect(granularityFor('2026-01-01', '2026-05-01')).toBe('month'); // 121 days
  });

  it('labels the granularity for card subtitles', () => {
    expect(granularityLabel('day')).toBe('daily');
    expect(granularityLabel('week')).toBe('weekly');
    expect(granularityLabel('month')).toBe('monthly');
  });
});

describe('startOfMonthIso', () => {
  it('is the first of the anchor month', () => {
    expect(startOfMonthIso(NOW)).toBe('2026-10-01');
  });
});
