import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { AdminUserListQueryDto, AdminBackupListQueryDto } from './dto/admin-query.dto';
import {
  ActionResultDto,
  AdminLockDto,
  AdminRateSnapshotDto,
  AdminStatsDto,
  AdminUserDetailDto,
  PaginatedAdminBackupsDto,
  PaginatedAdminUsersDto,
} from './dto/admin-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Aggregated dashboard statistics',
    description:
      'Total users, completed backups, storage usage, active sessions, and the latest published rate snapshot.',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved', type: AdminStatsDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async getStats(): Promise<AdminStatsDto> {
    return this.adminService.getStats();
  }

  @Get('locks')
  @ApiOperation({
    summary: 'List distributed scheduler locks',
    description: 'Shows cron locks (rates sync, backup cleanup) and their expiry.',
  })
  @ApiResponse({ status: 200, description: 'Locks retrieved', type: [AdminLockDto] })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async listLocks(): Promise<AdminLockDto[]> {
    return this.adminService.listLocks();
  }

  @Get('rates')
  @ApiOperation({
    summary: 'List rate snapshot history',
    description:
      'Newest-first snapshot history including publish state — doubles as the daily sync / provider health history.',
  })
  @ApiResponse({ status: 200, description: 'Snapshots retrieved', type: [AdminRateSnapshotDto] })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async listRateSnapshots(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<AdminRateSnapshotDto[]> {
    return this.adminService.listRateSnapshots(Math.min(Math.max(limit, 1), 100));
  }

  @Get('users')
  @ApiOperation({
    summary: 'List all users',
    description: 'Paginated user list with backup and active-session counts; supports search.',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved', type: PaginatedAdminUsersDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async listUsers(@Query() query: AdminUserListQueryDto): Promise<PaginatedAdminUsersDto> {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Get user detail with sessions and backups',
    description:
      'Returns the profile, the 20 newest refresh sessions (token hashes excluded), and the 20 newest backups.',
  })
  @ApiResponse({ status: 200, description: 'User detail retrieved', type: AdminUserDetailDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserDetail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetailDto> {
    return this.adminService.getUserDetail(id);
  }

  @Delete('users/:id')
  @ApiOperation({
    summary: 'Delete a user account',
    description:
      'Permanently deletes the user, their backups (storage objects included), and sessions. Self-deletion is rejected.',
  })
  @ApiResponse({ status: 200, description: 'User deleted', type: ActionResultDto })
  @ApiResponse({ status: 400, description: 'Self-deletion attempted' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ActionResultDto> {
    if (actor.id === id) {
      throw new BadRequestException('You cannot delete your own account from the admin panel');
    }
    return this.adminService.deleteUser(id);
  }

  @Delete('users/:id/sessions/:sessionId')
  @ApiOperation({
    summary: 'Revoke a user session',
    description: 'Marks the refresh session as revoked, signing that device out.',
  })
  @ApiResponse({ status: 200, description: 'Session revoked', type: ActionResultDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<ActionResultDto> {
    return this.adminService.revokeSession(id, sessionId);
  }

  @Get('backups')
  @ApiOperation({
    summary: 'List backups across all users',
    description: 'Paginated, newest first; optionally filter by status.',
  })
  @ApiResponse({ status: 200, description: 'Backups retrieved', type: PaginatedAdminBackupsDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async listBackups(@Query() query: AdminBackupListQueryDto): Promise<PaginatedAdminBackupsDto> {
    return this.adminService.listBackups(query);
  }

  @Delete('backups/:id')
  @ApiOperation({
    summary: 'Delete any backup',
    description: 'Removes the storage object and the metadata record on behalf of the owner.',
  })
  @ApiResponse({ status: 200, description: 'Backup deleted', type: ActionResultDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  async deleteBackup(@Param('id', ParseUUIDPipe) id: string): Promise<ActionResultDto> {
    return this.adminService.deleteBackup(id);
  }
}
