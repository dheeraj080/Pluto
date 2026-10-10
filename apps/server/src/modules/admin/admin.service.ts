import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BackupStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { BackupsService } from '../backups/backups.service';
import { AdminUserListQueryDto, AdminBackupListQueryDto } from './dto/admin-query.dto';
import {
  AdminBackupDto,
  AdminLockDto,
  AdminRateSnapshotDto,
  AdminSessionDto,
  AdminStatsDto,
  AdminUserDetailDto,
  ActionResultDto,
  PaginatedAdminBackupsDto,
  PaginatedAdminUsersDto,
} from './dto/admin-response.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly backupsService: BackupsService,
  ) {}

  /**
   * Paginated list of all users with backup/session counts; optional
   * case-insensitive search across e-mail and display name.
   */
  async listUsers(query: AdminUserListQueryDto): Promise<PaginatedAdminUsersDto> {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const skip = (query.page - 1) * query.limit;

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              backups: true,
              refreshSessions: {
                where: { isRevoked: false, expiresAt: { gt: new Date() } },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        backupCount: user._count.backups,
        activeSessionCount: user._count.refreshSessions,
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  /**
   * Full user detail: profile, newest sessions (token hashes excluded), and
   * newest backups.
   */
  async getUserDetail(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            backups: true,
            refreshSessions: {
              where: { isRevoked: false, expiresAt: { gt: new Date() } },
            },
          },
        },
        refreshSessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        backups: {
          orderBy: { sequenceNumber: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
      backupCount: user._count.backups,
      activeSessionCount: user._count.refreshSessions,
      sessions: user.refreshSessions.map((session): AdminSessionDto => ({
        id: session.id,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        isRevoked: session.isRevoked,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      })),
      backups: user.backups.map((backup) => this.toAdminBackupDto(backup, user.email)),
    };
  }

  /**
   * Permanently deletes a user. Reuses UsersService.deleteAccount so S3
   * objects are cleaned up before the cascading database delete.
   */
  async deleteUser(userId: string): Promise<ActionResultDto> {
    this.logger.log(`Admin-initiated account deletion for user ${userId}`);
    return this.usersService.deleteAccount(userId);
  }

  /**
   * Revokes a single refresh session (logs the device out).
   */
  async revokeSession(userId: string, sessionId: string): Promise<ActionResultDto> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    });

    if (result.count === 0) {
      throw new NotFoundException('Session not found');
    }

    this.logger.log(`Admin revoked session ${sessionId} of user ${userId}`);
    return { success: true, message: 'Session revoked' };
  }

  /**
   * Paginated list of backups across all users, newest first.
   */
  async listBackups(query: AdminBackupListQueryDto): Promise<PaginatedAdminBackupsDto> {
    const where: Prisma.BackupWhereInput = query.status ? { status: query.status } : {};

    const skip = (query.page - 1) * query.limit;

    const [total, backups] = await this.prisma.$transaction([
      this.prisma.backup.count({ where }),
      this.prisma.backup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        select: {
          id: true,
          userId: true,
          sequenceNumber: true,
          schemaVersion: true,
          appVersion: true,
          fileSizeBytes: true,
          checksumSha256: true,
          status: true,
          completedAt: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    return {
      items: backups.map((backup) => this.toAdminBackupDto(backup, backup.user.email)),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  /**
   * Deletes a backup on behalf of its owner (storage object + metadata).
   * Ownership is resolved first so BackupsService keeps enforcing its
   * invariants (status checks, S3-first ordering, idempotency).
   */
  async deleteBackup(backupId: string): Promise<ActionResultDto> {
    const backup = await this.prisma.backup.findUnique({
      where: { id: backupId },
      select: { userId: true },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    this.logger.log(`Admin-initiated backup deletion ${backupId}`);
    return this.backupsService.deleteBackup(backup.userId, backupId);
  }

  /**
   * Aggregated overview for the admin dashboard.
   */
  async getStats(): Promise<AdminStatsDto> {
    const [totalUsers, activeSessions, backupAggregate, lastRateSnapshot] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.refreshSession.count({
          where: { isRevoked: false, expiresAt: { gt: new Date() } },
        }),
        this.prisma.backup.aggregate({
          where: { status: BackupStatus.COMPLETED },
          _count: { _all: true },
          _sum: { fileSizeBytes: true },
        }),
        this.prisma.rateSnapshot.findFirst({
          where: { isPublished: true },
          orderBy: { version: 'desc' },
          select: {
            version: true,
            baseCurrency: true,
            effectiveDate: true,
            fetchedAt: true,
          },
        }),
      ]);

    return {
      totalUsers,
      totalBackups: backupAggregate._count._all,
      totalStorageBytes: Number(backupAggregate._sum.fileSizeBytes ?? 0),
      activeSessions,
      lastRateSnapshot,
    };
  }

  /**
   * Distributed scheduler locks (rates sync, backup cleanup, ...).
   */
  async listLocks(): Promise<AdminLockDto[]> {
    const locks = await this.prisma.systemLock.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return locks.map((lock) => ({
      lockName: lock.lockName,
      lockedUntil: lock.lockedUntil,
      lockedBy: lock.lockedBy,
      updatedAt: lock.updatedAt,
    }));
  }

  /**
   * Rate snapshot history (newest first): published vs pending snapshots.
   * Each successful daily sync produces one snapshot — serving as the sync
   * history / provider health signal.
   */
  async listRateSnapshots(limit: number): Promise<AdminRateSnapshotDto[]> {
    const snapshots = await this.prisma.rateSnapshot.findMany({
      orderBy: { version: 'desc' },
      take: limit,
      select: {
        version: true,
        baseCurrency: true,
        effectiveDate: true,
        fetchedAt: true,
        provider: true,
        isPublished: true,
        etag: true,
        _count: { select: { rates: true } },
      },
    });

    return snapshots.map((snapshot) => ({
      version: snapshot.version,
      baseCurrency: snapshot.baseCurrency,
      effectiveDate: snapshot.effectiveDate,
      fetchedAt: snapshot.fetchedAt,
      provider: snapshot.provider,
      isPublished: snapshot.isPublished,
      etag: snapshot.etag,
      rateCount: snapshot._count.rates,
    }));
  }

  private toAdminBackupDto(
    backup: {
      id: string;
      userId: string;
      sequenceNumber: number;
      schemaVersion: string;
      appVersion: string;
      fileSizeBytes: bigint;
      checksumSha256: string;
      status: BackupStatus;
      completedAt: Date | null;
      createdAt: Date;
    },
    userEmail: string,
  ): AdminBackupDto {
    return {
      id: backup.id,
      userId: backup.userId,
      userEmail,
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
