import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RecurrenceInputDto } from './recurring-expense.dto';

export class CreateExpenseDto {
  @ApiProperty({
    description: 'Identifier of an expense category owned by the caller',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({
    description: 'Amount spent, expressed in the expense currency',
    example: 12.5,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount!: number;

  @ApiProperty({
    description: 'ISO 4217 currency code; must be one of the supported currencies',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO 4217 code' })
  currency!: string;

  @ApiProperty({
    description: 'Date the expense was incurred',
    example: '2026-10-10',
  })
  @IsDateString({}, { message: 'incurredOn must be an ISO date such as YYYY-MM-DD' })
  incurredOn!: string;

  @ApiPropertyOptional({
    description: 'Free-form note describing the expense',
    example: 'Lunch with team',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({
    description: 'How the expense was settled',
    example: 'CARD',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  paymentMethod?: string;

  @ApiPropertyOptional({
    description:
      'Turn this expense into the first occurrence of a recurring rule in one step. The saved expense is linked to the new rule as a confirmed occurrence.',
    type: () => RecurrenceInputDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceInputDto)
  recurrence?: RecurrenceInputDto;
}
