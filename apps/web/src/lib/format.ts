/** Small display formatters. All callers render client-side after fetch. */

import type { RecurrenceFrequency } from "./types";

/**
 * Byte and percentage formatting are identical on both clients, so they live
 * in `@pluto/domain`; re-exported here to keep the `@/lib/format` path stable.
 */
export { currentMonth, formatBytes, formatPercent } from "@pluto/domain";

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Inclusive range label in UTC, e.g. `1–11 Oct`, `28 Sep – 4 Oct` or a single
 * day. Anchored to UTC so a `YYYY-MM-DD` bound cannot shift by a timezone.
 */
export function formatDateRange(from: string, to: string): string {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (from === to) {
    return end.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  }
  const endMonth = end.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth}`;
  }
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${startLabel} – ${endLabel}`;
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Formats an amount with its ISO 4217 currency. `Intl` supplies the correct
 * symbol and decimal rules per currency (JPY for instance renders without
 * cents); the fallback keeps an unknown code from blanking the UI.
 *
 * Pass an explicit `locale` for content that is server-rendered (for example
 * the landing-page mockups): the runtime locale differs between Node and the
 * browser, which would otherwise cause a hydration mismatch.
 */
export function formatMoney(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Renders a `YYYY-MM` bucket as a short month label, e.g. `Oct 2026`.
 * Anchored to UTC so a December/January boundary cannot shift the label.
 */
export function formatMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) return month;
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Range label that stays unambiguous across months and years, e.g.
 * `1–12 Oct 2026`, `28 Sep – 4 Oct 2026` or `Nov 2025 – Oct 2026`.
 * Anchored to UTC so a `YYYY-MM-DD` bound cannot shift by a timezone.
 */
export function formatRangeLabel(from: string, to: string): string {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const startMonth = start.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (from === to) return `${start.getUTCDate()} ${startMonth} ${startYear}`;
  if (startYear === endYear && start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth} ${endYear}`;
  }
  if (startYear === endYear) {
    return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth} ${endYear}`;
  }
  return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
}

/** Short "as of" date, e.g. `9 Oct` (with the year only when it is not this one). */
export function formatAsOf(iso: string, now: Date = new Date()): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** Compact short date for a bucket key (day or month), e.g. `12 Oct` / `Oct 2026`. */
export function formatBucket(bucket: string): string {
  if (bucket.length === 7) return formatMonth(bucket);
  return new Date(`${bucket}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const CADENCE_SIMPLE: Record<RecurrenceFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const CADENCE_UNIT: Record<RecurrenceFrequency, string> = {
  WEEKLY: "weeks",
  MONTHLY: "months",
  YEARLY: "years",
};

/**
 * The cadence in words: "Monthly" for every period, "Every 3 months" for a
 * wider interval. The server stores the period and the step separately and the
 * UI never shows the raw enum, so the wording lives here.
 */
export function describeCadence(frequency: RecurrenceFrequency, interval: number): string {
  if (interval <= 1) return CADENCE_SIMPLE[frequency];
  return `Every ${interval} ${CADENCE_UNIT[frequency]}`;
}
