import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService, HealthCheckResult } from './health.service';

import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness: is the process up and able to serve HTTP? Deliberately touches
   * no dependencies — pointing an orchestrator's *liveness* probe at a check
   * that fails when Postgres is down would restart healthy instances during a
   * database outage instead of merely draining them.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe: process is up (no dependency checks)' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  getLiveness(): { status: 'ok'; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness: can this instance actually serve traffic? Depends on the
   * database, so it returns 503 when the dependency is unreachable. Use this
   * for load-balancer / deploy traffic gates and *readiness* probes.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe: database reachable, instance can serve traffic' })
  @ApiResponse({ status: 200, description: 'Instance is ready' })
  @ApiResponse({ status: 503, description: 'Dependency (database) unavailable' })
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResult> {
    const result = await this.healthService.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get application and database health status' })
  @ApiResponse({
    status: 200,
    description: 'System health check details',
    schema: {
      example: {
        success: true,
        data: {
          status: 'ok',
          timestamp: '2026-10-09T03:45:00.000Z',
          uptime: 12.34,
          environment: 'development',
          database: {
            status: 'connected',
            latencyMs: 3,
          },
        },
        timestamp: '2026-10-09T03:45:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Dependency (database) unavailable',
  })
  async getHealth(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResult> {
    const result = await this.healthService.check();
    // A degraded instance must fail the platform / orchestrator health check,
    // otherwise traffic keeps being routed to an API that cannot reach Postgres.
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
