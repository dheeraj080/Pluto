import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  async getHealth(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}
