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
