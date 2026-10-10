import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';

export class CategoryBreakdownDto {
  @ApiProperty({ example: 'b2f1c3de-1111-2222-3333-444455556666' })
  categoryId!: string;

  @ApiProperty({ example: 'Food & Dining' })
  categoryName!: string;

  @ApiProperty({ example: '#f59e0b' })
  color!: string;

  @ApiProperty({ description: 'Subtotal converted into the base currency', example: 245.75 })
  total!: number;

  @ApiProperty({ example: 18 })
  count!: number;

  @ApiProperty({ description: 'Share of the period total, 0-100', example: 31.4 })
  percentage!: number;
}

export class CurrencyTotalDto {
  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  currency!: string;

  @ApiProperty({ description: 'Native, unconverted subtotal', example: 245.75 })
  total!: number;

  @ApiProperty({ example: 18 })
  count!: number;
}

export class ExpenseSummaryDto {
  @ApiProperty({ description: 'Currency all converted figures are expressed in', example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({
    description:
      'False when no rate snapshot was available; totals are then null and only byCurrency is populated',
    example: true,
  })
  converted!: boolean;

  @ApiPropertyOptional({
    description: 'Why conversion was unavailable',
    example: 'exchange rates unreachable',
  })
  conversionUnavailableReason?: string;

  @ApiProperty({ description: 'Inclusive range start', example: '2026-10-01' })
  from!: string;

  @ApiProperty({ description: 'Inclusive range end', example: '2026-10-31' })
  to!: string;

  @ApiPropertyOptional({
    description: 'Period total in the base currency',
    example: 783.2,
    nullable: true,
  })
  total!: number | null;

  @ApiProperty({ example: 42 })
  count!: number;

  @ApiPropertyOptional({
    description: 'Period average per expense in the base currency',
    example: 18.65,
    nullable: true,
  })
  average!: number | null;

  @ApiProperty({ type: [CategoryBreakdownDto] })
  byCategory!: CategoryBreakdownDto[];

  @ApiProperty({ type: [CurrencyTotalDto] })
  byCurrency!: CurrencyTotalDto[];
}

export class TrendPointDto {
  @ApiProperty({ description: 'Calendar month, YYYY-MM', example: '2026-10' })
  month!: string;

  @ApiPropertyOptional({
    description: 'Month total in the base currency',
    example: 783.2,
    nullable: true,
  })
  total!: number | null;

  @ApiProperty({ example: 42 })
  count!: number;
}

export class ExpenseTrendDto {
  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({ example: true })
  converted!: boolean;

  @ApiPropertyOptional({ description: 'Why conversion was unavailable', nullable: true })
  conversionUnavailableReason?: string;

  @ApiProperty({ description: 'Number of months returned, oldest first', example: 12 })
  months!: number;

  @ApiProperty({ type: [TrendPointDto] })
  points!: TrendPointDto[];
}

export class BudgetStatusDto {
  @ApiProperty({ example: 'c9d8e7f6-aaaa-bbbb-cccc-ddddeeeeffff' })
  budgetId!: string;

  @ApiPropertyOptional({ description: 'Null for an overall budget', nullable: true })
  categoryId!: string | null;

  @ApiPropertyOptional({ example: 'Food & Dining', nullable: true })
  categoryName!: string | null;

  @ApiPropertyOptional({ example: '#f59e0b', nullable: true })
  color!: string | null;

  @ApiProperty({ enum: BudgetPeriod, example: BudgetPeriod.MONTHLY })
  period!: BudgetPeriod;

  @ApiProperty({ description: 'Budgeted amount in the base currency', example: 500 })
  budgetAmount!: number;

  @ApiProperty({ description: 'Native budgeted amount as stored', example: 500 })
  budgetAmountNative!: number;

  @ApiProperty({ description: 'Spent in the evaluated window, converted', example: 612.4 })
  spent!: number;

  @ApiProperty({ description: 'budgetAmount minus spent', example: -112.4 })
  remaining!: number;

  @ApiProperty({ description: 'Spent as a percentage of budget', example: 122.5 })
  percentage!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: true })
  overBudget!: boolean;

  @ApiProperty({
    description: 'False when the budget start date falls after the evaluated window',
    example: true,
  })
  applied!: boolean;
}

export class BudgetStatusResponseDto {
  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({ example: true })
  converted!: boolean;

  @ApiPropertyOptional({ description: 'Why conversion was unavailable', nullable: true })
  conversionUnavailableReason?: string;

  @ApiProperty({ description: 'Evaluated period, YYYY-MM', example: '2026-10' })
  month!: string;

  @ApiProperty({ type: [BudgetStatusDto] })
  items!: BudgetStatusDto[];
}
