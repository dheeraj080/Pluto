import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL database via Prisma');
    } catch (error) {
      // Deliberately keep booting rather than crashing: the process needs to
      // stay up so `/v1/health` can report the outage (it returns 503) and the
      // platform's health check stops routing traffic here. Crashing would turn
      // a database blip into a boot loop. Logged at error level so it is not
      // mistaken for a warning in production.
      this.logger.error(
        `Initial database connection failed: ${error instanceof Error ? error.message : String(error)}. Make sure PostgreSQL is running.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL database');
  }
}
