import { ApiProperty } from '@nestjs/swagger';
import { BackupStatus } from '@prisma/client';

export class BackupMetadataDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ example: 3, description: 'Monotonically increasing sequence number per user' })
  sequenceNumber!: number;

  @ApiProperty({ example: '1.0.0' })
  schemaVersion!: string;

  @ApiProperty({ example: '1.2.0' })
  appVersion!: string;

  @ApiProperty({ example: 2048576, description: 'File size in bytes' })
  fileSizeBytes!: number;

  @ApiProperty({ example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  checksumSha256!: string;

  @ApiProperty({ enum: BackupStatus, example: BackupStatus.COMPLETED })
  status!: BackupStatus;

  @ApiProperty({ example: '2026-10-09T05:00:00.000Z', nullable: true, type: Date })
  completedAt!: Date | null;

  @ApiProperty({ example: '2026-10-09T04:55:00.000Z' })
  createdAt!: Date;
}

export class InitiateBackupResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  backupId!: string;

  @ApiProperty({ example: 3 })
  sequenceNumber!: number;

  @ApiProperty({
    description: 'Short-lived presigned S3 PUT URL for direct binary upload',
    example:
      'https://s3.amazonaws.com/pluto-backups/backups/user-id/backup-id.snap?AWSAccessKeyId=...',
  })
  uploadUrl!: string;

  @ApiProperty({ example: 900, description: 'Presigned upload URL expiry in seconds' })
  expiresInSeconds!: number;

  @ApiProperty({ example: '2026-10-09T05:15:00.000Z' })
  expiresAt!: Date;
}

export class DownloadBackupResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  backupId!: string;

  @ApiProperty({ example: 3 })
  sequenceNumber!: number;

  @ApiProperty({
    description: 'Short-lived presigned S3 GET URL for direct binary download',
    example:
      'https://s3.amazonaws.com/pluto-backups/backups/user-id/backup-id.snap?AWSAccessKeyId=...',
  })
  downloadUrl!: string;

  @ApiProperty({ example: 900, description: 'Presigned download URL expiry in seconds' })
  expiresInSeconds!: number;

  @ApiProperty({ example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  checksumSha256!: string;

  @ApiProperty({ example: 2048576 })
  fileSizeBytes!: number;
}

export class PaginatedBackupsResponseDto {
  @ApiProperty({ type: [BackupMetadataDto] })
  items!: BackupMetadataDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;
}
