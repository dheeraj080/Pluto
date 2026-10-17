import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import {
  SyncPullQueryDto,
  SyncPullResponseDto,
  SyncPushDto,
  SyncPushResponseDto,
} from './dto/sync.dto';

/**
 * Offline-write reconciliation for the mobile client.
 *
 * The phone writes to its local store first and replays the queue here when a
 * connection returns; the client mirror is refreshed from the pull side.
 */
@ApiTags('Sync')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Replay queued offline changes',
    description:
      'Applies device changes idempotently by last-write-wins on clientUpdatedAt. Each change is independent, so one rejection does not fail the batch.',
  })
  @ApiResponse({ status: 200, description: 'Per-change outcomes', type: SyncPushResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed change payload' })
  async push(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncPushDto,
  ): Promise<SyncPushResponseDto> {
    return this.syncService.push(user.id, dto.changes);
  }

  @Get('pull')
  @ApiOperation({
    summary: 'Mirror server changes since a cursor',
    description:
      'Returns expenses modified after `since`, including deletion tombstones (non-null `deletedAt`). Omit `since` for a full snapshot on first install.',
  })
  @ApiResponse({
    status: 200,
    description: 'Changed expenses and the next cursor',
    type: SyncPullResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Malformed cursor' })
  async pull(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncPullResponseDto> {
    return this.syncService.pull(user.id, query.since);
  }
}
