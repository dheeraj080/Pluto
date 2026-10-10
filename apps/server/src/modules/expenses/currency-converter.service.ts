import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { RatesService } from '../rates/rates.service';

/**
 * Rounds a value to 2 decimal places using half-up rounding.
 *
 * Conversion results are rounded at this boundary so that the sum of the rows a
 * user sees always equals the total rendered next to them.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(typeof value === 'number' ? value.toFixed(2) : value);
}

/**
 * An immutable, point-in-time view of an exchange rate table.
 *
 * Rates are quoted as `1 baseCurrency = rates[currency] units`, which is how
 * `RateSnapshot` stores them. Converting *from* any currency *into* the base is
 * therefore a division, and converting into any other currency is a division
 * followed by a multiplication. The base currency itself carries a rate of 1,
 * so same-currency conversion short-circuits without arithmetic.
 */
export class CurrencyConverter {
  private readonly rates: Map<string, Prisma.Decimal>;

  constructor(
    readonly baseCurrency: string,
    rates: Record<string, string | number>,
    readonly effectiveDate?: string,
  ) {
    const upperBase = baseCurrency.toUpperCase();
    this.rates = new Map(
      Object.entries(rates).map(([code, rate]) => [
        code.toUpperCase(),
        new Prisma.Decimal(String(rate)),
      ]),
    );
    // Guarantees a sane identity mapping even if the snapshot omitted its own base row.
    if (!this.rates.has(upperBase)) {
      this.rates.set(upperBase, new Prisma.Decimal(1));
    }
  }

  /** Currencies this converter can translate, including the base itself. */
  get supportedCurrencies(): string[] {
    return [...this.rates.keys()].sort();
  }

  supports(currency: string): boolean {
    return this.rates.has(currency.toUpperCase());
  }

  /**
   * Converts `amount` from `currency` into `baseCurrency`, rounded to 2dp.
   *
   * @throws BadRequestException when either currency has no rate in this snapshot.
   */
  convert(amount: number | string | Prisma.Decimal, currency: string): number {
    const source = currency.toUpperCase();
    if (source === this.baseCurrency) {
      return round2(Number(toDecimal(amount).toFixed(2)));
    }

    const fromRate = this.rates.get(source);
    if (!fromRate || fromRate.isZero()) {
      throw new BadRequestException(
        `No ${source} rate is available in snapshot ${this.effectiveDate ?? '(unknown)'} for base ${this.baseCurrency}`,
      );
    }

    const inBase = toDecimal(amount).div(fromRate);
    return Number(inBase.toFixed(2));
  }
}

/**
 * Builds `CurrencyConverter` instances from the rates module and validates
 * currency codes against the configured supported list.
 *
 * Rate lookups are deliberately allowed to fail: `RatesService.getLatestRates`
 * triggers a provider sync when no snapshot exists, which is a network call.
 * Report endpoints must degrade rather than 500, so callers that need that
 * behaviour use {@link tryGetConverter}.
 */
@Injectable()
export class CurrencyConverterService {
  private readonly logger = new Logger(CurrencyConverterService.name);
  private readonly supported: string[];
  private readonly defaultBase: string;

  constructor(
    private readonly ratesService: RatesService,
    private readonly configService: ConfigService,
  ) {
    this.supported = this.ratesService.getSupportedCurrencies().map((c) => c.code.toUpperCase());
    this.defaultBase = (
      this.configService.get<string>('EXCHANGE_RATE_BASE_CURRENCY', 'USD') || 'USD'
    ).toUpperCase();
  }

  /** Supported ISO 4217 codes, e.g. `['USD', 'EUR', ...]`. */
  get supportedCurrencies(): string[] {
    return [...this.supported];
  }

  get defaultBaseCurrency(): string {
    return this.defaultBase;
  }

  /**
   * Normalises and validates a user-supplied currency code.
   *
   * @throws BadRequestException when the code is not supported.
   */
  assertSupported(currency: string): string {
    const code = (currency ?? '').trim().toUpperCase();
    if (!this.supported.includes(code)) {
      throw new BadRequestException(
        `Unsupported currency '${currency}'. Supported currencies: ${this.supported.join(', ')}`,
      );
    }
    return code;
  }

  /**
   * Resolves the requested base currency, falling back to the configured default.
   *
   * @throws BadRequestException when an explicit base is not supported.
   */
  resolveBase(base?: string): string {
    if (!base) return this.defaultBase;
    return this.assertSupported(base);
  }

  /**
   * Loads a converter for `base`.
   *
   * @throws BadRequestException when the base is unsupported, or when no
   *   snapshot exists and the provider sync fails.
   */
  async getConverter(base?: string): Promise<CurrencyConverter> {
    return this.buildConverter(this.resolveBase(base));
  }

  /**
   * Non-throwing variant used by report endpoints so an unreachable rate
   * provider degrades the payload instead of failing the request.
   *
   * An unsupported base is a *client* error and still throws — only the
   * snapshot lookup is allowed to fail soft. Without that split a typo'd base
   * currency would silently produce an empty report instead of a 400.
   */
  async tryGetConverter(base?: string): Promise<CurrencyConverter | null> {
    const target = this.resolveBase(base);
    try {
      return await this.buildConverter(target);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Exchange rates unavailable for base='${target}': ${message}`);
      return null;
    }
  }

  private async buildConverter(target: string): Promise<CurrencyConverter> {
    const snapshot = await this.ratesService.getLatestRates(target);
    return new CurrencyConverter(snapshot.baseCurrency, snapshot.rates, snapshot.effectiveDate);
  }
}
