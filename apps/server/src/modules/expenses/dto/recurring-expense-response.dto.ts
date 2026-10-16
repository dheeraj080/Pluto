import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceStatus, RecurrenceFrequency, RecurringRuleStatus } from '@prisma/client';

export class RecurringExpenseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ example: 'b2f1c3de-1111-2222-3333-444455556666' })
  categoryId!: string;

  @ApiProperty({ example: 'Housing' })
  categoryName!: string;

  @ApiProperty({ example: '#f59e0b' })
  categoryColor!: string;

  @ApiProperty({ description: 'Amount due each occurrence', example: 1500 })
  amount!: number;

  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  currency!: string;

  @ApiPropertyOptional({ example: 'Rent', nullable: true, type: String })
  description!: string | null;

  @ApiPropertyOptional({ example: 'CARD', nullable: true, type: String })
  paymentMethod!: string | null;

  @ApiProperty({ enum: RecurrenceFrequency, example: RecurrenceFrequency.MONTHLY })
  frequency!: RecurrenceFrequency;

  @ApiProperty({ example: 1 })
  interval!: number;

  @ApiProperty({ example: '2026-10-01' })
  startDate!: string;

  @ApiPropertyOptional({ example: '2027-10-01', nullable: true, type: String })
  endDate!: string | null;

  @ApiProperty({ enum: RecurringRuleStatus, example: RecurringRuleStatus.ACTIVE })
  status!: RecurringRuleStatus;

  @ApiPropertyOptional({
    description: 'Earliest pending occurrence, else the next scheduled date',
    example: '2026-11-01',
    nullable: true,
    type: String,
  })
  nextDueOn!: string | null;

  @ApiProperty({ description: 'Number of occurrences awaiting confirmation', example: 1 })
  pendingCount!: number;

  @ApiProperty({ example: '2026-10-01' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-01T10:00:00.000Z' })
  updatedAt!: Date;
}

export class RecurringOccurrenceDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-1111-2222-333344445555' })
  id!: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  recurringExpenseId!: string;

  @ApiProperty({ description: 'Date the occurrence is due', example: '2026-11-01' })
  dueOn!: string;

  @ApiProperty({ enum: OccurrenceStatus, example: OccurrenceStatus.PENDING })
  status!: OccurrenceStatus;

  @ApiProperty({ example: 1500 })
  amount!: number;

  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  currency!: string;

  @ApiProperty({ example: 'b2f1c3de-1111-2222-3333-444455556666' })
  categoryId!: string;

  @ApiProperty({ example: 'Housing' })
  categoryName!: string;

  @ApiProperty({ example: '#f59e0b' })
  categoryColor!: string;

  @ApiPropertyOptional({ example: 'Rent', nullable: true, type: String })
  description!: string | null;

  @ApiPropertyOptional({ example: 'CARD', nullable: true, type: String })
  paymentMethod!: string | null;

  @ApiPropertyOptional({
    description: 'The expense created when this occurrence was confirmed',
    example: 'c9d8e7f6-aaaa-bbbb-cccc-ddddeeeeffff',
    nullable: true,
    type: String,
  })
  expenseId!: string | null;

  @ApiPropertyOptional({ example: '2026-11-01T09:00:00.000Z', nullable: true, type: Date })
  confirmedAt!: Date | null;

  @ApiProperty({ example: '2026-10-16T10:00:00.000Z' })
  createdAt!: Date;
}

export class PaginatedOccurrencesResponseDto {
  @ApiProperty({ type: [RecurringOccurrenceDto] })
  items!: RecurringOccurrenceDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 4 })
  total!: number;
}

export class ConfirmOccurrencesResponseDto {
  @ApiProperty({
    description: 'How many pending occurrences were turned into expenses',
    example: 3,
  })
  confirmed!: number;
}
