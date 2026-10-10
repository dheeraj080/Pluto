import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  database: {
    status: 'connected' | 'disconnected' | 'unreachable';
    latencyMs?: number;
    error?: string;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let dbStatus: 'connected' | 'disconnected' | 'unreachable' = 'disconnected';
    let dbLatency: number | undefined;
    let dbError: string | undefined;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
      dbLatency = Date.now() - startTime;
    } catch (err) {
      dbStatus = 'unreachable';
      this.logger.error(
        `Database health check query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      dbError =
        process.env.NODE_ENV === 'production'
          ? 'Database service unavailable'
          : err instanceof Error
            ? err.message
            : 'Database query failed';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        ...(dbLatency !== undefined ? { latencyMs: dbLatency } : {}),
        ...(dbError ? { error: dbError } : {}),
      },
    };
  }
}
