import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService, HealthCheckResult } from './health.service';

import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

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
