import { ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';

export class UpdateExpenseDto {
  @ApiPropertyOptional({
    description: 'Identifier of an expense category owned by the caller',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Amount spent', example: 12.5, minimum: 0.01 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code',
    example: 'EUR',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Currency must be a 3-letter ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Date the expense was incurred', example: '2026-10-10' })
  @IsOptional()
  @IsDateString({}, { message: 'incurredOn must be an ISO date such as YYYY-MM-DD' })
  incurredOn?: string;

  @ApiPropertyOptional({
    description: 'Free-form note',
    example: 'Lunch with team',
    maxLength: 280,
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({
    description: 'How the expense was settled',
    example: 'CASH',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  paymentMethod?: string;
}
