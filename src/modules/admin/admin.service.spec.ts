import { NotFoundException } from '@nestjs/common';
import { BackupStatus, UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { BackupsService } from '../backups/backups.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    $transaction: jest.Mock;
    user: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    refreshSession: { count: jest.Mock; updateMany: jest.Mock };
    backup: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; aggregate: jest.Mock };
    rateSnapshot: { findFirst: jest.Mock; findMany: jest.Mock };
    systemLock: { findMany: jest.Mock };
  };
  let usersService: { deleteAccount: jest.Mock };
  let backupsService: { deleteBackup: jest.Mock };

  beforeEach(() => {
    prisma = {
      // Array-form transaction: resolves the mocked prisma promises in order
      $transaction: jest.fn((promises: Promise<unknown>[]) => Promise.all(promises)),
      user: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      refreshSession: { count: jest.fn(), updateMany: jest.fn() },
      backup: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        aggregate: jest.fn(),
      },
      rateSnapshot: { findFirst: jest.fn(), findMany: jest.fn() },
      systemLock: { findMany: jest.fn() },
    };
    usersService = { deleteAccount: jest.fn() };
    backupsService = { deleteBackup: jest.fn() };

    service = new AdminService(
      prisma as unknown as PrismaService,
      usersService as unknown as UsersService,
      backupsService as unknown as BackupsService,
    );
  });

  describe('listUsers', () => {
    it('returns mapped users with counts and pagination', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          email: 'jane@example.com',
          name: 'Jane',
          avatarUrl: null,
          role: UserRole.ADMIN,
          createdAt: new Date('2026-01-01'),
          _count: { backups: 3, refreshSessions: 2 },
        },
      ]);

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'u1',
        email: 'jane@example.com',
        role: UserRole.ADMIN,
        backupCount: 3,
        activeSessionCount: 2,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('applies case-insensitive search across e-mail and name', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await service.listUsers({ page: 1, limit: 20, search: 'Jane' });

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'Jane', mode: 'insensitive' } },
            { name: { contains: 'Jane', mode: 'insensitive' } },
          ],
        },
      });
    });
  });

  describe('getUserDetail', () => {
    it('throws NotFoundException for unknown users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserDetail('missing')).rejects.toThrow(NotFoundException);
    });

    it('maps sessions without leaking token hashes and converts BigInt sizes', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'jane@example.com',
        name: 'Jane',
        avatarUrl: null,
        role: UserRole.USER,
        createdAt: new Date('2026-01-01'),
        _count: { backups: 1, refreshSessions: 1 },
        refreshSessions: [
          {
            id: 's1',
            tokenHash: 'super-secret-hash',
            userAgent: 'Mozilla/5.0',
            ipAddress: '10.0.0.1',
            isRevoked: false,
            expiresAt: new Date('2026-02-01'),
            createdAt: new Date('2026-01-01'),
          },
        ],
        backups: [
          {
            id: 'b1',
            userId: 'u1',
            sequenceNumber: 1,
            schemaVersion: '1.0.0',
            appVersion: '1.0.0',
            fileSizeBytes: 1048576n,
            checksumSha256: 'abc',
            status: BackupStatus.COMPLETED,
            completedAt: new Date(),
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.getUserDetail('u1');

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).not.toHaveProperty('tokenHash');
      expect(result.sessions[0].userAgent).toBe('Mozilla/5.0');
      expect(result.backups[0].fileSizeBytes).toBe(1048576);
      expect(typeof result.backups[0].fileSizeBytes).toBe('number');
      expect(result.backups[0].userEmail).toBe('jane@example.com');
    });
  });

  describe('deleteUser', () => {
    it('delegates to UsersService so storage + cascade are handled', async () => {
      usersService.deleteAccount.mockResolvedValue({ success: true, message: 'deleted' });

      const result = await service.deleteUser('u1');

      expect(usersService.deleteAccount).toHaveBeenCalledWith('u1');
      expect(result.success).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('revokes a session belonging to the user', async () => {
      prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeSession('u1', 's1');

      expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', userId: 'u1' },
        data: { isRevoked: true },
      });
      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when the session does not belong to the user', async () => {
      prisma.refreshSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeSession('u1', 'other')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBackup', () => {
    it('throws NotFoundException for unknown backups', async () => {
      prisma.backup.findUnique.mockResolvedValue(null);

      await expect(service.deleteBackup('missing')).rejects.toThrow(NotFoundException);
      expect(backupsService.deleteBackup).not.toHaveBeenCalled();
    });

    it('resolves the owner and delegates to BackupsService', async () => {
      prisma.backup.findUnique.mockResolvedValue({ userId: 'owner-1' });
      backupsService.deleteBackup.mockResolvedValue({ success: true, message: 'deleted' });

      const result = await service.deleteBackup('b1');

      expect(backupsService.deleteBackup).toHaveBeenCalledWith('owner-1', 'b1');
      expect(result.success).toBe(true);
    });
  });

  describe('getStats', () => {
    it('aggregates counts and converts BigInt storage sums to numbers', async () => {
      prisma.user.count.mockResolvedValue(7);
      prisma.refreshSession.count.mockResolvedValue(3);
      prisma.backup.aggregate.mockResolvedValue({
        _count: { _all: 12 },
        _sum: { fileSizeBytes: 20480n },
      });
      prisma.rateSnapshot.findFirst.mockResolvedValue({
        version: 42,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-09'),
        fetchedAt: new Date('2026-10-09T04:00:00Z'),
      });

      const stats = await service.getStats();

      expect(stats).toEqual({
        totalUsers: 7,
        totalBackups: 12,
        totalStorageBytes: 20480,
        activeSessions: 3,
        lastRateSnapshot: {
          version: 42,
          baseCurrency: 'USD',
          effectiveDate: new Date('2026-10-09'),
          fetchedAt: new Date('2026-10-09T04:00:00Z'),
        },
      });
    });
  });

  describe('listLocks', () => {
    it('returns mapped scheduler locks', async () => {
      prisma.systemLock.findMany.mockResolvedValue([
        {
          lockName: 'rates-sync',
          lockedUntil: new Date('2026-10-10T04:30:00Z'),
          lockedBy: 'worker-1',
          updatedAt: new Date('2026-10-10T04:00:00Z'),
        },
      ]);

      const locks = await service.listLocks();

      expect(locks).toHaveLength(1);
      expect(locks[0]).toEqual({
        lockName: 'rates-sync',
        lockedUntil: new Date('2026-10-10T04:30:00Z'),
        lockedBy: 'worker-1',
        updatedAt: new Date('2026-10-10T04:00:00Z'),
      });
    });
  });

  describe('listRateSnapshots', () => {
    it('returns newest-first snapshots with rate counts', async () => {
      prisma.rateSnapshot.findMany.mockResolvedValue([
        {
          version: 42,
          baseCurrency: 'USD',
          effectiveDate: new Date('2026-10-09'),
          fetchedAt: new Date('2026-10-09T04:00:00Z'),
          provider: 'frankfurter',
          isPublished: true,
          etag: 'W/"rates-42"',
          _count: { rates: 11 },
        },
      ]);

      const snapshots = await service.listRateSnapshots(20);

      expect(prisma.rateSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { version: 'desc' }, take: 20 }),
      );
      expect(snapshots[0]).toMatchObject({
        version: 42,
        isPublished: true,
        rateCount: 11,
        provider: 'frankfurter',
      });
    });
  });
});
