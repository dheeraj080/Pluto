import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IExchangeRateProvider,
  ProviderRateRow,
  ProviderRatesResponse,
} from '../interfaces/exchange-rate-provider.interface';

/**
 * Frankfurter v2 adapter.
 *
 * v2 blends 223 currencies from 104 central banks and official sources (v1 was
 * ECB-only, ~30 currencies). The public API needs no key, has no quotas and
 * explicitly permits caching and commercial use; the project is MIT and
 * self-hostable. The historical (implicit) default is EUR, but the `base`
 * query parameter makes any supported code a base.
 *
 * Response shape differs from v1: v2 returns a flat array of
 * `{ date, base, quote, rate }` rows rather than a `rates` dictionary, and each
 * row carries its own observation date. The adapter normalises that into
 * {@link ProviderRatesResponse}.
 *
 * We deliberately fetch every quote (no `quotes=` filter): this provider feeds
 * the canonical snapshot, which must be complete so cross-rates can be derived
 * for any reporting base later.
 */
@Injectable()
export class FrankfurterProvider implements IExchangeRateProvider {
  readonly providerName = 'frankfurter';
  private readonly logger = new Logger(FrankfurterProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'EXCHANGE_RATE_BASE_URL',
      'https://api.frankfurter.dev/v2',
    );
  }

  async fetchLatestRates(
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<ProviderRatesResponse> {
    const base = baseCurrency.toUpperCase();
    // v2 route is `/rates` (v1's `/latest` no longer exists).
    const url = `${this.baseUrl}/rates?base=${encodeURIComponent(base)}`;

    // We intentionally fetch the provider's full set rather than passing
    // `quotes=`, because the canonical snapshot must be complete; the caller's
    // target list is advisory only. Log its size so the intent is visible.
    this.logger.log(
      `Fetching latest exchange rates from ${this.providerName}: ${url} (${targetCurrencies.length} target(s) requested)`,
    );

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'PlutoServer/1.0',
          },
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Exchange rate provider HTTP ${response.status}: ${response.statusText}`);
        }

        const payload = (await response.json()) as Array<{
          date: string;
          base: string;
          quote: string;
          rate: number;
        }>;

        if (!Array.isArray(payload) || payload.length === 0) {
          throw new Error('Malformed provider payload: expected a non-empty rate array');
        }

        // Providers return their own codes; normalise and drop anything without
        // a usable quote. Individual currencies may legitimately be absent.
        const rows: ProviderRateRow[] = [];
        let asOf: string | null = null;
        for (const entry of payload) {
          if (!entry || typeof entry.quote !== 'string' || typeof entry.rate !== 'number') {
            continue;
          }
          const quoteCurrency = entry.quote.toUpperCase();
          if (!Number.isFinite(entry.rate) || entry.rate <= 0) {
            continue;
          }
          const effectiveDate = entry.date;
          rows.push({ quoteCurrency, rate: entry.rate, effectiveDate });
          if (asOf === null || effectiveDate > asOf) asOf = effectiveDate;
        }

        if (rows.length === 0 || asOf === null) {
          throw new Error('Provider payload contained no positive, dated rates');
        }

        // Guarantee the base quotes exactly 1.0 even if the provider omitted it.
        if (!rows.some((r) => r.quoteCurrency === base)) {
          rows.push({ quoteCurrency: base, rate: 1.0, effectiveDate: asOf });
        }

        return {
          baseCurrency: base,
          effectiveDate: asOf,
          rates: rows,
          provider: this.providerName,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Exchange rate fetch attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          // Exponential backoff with jitter so retries from many instances do
          // not synchronise into a thundering herd against the provider.
          const backoff = attempt * 1000 + Math.floor(Math.random() * 500);
          await new Promise((res) => setTimeout(res, backoff));
        }
      }
    }

    throw new Error(
      `Failed to fetch exchange rates after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }
}
