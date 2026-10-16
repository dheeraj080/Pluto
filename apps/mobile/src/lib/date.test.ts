import { describe, expect, it } from 'vitest';
import { dateLabel, lastMonthRange, localIso, thisMonthRange } from './date';

describe('localIso', () => {
  it('emits the device-local date as YYYY-MM-DD', () => {
    expect(localIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('dateLabel', () => {
  it('names Today and Yesterday, delegating older dates to formatDate', () => {
    const now = new Date(2026, 9, 16);
    expect(dateLabel('2026-10-16', now)).toBe('Today');
    expect(dateLabel('2026-10-15', now)).toBe('Yesterday');
    // `2026-10-26` is in the future relative to `now`, so it takes the
    // formatted branch — the locale is CI's en-US, so just pin the shape.
    const formatted = dateLabel('2026-08-10', now);
    expect(formatted).toContain('10');
  });

  it('returns the raw iso when the input does not parse', () => {
    expect(dateLabel('not-a-date')).toBe('not-a-date');
  });
});

describe('thisMonthRange / lastMonthRange', () => {
  it('covers the 1st through the anchor date', () => {
    expect(thisMonthRange(new Date(2026, 9, 16))).toEqual({
      from: '2026-10-01',
      to: '2026-10-16',
    });
  });

  it('covers the full previous month', () => {
    expect(lastMonthRange(new Date(2026, 2, 15))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(lastMonthRange(new Date(2026, 9, 1))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });
});
