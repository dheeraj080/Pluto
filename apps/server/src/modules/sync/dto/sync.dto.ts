import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { Type, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  validateSync,
  type ValidationArguments,
} from 'class-validator';

export const SYNC_ENTITIES = ['expense', 'budget', 'category'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const SYNC_OPERATIONS = ['create', 'update', 'delete'] as const;
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const SYNC_STATUSES = ['applied', 'skipped', 'failed'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

/** Mirrors the Prisma `BudgetPeriod` enum; kept local so the DTO owns its enum. */
export const BUDGET_PERIODS = ['MONTHLY', 'YEARLY'] as const;
export type BudgetPeriodValue = (typeof BUDGET_PERIODS)[number];

/**
 * The full state of an expense as held by the device.
 *
 * Sync is "whole row wins": the device is the primary writer, so a push carries
 * the complete record rather than a diff. A newer push simply replaces the row.
 */
export class SyncExpensePayloadDto {
  @ApiProperty({
    description: 'Identifier of an expense category owned by the caller',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ description: 'Amount in the expense currency', example: 12.5, minimum: 0.01 })
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
  @Length(3, 3)
  currency!: string;

  @ApiPropertyOptional({ example: 'Lunch with team', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ example: 'CARD', nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string | null;

  @ApiProperty({ description: 'Date the expense was incurred', example: '2026-10-10' })
  @IsDateString()
  incurredOn!: string;

  @ApiPropertyOptional({
    description: 'The recurring rule that generated this expense, if any',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  recurringExpenseId?: string | null;
}

/**
 * The full state of a budget as held by the device.
 *
 * `update` on the REST API accepts only the amount and start date, but sync is
 * whole-row-wins like expenses: the device always sends every field so a single
 * `create`/`update` mutation converges regardless of what changed.
 */
export class SyncBudgetPayloadDto {
  @ApiPropertyOptional({
    description: 'Category to budget for; omit (or null) for an overall budget',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiProperty({ description: 'Budget limit in `currency`', example: 400 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ enum: BUDGET_PERIODS, example: 'MONTHLY' })
  @IsIn(BUDGET_PERIODS)
  period!: BudgetPeriodValue;

  @ApiProperty({
    description: 'First day the budget applies, inclusive',
    example: '2026-10-01',
  })
  @IsDateString()
  startDate!: string;
}

/**
 * The full state of a category as held by the device.
 *
 * Whole-row wins like the others: a rename carries the colour, icon and order
 * too, so one mutation converges regardless of what changed. `isDefault` and
 * `expenseCount` are absent deliberately — the first is server-owned (seeded
 * defaults) and the second is a count, not a field anyone writes.
 */
export class SyncCategoryPayloadDto {
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
  icon?: string | null;

  @ApiPropertyOptional({ description: 'Display order, ascending', example: 30, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * Validates `SyncChangeDto.data` against the payload class `entity` selects.
 *
 * The payload shape depends on the discriminated `entity` field, which a single
 * `@ValidateNested()` cannot express. Re-validating here keeps the whole batch's
 * 400 behaviour — a malformed payload is a client bug, not a per-op failure.
 */
@ValidatorConstraint({ name: 'syncChangeData', async: false })
class SyncChangeDataConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const { entity } = args.object as SyncChangeDto;
    const payloadClass: new () => object =
      entity === 'budget'
        ? SyncBudgetPayloadDto
        : entity === 'category'
          ? SyncCategoryPayloadDto
          : SyncExpensePayloadDto;
    const instance = plainToInstance(payloadClass, value);
    return validateSync(instance, { whitelist: true, forbidNonWhitelisted: true }).length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return `data must be a valid '${(args.object as SyncChangeDto).entity}' payload`;
  }
}

/**
 * One queued mutation replayed from the device.
 *
 * `clientUpdatedAt` is the device's logical clock and is the sole arbiter of
 * last-write-wins: the server only applies a change strictly newer than the
 * stored `clientUpdatedAt`, which makes replaying the queue idempotent.
 *
 * `@ApiExtraModels` forces both payload shapes into `components.schemas`; the
 * `oneOf` below references them by `$ref` and would otherwise leave them out.
 */
@ApiExtraModels(SyncExpensePayloadDto, SyncBudgetPayloadDto, SyncCategoryPayloadDto)
export class SyncChangeDto {
  @ApiProperty({ enum: SYNC_ENTITIES, example: 'expense' })
  @IsIn(SYNC_ENTITIES)
  entity!: SyncEntity;

  @ApiProperty({
    description: 'Client-generated UUID; doubles as the canonical entity id',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: SYNC_OPERATIONS, example: 'create' })
  @IsIn(SYNC_OPERATIONS)
  op!: SyncOperation;

  @ApiProperty({
    description: 'Device-side modification time',
    example: '2026-10-10T08:15:00.000Z',
  })
  @IsDateString()
  clientUpdatedAt!: string;

  @ApiPropertyOptional({
    description:
      'Required for create/update, ignored for delete; an expense, budget or category payload, by `entity`',
    oneOf: [
      { $ref: getSchemaPath(SyncExpensePayloadDto) },
      { $ref: getSchemaPath(SyncBudgetPayloadDto) },
      { $ref: getSchemaPath(SyncCategoryPayloadDto) },
    ],
  })
  @IsOptional()
  @IsObject()
  @Validate(SyncChangeDataConstraint)
  data?: SyncExpensePayloadDto | SyncBudgetPayloadDto | SyncCategoryPayloadDto;
}

export class SyncPushDto {
  @ApiProperty({ type: [SyncChangeDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SyncChangeDto)
  changes!: SyncChangeDto[];
}

export class SyncPushResultDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ enum: SYNC_STATUSES, example: 'applied' })
  status!: SyncStatus;

  @ApiPropertyOptional({ example: 'stale', nullable: true, type: String })
  reason?: string;

  @ApiPropertyOptional({ example: '2026-10-10T09:00:00.000Z', nullable: true, type: String })
  serverUpdatedAt?: string;
}

export class SyncPushResponseDto {
  @ApiProperty({ type: [SyncPushResultDto] })
  results!: SyncPushResultDto[];

  @ApiProperty({
    description: 'Opaque cursor to pass as `since` on the next pull',
    example: '2026-10-10T09:00:00.000Z',
  })
  cursor!: string;
}

export class SyncPullQueryDto {
  @ApiPropertyOptional({
    description: 'Return changes strictly after this ISO timestamp; omit for a full snapshot',
    example: '2026-10-10T09:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  since?: string;
}

/**
 * An expense row as mirrored to a device, including tombstones.
 *
 * A non-null `deletedAt` is a deletion tombstone: the device removes the row
 * locally rather than resurrecting it on its next push.
 */
export class SyncedExpenseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ example: 'b2f1c3de-1111-2222-3333-444455556666' })
  categoryId!: string;

  @ApiProperty({ example: 12.5 })
  amount!: number;

  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  currency!: string;

  @ApiPropertyOptional({ example: 'Lunch with team', nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ example: '2026-10-10' })
  incurredOn!: string;

  @ApiPropertyOptional({ example: 'CARD', nullable: true, type: String })
  paymentMethod!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true, type: String })
  recurringExpenseId!: string | null;

  @ApiProperty({ example: '2026-10-10T08:15:00.000Z' })
  clientUpdatedAt!: string;

  @ApiProperty({ example: '2026-10-10T09:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: null, nullable: true, type: String })
  deletedAt!: string | null;
}

export class SyncPullResponseDto {
  @ApiProperty({ type: [SyncedExpenseDto] })
  expenses!: SyncedExpenseDto[];

  @ApiProperty({
    description: 'Opaque cursor to pass as `since` on the next pull',
    example: '2026-10-10T09:00:00.000Z',
  })
  cursor!: string;

  @ApiProperty({
    description: 'True when more rows are waiting; pull again with the returned cursor',
    example: false,
  })
  hasMore!: boolean;
}

/** Raw cursor handed out for an empty dataset so callers never send `undefined`. */
export const SYNC_EPOCH = new Date(0).toISOString();
