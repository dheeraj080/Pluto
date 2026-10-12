import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Query for the exchange-rate history between two currencies over a date
 * range. `quote` is required; omitting `from` defaults to twelve months before
 * `to`, and omitting `to` defaults to today.
 */
export class RateHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 4217 3-letter base currency code (default: the server default)',
    example: 'EUR',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'Base currency must be a 3-letter uppercase ISO code (e.g. EUR)',
  })
  base?: string;

  @ApiProperty({
    description: 'ISO 4217 3-letter quote currency code',
    example: 'INR',
  })
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'Quote currency must be a 3-letter uppercase ISO code (e.g. INR)',
  })
  quote!: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound (YYYY-MM-DD); defaults to 12 months before `to`',
    example: '2025-10-12',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be an ISO date such as YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound (YYYY-MM-DD); defaults to today',
    example: '2026-10-12',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be an ISO date such as YYYY-MM-DD' })
  to?: string;
}
