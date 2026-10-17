import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  // Reuses CurrencyConverterService so synced records are validated exactly like
  // records created through the online CRUD endpoints.
  imports: [ExpensesModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
