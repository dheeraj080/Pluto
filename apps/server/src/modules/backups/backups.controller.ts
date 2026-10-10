import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BackupsService } from './backups.service';
import { InitiateBackupDto } from './dto/initiate-backup.dto';
import { BackupPaginationQueryDto } from './dto/backup-query.dto';
import {
  InitiateBackupResponseDto,
  BackupMetadataDto,
  DownloadBackupResponseDto,
  PaginatedBackupsResponseDto,
} from './dto/backup-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Backups')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate a new cloud backup upload',
    description:
      'Allocates the next sequential version for the user and generates a short-lived presigned S3 PUT URL for direct binary upload.',
  })
  @ApiResponse({
    status: 201,
    description: 'Backup initiated and presigned upload URL generated',
    type: InitiateBackupResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid metadata or checksum' })
  @ApiResponse({ status: 413, description: 'File size exceeds maximum quota' })
  async initiateBackup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateBackupDto,
  ): Promise<InitiateBackupResponseDto> {
    return this.backupsService.initiateBackup(user.id, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify and finalize an uploaded backup snapshot',
    description:
      'Verifies the binary object exists in S3, checks size, marks backup COMPLETED, and prunes older backups according to user retention limits.',
  })
  @ApiResponse({
    status: 200,
    description: 'Backup verified and completed',
    type: BackupMetadataDto,
  })
  @ApiResponse({ status: 400, description: 'File not found in storage or invalid status' })
  @ApiResponse({ status: 403, description: 'Forbidden - not owned by caller' })
  @ApiResponse({ status: 404, description: 'Backup record not found' })
  async completeBackup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BackupMetadataDto> {
    return this.backupsService.completeBackup(user.id, id);
  }

  @Get()
  @ApiOperation({
    summary: 'List completed backup snapshots',
    description:
      'Returns a paginated list of completed cloud backup snapshots belonging to the authenticated user, ordered from newest to oldest.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of completed backup snapshots',
    type: PaginatedBackupsResponseDto,
  })
  async listBackups(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BackupPaginationQueryDto,
  ): Promise<PaginatedBackupsResponseDto> {
    return this.backupsService.listUserBackups(user.id, query);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Get presigned download URL for a completed backup',
    description:
      'Generates a secure, short-lived presigned GET URL for downloading the private backup snapshot from object storage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned download URL generated',
    type: DownloadBackupResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not owned by caller' })
  @ApiResponse({ status: 404, description: 'Backup record not found' })
  async getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DownloadBackupResponseDto> {
    return this.backupsService.getDownloadUrl(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a backup snapshot',
    description:
      'Permanently deletes the backup metadata record and the corresponding binary object in S3.',
  })
  @ApiResponse({ status: 200, description: 'Backup deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not owned by caller' })
  async deleteBackup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.backupsService.deleteBackup(user.id, id);
  }
}
