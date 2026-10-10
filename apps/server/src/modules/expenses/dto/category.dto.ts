import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Unique category name within the account',
    example: 'Groceries',
    maxLength: 40,
  })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ description: 'Hex colour used in charts', example: '#f59e0b' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ description: 'Optional icon key', example: 'utensils', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Groceries', maxLength: 40 })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ description: 'Hex colour used in charts', example: '#f59e0b' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 'utensils', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;

  @ApiPropertyOptional({ description: 'Display order, ascending', example: 30, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
