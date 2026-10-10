import { Controller, Get, Query, Req, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RatesService } from './rates.service';
import { LatestRatesQueryDto } from './dto/latest-rates-query.dto';
import {
  RateSnapshotResponseDto,
  SupportedCurrencyDto,
  RateSnapshotVersionDto,
} from './dto/rates-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Rates')
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

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
