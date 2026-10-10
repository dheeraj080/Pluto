export interface ProviderRatesResponse {
  baseCurrency: string;
  effectiveDate: string; // YYYY-MM-DD
  rates: Record<string, number>;
  provider: string;
}

export interface IExchangeRateProvider {
  readonly providerName: string;
  fetchLatestRates(
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<ProviderRatesResponse>;
}
