import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class LatestRatesQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 4217 3-letter base currency code (default: USD)',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'Base currency must be a 3-letter uppercase ISO code (e.g. USD)',
  })
  base?: string = 'USD';
}
