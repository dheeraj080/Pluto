import { Module } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { BackupsController } from './backups.controller';
import { StorageService } from './storage/storage.service';
import { BackupsCleanupScheduler } from './backups.scheduler';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BackupsController],
  providers: [BackupsService, StorageService, BackupsCleanupScheduler],
  exports: [BackupsService, StorageService],
})
export class BackupsModule {}
