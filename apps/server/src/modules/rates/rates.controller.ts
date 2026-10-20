import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RatesService } from './rates.service';
import { RatesScheduler } from './rates.scheduler';
import { LatestRatesQueryDto } from './dto/latest-rates-query.dto';
import { RateHistoryQueryDto } from './dto/rate-history-query.dto';
import { RateTablesQueryDto } from './dto/rate-tables-query.dto';
import {
  RateSnapshotResponseDto,
  SupportedCurrencyDto,
  RateSnapshotVersionDto,
  RateHistoryResponseDto,
  RateTableDto,
} from './dto/rates-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RatesSyncGuard } from './guards/rates-sync.guard';

@ApiTags('Rates')
@Controller('rates')
export class RatesController {
  constructor(
    private readonly ratesService: RatesService,
    private readonly ratesScheduler: RatesScheduler,
  ) {}

  /**
   * External trigger for the daily rate sync.
   *
   * The in-process cron (`EXCHANGE_RATE_SCHEDULE`) is the primary path, but it
   * only fires on a running instance: a platform that spins an idle service down
   * executes no crons, and every converted report figure depends on a current
   * snapshot. This route is the reliable trigger for that case — a scheduled
   * GitHub Actions job (see `.github/workflows/rates-sync.yml`) or any caller
   * that can send `X-Sync-Token`.
   *
   * `@Public()` detaches the global JwtAuthGuard because a scheduler holds no
   * user session; `RatesSyncGuard` replaces it with the shared-secret check and
   * 404s when `RATES_SYNC_TOKEN` is unset. The run is delegated to the scheduler
   * so it takes the same database-backed `SystemLock` as the cron: a trigger that
   * arrives while the cron is mid-sync is a no-op, not a concurrent second sync.
   */
  @Public()
  @UseGuards(RatesSyncGuard)
  @Post('sync')
  // A trigger creates no resource and may legitimately be a no-op (the cron
  // holds the lock), so 200 is the honest status — Nest would default to 201,
  // which the external workflow would report as a failure.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger the exchange-rate sync from outside the process',
    description:
      'Runs the same locked sync as the daily cron. Requires the X-Sync-Token header (or a Bearer token) matching RATES_SYNC_TOKEN; returns 404 when no token is configured and 401 when it does not match. Used by the scheduled external trigger where an idle instance runs no crons.',
  })
  @ApiResponse({ status: 200, description: 'Sync attempted (per-run outcome logged)' })
  @ApiResponse({ status: 401, description: 'Missing or invalid sync token' })
  @ApiResponse({ status: 404, description: 'External sync is not configured' })
  async triggerSync(): Promise<{ triggered: boolean; message: string }> {
    await this.ratesScheduler.runLockedSync('external-trigger');
    return {
      triggered: true,
      message: 'Exchange rate sync attempted; see the server logs for the outcome',
    };
  }

  @Public()
  @Get('latest')
  @ApiOperation({
    summary: 'Get latest published exchange rate snapshot',
    description:
      'Returns the latest validated exchange rate snapshot for the requested base currency (default USD). Supports HTTP ETags for 304 Not Modified caching.',
  })
  @ApiResponse({
    status: 200,
    description: 'Latest exchange rate snapshot',
    type: RateSnapshotResponseDto,
  })
  @ApiResponse({ status: 304, description: 'Not Modified (ETag match)' })
  @ApiResponse({ status: 400, description: 'Unsupported base currency' })
  async getLatestRates(
    @Query() query: LatestRatesQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.ratesService.getLatestRates(query.base);

    // ETag caching check
    const clientIfNoneMatch = req.headers['if-none-match'];
    if (clientIfNoneMatch && clientIfNoneMatch === data.etag) {
      res.status(HttpStatus.NOT_MODIFIED).send();
      return;
    }

    res.setHeader('ETag', data.etag);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.status(HttpStatus.OK).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  @Public()
  @Get('supported-currencies')
  @ApiOperation({
    summary: 'List supported currencies',
    description: 'Returns the list of supported ISO 4217 currencies along with names and symbols.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of supported currencies',
    type: [SupportedCurrencyDto],
  })
  getSupportedCurrencies(): SupportedCurrencyDto[] {
    return this.ratesService.getSupportedCurrencies();
  }

  @Public()
  @Get('history')
  @ApiOperation({
    summary: 'Exchange-rate history between two currencies',
    description:
      'Returns one point per published snapshot in the range, oldest first. Defaults to the trailing twelve months when no range is given.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rate history information',
    type: RateHistoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Unsupported currency or malformed date' })
  async getRateHistory(@Query() query: RateHistoryQueryDto): Promise<RateHistoryResponseDto> {
    return this.ratesService.getRateHistory(query);
  }

  @Public()
  @Get('tables')
  @ApiOperation({
    summary: 'List immutable rate snapshots over a bounded window',
    description:
      'Returns the latest published rate table before `from` plus every table in `[from, to]` (default: the trailing 90 days), oldest first. Clients mirror this window on-device so report conversion works offline; older dates fall back to the online report endpoints.',
  })
  @ApiResponse({
    status: 200,
    description: 'Point-in-time rate tables',
    type: [RateTableDto],
  })
  @ApiResponse({ status: 400, description: 'Unsupported base currency or malformed window' })
  async getRateTables(@Query() query: RateTablesQueryDto): Promise<RateTableDto[]> {
    return this.ratesService.getRateTables(query);
  }

  @Public()
  @Get('versions')
  @ApiOperation({
    summary: 'List historical published rate versions',
    description: 'Returns version metadata for recent published exchange rate snapshots.',
  })
  @ApiResponse({
    status: 200,
    description: 'Historical published versions',
    type: [RateSnapshotVersionDto],
  })
  async getVersions(): Promise<RateSnapshotVersionDto[]> {
    return this.ratesService.getVersions();
  }
}
