import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { RatesService } from './rates.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RatesScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RatesScheduler.name);
  private readonly instanceId: string;

  constructor(
    private readonly ratesService: RatesService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.instanceId = `${os.hostname()}-${process.pid}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async onApplicationBootstrap(): Promise<void> {
    // Initial rates check on boot
    try {
      const existing = await this.prisma.rateSnapshot.findFirst({
        where: { isPublished: true },
      });

      if (!existing) {
        this.logger.log(
          'No published exchange rate snapshots found on startup. Executing initial sync...',
        );
        await this.executeSyncWithLock();
      }
    } catch (err) {
      this.logger.warn(
        `Bootstrap rate sync check deferred: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Daily scheduled exchange rate sync (Default: 04:00 AM UTC)
   */
  @Cron(process.env.EXCHANGE_RATE_SCHEDULE || '0 4 * * *')
  async handleDailyRateSync(): Promise<void> {
    this.logger.log('Scheduled exchange rate sync triggered');
    await this.executeSyncWithLock();
  }

  /**
   * Safe execution with database-backed distributed lock
   */
  private async executeSyncWithLock(): Promise<void> {
    const lockName = 'exchange_rate_daily_sync';
    const lockDurationMinutes = 10;
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);

    const acquired = await this.acquireLock(lockName, lockExpiry);

    if (!acquired) {
      this.logger.log(
        `Skipping rate sync: Another instance holds the active lock for '${lockName}'.`,
      );
      return;
    }

    try {
      this.logger.log(
        `Lock acquired by ${this.instanceId}. Performing exchange rate synchronization...`,
      );
      await this.ratesService.syncExchangeRates();
    } catch (err) {
      this.logger.error(
        `Scheduled exchange rate sync failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await this.releaseLock(lockName);
    }
  }

  private async acquireLock(lockName: string, lockExpiry: Date): Promise<boolean> {
    try {
      const now = new Date();

      if (typeof this.prisma.$executeRaw === 'function') {
        // Atomic single-statement UPSERT with conditional UPDATE in PostgreSQL.
        // Prevents multiple concurrent application instances from simultaneously claiming an expired or missing lock.
        const affected = await this.prisma.$executeRaw`
          INSERT INTO system_locks ("lockName", "lockedUntil", "lockedBy", "updatedAt")
          VALUES (${lockName}, ${lockExpiry}, ${this.instanceId}, NOW())
          ON CONFLICT ("lockName") DO UPDATE
          SET "lockedUntil" = EXCLUDED."lockedUntil",
              "lockedBy" = EXCLUDED."lockedBy",
              "updatedAt" = NOW()
          WHERE system_locks."lockedUntil" < ${now}
        `;
        return affected > 0;
      }

      // Fallback for mock environments
      const currentLock = await this.prisma.systemLock.findUnique({
        where: { lockName },
      });

      if (!currentLock || currentLock.lockedUntil < now) {
        await this.prisma.systemLock.upsert({
          where: { lockName },
          create: {
            lockName,
            lockedUntil: lockExpiry,
            lockedBy: this.instanceId,
          },
          update: {
            lockedUntil: lockExpiry,
            lockedBy: this.instanceId,
          },
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private async releaseLock(lockName: string): Promise<void> {
    try {
      await this.prisma.systemLock.deleteMany({
        where: {
          lockName,
          lockedBy: this.instanceId,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to release lock '${lockName}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
