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
