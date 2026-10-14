import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';

export class ExpenseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ example: 'b2f1c3de-1111-2222-3333-444455556666' })
  categoryId!: string;

  @ApiProperty({ example: 'Food & Dining' })
  categoryName!: string;

  @ApiProperty({ example: '#f59e0b' })
  categoryColor!: string;

  @ApiProperty({ description: 'Amount in the expense currency', example: 12.5 })
  amount!: number;

  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  currency!: string;

  @ApiPropertyOptional({ example: 'Lunch with team', nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ description: 'Date the expense was incurred', example: '2026-10-10' })
  incurredOn!: string;

  @ApiPropertyOptional({ example: 'CARD', nullable: true, type: String })
  paymentMethod!: string | null;

  @ApiProperty({ example: '2026-10-10T08:15:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-10T09:00:00.000Z' })
  updatedAt!: Date;
}

export class PaginatedExpensesResponseDto {
  @ApiProperty({ type: [ExpenseDto] })
  items!: ExpenseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}

export class ExpenseCategoryDto {
  @ApiProperty({ example: 'b2f1c3de-1111-2222-3333-444455556666' })
  id!: string;

  @ApiProperty({ example: 'Food & Dining' })
  name!: string;

  @ApiProperty({ example: '#f59e0b' })
  color!: string;

  @ApiPropertyOptional({ example: 'utensils', nullable: true, type: String })
  icon!: string | null;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty({ example: 10 })
  sortOrder!: number;

  @ApiProperty({ description: 'Number of expenses filed under this category', example: 24 })
  expenseCount!: number;
}

export class BudgetDto {
  @ApiProperty({ example: 'c9d8e7f6-aaaa-bbbb-cccc-ddddeeeeffff' })
  id!: string;

  @ApiPropertyOptional({
    description: 'Category id, or null for an overall budget',
    nullable: true,
    type: String,
  })
  categoryId!: string | null;

  @ApiPropertyOptional({ example: 'Food & Dining', nullable: true, type: String })
  categoryName!: string | null;

  @ApiProperty({ description: 'Budgeted amount', example: 500 })
  amount!: number;

  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  currency!: string;

  @ApiProperty({ enum: BudgetPeriod, example: BudgetPeriod.MONTHLY })
  period!: BudgetPeriod;

  @ApiProperty({ example: '2026-10-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-10-01T10:00:00.000Z' })
  createdAt!: Date;
}
