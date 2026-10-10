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
