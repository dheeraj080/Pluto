import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceStatus, RecurrenceFrequency, RecurringRuleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const OCCURRENCE_STATUSES = [
  OccurrenceStatus.PENDING,
  OccurrenceStatus.CONFIRMED,
  OccurrenceStatus.SKIPPED,
] as const;

/** Recurrence block accepted inline by `POST /expenses` to create a rule in one step. */
export class RecurrenceInputDto {
  @ApiProperty({ enum: RecurrenceFrequency, example: RecurrenceFrequency.MONTHLY })
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @ApiPropertyOptional({ description: 'Every Nth period', example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @ApiPropertyOptional({
    description: 'Stop generating occurrences after this date',
    example: '2027-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be an ISO date such as YYYY-MM-DD' })
  endDate?: string;
}

export class CreateRecurringExpenseDto {
  @ApiProperty({
    description: 'Identifier of an expense category owned by the caller',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({
    description: 'Amount due each occurrence, in the rule currency',
    example: 1500,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount!: number;

  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO 4217 code' })
  currency!: string;

  @ApiProperty({ enum: RecurrenceFrequency, example: RecurrenceFrequency.MONTHLY })
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @ApiPropertyOptional({ description: 'Every Nth period', example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @ApiProperty({
    description: 'Anchor date the cadence counts from; a past date only anchors the schedule',
    example: '2026-10-01',
  })
  @IsDateString({}, { message: 'startDate must be an ISO date such as YYYY-MM-DD' })
  startDate!: string;

  @ApiPropertyOptional({
    description: 'Stop generating occurrences after this date',
    example: '2027-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be an ISO date such as YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Free-form note', example: 'Rent', maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({
    description: 'How the expense is settled',
    example: 'CARD',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  paymentMethod?: string;
}

export class UpdateRecurringExpenseDto {
  @ApiPropertyOptional({ description: 'Identifier of an expense category owned by the caller' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Amount due each occurrence', minimum: 0.01 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({ enum: RecurrenceFrequency })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional({ description: 'Every Nth period', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  interval?: number;

  @ApiPropertyOptional({
    description: 'Anchor date the cadence counts from',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be an ISO date such as YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Stop generating occurrences after this date, or null to clear',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be an ISO date such as YYYY-MM-DD' })
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Free-form note', maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({ description: 'How the expense is settled', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Pause or resume the rule. `PAUSED` suppresses generation; `ACTIVE` resumes.',
    enum: RecurringRuleStatus,
  })
  @IsOptional()
  @IsEnum(RecurringRuleStatus)
  status?: RecurringRuleStatus;
}

export class ConfirmOccurrenceDto {
  @ApiPropertyOptional({ description: 'Override the recorded amount', minimum: 0.01 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Override the ISO 4217 currency code',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Override the category' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Override the incurred date', example: '2026-10-01' })
  @IsOptional()
  @IsDateString({}, { message: 'incurredOn must be an ISO date such as YYYY-MM-DD' })
  incurredOn?: string;

  @ApiPropertyOptional({ description: 'Override the note', maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({ description: 'Override the payment method', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  paymentMethod?: string;
}

export class RecurringOccurrenceQueryDto {
  @ApiPropertyOptional({ enum: OCCURRENCE_STATUSES, description: 'Filter by occurrence status' })
  @IsOptional()
  @IsEnum(OccurrenceStatus)
  status?: OccurrenceStatus;

  @ApiPropertyOptional({
    description: 'Only occurrences due on or after this date',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be an ISO date such as YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Only occurrences due on or before this date',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be an ISO date such as YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ description: 'Restrict to a single rule' })
  @IsOptional()
  @IsUUID()
  recurringExpenseId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ConfirmManyOccurrencesDto {
  @ApiPropertyOptional({
    description: 'Specific occurrence ids to confirm. Omit to confirm every pending occurrence.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];
}
