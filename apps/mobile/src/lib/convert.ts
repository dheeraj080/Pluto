/**
 * Display-only currency conversion, shared with the web client.
 *
 * The rate math and the `RateSnapshot` shape live in `@pluto/domain` so both
 * clients agree; they are re-exported here to keep the `@/lib/convert` import
 * path stable. The helpers below are mobile-specific: a compact row shows the
 * recorded amount plus one companion, and a summary leads with the non-home
 * currency — neither shape exists on web.
 *
 * A snapshot's `rates` map is "units of CODE per 1 unit of baseCurrency", so a
 * rate between two arbitrary codes is `rates[to] / rates[from]`.
 */

import type { Schemas } from '@pluto/api-client';
import { buildConversionPreview, rateBetween } from '@pluto/domain';
import type { RateSnapshot } from '@pluto/domain';

export { buildConversionPreview, rateBetween };
export type { ConversionPreview, RateSnapshot } from '@pluto/domain';

/** Narrows the generated snapshot into the shape above. */
export function toRateSnapshot(dto: Schemas['RateSnapshotResponseDto']): RateSnapshot {
  return { ...dto, rates: dto.rates as unknown as Record<string, string> };
}

export interface RecordedAmounts {
  /** The amount exactly as recorded — always the primary figure. */
  amount: number;
  /** The currency it was recorded in — always the primary currency. */
  currency: string;
  /** The same amount in the companion currency, or null when it cannot be shown. */
  companionAmount: number | null;
  /** The companion currency code, or null when there is no companion figure. */
  companionCurrency: string | null;
}

/**
 * The two figures an expense row shows: the amount as it was recorded, and the
 * same amount in one companion currency.
 *
 * The recorded currency always leads and is never rewritten. The companion is
 * the home currency when the expense was recorded in something else; when the
 * expense already is in the home currency, the Second stands in so a row still
 * shows two currencies. It is derived from the public snapshot for display only
 * and is omitted when no rate is available.
 */
export function recordedAmounts(
  amount: number,
  currency: string,
  home: string | null,
  snapshot: RateSnapshot | null,
  second: string | null = null,
): RecordedAmounts {
  const companion =
    home && home !== currency ? home : second && second !== currency ? second : null;
  if (!companion) {
    return { amount, currency, companionAmount: null, companionCurrency: null };
  }
  const converted = buildConversionPreview(amount, currency, companion, snapshot)?.amount ?? null;
  return {
    amount,
    currency,
    companionAmount: converted,
    companionCurrency: converted === null ? null : companion,
  };
}

export interface SummaryAmounts {
  /** The larger figure, in the non-home currency. */
  amount: number;
  currency: string;
  /** The same figure in the home currency, or null when there is no pair. */
  secondaryAmount: number | null;
  secondaryCurrency: string | null;
}

/**
 * The two figures a total or summary shows, in the app's one display order: the
 * Second (non-home) currency leads and the home currency sits beneath it.
 *
 * Falls back to a single home figure when no Second is paired or the server did
 * not convert the total. Returns null when there is not even a home figure.
 */
export function summaryAmounts(
  homeAmount: number | null | undefined,
  homeCurrency: string | null | undefined,
  secondAmount: number | null | undefined,
  secondCurrency: string | null | undefined,
): SummaryAmounts | null {
  if (homeAmount == null || !homeCurrency) return null;
  if (secondAmount != null && secondCurrency && secondCurrency !== homeCurrency) {
    return {
      amount: secondAmount,
      currency: secondCurrency,
      secondaryAmount: homeAmount,
      secondaryCurrency: homeCurrency,
    };
  }
  return {
    amount: homeAmount,
    currency: homeCurrency,
    secondaryAmount: null,
    secondaryCurrency: null,
  };
}
