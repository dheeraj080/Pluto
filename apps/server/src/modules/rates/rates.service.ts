import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_SUPPORTED_CURRENCIES,
  getCurrencyMeta,
  isKnownCurrencyCode,
  normalizeCurrencyCode,
} from '../../common/currency/currency.registry';
import {
  IExchangeRateProvider,
  ProviderRateRow,
  ProviderRatesResponse,
} from './interfaces/exchange-rate-provider.interface';
import { EXCHANGE_RATE_PROVIDER } from './providers/provider.token';
import {
  RateSnapshotResponseDto,
  SupportedCurrencyDto,
  RateSnapshotVersionDto,
  RateTableDto,
  RateHistoryPointDto,
  RateHistoryResponseDto,
} from './dto/rates-response.dto';
import { RateHistoryQueryDto } from './dto/rate-history-query.dto';

/** How long a served snapshot/table is trusted before re-reading the DB. */
const SNAPSHOT_CACHE_TTL_MS = 60_000;

/** A stored rate row plus the date it was observed on. */
interface DatedRate {
  quoteCurrency: string;
  rate: number;
  effectiveDate: string; // YYYY-MM-DD
}

/**
 * Exchange-rate storage, retrieval and canonical-base derivation.
 *
 * ## Canonical base
 *
 * Snapshots are stored against a single **canonical base** (default USD).
 * Because a cross-rate is `rates[to] / rates[from]` — the snapshot's own base
 * cancels — one canonical table can express every reporting base. When a
 * caller asks for another base we derive it on the fly
 * ({@link deriveRows}) rather than fetching and storing a second snapshot per
 * base. That keeps provider traffic, storage and report tables independent of
 * how many bases users pick.
 *
 * ## Per-row dates and carry-forward
 *
 * Frankfurter v2 blends ~104 sources that publish on staggered schedules, so
 * individual quotes carry their own observation date. Each sync therefore
 * **carries forward** the previous snapshot's rows for any currency the
 * provider did not update today, producing a complete, dated table. Reads never
 * see a currency vanish just because its source was quiet.
 */
@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  private readonly supportedCurrencies: string[];
  private readonly defaultBaseCurrency: string;
  private readonly canonicalBaseCurrency: string;

  /**
   * In-flight on-demand syncs. Coalesces concurrent `getLatestRates` calls that
   * find no snapshot so only one provider request is issued (single-instance;
   * across instances the scheduler's SystemLock governs the daily sync).
   */
  private readonly inFlightSync = new Map<string, Promise<RateSnapshotResponseDto>>();

  /** Small TTL cache of served snapshots, keyed by requested base currency. */
  private readonly snapshotCache = new Map<
    string,
    { cachedAt: number; dto: RateSnapshotResponseDto }
  >();

  /** Small TTL cache of served report tables, keyed by `base:endDate`. */
  private readonly tableCache = new Map<string, { cachedAt: number; tables: RateTableDto[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(EXCHANGE_RATE_PROVIDER) private readonly rateProvider: IExchangeRateProvider,
  ) {
    const rawCurrencies = this.configService.get<string>(
      'SUPPORTED_CURRENCIES',
      DEFAULT_SUPPORTED_CURRENCIES.join(','),
    );
    this.supportedCurrencies = rawCurrencies
      .split(',')
      .map((c) => normalizeCurrencyCode(c))
      .filter((code): code is string => code !== null && isKnownCurrencyCode(code));

    this.defaultBaseCurrency =
      normalizeCurrencyCode(this.configService.get<string>('EXCHANGE_RATE_BASE_CURRENCY', 'USD')) ??
      'USD';

    this.canonicalBaseCurrency =
      normalizeCurrencyCode(
        this.configService.get<string>('EXCHANGE_RATE_CANONICAL_BASE', 'USD'),
      ) ?? 'USD';

    // The canonical base must always be convertible even if an operator trims
    // SUPPORTED_CURRENCIES, otherwise derived tables could not be built.
    if (!this.supportedCurrencies.includes(this.canonicalBaseCurrency)) {
      this.supportedCurrencies.push(this.canonicalBaseCurrency);
    }

    if (this.supportedCurrencies.length === 0) {
      this.logger.warn(
        'SUPPORTED_CURRENCIES contained no registry-valid codes; falling back to USD.',
      );
      this.supportedCurrencies.push('USD');
    }
  }

  /**
   * Fetches, validates, merges (carry-forward) and atomically persists a
   * complete canonical-base snapshot. Returns the current snapshot unchanged
   * when nothing has changed since the last one.
   */
  async syncExchangeRates(baseCurrency?: string): Promise<RateSnapshotResponseDto> {
    const base = this.canonicalBaseCurrency;
    if (baseCurrency && baseCurrency.toUpperCase() !== base) {
      // The parameter is retained for backwards compatibility; storage is
      // canonical-only now and other bases are derived at read time.
      this.logger.warn(
        `syncExchangeRates(${baseCurrency}) ignored: storage is canonical (${base}); requesting a base is derived on read.`,
      );
    }

    // A fresh snapshot is about to land; never serve stale cached responses.
    this.invalidateCaches();

    this.logger.log(`Starting exchange rate sync for canonical base: ${base}`);

    try {
      // 1. Fetch from the configured provider (frankfurter | mock)
      const providerData = await this.rateProvider.fetchLatestRates(base, this.supportedCurrencies);

      // 2. Validate complete payload
      this.validateSnapshotRates(providerData, base);

      // 3. Carry forward rows the provider did not refresh today so the table
      //    stays complete even when a source is quiet.
      const previous = await this.findLatestSnapshotWithRates(base);
      const merged = this.mergeCarryForward(providerData.rates, previous, base);
      const asOf = merged.reduce(
        (max, row) => (row.effectiveDate > max ? row.effectiveDate : max),
        '0000-01-01',
      );

      // 4. Generate a content ETag; an unchanged table is a clean no-op.
      const etag = this.computeEtag(base, asOf, merged);
      if (previous && previous.etag === etag) {
        this.logger.log(`Rates unchanged for ${base}; reusing snapshot v${previous.version}`);
        const dto = await this.formatSnapshotResponse(previous.id);
        this.cacheSnapshot(base, dto);
        return dto;
      }

      // 5. Atomically persist snapshot and rates in a transaction
      const snapshot = await this.prisma.$transaction(async (tx) => {
        const createdSnapshot = await tx.rateSnapshot.create({
          data: {
            baseCurrency: base,
            effectiveDate: new Date(asOf),
            provider: providerData.provider,
            etag,
            isPublished: true, // Only published on transaction success
          },
        });

        await tx.exchangeRate.createMany({
          data: merged.map((row) => ({
            snapshotId: createdSnapshot.id,
            quoteCurrency: row.quoteCurrency,
            rate: new Prisma.Decimal(row.rate.toFixed(6)),
            effectiveDate: new Date(row.effectiveDate),
          })),
        });

        return createdSnapshot;
      });

      this.logger.log(
        `Successfully published rate snapshot v${snapshot.version} for ${base} (${asOf})`,
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
   * Serves from a short TTL cache when fresh, otherwise reads the canonical
   * snapshot and derives the requested base. Only touches the provider when no
   * canonical snapshot exists at all.
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

    let canonical = await this.findLatestPublishedSnapshot(this.canonicalBaseCurrency);

    if (!canonical) {
      this.logger.log(
        `No snapshot found for canonical base ${this.canonicalBaseCurrency}. Triggering on-demand sync...`,
      );
      const synced = await this.syncWithCoalescing();
      canonical = await this.findLatestPublishedSnapshot(this.canonicalBaseCurrency);
      if (!canonical) {
        // The sync succeeded but the follow-up read raced (or a test double
        // returns nothing); serve the freshly synced snapshot directly.
        const dto = this.deriveDtoFromSnapshotDto(base, synced);
        this.cacheSnapshot(base, dto);
        return dto;
      }
    }

    const snapshot = await this.loadSnapshot(canonical.id);
    const dto = this.buildSnapshotDto(base, snapshot);
    this.cacheSnapshot(base, dto);
    return dto;
  }

  /**
   * Coalesces concurrent on-demand syncs at the in-process level. Note this
   * only guards one instance; the scheduler's SystemLock provides the
   * cross-instance guard for the daily sync.
   */
  private syncWithCoalescing(): Promise<RateSnapshotResponseDto> {
    const base = this.canonicalBaseCurrency;
    const inFlight = this.inFlightSync.get(base);
    if (inFlight) {
      this.logger.log(`Reusing in-flight on-demand sync for base ${base}`);
      return inFlight;
    }

    const sync = this.syncExchangeRates().finally(() => {
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

  private invalidateCaches(): void {
    this.snapshotCache.clear();
    this.tableCache.clear();
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
   * Loads every published canonical snapshot that can resolve a date range,
   * sorted by effectiveDate ascending, derived for `baseCurrency`.
   *
   * Reports use the latest snapshot on-or-before each expense date for genuine
   * historical conversion. When the whole range predates the first snapshot,
   * the earliest snapshot is still returned so those expenses resolve as a
   * clearly labeled *estimate* rather than silently using today's rate. When no
   * snapshot exists at all an on-demand sync is attempted; failure returns an
   * empty list so reports degrade gracefully instead of 500ing.
   */
  async getRateTablesForRange(baseCurrency: string, end: Date): Promise<RateTableDto[]> {
    const base = (baseCurrency || this.defaultBaseCurrency).toUpperCase();
    if (!this.supportedCurrencies.includes(base)) {
      throw new BadRequestException(
        `Unsupported base currency: ${base}. Supported: ${this.supportedCurrencies.join(', ')}`,
      );
    }

    const cacheKey = `${base}:${end.toISOString().slice(0, 10)}`;
    const cached = this.getCachedTables(cacheKey);
    if (cached) {
      return cached;
    }

    const canonicalBase = this.canonicalBaseCurrency;
    const anySnapshot = await this.prisma.rateSnapshot.findFirst({
      where: { baseCurrency: canonicalBase, isPublished: true },
      select: { id: true },
    });
    if (!anySnapshot) {
      try {
        await this.syncExchangeRates();
      } catch (err) {
        this.logger.warn(
          `On-demand rate sync for ${canonicalBase} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const snapshots = await this.prisma.rateSnapshot.findMany({
      where: { baseCurrency: canonicalBase, isPublished: true, effectiveDate: { lte: end } },
      orderBy: { effectiveDate: 'asc' },
      include: { rates: true },
    });

    if (snapshots.length === 0) {
      const earliest = await this.prisma.rateSnapshot.findFirst({
        where: { baseCurrency: canonicalBase, isPublished: true },
        orderBy: { effectiveDate: 'asc' },
        include: { rates: true },
      });
      if (earliest) snapshots.push(earliest);
    }

    const tables = snapshots
      .map((s) => this.toRateTable(base, s))
      .filter((t): t is RateTableDto => t !== null);
    this.cacheTables(cacheKey, tables);
    return tables;
  }

  private getCachedTables(key: string): RateTableDto[] | null {
    const entry = this.tableCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > SNAPSHOT_CACHE_TTL_MS) {
      this.tableCache.delete(key);
      return null;
    }
    return entry.tables;
  }

  private cacheTables(key: string, tables: RateTableDto[]): void {
    this.tableCache.set(key, { cachedAt: Date.now(), tables });
  }

  /**
   * Exchange-rate history for a currency pair over a bounded date range: one
   * point per published snapshot, oldest first. Powers the "Base vs Second"
   * rate chart and gives the dashboard a genuine historical series rather than
   * a flat line at today's rate.
   *
   * The math is base-independent (`quote / base` cancels the snapshot's own
   * base), so every published snapshot is a candidate regardless of which base
   * it was stored with.
   */
  async getRateHistory(query: RateHistoryQueryDto): Promise<RateHistoryResponseDto> {
    const base = (query.base || this.defaultBaseCurrency).toUpperCase();
    if (!this.supportedCurrencies.includes(base)) {
      throw new BadRequestException(
        `Unsupported base currency: ${base}. Supported: ${this.supportedCurrencies.join(', ')}`,
      );
    }

    const quote = query.quote.toUpperCase();
    if (!this.supportedCurrencies.includes(quote)) {
      throw new BadRequestException(
        `Unsupported quote currency: ${quote}. Supported: ${this.supportedCurrencies.join(', ')}`,
      );
    }

    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : today;
    const from = query.from
      ? new Date(`${query.from}T00:00:00.000Z`)
      : (() => {
          const start = new Date(to);
          start.setUTCFullYear(start.getUTCFullYear() - 1);
          return start;
        })();

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('`from` must be on or before `to`');
    }

    // With no snapshot at all, a rate line is impossible; attempt one sync so a
    // brand-new deployment is not permanently empty, then degrade to no points.
    const anySnapshot = await this.prisma.rateSnapshot.findFirst({
      where: { baseCurrency: this.canonicalBaseCurrency, isPublished: true },
      select: { id: true },
    });
    if (!anySnapshot) {
      try {
        await this.syncExchangeRates();
      } catch (err) {
        this.logger.warn(
          `On-demand rate sync for ${this.canonicalBaseCurrency} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const snapshots = await this.prisma.rateSnapshot.findMany({
      where: {
        isPublished: true,
        effectiveDate: { gte: from, lte: to },
      },
      orderBy: { effectiveDate: 'asc' },
      include: { rates: true },
    });

    const points: RateHistoryPointDto[] = [];
    for (const snapshot of snapshots) {
      const ratesByCode = new Map(snapshot.rates.map((r) => [r.quoteCurrency, r.rate]));
      const baseRate = ratesByCode.get(base) ?? new Prisma.Decimal(1);
      const quoteRate = ratesByCode.get(quote);
      if (!quoteRate || baseRate.isZero()) continue;
      points.push({
        date: snapshot.effectiveDate.toISOString().split('T')[0],
        rate: Number(quoteRate.div(baseRate).toFixed(6)),
      });
    }

    return {
      baseCurrency: base,
      quoteCurrency: quote,
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
      points,
    };
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

  // -------------------------------------------------------------------------
  // Storage helpers
  // -------------------------------------------------------------------------

  private async findLatestPublishedSnapshot(baseCurrency: string) {
    return this.prisma.rateSnapshot.findFirst({
      where: {
        baseCurrency,
        isPublished: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  private async findLatestSnapshotWithRates(baseCurrency: string) {
    return this.prisma.rateSnapshot.findFirst({
      where: { baseCurrency, isPublished: true },
      orderBy: { version: 'desc' },
      include: { rates: true },
    });
  }

  private async loadSnapshot(snapshotId: string) {
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
    return snapshot;
  }

  private async formatSnapshotResponse(snapshotId: string): Promise<RateSnapshotResponseDto> {
    const snapshot = await this.loadSnapshot(snapshotId);
    return this.buildSnapshotDto(snapshot.baseCurrency, snapshot);
  }

  /** Builds the client DTO, deriving non-canonical bases on the fly. */
  private buildSnapshotDto(
    base: string,
    snapshot: {
      version: number;
      baseCurrency: string;
      effectiveDate: Date;
      fetchedAt: Date;
      provider: string;
      etag: string;
      rates: { quoteCurrency: string; rate: Prisma.Decimal; effectiveDate?: Date | null }[];
    },
  ): RateSnapshotResponseDto {
    const canonicalDateIso = snapshot.effectiveDate.toISOString().split('T')[0];

    // Identity path: requesting the stored base returns the snapshot verbatim,
    // including its persisted ETag, so HTTP caching stays stable.
    if (base === snapshot.baseCurrency) {
      return {
        version: snapshot.version,
        baseCurrency: base,
        effectiveDate: canonicalDateIso,
        fetchedAt: snapshot.fetchedAt,
        provider: snapshot.provider,
        etag: snapshot.etag,
        rates: Object.fromEntries(snapshot.rates.map((r) => [r.quoteCurrency, r.rate.toFixed(6)])),
      };
    }

    const rows = this.deriveRows(snapshot.rates, base, canonicalDateIso);
    if (!rows) {
      throw new BadRequestException(
        `No exchange rate is available for base ${base} in snapshot v${snapshot.version}`,
      );
    }

    const asOf = rows.reduce(
      (max, row) => (row.effectiveDate > max ? row.effectiveDate : max),
      canonicalDateIso,
    );
    const etag = this.computeEtag(base, asOf, rows);
    return {
      version: snapshot.version,
      baseCurrency: base,
      effectiveDate: asOf,
      fetchedAt: snapshot.fetchedAt,
      provider: snapshot.provider,
      etag,
      rates: Object.fromEntries(rows.map((r) => [r.quoteCurrency, r.rate.toFixed(6)])),
    };
  }

  /**
   * Derives a requested base from an already-materialised snapshot DTO.
   *
   * Used only on the rare path where an on-demand sync succeeded but the
   * follow-up snapshot read returned nothing; it loses per-row dates (the DTO
   * carries none) but still produces a correct, complete rate map.
   */
  private deriveDtoFromSnapshotDto(
    base: string,
    source: RateSnapshotResponseDto,
  ): RateSnapshotResponseDto {
    if (base === source.baseCurrency) {
      return source;
    }

    const synthetic = Object.entries(source.rates).map(([quoteCurrency, rate]) => ({
      quoteCurrency,
      rate: new Prisma.Decimal(rate),
      effectiveDate: null as Date | null,
    }));
    const rows = this.deriveRows(synthetic, base, source.effectiveDate);
    if (!rows) {
      throw new BadRequestException(`No exchange rate is available for base ${base}`);
    }

    const asOf = source.effectiveDate;
    return {
      version: source.version,
      baseCurrency: base,
      effectiveDate: asOf,
      fetchedAt: source.fetchedAt,
      provider: source.provider,
      etag: this.computeEtag(base, asOf, rows),
      rates: Object.fromEntries(rows.map((r) => [r.quoteCurrency, r.rate.toFixed(6)])),
    };
  }

  private toRateTable(
    base: string,
    snapshot: {
      version: number;
      baseCurrency: string;
      effectiveDate: Date;
      provider: string;
      rates: { quoteCurrency: string; rate: Prisma.Decimal; effectiveDate?: Date | null }[];
    },
  ): RateTableDto | null {
    const canonicalDateIso = snapshot.effectiveDate.toISOString().split('T')[0];

    if (base === snapshot.baseCurrency) {
      return {
        version: snapshot.version,
        baseCurrency: base,
        effectiveDate: canonicalDateIso,
        provider: snapshot.provider,
        rates: Object.fromEntries(snapshot.rates.map((r) => [r.quoteCurrency, r.rate.toFixed(6)])),
        dates: Object.fromEntries(
          snapshot.rates.map((r) => [
            r.quoteCurrency,
            r.effectiveDate ? r.effectiveDate.toISOString().split('T')[0] : canonicalDateIso,
          ]),
        ),
      };
    }

    const rows = this.deriveRows(snapshot.rates, base, canonicalDateIso);
    if (!rows) return null;
    return {
      version: snapshot.version,
      baseCurrency: base,
      effectiveDate: canonicalDateIso,
      provider: snapshot.provider,
      rates: Object.fromEntries(rows.map((r) => [r.quoteCurrency, r.rate.toFixed(6)])),
      dates: Object.fromEntries(rows.map((r) => [r.quoteCurrency, r.effectiveDate])),
    };
  }

  /**
   * Re-expresses a canonical table (units of quote per 1 canonical base) as a
   * table against `base`: `derived[code] = canonical[code] / canonical[base]`.
   * The derived row's date is the *older* of the two legs — a pair is only as
   * fresh as its stalest component.
   *
   * Returns null when `base` is not quoted in this snapshot.
   */
  private deriveRows(
    canonicalRates: { quoteCurrency: string; rate: Prisma.Decimal; effectiveDate?: Date | null }[],
    base: string,
    canonicalDateIso: string,
  ): DatedRate[] | null {
    const baseRow = canonicalRates.find((r) => r.quoteCurrency === base);
    if (!baseRow) return null;

    const baseRate = baseRow.rate;
    if (baseRate.isZero()) return null;
    const baseLegDate = baseRow.effectiveDate
      ? baseRow.effectiveDate.toISOString().split('T')[0]
      : canonicalDateIso;

    const rows: DatedRate[] = canonicalRates.map((r) => {
      const rowDate = r.effectiveDate
        ? r.effectiveDate.toISOString().split('T')[0]
        : canonicalDateIso;
      return {
        quoteCurrency: r.quoteCurrency,
        rate: Number(r.rate.div(baseRate).toFixed(6)),
        effectiveDate: rowDate < baseLegDate ? rowDate : baseLegDate,
      };
    });

    // Guarantee the requested base quotes exactly 1.0.
    const existing = rows.find((r) => r.quoteCurrency === base);
    if (existing) {
      existing.rate = 1;
      existing.effectiveDate = baseLegDate;
    } else {
      rows.push({ quoteCurrency: base, rate: 1, effectiveDate: baseLegDate });
    }

    return rows;
  }

  /**
   * Merges freshly fetched rows over the previous snapshot's rows: refreshed
   * currencies win, quiet ones carry forward with their original date. The base
   * is always forced to 1.0.
   */
  private mergeCarryForward(
    fresh: ProviderRateRow[],
    previous: {
      rates: { quoteCurrency: string; rate: Prisma.Decimal; effectiveDate?: Date | null }[];
      effectiveDate: Date;
    } | null,
    base: string,
  ): DatedRate[] {
    const byCode = new Map<string, DatedRate>();

    if (previous) {
      const prevDateIso = previous.effectiveDate.toISOString().split('T')[0];
      for (const row of previous.rates) {
        byCode.set(row.quoteCurrency, {
          quoteCurrency: row.quoteCurrency,
          rate: Number(row.rate.toFixed(6)),
          effectiveDate: row.effectiveDate
            ? row.effectiveDate.toISOString().split('T')[0]
            : prevDateIso,
        });
      }
    }

    for (const row of fresh) {
      const code = row.quoteCurrency.toUpperCase();
      byCode.set(code, {
        quoteCurrency: code,
        rate: code === base ? 1 : row.rate,
        effectiveDate: row.effectiveDate,
      });
    }

    // The base must always be present, at exactly 1.0, dated to the freshest row.
    const freshDate = fresh.reduce(
      (max, row) => (row.effectiveDate > max ? row.effectiveDate : max),
      '0000-01-01',
    );
    const baseRow = byCode.get(base);
    if (baseRow) {
      baseRow.rate = 1;
    } else {
      byCode.set(base, { quoteCurrency: base, rate: 1, effectiveDate: freshDate });
    }

    return [...byCode.values()].sort((a, b) => a.quoteCurrency.localeCompare(b.quoteCurrency));
  }

  private computeEtag(base: string, effectiveDate: string, rows: DatedRate[]): string {
    const fingerprint = [...rows]
      .sort((a, b) => a.quoteCurrency.localeCompare(b.quoteCurrency))
      .map((r) => `${r.quoteCurrency}:${r.rate.toFixed(6)}:${r.effectiveDate}`)
      .join(',');
    const hash = crypto
      .createHash('sha256')
      .update(`${base}:${effectiveDate}:${fingerprint}`)
      .digest('hex')
      .substring(0, 16);
    return `W/"rates-${base}-${effectiveDate}-${hash}"`;
  }

  private validateSnapshotRates(providerData: ProviderRatesResponse, baseCurrency: string): void {
    const rows = providerData.rates;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Rates payload is not a valid non-empty array');
    }

    // Base currency rate must be strictly 1.0
    const baseRow = rows.find((r) => r.quoteCurrency.toUpperCase() === baseCurrency);
    if (!baseRow || Math.abs(baseRow.rate - 1.0) > 0.000001) {
      throw new Error(`Base currency ${baseCurrency} rate must be 1.0, got: ${baseRow?.rate}`);
    }

    // Every quoted rate must be a positive finite number with a usable date.
    for (const row of rows) {
      if (typeof row.rate !== 'number' || !isFinite(row.rate) || row.rate <= 0) {
        throw new Error(`Invalid non-positive finite rate for ${row.quoteCurrency}: ${row.rate}`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveDate)) {
        throw new Error(`Invalid effective date for ${row.quoteCurrency}: ${row.effectiveDate}`);
      }
    }
  }
}
