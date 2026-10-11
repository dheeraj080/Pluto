import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  getCurrencyMeta,
  isKnownCurrencyCode,
  normalizeCurrencyCode,
} from '../../common/currency/currency.registry';
import { IExchangeRateProvider } from './interfaces/exchange-rate-provider.interface';
import { EXCHANGE_RATE_PROVIDER } from './providers/provider.token';
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

/** How long a served `getLatestRates` response is trusted before re-reading the DB. */
const SNAPSHOT_CACHE_TTL_MS = 60_000;

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  private readonly supportedCurrencies: string[];
  private readonly defaultBaseCurrency: string;

  /**
   * In-flight on-demand syncs per base currency. Coalesces concurrent
   * `getLatestRates` calls that find no snapshot so only one provider request
   * is issued (single-instance; across instances the scheduler's SystemLock
   * governs the daily sync).
   */
  private readonly inFlightSync = new Map<string, Promise<RateSnapshotResponseDto>>();

  /** Small TTL cache of freshly served snapshots, keyed by base currency. */
  private readonly snapshotCache = new Map<
    string,
    { cachedAt: number; dto: RateSnapshotResponseDto }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(EXCHANGE_RATE_PROVIDER) private readonly rateProvider: IExchangeRateProvider,
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

    // A fresh snapshot is about to land; never serve a stale cached response.
    this.invalidateSnapshot(base);

    this.logger.log(`Starting exchange rate sync for base currency: ${base}`);

    try {
      // 1. Fetch from the configured provider (frankfurter | mock)
      const providerData = await this.rateProvider.fetchLatestRates(base, this.supportedCurrencies);

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

      const published = await this.formatSnapshotResponse(snapshot.id);
      this.cacheSnapshot(base, published);
      return published;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Exchange rate synchronization failed: ${message}`);

      // Try to return latest existing valid snapshot
      const existing = await this.findLatestPublishedSnapshot(base);
      if (existing) {
        this.logger.warn(
          `Preserving and serving last valid published snapshot v${existing.version}`,
        );
        const preserved = await this.formatSnapshotResponse(existing.id);
        this.cacheSnapshot(base, preserved);
        return preserved;
      }

      throw new Error(`Exchange rate sync failed and no prior snapshot exists: ${message}`);
    }
  }

  /**
   * Retrieves the latest published snapshot for the requested base currency.
   *
   * Serves from a short TTL cache when fresh (avoids a DB read on every
   * expense/report request), falls back to the DB, and only touches the
   * provider when no snapshot exists at all. Concurrent callers that find no
   * snapshot share a single in-flight sync.
   */
  async getLatestRates(baseCurrency?: string): Promise<RateSnapshotResponseDto> {
    const base = (baseCurrency || this.defaultBaseCurrency).toUpperCase();

    if (!this.supportedCurrencies.includes(base)) {
      throw new BadRequestException(
        `Unsupported base currency: ${base}. Supported: ${this.supportedCurrencies.join(', ')}`,
      );
    }

    const cached = this.getCachedSnapshot(base);
    if (cached) {
      return cached;
    }

    const latest = await this.findLatestPublishedSnapshot(base);

    if (!latest) {
      this.logger.log(`No snapshot found for base ${base}. Triggering on-demand sync...`);
      return this.syncWithCoalescing(base);
    }

    const dto = await this.formatSnapshotResponse(latest.id);
    this.cacheSnapshot(base, dto);
    return dto;
  }

  /**
   * Coalesces concurrent on-demand syncs for the same base at the in-process
   * level. Note this only guards one instance; the scheduler's SystemLock
   * provides the cross-instance guard for the daily sync.
   */
  private syncWithCoalescing(base: string): Promise<RateSnapshotResponseDto> {
    const inFlight = this.inFlightSync.get(base);
    if (inFlight) {
      this.logger.log(`Reusing in-flight on-demand sync for base ${base}`);
      return inFlight;
    }

    const sync = this.syncExchangeRates(base).finally(() => {
      this.inFlightSync.delete(base);
    });
    this.inFlightSync.set(base, sync);
    return sync;
  }

  private cacheSnapshot(base: string, dto: RateSnapshotResponseDto): void {
    this.snapshotCache.set(base, { cachedAt: Date.now(), dto });
  }

  private getCachedSnapshot(base: string): RateSnapshotResponseDto | null {
    const entry = this.snapshotCache.get(base);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.cachedAt > SNAPSHOT_CACHE_TTL_MS) {
      this.snapshotCache.delete(base);
      return null;
    }
    return entry.dto;
  }

  private invalidateSnapshot(base: string): void {
    this.snapshotCache.delete(base);
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
