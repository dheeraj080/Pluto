/**
 * Minimal formatting helpers for the mobile UI.
 *
 * `apps/web/src/lib/format.ts` holds the richer versions; the plan calls for
 * lifting the pure parts into a shared `packages/domain` so both clients agree.
 * Until then this mirrors the money formatting exactly.
 */

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Hermes without full ICU, or an unknown currency code.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** `2026-10-10` → `10 Oct 2026`, without depending on locale data. */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return iso;
  }
}

/**
 * Today as `YYYY-MM-DD`, in the device's local time zone.
 *
 * Local rather than UTC on purpose: the user's "today" is what their calendar
 * says. Date *ranges* built from this bound are plain calendar dates, so they
 * stay zone-free once computed.
 */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * `2026-10` → `Oct 2026`, anchored to UTC so a month boundary cannot shift it.
 *
 * Month *buckets* are UTC (`2026-10`) while `todayIso` is local; a bucket is a
 * server-side grouping, so it must be read back in the same zone it was made.
 */
export function formatMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return month;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, mon - 1, 1)));
  } catch {
    return month;
  }
}

/** Today as a `YYYY-MM` bucket, in UTC. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** `0.5` → `0.5%`, `12` → `12%` — only adds a decimal when there is one. */
export function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

/**
 * True for a `YYYY-MM-DD` string that is also a real calendar date.
 *
 * The shape check alone would accept `2026-02-31`; the server validates with
 * `IsDateString` and would reject it, so catching it here gives a better error.
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Parses a user-entered amount into the number the API expects.
 *
 * Returns `null` for anything that is not a positive amount with at most two
 * decimal places, which is exactly what `CreateExpenseDto` permits — validating
 * here means the user sees a field error instead of a 400.
 */
export function parseAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}
