/**
 * Client-side currency conversion for display only.
 *
 * The server converts when it aggregates reports; this helper exists so the
 * expense form can show an "≈ value in your reporting currency" preview using
 * the same public ECB snapshot. It never changes the stored amount.
 *
 * A snapshot's `rates` map is "units of CODE per 1 baseCurrency", so a rate
 * between two arbitrary codes is `rates[to] / rates[from]`.
 */

import type { RateSnapshot } from "./types";

export interface ConversionPreview {
  /** Converted amount in the target currency. */
  amount: number;
  /** Multiplier applied (1 unit of `from` = `rate` units of `to`). */
  rate: number;
  from: string;
  to: string;
  /** Reference-rate date, YYYY-MM-DD. */
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
  if (!Number.isFinite(amount) || amount <= 0) return null;
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