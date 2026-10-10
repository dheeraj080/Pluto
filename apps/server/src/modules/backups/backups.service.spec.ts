import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, PayloadTooLargeException } from '@nestjs/common';
import { BackupStatus } from '@prisma/client';
import { BackupsService } from './backups.service';
import { StorageService } from './storage/storage.service';
import { PrismaService } from '../../database/prisma.service';

describe('BackupsService', () => {
  let backupsService: BackupsService;

  const mockPrismaService = {
    backup: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }
      return Promise.all(callback);
    }),
  };

  const mockStorageService = {
    generatePresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.local/upload-url'),
    generatePresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.local/download-url'),
    headObject: jest.fn(),
    verifyObjectChecksum: jest.fn(),
    copyObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'BACKUP_MAX_SIZE_BYTES') return 10485760; // 10MB
      if (key === 'BACKUP_RETENTION_COUNT') return 2; // Retain max 2
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    backupsService = module.get<BackupsService>(BackupsService);
    jest.clearAllMocks();
  });

  it('should initiate backup and return sequential version with presigned upload URL targeting staging', async () => {
    mockPrismaService.backup.findFirst.mockResolvedValue({ sequenceNumber: 4 });
    mockPrismaService.backup.create.mockResolvedValue({
      id: 'backup-uuid-5',
      sequenceNumber: 5,
    });
    mockPrismaService.backup.update.mockResolvedValue({
      id: 'backup-uuid-5',
      sequenceNumber: 5,
      storageKey: 'backups/user-1/backup-uuid-5.snap',
    });

    const result = await backupsService.initiateBackup('user-1', {
      schemaVersion: '1.0.0',
      appVersion: '2.0.0',
      expectedSizeBytes: 500000,
      checksumSha256: 'a'.repeat(64),
    });

    expect(result.backupId).toBe('backup-uuid-5');
    expect(result.sequenceNumber).toBe(5);
    expect(result.uploadUrl).toBe('https://s3.local/upload-url');
    expect(mockStorageService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      'backups/user-1/staging/backup-uuid-5.bin',
      900,
    );
  });

  it('should reject backup initiation when expected size exceeds quota', async () => {
    await expect(
      backupsService.initiateBackup('user-1', {
        schemaVersion: '1.0.0',
        appVersion: '2.0.0',
        expectedSizeBytes: 20000000, // 20MB > 10MB
        checksumSha256: 'a'.repeat(64),
      }),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('should verify storage object and complete backup successfully with checksum check and staging copy', async () => {
    mockPrismaService.backup.findUnique.mockResolvedValue({
      id: 'backup-uuid-1',
      userId: 'user-1',
      status: BackupStatus.PENDING,
      storageKey: 'backups/user-1/backup-uuid-1.snap',
      checksumSha256: 'a'.repeat(64),
      sequenceNumber: 1,
    });

    // Staging head returns positive content
    mockStorageService.headObject.mockResolvedValue({
      contentLength: 500000,
    });

    mockStorageService.verifyObjectChecksum.mockResolvedValue({
      matches: true,
      actualChecksumSha256: 'a'.repeat(64),
      actualBytes: 500000,
    });

    mockPrismaService.backup.update.mockResolvedValue({
      id: 'backup-uuid-1',
      userId: 'user-1',
      status: BackupStatus.COMPLETED,
      sequenceNumber: 1,
      schemaVersion: '1.0.0',
      appVersion: '2.0.0',
      fileSizeBytes: BigInt(500000),
      checksumSha256: 'a'.repeat(64),
      completedAt: new Date(),
      createdAt: new Date(),
    });

    mockPrismaService.backup.findMany.mockResolvedValue([]); // For retention prune check

    const result = await backupsService.completeBackup('user-1', 'backup-uuid-1');

    expect(result.status).toBe(BackupStatus.COMPLETED);
    expect(result.fileSizeBytes).toBe(500000);
    expect(mockStorageService.verifyObjectChecksum).toHaveBeenCalledWith(
      'backups/user-1/staging/backup-uuid-1.bin',
      'a'.repeat(64),
    );
    expect(mockStorageService.copyObject).toHaveBeenCalledWith(
      'backups/user-1/staging/backup-uuid-1.bin',
      'backups/user-1/backup-uuid-1.snap',
    );
  });

  it('should reject completion and mark backup FAILED when checksum does not match', async () => {
    mockPrismaService.backup.findUnique.mockResolvedValue({
      id: 'backup-uuid-1',
      userId: 'user-1',
      status: BackupStatus.PENDING,
      storageKey: 'backups/user-1/backup-uuid-1.snap',
      checksumSha256: 'a'.repeat(64),
      sequenceNumber: 1,
    });

    mockStorageService.headObject.mockResolvedValue({
      contentLength: 500000,
    });

    mockStorageService.verifyObjectChecksum.mockResolvedValue({
      matches: false, // Checksum mismatch!
      actualChecksumSha256: 'b'.repeat(64),
      actualBytes: 500000,
    });

    await expect(backupsService.completeBackup('user-1', 'backup-uuid-1')).rejects.toThrow(
      'Uploaded object SHA-256 checksum does not match expected checksum',
    );

    expect(mockPrismaService.backup.update).toHaveBeenCalledWith({
      where: { id: 'backup-uuid-1' },
      data: { status: BackupStatus.FAILED },
    });
  });

  it('should reject completion when pending backup has expired', async () => {
    mockPrismaService.backup.findUnique.mockResolvedValue({
      id: 'backup-uuid-1',
      userId: 'user-1',
      status: BackupStatus.PENDING,
      expiresAt: new Date(Date.now() - 60000), // Expired!
      storageKey: 'backups/user-1/backup-uuid-1.snap',
    });

    await expect(backupsService.completeBackup('user-1', 'backup-uuid-1')).rejects.toThrow(
      'Pending backup upload has expired',
    );

    expect(mockPrismaService.backup.update).toHaveBeenCalledWith({
      where: { id: 'backup-uuid-1' },
      data: { status: BackupStatus.FAILED },
    });
  });

  it('should be idempotent and return existing metadata when backup is already COMPLETED', async () => {
    const existingBackup = {
      id: 'backup-uuid-1',
      userId: 'user-1',
      status: BackupStatus.COMPLETED,
      sequenceNumber: 1,
      schemaVersion: '1.0.0',
      appVersion: '2.0.0',
      fileSizeBytes: BigInt(500000),
      checksumSha256: 'a'.repeat(64),
      completedAt: new Date(),
      createdAt: new Date(),
      storageKey: 'backups/user-1/backup-uuid-1.snap',
    };

    mockPrismaService.backup.findUnique.mockResolvedValue(existingBackup);

    const result = await backupsService.completeBackup('user-1', 'backup-uuid-1');

    expect(result.status).toBe(BackupStatus.COMPLETED);
    // Should NOT call verifyObjectChecksum again
    expect(mockStorageService.verifyObjectChecksum).not.toHaveBeenCalled();
  });

  it('should forbid completing another user backup', async () => {
    mockPrismaService.backup.findUnique.mockResolvedValue({
      id: 'backup-uuid-1',
      userId: 'user-victim',
      status: BackupStatus.PENDING,
    });

    await expect(backupsService.completeBackup('user-attacker', 'backup-uuid-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should forbid downloading another user backup', async () => {
    mockPrismaService.backup.findUnique.mockResolvedValue({
      id: 'backup-uuid-1',
      userId: 'user-victim',
      status: BackupStatus.COMPLETED,
    });

    await expect(backupsService.getDownloadUrl('user-attacker', 'backup-uuid-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should prune older backups when count exceeds retention quota', async () => {
    // 3 backups exist, retention count is 2
    mockPrismaService.backup.findMany.mockResolvedValue([
      { id: 'b-3', sequenceNumber: 3, storageKey: 'key-3' },
      { id: 'b-2', sequenceNumber: 2, storageKey: 'key-2' },
      { id: 'b-1', sequenceNumber: 1, storageKey: 'key-1' }, // Oldest to prune
    ]);

    await backupsService.pruneUserBackups('user-1');

    expect(mockStorageService.deleteObject).toHaveBeenCalledWith('key-1');
    expect(mockPrismaService.backup.delete).toHaveBeenCalledWith({ where: { id: 'b-1' } });
  });
});
