import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { DevSeedService } from './dev-seed.service';

/**
 * Development-only helpers. Wired into the auth module purely so the mock
 * sign-in can populate a demo account; nothing here is reachable in
 * production (dev auth is refused there before seeding can run).
 */
@Module({
  imports: [ExpensesModule],
  providers: [DevSeedService],
  exports: [DevSeedService],
})
export class DevModule {}
