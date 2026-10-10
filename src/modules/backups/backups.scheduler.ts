import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupsService } from './backups.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BackupsCleanupScheduler {
  private readonly logger = new Logger(BackupsCleanupScheduler.name);

  constructor(
    private readonly backupsService: BackupsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Runs hourly to prune abandoned pending uploads and expired refresh sessions
   */
  @Cron('0 * * * *') // Hourly at minute 0
  async handleCleanupJob(): Promise<void> {
    this.logger.log('Starting hourly cleanup job for expired sessions and abandoned uploads...');

    try {
      // 1. Clean abandoned pending backup uploads
      const prunedBackups = await this.backupsService.cleanupAbandonedUploads();
      if (prunedBackups > 0) {
        this.logger.log(`Pruned ${prunedBackups} abandoned pending backup uploads`);
      }

      // 2. Clean expired refresh token sessions
      const now = new Date();
      const expiredSessionsResult = await this.prisma.refreshSession.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });

      if (expiredSessionsResult.count > 0) {
        this.logger.log(`Pruned ${expiredSessionsResult.count} expired refresh token sessions`);
      }
    } catch (err) {
      this.logger.error(
        `Cleanup job encountered error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
