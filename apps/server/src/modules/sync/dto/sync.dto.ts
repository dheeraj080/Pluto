import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const SYNC_ENTITIES = ['expense'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const SYNC_OPERATIONS = ['create', 'update', 'delete'] as const;
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

export const SYNC_STATUSES = ['applied', 'skipped', 'failed'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

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
 * One queued mutation replayed from the device.
 *
 * `clientUpdatedAt` is the device's logical clock and is the sole arbiter of
 * last-write-wins: the server only applies a change strictly newer than the
 * stored `clientUpdatedAt`, which makes replaying the queue idempotent.
 */
export class SyncChangeDto {
  @ApiProperty({ enum: SYNC_ENTITIES, example: 'expense' })
  @IsIn(SYNC_ENTITIES)
  entity!: SyncEntity;

  @ApiProperty({
    description: 'Client-generated UUID; doubles as the canonical expense id',
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
    description: 'Required for create/update, ignored for delete',
    type: SyncExpensePayloadDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SyncExpensePayloadDto)
  data?: SyncExpensePayloadDto;
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
