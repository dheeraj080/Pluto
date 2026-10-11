import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CurrencyMeta,
  getCurrencyMeta,
  isKnownCurrencyCode,
  normalizeCurrencyCode,
} from './currency.registry';

/**
 * Single source of truth for "what is a valid currency code" and "what can
 * actually be converted".
 *
 * These two questions are deliberately decoupled:
 * - *Recording* only needs a registry-valid ISO 4217 code (`isValid` /
 *   `assertValid`). A traveller must be able to log a Thai Baht or Vietnamese
 *   Dong even though the rate provider may never quote it.
 * - *Reporting bases* additionally require the code to be in the configured
 *   `SUPPORTED_CURRENCIES` list (`isSupportedReporting` /
 *   `assertSupportedReporting`), which mirrors what the exchange-rate provider
 *   actually serves. Asking for a report in a currency the provider cannot
 *   quote must fail loudly rather than silently producing an empty figure.
 */
@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly supportedReporting: string[];
  private readonly defaultReporting: string;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>(
      'SUPPORTED_CURRENCIES',
      'AUD,BRL,CAD,CHF,CNY,CZK,DKK,EUR,GBP,HKD,HUF,IDR,ILS,INR,ISK,JPY,KRW,MXN,MYR,NOK,NZD,PHP,PLN,RON,SEK,SGD,THB,TRY,USD,ZAR',
    );
    this.supportedReporting = raw
      .split(',')
      .map((code) => normalizeCurrencyCode(code))
      .filter((code): code is string => code !== null && isKnownCurrencyCode(code));

    this.defaultReporting =
      normalizeCurrencyCode(this.configService.get<string>('EXCHANGE_RATE_BASE_CURRENCY', 'USD')) ??
      'USD';

    if (this.supportedReporting.length === 0) {
      this.logger.warn(
        'SUPPORTED_CURRENCIES contained no registry-valid codes; falling back to USD.',
      );
      this.supportedReporting.push('USD');
    }
  }

  /** Config-driven list of convertible reporting currencies. */
  get supportedReportingCurrencies(): string[] {
    return [...this.supportedReporting];
  }

  /** Default reporting currency (the canonical snapshot base). */
  get defaultReportingCurrency(): string {
    return this.defaultReporting;
  }

  /** Normalised code if `value` is a registry-valid ISO 4217 code, else null. */
  normalize(value: string): string | null {
    const code = normalizeCurrencyCode(value);
    return code !== null && isKnownCurrencyCode(code) ? code : null;
  }

  /** True when `value` is a registry-valid ISO 4217 code. */
  isValid(value: string): boolean {
    return this.normalize(value) !== null;
  }

  /**
   * Normalises and validates a code suitable for *recording* an expense or
   * budget.
   *
   * @throws BadRequestException when the code is not a registry-valid ISO code.
   */
  assertValid(value: string): string {
    const code = normalizeCurrencyCode(value);
    if (code === null || !isKnownCurrencyCode(code)) {
      throw new BadRequestException(
        `'${value}' is not a valid ISO 4217 currency code. Recording still requires a three-letter code, but it does not need an exchange rate.`,
      );
    }
    return code;
  }

  /** True when `value` is in the configured convertible reporting set. */
  isSupportedReporting(value: string): boolean {
    const code = normalizeCurrencyCode(value);
    return code !== null && this.supportedReporting.includes(code);
  }

  /**
   * Normalises and validates a reporting/base currency.
   *
   * @throws BadRequestException when the code is outside the provider-backed
   * reporting set.
   */
  assertSupportedReporting(value: string): string {
    const code = normalizeCurrencyCode(value);
    if (code === null || !this.supportedReporting.includes(code)) {
      throw new BadRequestException(
        `Unsupported reporting currency '${value}'. Supported: ${this.supportedReporting.join(', ')}`,
      );
    }
    return code;
  }

  /** Metadata for display, falling back to the code itself. */
  meta(code: string): CurrencyMeta {
    const normalised = normalizeCurrencyCode(code) ?? code.toUpperCase();
    return getCurrencyMeta(normalised);
  }
}
