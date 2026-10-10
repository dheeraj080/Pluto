import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateBudgetDto {
  @ApiPropertyOptional({
    description: 'Category the budget applies to. Omit for an overall (whole-account) budget.',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiProperty({
    description: 'Budgeted amount in the budget currency',
    example: 500,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Budget amount must be greater than 0' })
  amount!: number;

  @ApiProperty({
    description: 'ISO 4217 currency code; use the report base currency for comparability',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO 4217 code' })
  currency!: string;

  @ApiPropertyOptional({ enum: BudgetPeriod, default: BudgetPeriod.MONTHLY })
  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;

  @ApiPropertyOptional({
    description: 'First date the budget applies; defaults to today',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be an ISO date such as YYYY-MM-DD' })
  startDate?: string;
}

export class UpdateBudgetDto {
  @ApiProperty({ description: 'New budgeted amount', example: 600, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Budget amount must be greater than 0' })
  amount!: number;

  @ApiPropertyOptional({ description: 'New first-applied date', example: '2026-10-01' })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be an ISO date such as YYYY-MM-DD' })
  startDate?: string;
}
