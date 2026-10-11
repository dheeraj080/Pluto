import { Injectable, Logger } from '@nestjs/common';
import {
  IExchangeRateProvider,
  ProviderRatesResponse,
} from '../interfaces/exchange-rate-provider.interface';
import { FRANKFURTER_CURRENCIES } from '../rates.service';

/**
 * Deterministic, offline exchange-rate provider used for development, demo
 * environments and tests. It never touches the network.
 *
 * Rates are ECB-reference-style approximations quoted against the euro; any
 * requested base currency is derived by cross-dividing so that the base always
 * quotes exactly 1.0 and the set is stable day to day.
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

  fetchLatestRates(baseCurrency: string): Promise<ProviderRatesResponse> {
    const base = baseCurrency.toUpperCase();
    const baseEurRate = this.eurBased[base];
    if (baseEurRate === undefined) {
      return Promise.reject(
        new Error(
          `Mock provider has no reference rate for base '${base}'. Supported: ${FRANKFURTER_CURRENCIES.join(', ')}`,
        ),
      );
    }

    const rates: Record<string, number> = {};
    for (const quote of FRANKFURTER_CURRENCIES) {
      const eurRate = this.eurBased[quote];
      if (eurRate === undefined) continue;
      // Derive the cross rate from the EUR pivot, explicitly rounding to 6dp so
      // the stored decimal values are stable.
      rates[quote] = Number((eurRate / baseEurRate).toFixed(6));
    }
    rates[base] = 1.0; // Base must quote exactly 1.0.

    this.logger.log(
      `Generated deterministic mock rates for base ${base} (${Object.keys(rates).length} quotes)`,
    );

    return Promise.resolve({
      baseCurrency: base,
      // Market date = today, so demo expenses resolve as *historical* rather
      // than estimate the moment they are seeded.
      effectiveDate: new Date().toISOString().split('T')[0],
      rates,
      provider: this.providerName,
    });
  }
}
