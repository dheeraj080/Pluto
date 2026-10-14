import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { BackupStatus, UserRole } from '@prisma/client';

export class AdminUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  backupCount!: number;

  @ApiProperty()
  activeSessionCount!: number;
}

export class AdminSessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  userAgent!: string | null;

  @ApiProperty({ nullable: true, type: String })
  ipAddress!: string | null;

  @ApiProperty()
  isRevoked!: boolean;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}

export class AdminBackupDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  userEmail!: string;

  @ApiProperty()
  sequenceNumber!: number;

  @ApiProperty()
  schemaVersion!: string;

  @ApiProperty()
  appVersion!: string;

  @ApiProperty({ description: 'File size in bytes (serialized as a plain number)' })
  fileSizeBytes!: number;

  @ApiProperty()
  checksumSha256!: string;

  @ApiProperty({ enum: BackupStatus })
  status!: BackupStatus;

  @ApiProperty({ nullable: true, type: Date })
  completedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AdminUserDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  backupCount!: number;

  @ApiProperty()
  activeSessionCount!: number;

  @ApiProperty({ type: [AdminSessionDto], description: 'Newest 20 refresh sessions' })
  sessions!: AdminSessionDto[];

  @ApiProperty({ type: [AdminBackupDto], description: 'Newest 20 backups' })
  backups!: AdminBackupDto[];
}

export class PaginatedAdminUsersDto {
  @ApiProperty({ type: [AdminUserSummaryDto] })
  items!: AdminUserSummaryDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}

export class PaginatedAdminBackupsDto {
  @ApiProperty({ type: [AdminBackupDto] })
  items!: AdminBackupDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}

export class AdminRateSnapshotSummaryDto {
  @ApiProperty()
  version!: number;

  @ApiProperty()
  baseCurrency!: string;

  @ApiProperty()
  effectiveDate!: Date;

  @ApiProperty()
  fetchedAt!: Date;
}

export class AdminStatsDto {
  @ApiProperty()
  totalUsers!: number;

  @ApiProperty({ description: 'Completed backup snapshots' })
  totalBackups!: number;

  @ApiProperty({ description: 'Sum of completed backup sizes in bytes' })
  totalStorageBytes!: number;

  @ApiProperty({ description: 'Unrevoked, unexpired refresh sessions' })
  activeSessions!: number;

  @ApiProperty({
    nullable: true,
    type: AdminRateSnapshotSummaryDto,
    allOf: [{ $ref: getSchemaPath(AdminRateSnapshotSummaryDto) }],
  })
  lastRateSnapshot!: AdminRateSnapshotSummaryDto | null;
}

export class AdminLockDto {
  @ApiProperty()
  lockName!: string;

  @ApiProperty()
  lockedUntil!: Date;

  @ApiProperty()
  lockedBy!: string;

  @ApiProperty()
  updatedAt!: Date;
}

export class AdminRateSnapshotDto {
  @ApiProperty()
  version!: number;

  @ApiProperty()
  baseCurrency!: string;

  @ApiProperty()
  effectiveDate!: Date;

  @ApiProperty()
  fetchedAt!: Date;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ description: 'True once the snapshot is live for clients' })
  isPublished!: boolean;

  @ApiProperty()
  etag!: string;

  @ApiProperty({ description: 'Number of exchange rates in this snapshot' })
  rateCount!: number;
}

export class ActionResultDto {
  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  message?: string;
}
