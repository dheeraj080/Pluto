import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';

/** Whether a conversion used the true transaction-date cycle or a labeled approximation. */
export type RatePolicy = 'historical' | 'estimate';

/**
 * Aggregated conversion health of a report payload:
 * - `converted`            — every line converted
 * - `partially_converted`  — some lines converted, some could not
 * - `unavailable`          — nothing could be converted
 */
export type ConversionStatus = 'converted' | 'partially_converted' | 'unavailable';

/** Which snapshots/policies actually fed a report, for auditability. */
export class RateProvenanceDto {
  @ApiPropertyOptional({ description: 'Earliest snapshot date used', example: '2026-09-30' })
  earliestRateDate!: string | null;

  @ApiPropertyOptional({ description: 'Latest snapshot date used', example: '2026-10-09' })
  latestRateDate!: string | null;

  @ApiProperty({
    description: 'Distinct policies applied; includes unavailable when any line failed',
    example: ['historical', 'estimate'],
  })
  policies!: Array<RatePolicy | 'unavailable'>;
}

/** Provenance reported per converted line (top expenses, budget items, CSV). */
export interface ItemConversionProvenance {
  /** Converted amount in the base currency, or null when unconvertible. */
  convertedAmount: number | null;
  /** Base currency the converted amount is expressed in, or null. */
  convertedCurrency: string | null;
  /** Actual snapshot date used for the conversion, or null. */
  rateDate: string | null;
  /** historical / estimate, or null when unconvertible. */
  ratePolicy: RatePolicy | null;
  /** converted when this line could be converted, else unavailable. */
  conversionStatus: 'converted' | 'unavailable';
}

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

  @ApiPropertyOptional({
    description: 'Subtotal in the secondary currency, when one was requested',
    example: 22490,
    nullable: true,
  })
  secondaryTotal?: number | null;
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

  @ApiProperty({
    description:
      'Health of this report: converted, partially_converted (some lines failed), or unavailable',
    enum: ['converted', 'partially_converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus!: ConversionStatus;

  @ApiProperty({
    description: 'Native currencies within the range that could not be converted',
    type: [String],
    example: ['VND'],
  })
  unconvertedCurrencies!: string[];

  @ApiProperty({ type: RateProvenanceDto })
  rateProvenance!: RateProvenanceDto;

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

  @ApiPropertyOptional({
    description: 'Second currency these figures are also expressed in, when requested',
    example: 'INR',
    nullable: true,
  })
  secondaryCurrency?: string | null;

  @ApiPropertyOptional({
    description: 'Period total in the secondary currency',
    example: 44955,
    nullable: true,
  })
  secondaryTotal?: number | null;

  @ApiPropertyOptional({
    description: 'Period average per expense in the secondary currency',
    example: 1070.36,
    nullable: true,
  })
  secondaryAverage?: number | null;
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

  @ApiPropertyOptional({
    description: 'Month total in the secondary currency, when one was requested',
    example: 65750,
    nullable: true,
  })
  secondaryTotal?: number | null;
}

export class ExpenseTrendDto {
  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiPropertyOptional({
    description: 'Second currency the points are also expressed in, when requested',
    example: 'INR',
    nullable: true,
  })
  secondaryCurrency?: string | null;

  @ApiProperty({ example: true })
  converted!: boolean;

  @ApiPropertyOptional({ description: 'Why conversion was unavailable', nullable: true })
  conversionUnavailableReason?: string;

  @ApiProperty({
    enum: ['converted', 'partially_converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus!: ConversionStatus;

  @ApiProperty({ type: [String], example: ['VND'] })
  unconvertedCurrencies!: string[];

  @ApiProperty({ type: RateProvenanceDto })
  rateProvenance!: RateProvenanceDto;

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

  @ApiPropertyOptional({
    description: 'Budget amount converted into the base currency, null when unconvertible',
    example: 500,
    nullable: true,
  })
  convertedAmount!: number | null;

  @ApiPropertyOptional({ example: 'USD', nullable: true })
  convertedCurrency!: string | null;

  @ApiPropertyOptional({
    description: 'Snapshot date used for the budget amount conversion',
    example: '2026-10-01',
    nullable: true,
  })
  rateDate!: string | null;

  @ApiPropertyOptional({
    enum: ['historical', 'estimate'],
    example: 'historical',
    nullable: true,
  })
  ratePolicy!: RatePolicy | null;

  @ApiProperty({
    description: 'converted when spend and budget amount both converted, unavailable otherwise',
    enum: ['converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus!: 'converted' | 'unavailable';

  @ApiPropertyOptional({
    description: 'Budgeted amount in the secondary currency, when requested',
    example: 49900,
    nullable: true,
  })
  secondaryBudgetAmount?: number | null;

  @ApiPropertyOptional({
    description: 'Spent in the secondary currency, when requested',
    example: 61100,
    nullable: true,
  })
  secondarySpent?: number | null;

  @ApiPropertyOptional({
    description: 'secondaryBudgetAmount minus secondarySpent, when requested',
    example: -11200,
    nullable: true,
  })
  secondaryRemaining?: number | null;
}

export class ComparisonDeltaDto {
  @ApiProperty({ description: 'Difference in total (current - previous)', example: -12.34 })
  totalAbs!: number;

  @ApiProperty({ description: 'Percentage change in total', example: -8.5 })
  totalPct!: number;

  @ApiProperty({ description: 'Difference in count (current - previous)', example: 2 })
  countAbs!: number;

  @ApiProperty({ description: 'Percentage change in count', example: 15.4 })
  countPct!: number;
}

export class ExpenseComparisonDto {
  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({ example: true })
  converted!: boolean;

  @ApiPropertyOptional({ description: 'Why conversion was unavailable', nullable: true })
  conversionUnavailableReason?: string;

  @ApiProperty({
    enum: ['converted', 'partially_converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus!: ConversionStatus;

  @ApiProperty({ type: [String] })
  unconvertedCurrencies!: string[];

  @ApiProperty({ type: RateProvenanceDto })
  rateProvenance!: RateProvenanceDto;

  @ApiProperty({ type: ExpenseSummaryDto })
  current!: ExpenseSummaryDto;

  @ApiProperty({ type: ExpenseSummaryDto })
  previous!: ExpenseSummaryDto;

  @ApiProperty({ type: ComparisonDeltaDto })
  delta!: ComparisonDeltaDto;
}

export class TopExpenseItemDto {
  @ApiProperty({ example: 'e8f7a6b5-cccc-dddd-eeee-ffff00001111' })
  id!: string;

  @ApiProperty({ example: 'Lunch at cafe', nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ example: 'Food & Dining', nullable: true })
  categoryName!: string | null;

  @ApiProperty({ example: 'Food', nullable: true })
  categorySlug!: string | null;

  @ApiProperty({ example: 25.5 })
  amountNative!: number;

  @ApiProperty({ example: 'EUR' })
  currency!: string;

  @ApiPropertyOptional({ description: 'Amount converted to base currency', example: 27.3 })
  amount?: number | null;

  @ApiPropertyOptional({
    description: 'Converted amount in the base currency (alias of amount)',
    example: 27.3,
    nullable: true,
  })
  convertedAmount?: number | null;

  @ApiPropertyOptional({ example: 'USD', nullable: true })
  convertedCurrency?: string | null;

  @ApiPropertyOptional({
    description: 'Amount in the requested secondary currency, when one was requested',
    example: 2450,
    nullable: true,
  })
  amountSecondary?: number | null;

  @ApiPropertyOptional({
    description: 'Snapshot date used for conversion, or null',
    example: '2026-10-09',
    nullable: true,
  })
  rateDate?: string | null;

  @ApiPropertyOptional({
    enum: ['historical', 'estimate'],
    example: 'historical',
    nullable: true,
  })
  ratePolicy?: RatePolicy | null;

  @ApiPropertyOptional({
    enum: ['converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus?: 'converted' | 'unavailable';

  @ApiProperty({ example: '2026-10-15' })
  incurredOn!: string;
}

export class TopExpensesResponseDto {
  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiProperty({ example: true })
  converted!: boolean;

  @ApiPropertyOptional({ description: 'Why conversion was unavailable', nullable: true })
  conversionUnavailableReason?: string;

  @ApiProperty({
    enum: ['converted', 'partially_converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus!: ConversionStatus;

  @ApiProperty({ type: [String] })
  unconvertedCurrencies!: string[];

  @ApiProperty({ type: RateProvenanceDto })
  rateProvenance!: RateProvenanceDto;

  @ApiProperty({ type: [TopExpenseItemDto] })
  items!: TopExpenseItemDto[];
}

export class DayOfWeekItemDto {
  @ApiProperty({ description: '0=Sunday,1=Monday,...,6=Saturday', example: 1 })
  dow!: number;

  @ApiProperty({ example: 'Mon' })
  label!: string;

  @ApiProperty({ example: 245.75 })
  total!: number;

  @ApiProperty({ example: 18 })
  count!: number;

  @ApiProperty({ example: 13.65 })
  average!: number;

  @ApiPropertyOptional({
    description: 'Total in the secondary currency, when one was requested',
    example: 22490,
    nullable: true,
  })
  secondaryTotal?: number | null;
}

export class ByDayOfWeekResponseDto {
  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiPropertyOptional({
    description: 'Second currency the items are also expressed in, when requested',
    example: 'INR',
    nullable: true,
  })
  secondaryCurrency?: string | null;

  @ApiProperty({ example: true })
  converted!: boolean;

  @ApiPropertyOptional({ description: 'Why conversion was unavailable', nullable: true })
  conversionUnavailableReason?: string;

  @ApiProperty({
    enum: ['converted', 'partially_converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus!: ConversionStatus;

  @ApiProperty({ type: [String] })
  unconvertedCurrencies!: string[];

  @ApiProperty({ type: RateProvenanceDto })
  rateProvenance!: RateProvenanceDto;

  @ApiProperty({ type: [DayOfWeekItemDto] })
  items!: DayOfWeekItemDto[];
}

export class BudgetStatusResponseDto {
  @ApiProperty({ example: 'USD' })
  baseCurrency!: string;

  @ApiPropertyOptional({
    description: 'Second currency the items are also expressed in, when requested',
    example: 'INR',
    nullable: true,
  })
  secondaryCurrency?: string | null;

  @ApiProperty({ example: true })
  converted!: boolean;

  @ApiPropertyOptional({ description: 'Why conversion was unavailable', nullable: true })
  conversionUnavailableReason?: string;

  @ApiProperty({
    enum: ['converted', 'partially_converted', 'unavailable'],
    example: 'converted',
  })
  conversionStatus!: ConversionStatus;

  @ApiProperty({ type: [String] })
  unconvertedCurrencies!: string[];

  @ApiProperty({ type: RateProvenanceDto })
  rateProvenance!: RateProvenanceDto;

  @ApiProperty({ description: 'Evaluated period, YYYY-MM', example: '2026-10' })
  month!: string;

  @ApiProperty({ type: [BudgetStatusDto] })
  items!: BudgetStatusDto[];
}
