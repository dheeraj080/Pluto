import { RecurrenceFrequency } from '@prisma/client';
import {
  addDays,
  computeDueDates,
  daysInMonth,
  nextDueDate,
  occurrenceAt,
  startOfPeriod,
} from './recurring-schedule.util';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('recurring-schedule.util', () => {
  describe('daysInMonth', () => {
    it('knows month lengths, including leap Februaries', () => {
      expect(daysInMonth(2026, 1)).toBe(28);
      expect(daysInMonth(2028, 1)).toBe(29);
      expect(daysInMonth(2026, 3)).toBe(30);
    });
  });

  describe('occurrenceAt', () => {
    it('adds whole weeks', () => {
      expect(occurrenceAt(utc('2026-10-01'), RecurrenceFrequency.WEEKLY, 1, 2).toISOString()).toBe(
        utc('2026-10-15').toISOString(),
      );
    });

    it('honours an every-N-weeks interval', () => {
      expect(occurrenceAt(utc('2026-10-01'), RecurrenceFrequency.WEEKLY, 2, 1).toISOString()).toBe(
        utc('2026-10-15').toISOString(),
      );
    });

    it('adds whole months', () => {
      expect(occurrenceAt(utc('2026-01-15'), RecurrenceFrequency.MONTHLY, 1, 3).toISOString()).toBe(
        utc('2026-04-15').toISOString(),
      );
    });

    it('honours an every-N-months interval', () => {
      expect(occurrenceAt(utc('2026-01-15'), RecurrenceFrequency.MONTHLY, 3, 1).toISOString()).toBe(
        utc('2026-04-15').toISOString(),
      );
    });

    it('clamps a month-end anchor and recovers it', () => {
      const anchor = utc('2026-01-31');
      expect(occurrenceAt(anchor, RecurrenceFrequency.MONTHLY, 1, 1).toISOString()).toBe(
        utc('2026-02-28').toISOString(),
      );
      expect(occurrenceAt(anchor, RecurrenceFrequency.MONTHLY, 1, 2).toISOString()).toBe(
        utc('2026-03-31').toISOString(),
      );
    });

    it('clamps a leap-day yearly anchor to Feb 28 in common years', () => {
      expect(occurrenceAt(utc('2028-02-29'), RecurrenceFrequency.YEARLY, 1, 1).toISOString()).toBe(
        utc('2029-02-28').toISOString(),
      );
    });
  });

  describe('startOfPeriod', () => {
    it('returns Monday for a week', () => {
      // 2026-10-16 is a Friday.
      expect(startOfPeriod(utc('2026-10-16'), RecurrenceFrequency.WEEKLY).toISOString()).toBe(
        utc('2026-10-12').toISOString(),
      );
    });

    it('returns the first of the month / year', () => {
      expect(startOfPeriod(utc('2026-10-16'), RecurrenceFrequency.MONTHLY).toISOString()).toBe(
        utc('2026-10-01').toISOString(),
      );
      expect(startOfPeriod(utc('2026-10-16'), RecurrenceFrequency.YEARLY).toISOString()).toBe(
        utc('2026-01-01').toISOString(),
      );
    });
  });

  describe('computeDueDates', () => {
    it('returns only the occurrences inside the window, oldest first', () => {
      const due = computeDueDates({
        startDate: utc('2026-01-15'),
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        fromExclusive: utc('2026-09-30'),
        toInclusive: utc('2026-10-16'),
      });
      expect(due.map((date) => date.toISOString())).toEqual([utc('2026-10-15').toISOString()]);
    });

    it('never back-fills before fromExclusive', () => {
      const due = computeDueDates({
        startDate: utc('2020-01-15'),
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        fromExclusive: utc('2026-09-30'),
        toInclusive: utc('2026-10-16'),
      });
      expect(due).toHaveLength(1);
    });

    it('stops at endDate', () => {
      const due = computeDueDates({
        startDate: utc('2026-10-01'),
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        endDate: utc('2026-11-15'),
        fromExclusive: utc('2026-09-30'),
        toInclusive: utc('2027-06-30'),
      });
      expect(due.map((date) => date.toISOString())).toEqual([
        utc('2026-10-01').toISOString(),
        utc('2026-11-01').toISOString(),
      ]);
    });

    it('returns nothing when the window precedes the start', () => {
      const due = computeDueDates({
        startDate: utc('2027-01-01'),
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        fromExclusive: utc('2026-09-30'),
        toInclusive: utc('2026-10-16'),
      });
      expect(due).toEqual([]);
    });
  });

  describe('nextDueDate', () => {
    it('returns the next occurrence strictly after the cursor', () => {
      const next = nextDueDate({
        startDate: utc('2026-01-15'),
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        after: utc('2026-10-16'),
      });
      expect(next?.toISOString()).toBe(utc('2026-11-15').toISOString());
    });

    it('returns null once the series has ended', () => {
      const next = nextDueDate({
        startDate: utc('2026-01-15'),
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        endDate: utc('2026-10-01'),
        after: utc('2026-10-16'),
      });
      expect(next).toBeNull();
    });
  });

  describe('addDays', () => {
    it('shifts across month boundaries in UTC', () => {
      expect(addDays(utc('2026-10-01'), -1).toISOString()).toBe(utc('2026-09-30').toISOString());
    });
  });
});
