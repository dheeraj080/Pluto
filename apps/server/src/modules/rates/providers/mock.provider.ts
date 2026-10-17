import { Injectable, Logger } from '@nestjs/common';
import {
  IExchangeRateProvider,
  ProviderRateRow,
  ProviderRatesResponse,
} from '../interfaces/exchange-rate-provider.interface';
import { CURRENCY_REGISTRY, isKnownCurrencyCode } from '../../../common/currency/currency.registry';

/**
 * Deterministic, offline exchange-rate provider used for development, demo
 * environments and tests. It never touches the network.
 *
 * Rates are ECB-reference-style approximations quoted against the euro for the
 * currencies we have a hand-checked reference for; every other registry code
 * gets a stable pseudo-rate derived from its own code so the mock can stand in
 * for the full Frankfurter v2 universe without a table of 150 literals.
 */
@Injectable()
export class MockExchangeRateProvider implements IExchangeRateProvider {
  readonly providerName = 'mock';
  private readonly logger = new Logger(MockExchangeRateProvider.name);

  /** EUR-based reference rates (1 EUR buys N of quote). */
  private readonly eurBased: Record<string, number> = {
    AUD: 1.64,
    BRL: 5.8,
    CAD: 1.47,
    CHF: 0.94,
    CNY: 7.8,
    CZK: 25.1,
    DKK: 7.46,
    EUR: 1.0,
    GBP: 0.85,
    HKD: 8.44,
    HUF: 391.0,
    IDR: 16900,
    ILS: 3.98,
    INR: 90.5,
    ISK: 149.0,
    JPY: 158.0,
    KRW: 1455.0,
    MXN: 19.4,
    MYR: 4.95,
    NOK: 11.7,
    NZD: 1.79,
    PHP: 60.1,
    PLN: 4.29,
    RON: 4.97,
    SEK: 11.5,
    SGD: 1.46,
    THB: 38.9,
    TRY: 32.4,
    USD: 1.08,
    ZAR: 20.1,
  };

  fetchLatestRates(
    baseCurrency: string,
    targetCurrencies: string[] = [],
  ): Promise<ProviderRatesResponse> {
    const base = baseCurrency.toUpperCase();
    if (!isKnownCurrencyCode(base)) {
      return Promise.reject(
        new Error(
          `Mock provider has no reference rate for base '${base}'. Supported: ${Object.keys(
            CURRENCY_REGISTRY,
          ).join(', ')}`,
        ),
      );
    }

    const baseEurRate = this.eurRate(base);
    // Union of the requested targets and the registry, so a caller that passes
    // an explicit (possibly narrower) set still gets the base row.
    const universe = new Set<string>([...targetCurrencies, base]);
    if (targetCurrencies.length === 0) {
      for (const code of Object.keys(CURRENCY_REGISTRY)) universe.add(code);
    }

    const effectiveDate = new Date().toISOString().split('T')[0];
    const rows: ProviderRateRow[] = [];
    for (const quote of universe) {
      const code = quote.toUpperCase();
      if (!isKnownCurrencyCode(code)) continue;
      if (code === base) {
        rows.push({ quoteCurrency: code, rate: 1.0, effectiveDate });
        continue;
      }
      // Derive the cross rate from the EUR pivot, explicitly rounding to 6dp so
      // the stored decimal values are stable.
      const rate = Number((this.eurRate(code) / baseEurRate).toFixed(6));
      rows.push({ quoteCurrency: code, rate, effectiveDate });
    }

    this.logger.log(`Generated deterministic mock rates for base ${base} (${rows.length} quotes)`);

    return Promise.resolve({
      baseCurrency: base,
      // Market date = today, so demo expenses resolve as *historical* rather
      // than estimate the moment they are seeded.
      effectiveDate,
      rates: rows,
      provider: this.providerName,
    });
  }

  /** Hand-checked EUR reference rate, or a stable pseudo-rate for the rest. */
  private eurRate(code: string): number {
    const known = this.eurBased[code];
    if (known !== undefined) return known;
    // Deterministic, positive, stable across processes: 1 + hash%9999/1000 ∈ [1, 11).
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
    }
    return 1 + (hash % 9999) / 1000;
  }
}
