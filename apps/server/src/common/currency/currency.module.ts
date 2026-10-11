import { Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';

/**
 * Currency validation and metadata shared by rates, expenses and users.
 *
 * `CurrencyService` is cheap, stateless and reads only configuration, so it is
 * safe to import from every feature module that touches currency.
 */
@Module({
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
