/**
 * Client-side currency conversion for display only.
 *
 * The rate math lives in `@pluto/domain` so both clients share one definition;
 * it is re-exported here to keep the `@/lib/convert` import path stable. The row
 * shaper below is web-specific: web rows show the base value plus the second
 * value, whereas a mobile row shows the recorded amount plus one companion.
 *
 * A snapshot's `rates` map is "units of CODE per 1 baseCurrency", so a rate
 * between two arbitrary codes is `rates[to] / rates[from]`.
 */

import { buildConversionPreview, formatRateValue, rateBetween } from '@pluto/domain';
import type { RateSnapshot } from '@pluto/domain';

export { buildConversionPreview, formatRateValue, rateBetween };
export type { ConversionPreview, RateSnapshot } from '@pluto/domain';

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
 * Display-only, like the rest of this module — the stored amount is untouched.
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
