/**
 * Display-only currency conversion and rate formatting.
 *
 * The server converts when it aggregates; these helpers exist so a row or a
 * preview can be shown in the user's currencies using the same public ECB
 * snapshot. They never change a stored amount.
 *
 * A snapshot's `rates` map is "units of CODE per 1 unit of baseCurrency", so a
 * rate between two arbitrary codes is `rates[to] / rates[from]`.
 */

/**
 * A published rate snapshot.
 *
 * Stated here rather than reusing `Schemas['RateSnapshotResponseDto']`: the
 * generator renders the open-ended `rates` dictionary as `Record<string,
 * never>`, which no amount of narrowing can make usable. The server serialises
 * exact decimal strings, so the values are strings that `Number()` reads.
 */
export interface RateSnapshot {
  version: number;
  baseCurrency: string;
  effectiveDate: string;
  fetchedAt: string;
  provider: string;
  etag: string;
  rates: Record<string, string>;
}

export interface ConversionPreview {
  /** Converted amount in the target currency. */
  amount: number;
  /** Multiplier applied (1 unit of `from` = `rate` units of `to`). */
  rate: number;
  from: string;
  to: string;
  /** Reference-rate date, `YYYY-MM-DD`. */
  effectiveDate: string;
  provider: string;
}

/** Multiplier to convert `from` into `to` using a snapshot, or null if unknown. */
export function rateBetween(
  from: string,
  to: string,
  rates: Record<string, string>,
): number | null {
  if (from === to) return 1;
  const rateFrom = Number(rates[from]);
  const rateTo = Number(rates[to]);
  if (!Number.isFinite(rateFrom) || !Number.isFinite(rateTo) || rateFrom <= 0) return null;
  return rateTo / rateFrom;
}

/**
 * Builds a display preview for `amount` converted from `from` to `to`.
 * Returns null when either currency is missing from the snapshot.
 */
export function buildConversionPreview(
  amount: number,
  from: string,
  to: string,
  snapshot: RateSnapshot | null,
): ConversionPreview | null {
  if (!snapshot) return null;
  if (!Number.isFinite(amount) || amount < 0) return null;
  const rate = rateBetween(from, to, snapshot.rates);
  if (rate === null) return null;
  return {
    amount: amount * rate,
    rate,
    from,
    to,
    effectiveDate: snapshot.effectiveDate,
    provider: snapshot.provider,
  };
}

/**
 * A rate with just enough precision to be useful: four decimals for the
 * sub-unit rates a single unit is usually worth, two once the number is large
 * enough that four would be noise. The one place this rule is defined.
 */
export function formatRateValue(rate: number): string {
  return rate.toLocaleString(undefined, {
    maximumFractionDigits: rate >= 100 ? 2 : 4,
    minimumFractionDigits: 0,
  });
}

/**
 * The effective pair rate implied by a primary/secondary pair of amounts, or
 * null when it cannot be derived (no secondary, or nothing spent).
 */
export function effectiveRate(
  primary: number | null | undefined,
  secondary: number | null | undefined,
): number | null {
  if (primary == null || secondary == null || primary <= 0) return null;
  return secondary / primary;
}
