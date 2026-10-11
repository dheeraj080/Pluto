import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  getCurrencyMeta,
  isKnownCurrencyCode,
  normalizeCurrencyCode,
} from '../../common/currency/currency.registry';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import {
  RateSnapshotResponseDto,
  SupportedCurrencyDto,
  RateSnapshotVersionDto,
} from './dto/rates-response.dto';

/**
 * Currencies Frankfurter actually serves (ECB reference rates).
 *
 * Recording is not limited to this set — a valid ISO code can always be stored
 * — but only these codes can be converted, so they are the reporting universe.
 */
export const FRANKFURTER_CURRENCIES = [
  'AUD',
  'BRL',
  'CAD',
  'CHF',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'GBP',
  'HKD',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'ISK',
  'JPY',
  'KRW',
  'MXN',
  'MYR',
  'NOK',
  'NZD',
  'PHP',
  'PLN',
  'RON',
  'SEK',
  'SGD',
  'THB',
  'TRY',
  'USD',
  'ZAR',
] as const;

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  private readonly supportedCurrencies: string[];
  private readonly defaultBaseCurrency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly frankfurterProvider: FrankfurterProvider,
  ) {
    const rawCurrencies = this.configService.get<string>(
      'SUPPORTED_CURRENCIES',
      'AUD,BRL,CAD,CHF,CNY,CZK,DKK,EUR,GBP,HKD,HUF,IDR,ILS,INR,ISK,JPY,KRW,MXN,MYR,NOK,NZD,PHP,PLN,RON,SEK,SGD,THB,TRY,USD,ZAR',
    );
    this.supportedCurrencies = rawCurrencies
      .split(',')
      .map((c) => normalizeCurrencyCode(c))
      .filter((code): code is string => code !== null && isKnownCurrencyCode(code));

    this.defaultBaseCurrency =
      normalizeCurrencyCode(this.configService.get<string>('EXCHANGE_RATE_BASE_CURRENCY', 'USD')) ??
      'USD';
  }

  /**
   * Fetches, validates, and atomically persists a complete rate snapshot
   */
  async syncExchangeRates(baseCurrency?: string): Promise<RateSnapshotResponseDto> {
    const base = (baseCurrency || this.defaultBaseCurrency).toUpperCase();

    if (!this.supportedCurrencies.includes(base)) {
      throw new BadRequestException(`Base currency ${base} is not in supported currencies list`);
    }

    this.logger.log(`Starting exchange rate sync for base currency: ${base}`);

    try {
      // 1. Fetch from provider
      const providerData = await this.frankfurterProvider.fetchLatestRates(
        base,
        this.supportedCurrencies,
      );

      if (!providerData || !providerData.rates) {
        throw new Error('Exchange rate provider returned empty or invalid rate data');
      }

      // 2. Validate complete payload
      this.validateSnapshotRates(providerData.rates, base);

      // 3. Generate ETag and effective date
      const effectiveDateObj = new Date(providerData.effectiveDate);
      if (isNaN(effectiveDateObj.getTime())) {
        throw new Error(`Invalid effective date received: ${providerData.effectiveDate}`);
      }

      const rawContentForHash = `${base}:${providerData.effectiveDate}:${JSON.stringify(providerData.rates)}`;
      const hash = crypto
        .createHash('sha256')
        .update(rawContentForHash)
        .digest('hex')
        .substring(0, 16);
      const etag = `W/"rates-${base}-${providerData.effectiveDate}-${hash}"`;

      // 4. Atomically persist snapshot and rates in a transaction
      const snapshot = await this.prisma.$transaction(async (tx) => {
        // Create parent snapshot record
        const createdSnapshot = await tx.rateSnapshot.create({
          data: {
            baseCurrency: base,
            effectiveDate: effectiveDateObj,
            provider: providerData.provider,
            etag,
            isPublished: true, // Only published on transaction success
          },
        });

        // Prepare rate rows
        const rateRows = Object.entries(providerData.rates).map(([quoteCurrency, rateValue]) => ({
          snapshotId: createdSnapshot.id,
          quoteCurrency: quoteCurrency.toUpperCase(),
          rate: new Prisma.Decimal(rateValue.toFixed(6)),
        }));

        await tx.exchangeRate.createMany({
          data: rateRows,
        });

        return createdSnapshot;
      });

      this.logger.log(
        `Successfully published rate snapshot v${snapshot.version} for ${base} (${snapshot.effectiveDate.toISOString().split('T')[0]})`,
      );

      return this.formatSnapshotResponse(snapshot.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Exchange rate synchronization failed: ${message}`);

      // Try to return latest existing valid snapshot
      const existing = await this.findLatestPublishedSnapshot(base);
      if (existing) {
        this.logger.warn(
          `Preserving and serving last valid published snapshot v${existing.version}`,
        );
        return this.formatSnapshotResponse(existing.id);
      }

      throw new Error(`Exchange rate sync failed and no prior snapshot exists: ${message}`);
    }
  }

  /**
   * Retrieves the latest published snapshot for the requested base currency
   */
  async getLatestRates(baseCurrency?: string): Promise<RateSnapshotResponseDto> {
    const base = (baseCurrency || this.defaultBaseCurrency).toUpperCase();

    if (!this.supportedCurrencies.includes(base)) {
      throw new BadRequestException(
        `Unsupported base currency: ${base}. Supported: ${this.supportedCurrencies.join(', ')}`,
      );
    }

    const latest = await this.findLatestPublishedSnapshot(base);

    if (!latest) {
      this.logger.log(`No snapshot found for base ${base}. Triggering on-demand sync...`);
      return this.syncExchangeRates(base);
    }

    return this.formatSnapshotResponse(latest.id);
  }

  /**
   * Returns supported currency metadata
   */
  getSupportedCurrencies(): SupportedCurrencyDto[] {
    return this.supportedCurrencies.map((code) => {
      const meta = getCurrencyMeta(code);
      return { code, name: meta.name, symbol: meta.symbol };
    });
  }

  /**
   * Returns list of published rate snapshot versions
   */
  async getVersions(limit: number = 20): Promise<RateSnapshotVersionDto[]> {
    const snapshots = await this.prisma.rateSnapshot.findMany({
      where: { isPublished: true },
      orderBy: { version: 'desc' },
      take: Math.min(limit, 100),
      select: {
        version: true,
        baseCurrency: true,
        effectiveDate: true,
        fetchedAt: true,
        etag: true,
      },
    });

    return snapshots.map((s) => ({
      version: s.version,
      baseCurrency: s.baseCurrency,
      effectiveDate: s.effectiveDate.toISOString().split('T')[0],
      fetchedAt: s.fetchedAt,
      etag: s.etag,
    }));
  }

  private async findLatestPublishedSnapshot(baseCurrency: string) {
    return this.prisma.rateSnapshot.findFirst({
      where: {
        baseCurrency,
        isPublished: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  private async formatSnapshotResponse(snapshotId: string): Promise<RateSnapshotResponseDto> {
    const snapshot = await this.prisma.rateSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        rates: {
          orderBy: { quoteCurrency: 'asc' },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    const ratesMap: Record<string, string> = {};
    for (const rateRow of snapshot.rates) {
      ratesMap[rateRow.quoteCurrency] = rateRow.rate.toFixed(6);
    }

    return {
      version: snapshot.version,
      baseCurrency: snapshot.baseCurrency,
      effectiveDate: snapshot.effectiveDate.toISOString().split('T')[0],
      fetchedAt: snapshot.fetchedAt,
      provider: snapshot.provider,
      etag: snapshot.etag,
      rates: ratesMap,
    };
  }

  private validateSnapshotRates(rates: Record<string, number>, baseCurrency: string): void {
    if (!rates || typeof rates !== 'object' || Object.keys(rates).length === 0) {
      throw new Error('Rates payload is not a valid non-empty object');
    }

    // Base currency rate must be strictly 1.0
    const baseRate = rates[baseCurrency];
    if (baseRate === undefined || Math.abs(baseRate - 1.0) > 0.000001) {
      throw new Error(`Base currency ${baseCurrency} rate must be 1.0, got: ${baseRate}`);
    }

    // Every quoted rate must be a positive finite number. Individual currencies
    // may legitimately be absent — declaring a currency in SUPPORTED_CURRENCIES
    // does not guarantee the provider returns it every day.
    for (const [currency, val] of Object.entries(rates)) {
      if (typeof val !== 'number' || !isFinite(val) || val <= 0) {
        throw new Error(`Invalid non-positive finite rate for ${currency}: ${val}`);
      }
    }
  }
}
