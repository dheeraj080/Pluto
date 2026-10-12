import { ApiProperty } from '@nestjs/swagger';

export class RateSnapshotResponseDto {
  @ApiProperty({ example: 42, description: 'Monotonically increasing version identifier' })
  version!: number;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 base currency code' })
  baseCurrency!: string;

  @ApiProperty({
    example: '2026-10-09',
    description: 'Effective market date for the rates snapshot',
  })
  effectiveDate!: string;

  @ApiProperty({
    example: '2026-10-09T04:00:15.123Z',
    description: 'Timestamp when rates were fetched from the provider',
  })
  fetchedAt!: Date;

  @ApiProperty({ example: 'frankfurter', description: 'Name of the exchange rate data provider' })
  provider!: string;

  @ApiProperty({
    example: 'W/"rates-v42-20261009"',
    description: 'ETag value for client caching and deduplication',
  })
  etag!: string;

  @ApiProperty({
    description:
      'Dictionary of quote currencies and their rate against 1 unit of base currency, serialized as exact decimal strings',
    example: {
      USD: '1.000000',
      EUR: '0.923400',
      GBP: '0.789100',
      INR: '86.425000',
      JPY: '152.340000',
      CNY: '7.245000',
      CAD: '1.385000',
      AUD: '1.542000',
      CHF: '0.887000',
      SGD: '1.341000',
      NZD: '1.678000',
    },
  })
  rates!: Record<string, string>;
}

export class SupportedCurrencyDto {
  @ApiProperty({ example: 'USD' })
  code!: string;

  @ApiProperty({ example: 'United States Dollar' })
  name!: string;

  @ApiProperty({ example: '$' })
  symbol!: string;
}

export class RateSnapshotVersionDto {
  @ApiProperty({ example: 42 })
  version!: number;

  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({ example: '2026-10-09' })
  effectiveDate!: string;

  @ApiProperty({ example: '2026-10-09T04:00:15.123Z' })
  fetchedAt!: Date;

  @ApiProperty({ example: 'W/"rates-v42-20261009"' })
  etag!: string;
}

/**
 * One immutable, already-persisted rate snapshot ready for point-in-time
 * conversion. Reports load the full set covering a date range and resolve the
 * latest snapshot on-or-before each expense date — never today's rate
 * silently.
 */
export class RateTableDto {
  @ApiProperty({ example: 42 })
  version!: number;

  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({ example: '2026-10-09', description: 'Provider market date (YYYY-MM-DD)' })
  effectiveDate!: string;

  @ApiProperty({ example: 'frankfurter' })
  provider!: string;

  @ApiProperty({
    description: 'Rates against 1 unit of baseCurrency, serialized as exact decimal strings',
    example: { USD: '1.000000', EUR: '0.923400' },
  })
  rates!: Record<string, string>;
}

/** One dated point on a currency pair's exchange-rate history. */
export class RateHistoryPointDto {
  @ApiProperty({ example: '2026-10-09', description: 'Snapshot market date (YYYY-MM-DD)' })
  date!: string;

  @ApiProperty({
    example: 89.98,
    description: 'Units of quoteCurrency per 1 unit of baseCurrency',
  })
  rate!: number;
}

export class RateHistoryResponseDto {
  @ApiProperty({ example: 'EUR' })
  baseCurrency!: string;

  @ApiProperty({ example: 'INR' })
  quoteCurrency!: string;

  @ApiProperty({ example: '2025-10-12', description: 'Inclusive range start (YYYY-MM-DD)' })
  from!: string;

  @ApiProperty({ example: '2026-10-12', description: 'Inclusive range end (YYYY-MM-DD)' })
  to!: string;

  @ApiProperty({
    type: [RateHistoryPointDto],
    description: 'One point per published snapshot in range, oldest first',
  })
  points!: RateHistoryPointDto[];
}
