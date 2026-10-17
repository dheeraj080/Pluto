/**
 * One quote returned by a provider.
 *
 * Rates are quoted as "units of `quoteCurrency` per 1 unit of the response's
 * base currency". Each row carries its *own* observation date: modern blended
 * feeds (Frankfurter v2) aggregate dozens of central-bank sources that publish
 * on staggered schedules, so the freshest USD->EUR row and the freshest
 * USD->VND row can legitimately be dated a day or two apart.
 */
export interface ProviderRateRow {
  quoteCurrency: string;
  rate: number;
  /** Observation date for this specific quote (YYYY-MM-DD). */
  effectiveDate: string;
}

/**
 * A complete set of quotes for one base currency.
 *
 * `effectiveDate` is the latest observation date across all rows (the "as of"
 * date of the table); individual rows may be older, which is why the per-row
 * date exists.
 */
export interface ProviderRatesResponse {
  baseCurrency: string;
  effectiveDate: string; // YYYY-MM-DD
  rates: ProviderRateRow[];
  provider: string;
}

export interface IExchangeRateProvider {
  readonly providerName: string;
  fetchLatestRates(
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<ProviderRatesResponse>;
}
