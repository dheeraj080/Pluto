import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export const EXPENSE_SORTS = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc'] as const;
export type ExpenseSort = (typeof EXPENSE_SORTS)[number];

export class ExpenseQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Restrict to a single category',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive lower bound on incurredOn',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be an ISO date such as YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound on incurredOn',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be an ISO date such as YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ description: 'Minimum amount (native currency)', example: 10, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum amount (native currency)',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Restrict to a single currency',
    example: 'EUR',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over description',
    example: 'grocer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: EXPENSE_SORTS, default: 'date_desc' })
  @IsOptional()
  @IsIn(EXPENSE_SORTS)
  sort: ExpenseSort = 'date_desc';
}

export class ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive lower bound; defaults to the first day of the current month',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be an ISO date such as YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive upper bound; defaults to today',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be an ISO date such as YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({
    description: 'Base currency to convert into',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  base?: string;
}

export class TrendQueryDto {
  @ApiPropertyOptional({
    description: 'Number of trailing months to return',
    example: 12,
    default: 12,
    maximum: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months: number = 12;

  @ApiPropertyOptional({
    description: 'Base currency to convert into',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  base?: string;
}

export class BudgetStatusQueryDto {
  @ApiPropertyOptional({ description: 'Month to evaluate, as YYYY-MM', example: '2026-10' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be formatted YYYY-MM' })
  month?: string;

  @ApiPropertyOptional({
    description: 'Base currency to convert into',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  base?: string;
}
