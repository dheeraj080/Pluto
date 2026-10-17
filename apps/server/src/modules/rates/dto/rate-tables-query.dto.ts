import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Query for the published rate snapshots a client needs to mirror locally.
 *
 * The clients keep a bounded local mirror (the trailing window) so report
 * conversion keeps working offline; dates older than the mirror fall back to
 * the live report endpoints. `from` defaults to 90 days before `to`, and `to`
 * defaults to today.
 */
export class RateTablesQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 4217 3-letter base currency code to derive against',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'Base currency must be a 3-letter uppercase ISO code (e.g. USD)',
  })
  base?: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound (YYYY-MM-DD); defaults to 90 days before `to`',
    example: '2026-07-20',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be an ISO date such as YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound (YYYY-MM-DD); defaults to today',
    example: '2026-10-18',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be an ISO date such as YYYY-MM-DD' })
  to?: string;
}
