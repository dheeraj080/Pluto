import { RateTableDto } from '../rates/dto/rates-response.dto';

/**
 * Whether a conversion used the true transaction-date cycle of rates
 * (`historical`) or fell back to a nearby snapshot that is explicitly labeled
 * as an approximation (`estimate`). `estimate` is never silent: the real
 * `rateDate` is always reported alongside it.
 */
export type RatePolicy = 'historical' | 'estimate';

export interface ResolvedSnapshot {
  table: RateTableDto;
  policy: RatePolicy;
}

/**
 * Picks the snapshot that converts an expense dated `dateIso`.
 *
 * Policy, per the spec:
 * - Latest snapshot with effectiveDate <= expense date → `historical` when its
 *   age (in whole days) is within the configurable lookback (default 10d),
 *   otherwise `estimate` (rate exists but is stale — clearly labeled).
 * - Expense predates every snapshot → the *earliest* snapshot, labeled
 *   `estimate` (a rate from the future is never a historical rate).
 * - No snapshots at all → `null` (conversion status `unavailable`).
 */
export class RateResolver {
  private readonly sorted: readonly RateTableDto[];

  constructor(
    tables: readonly RateTableDto[],
    private readonly lookbackDays: number,
  ) {
    this.sorted = [...tables].sort(
      (a, b) => Date.parse(a.effectiveDate) - Date.parse(b.effectiveDate),
    );
  }

  resolve(dateIso: string): ResolvedSnapshot | null {
    if (this.sorted.length === 0) {
      return null;
    }

    const date = this.parse(dateIso);

    // Latest snapshot on-or-before the expense date.
    let index = this.sorted.length - 1;
    while (index >= 0 && this.parse(this.sorted[index].effectiveDate) > date) {
      index -= 1;
    }

    if (index >= 0) {
      const table = this.sorted[index];
      return { table, policy: this.policyFor(table.effectiveDate, dateIso) };
    }

    // The expense predates the first snapshot; use the earliest snapshot and
    // say so. Not a true historical cycle, but still clearly labeled and far
    // better than silently quoting today's rate.
    return { table: this.sorted[0], policy: 'estimate' };
  }

  /**
   * Observation date of a single currency within a table.
   *
   * v2 blends sources that publish on staggered schedules, so a currency may be
   * older than the table's `effectiveDate`. Legacy tables carry no per-row
   * dates and fall back to the table date.
   */
  rateDateFor(table: RateTableDto, currency: string): string {
    return table.dates?.[currency] ?? table.effectiveDate;
  }

  /**
   * Classifies an observation date against an expense date. A rate observed
   * *after* the expense can never be historical (a future rate is not the rate
   * that applied), and anything staler than the lookback is an `estimate`.
   */
  policyFor(rateDate: string, dateIso: string): RatePolicy {
    const expense = this.parse(dateIso);
    const observed = this.parse(rateDate);
    if (observed > expense) {
      return 'estimate';
    }
    const gapDays = Math.floor((expense - observed) / 86_400_000);
    return gapDays <= this.lookbackDays ? 'historical' : 'estimate';
  }

  private parse(isoDate: string): number {
    return Date.parse(`${isoDate}T00:00:00.000Z`);
  }
}
