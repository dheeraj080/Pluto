import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from './storage/storage.service';
import { InitiateBackupDto } from './dto/initiate-backup.dto';
import { BackupPaginationQueryDto } from './dto/backup-query.dto';
import {
  InitiateBackupResponseDto,
  BackupMetadataDto,
  DownloadBackupResponseDto,
  PaginatedBackupsResponseDto,
} from './dto/backup-response.dto';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly maxSizeBytes: number;
  private readonly retentionCount: number;
  private readonly uploadUrlTtl: number;
  private readonly downloadUrlTtl: number;
  private readonly pendingExpiryHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.maxSizeBytes = this.configService.get<number>(
      'BACKUP_MAX_SIZE_BYTES',
      52428800, // 50MB
    );
    this.retentionCount = this.configService.get<number>('BACKUP_RETENTION_COUNT', 5);
    this.uploadUrlTtl = this.configService.get<number>('BACKUP_UPLOAD_URL_TTL', 900);
    this.downloadUrlTtl = this.configService.get<number>('BACKUP_DOWNLOAD_URL_TTL', 900);
    this.pendingExpiryHours = this.configService.get<number>('BACKUP_PENDING_EXPIRY_HOURS', 24);
  }

  /**
   * Initiates a pending backup session and issues a short-lived presigned upload URL
   */
  async initiateBackup(userId: string, dto: InitiateBackupDto): Promise<InitiateBackupResponseDto> {
    if (dto.expectedSizeBytes > this.maxSizeBytes) {
      throw new PayloadTooLargeException(
        `Backup file size (${dto.expectedSizeBytes} bytes) exceeds the maximum allowed limit of ${this.maxSizeBytes} bytes`,
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.pendingExpiryHours);

    // Atomically allocate per-user sequence number and create pending backup
    const backup = await this.prisma.$transaction(async (tx) => {
      // Row lock on the user record to prevent race conditions on concurrent sequence allocation
      if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === 'function') {
        await (tx as { $queryRaw: (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> })
          .$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`.catch(() => {});
      }

      const lastBackup = await tx.backup.findFirst({
        where: { userId },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true },
      });

      const nextSequence = (lastBackup?.sequenceNumber || 0) + 1;
      const placeholderKey = `backups/${userId}/pending-${Date.now()}`;

      const created = await tx.backup.create({
        data: {
          userId,
          sequenceNumber: nextSequence,
          schemaVersion: dto.schemaVersion,
          appVersion: dto.appVersion,
          storageKey: placeholderKey,
          checksumSha256: dto.checksumSha256.toLowerCase(),
          fileSizeBytes: BigInt(dto.expectedSizeBytes),
          status: BackupStatus.PENDING,
          expiresAt,
        },
      });

      // Update storage key with concrete backup ID
      const finalStorageKey = `backups/${userId}/${created.id}.snap`;
      return tx.backup.update({
        where: { id: created.id },
        data: { storageKey: finalStorageKey },
      });
    });

    // Generate presigned upload URL targeting a dedicated staging key to protect completed backups from overwrite
    const stagingKey = `backups/${userId}/staging/${backup.id}.bin`;
    const uploadUrl = await this.storageService.generatePresignedUploadUrl(
      stagingKey,
      this.uploadUrlTtl,
    );

    this.logger.log(
      `Backup initiated: user=${userId}, backupId=${backup.id}, seq=#${backup.sequenceNumber}`,
    );

    return {
      backupId: backup.id,
      sequenceNumber: backup.sequenceNumber,
      uploadUrl,
      expiresInSeconds: this.uploadUrlTtl,
      expiresAt,
    };
  }

  /**
   * Verifies uploaded content in object storage and finalizes snapshot
   */
  async completeBackup(userId: string, backupId: string): Promise<BackupMetadataDto> {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup record not found');
    }

    if (backup.userId !== userId) {
      throw new ForbiddenException('Access denied: You do not own this backup snapshot');
    }

    // Idempotent return if already completed
    if (backup.status === BackupStatus.COMPLETED) {
      return this.toMetadataDto(backup);
    }

    if (backup.status !== BackupStatus.PENDING) {
      throw new BadRequestException(
        `Cannot complete backup with status '${backup.status}'. Expected 'PENDING'.`,
      );
    }

    // Check expiration on pending backup
    if (backup.expiresAt && new Date() > backup.expiresAt) {
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { status: BackupStatus.FAILED },
      });
      throw new BadRequestException(
        'Pending backup upload has expired. Please initiate a new backup.',
      );
    }

    // Check object in staging or direct storage
    const stagingKey = `backups/${userId}/staging/${backup.id}.bin`;
    const stagingHead = await this.storageService.headObject(stagingKey);
    const sourceKey = stagingHead && stagingHead.contentLength > 0 ? stagingKey : backup.storageKey;

    const head =
      stagingHead && stagingHead.contentLength > 0
        ? stagingHead
        : await this.storageService.headObject(sourceKey);

    if (!head || head.contentLength <= 0) {
      throw new BadRequestException(
        'Uploaded backup file was not found in object storage. Ensure binary upload finished before calling complete.',
      );
    }

    // Server-side SHA-256 checksum and data integrity verification
    const integrityCheck = await this.storageService.verifyObjectChecksum(
      sourceKey,
      backup.checksumSha256,
    );

    if (!integrityCheck.matches) {
      this.logger.warn(
        `Backup checksum mismatch for backupId=${backupId}: expected=${backup.checksumSha256}, actual=${integrityCheck.actualChecksumSha256}`,
      );
      await this.storageService.deleteObject(sourceKey).catch(() => {});
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { status: BackupStatus.FAILED },
      });
      throw new BadRequestException(
        'Uploaded object SHA-256 checksum does not match expected checksum',
      );
    }

    // Verify file size within tolerance
    const actualBytes = BigInt(integrityCheck.actualBytes || head.contentLength);
    if (actualBytes > BigInt(this.maxSizeBytes)) {
      await this.storageService.deleteObject(sourceKey).catch(() => {});
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { status: BackupStatus.FAILED },
      });
      throw new PayloadTooLargeException('Actual uploaded file exceeds size quota');
    }

    // If object was in staging, promote to final storage key to prevent subsequent overwrite
    if (sourceKey !== backup.storageKey) {
      await this.storageService.copyObject(sourceKey, backup.storageKey);
      await this.storageService.deleteObject(sourceKey).catch(() => {});
    }

    // Update to COMPLETED
    const completedBackup = await this.prisma.backup.update({
      where: { id: backupId },
      data: {
        status: BackupStatus.COMPLETED,
        fileSizeBytes: actualBytes,
        completedAt: new Date(),
        expiresAt: null, // Clear pending expiration
      },
    });

    this.logger.log(
      `Backup completed successfully: user=${userId}, backupId=${backupId}, seq=#${completedBackup.sequenceNumber}, size=${actualBytes} bytes`,
    );

    // Enforce retention limit for the user (best-effort after successful completion)
    try {
      await this.pruneUserBackups(userId);
    } catch (error) {
      this.logger.error(
        `Failed to prune backups after completing backup ${backupId} for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return this.toMetadataDto(completedBackup);
  }

  /**
   * Lists completed backups belonging to the authenticated user
   */
  async listUserBackups(
    userId: string,
    query: BackupPaginationQueryDto,
  ): Promise<PaginatedBackupsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.backup.findMany({
        where: {
          userId,
          status: BackupStatus.COMPLETED,
        },
        orderBy: { sequenceNumber: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.backup.count({
        where: {
          userId,
          status: BackupStatus.COMPLETED,
        },
      }),
    ]);

    return {
      items: items.map((b) => this.toMetadataDto(b)),
      page,
      limit,
      total,
    };
  }

  /**
   * Generates a short-lived download URL for an owned completed backup
   */
  async getDownloadUrl(userId: string, backupId: string): Promise<DownloadBackupResponseDto> {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup snapshot not found');
    }

    if (backup.userId !== userId) {
      throw new ForbiddenException('Access denied: You do not own this backup snapshot');
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new BadRequestException('Cannot download backup that is not completed');
    }

    const downloadUrl = await this.storageService.generatePresignedDownloadUrl(
      backup.storageKey,
      this.downloadUrlTtl,
    );

    this.logger.log(`Generated download URL for user=${userId}, backupId=${backupId}`);

    return {
      backupId: backup.id,
      sequenceNumber: backup.sequenceNumber,
      downloadUrl,
      expiresInSeconds: this.downloadUrlTtl,
      checksumSha256: backup.checksumSha256,
      fileSizeBytes: Number(backup.fileSizeBytes),
    };
  }

  /**
   * Deletes an owned backup and its object in private storage
   */
  async deleteBackup(
    userId: string,
    backupId: string,
  ): Promise<{ success: boolean; message: string }> {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      // Idempotent deletion
      return { success: true, message: 'Backup deleted successfully' };
    }

    if (backup.userId !== userId) {
      throw new ForbiddenException('Access denied: You do not own this backup snapshot');
    }

    // Delete object from storage. If S3 fails, the DB record is retained so deletion can be retried.
    await this.storageService.deleteObject(backup.storageKey);

    // Clean up staging object if pending
    const stagingKey = `backups/${userId}/staging/${backup.id}.bin`;
    await this.storageService.deleteObject(stagingKey).catch(() => {});

    // Delete record from database
    await this.prisma.backup.delete({
      where: { id: backupId },
    });

    this.logger.log(`Deleted backup: user=${userId}, backupId=${backupId}`);

    return { success: true, message: 'Backup snapshot deleted successfully' };
  }

  /**
   * Prunes oldest completed backups for a user exceeding retention quota
   */
  async pruneUserBackups(userId: string): Promise<void> {
    const completedBackups = await this.prisma.backup.findMany({
      where: {
        userId,
        status: BackupStatus.COMPLETED,
      },
      orderBy: { sequenceNumber: 'desc' },
      select: { id: true, storageKey: true, sequenceNumber: true },
    });

    if (completedBackups.length <= this.retentionCount) {
      return;
    }

    const backupsToPrune = completedBackups.slice(this.retentionCount);

    // Safety: Never prune the last valid recovery point if retentionCount is 0 or something unexpected
    if (backupsToPrune.length >= completedBackups.length && this.retentionCount > 0) {
      this.logger.warn(
        `Refusing to prune backups for user ${userId}: would remove all ${completedBackups.length} completed backups while retentionCount=${this.retentionCount}`,
      );
      return;
    }

    // If retentionCount is 0, we still must not delete everything blindly; treat as no-op for safety
    if (this.retentionCount <= 0) {
      this.logger.warn(
        `Retention count is ${this.retentionCount}; refusing to prune any backups for user ${userId} as a safety measure`,
      );
      return;
    }

    this.logger.log(
      `Retention policy: Pruning ${backupsToPrune.length} older backups for user ${userId} (retaining latest ${this.retentionCount})`,
    );

    for (const b of backupsToPrune) {
      try {
        await this.storageService.deleteObject(b.storageKey);
        await this.prisma.backup.delete({ where: { id: b.id } });
      } catch (error) {
        this.logger.error(
          `Failed to delete pruned backup ${b.id} for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
        // Continue with remaining backups rather than failing the entire operation
      }
    }
  }

  /**
   * Cleans up abandoned pending uploads past their expiration time
   */
  async cleanupAbandonedUploads(): Promise<number> {
    const now = new Date();
    const abandoned = await this.prisma.backup.findMany({
      where: {
        status: BackupStatus.PENDING,
        expiresAt: { lt: now },
      },
      take: 100,
    });

    if (abandoned.length === 0) return 0;

    this.logger.log(`Cleaning up ${abandoned.length} expired pending backup uploads`);

    for (const b of abandoned) {
      const stagingKey = `backups/${b.userId}/staging/${b.id}.bin`;
      await this.storageService.deleteObject(b.storageKey).catch(() => {});
      await this.storageService.deleteObject(stagingKey).catch(() => {});
      await this.prisma.backup.delete({ where: { id: b.id } }).catch(() => {});
    }

    return abandoned.length;
  }

  private toMetadataDto(backup: {
    id: string;
    sequenceNumber: number;
    schemaVersion: string;
    appVersion: string;
    fileSizeBytes: bigint;
    checksumSha256: string;
    status: BackupStatus;
    completedAt: Date | null;
    createdAt: Date;
  }): BackupMetadataDto {
    return {
      id: backup.id,
      sequenceNumber: backup.sequenceNumber,
      schemaVersion: backup.schemaVersion,
      appVersion: backup.appVersion,
      fileSizeBytes: Number(backup.fileSizeBytes),
      checksumSha256: backup.checksumSha256,
      status: backup.status,
      completedAt: backup.completedAt,
      createdAt: backup.createdAt,
    };
  }
}
