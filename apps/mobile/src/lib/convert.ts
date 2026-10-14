/**
 * Display-only currency conversion, ported from `apps/web/src/lib/convert.ts`.
 *
 * The server converts when it aggregates; this module exists so a row or a
 * preview can be shown in the user's Pair using the same public ECB snapshot.
 * It never changes a stored amount.
 *
 * A snapshot's `rates` map is "units of CODE per 1 unit of baseCurrency", so a
 * rate between two arbitrary codes is `rates[to] / rates[from]`.
 */

import type { Schemas } from '@pluto/api-client';

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

/** Narrows the generated snapshot into the shape above. */
export function toRateSnapshot(dto: Schemas['RateSnapshotResponseDto']): RateSnapshot {
  return { ...dto, rates: dto.rates as unknown as Record<string, string> };
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

export interface DualAmounts {
  /** Amount in the base currency, or null when it cannot be derived. */
  base: number | null;
  /** Amount in the second currency, or null when none was set/derivable. */
  second: number | null;
}

/**
 * Both Pair values for one recorded amount, for list rows.
 *
 * A row recorded in the base currency needs no rate for the base value; a row
 * in a third currency is converted from the public snapshot for display only.
 */
export function dualAmounts(
  amount: number,
  currency: string,
  base: string | null,
  second: string | null,
  snapshot: RateSnapshot | null,
): DualAmounts {
  const convert = (to: string | null): number | null => {
    if (!to) return null;
    if (to === currency) return amount;
    return buildConversionPreview(amount, currency, to, snapshot)?.amount ?? null;
  };
  return { base: convert(base), second: convert(second) };
}
