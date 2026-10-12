import { BadRequestException } from '@nestjs/common';
import { BudgetPeriod } from '@prisma/client';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_ONLY = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Parses an ISO date into a `Date` pinned to UTC midnight.
 *
 * Prisma `@db.Date` columns round-trip as UTC midnight, so every boundary value
 * must be built the same way or filtering drifts by a timezone offset.
 * Accepts `YYYY-MM-DD` and full ISO datetimes (the date part is used).
 */
export function toUtcDate(value: string): Date {
  const datePart = value.length > 10 ? value.slice(0, 10) : value;
  if (!DATE_ONLY.test(datePart)) {
    throw new BadRequestException(`'${value}' is not a valid calendar date (expected YYYY-MM-DD)`);
  }
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`'${value}' is not a valid calendar date`);
  }
  return parsed;
}

/** Formats a `Date` as `YYYY-MM-DD` in UTC. */
export function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Formats a `Date` as `YYYY-MM` in UTC. */
export function monthKey(value: Date): string {
  return value.toISOString().slice(0, 7);
}

/** Validates and returns a normalised `YYYY-MM` month string. */
export function normalizeMonth(month: string | undefined, fallback = new Date()): string {
  if (!month) return monthKey(fallback);
  if (!MONTH_ONLY.test(month)) {
    throw new BadRequestException(`'${month}' is not a valid month (expected YYYY-MM)`);
  }
  return month;
}

/** Returns the inclusive `[start, end]` window of a `YYYY-MM` month, in UTC. */
export function monthWindow(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, mon - 1, 1)),
    // Day 0 of the following month is the last day of this one.
    end: new Date(Date.UTC(year, mon, 1) - 1),
  };
}

/** Returns the inclusive `[start, end]` window covered by a budget period. */
export function periodWindow(period: BudgetPeriod, month: string): { start: Date; end: Date } {
  if (period === BudgetPeriod.YEARLY) {
    const year = Number(month.slice(0, 4));
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year, 11, 31) + 86399999),
    };
  }
  return monthWindow(month);
}

/**
 * Returns `count` month keys (`YYYY-MM`) oldest first, ending with the month
 * containing `now`.
 */
export function trailingMonths(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count + 1, 1));
  for (let i = 0; i < count; i += 1) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/** Bucket size for the generic spending series. */
export type SeriesGranularity = 'day' | 'week' | 'month';

/** UTC midnight of the Monday starting the ISO week that contains `date`. */
export function weekStart(date: Date): Date {
  const offset = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset));
}

/** The bucket key a date belongs to at the requested granularity. */
export function seriesKey(date: Date, granularity: SeriesGranularity): string {
  if (granularity === 'month') return monthKey(date);
  if (granularity === 'week') return formatDate(weekStart(date));
  return formatDate(date);
}

/**
 * Every bucket key in the inclusive `[start, end]` window, oldest first.
 *
 * Keeps a chart's axis continuous through days/weeks/months with no spending,
 * mirroring how `trailingMonths` zero-fills the monthly trend.
 */
export function seriesBuckets(granularity: SeriesGranularity, start: Date, end: Date): string[] {
  const keys: string[] = [];

  if (granularity === 'month') {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor.getTime() <= last.getTime()) {
      keys.push(monthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
  }

  const toDay = (value: Date) =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const first = granularity === 'week' ? weekStart(start) : toDay(start);
  const last = granularity === 'week' ? weekStart(end) : toDay(end);
  const step = granularity === 'week' ? 7 : 1;

  const cursor = new Date(first);
  while (cursor.getTime() <= last.getTime()) {
    keys.push(formatDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return keys;
}

/**
 * Resolves a report range, defaulting to the current calendar month through today.
 *
 * A month default keeps the summary, the budget status, and the dashboard card
 * talking about the same period without the caller having to pass dates.
 */
export function resolveRange(
  from?: string,
  to?: string,
  now = new Date(),
): { start: Date; end: Date } {
  const today = toUtcDate(formatDate(now));
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    start: from ? toUtcDate(from) : firstOfMonth,
    end: to ? toUtcDate(to) : today,
  };
}
