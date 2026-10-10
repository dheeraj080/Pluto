import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import {
  RateSnapshotResponseDto,
  SupportedCurrencyDto,
  RateSnapshotVersionDto,
} from './dto/rates-response.dto';

export const CURRENCY_METADATA: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'United States Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound Sterling', symbol: '£' },
  INR: { name: 'Indian Rupee', symbol: '₹' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  CNY: { name: 'Chinese Yuan', symbol: '¥' },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$' },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$' },
};

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
      'USD,EUR,GBP,INR,JPY,CNY,CAD,AUD,CHF,SGD,NZD',
    );
    this.supportedCurrencies = rawCurrencies
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length === 3);

    this.defaultBaseCurrency = this.configService
      .get<string>('EXCHANGE_RATE_BASE_CURRENCY', 'USD')
      .toUpperCase();
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
    return this.supportedCurrencies.map((code) => ({
      code,
      name: CURRENCY_METADATA[code]?.name || code,
      symbol: CURRENCY_METADATA[code]?.symbol || code,
    }));
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
    if (!rates || typeof rates !== 'object') {
      throw new Error('Rates payload is not a valid object');
    }

    // Base currency rate must be strictly 1.0
    const baseRate = rates[baseCurrency];
    if (baseRate === undefined || Math.abs(baseRate - 1.0) > 0.000001) {
      throw new Error(`Base currency ${baseCurrency} rate must be 1.0, got: ${baseRate}`);
    }

    // Check all required currencies are covered and positive finite numbers
    for (const currency of this.supportedCurrencies) {
      const val = rates[currency];
      if (val === undefined || val === null) {
        throw new Error(`Missing required rate for currency: ${currency}`);
      }
      if (typeof val !== 'number' || !isFinite(val) || val <= 0) {
        throw new Error(`Invalid non-positive finite rate for ${currency}: ${val}`);
      }
    }
  }
}
