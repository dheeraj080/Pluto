import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { BackupsModule } from '../backups/backups.module';
import { CurrencyModule } from '../../common/currency/currency.module';

@Module({
  imports: [AuthModule, BackupsModule, CurrencyModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
