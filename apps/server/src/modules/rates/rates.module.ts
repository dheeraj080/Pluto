import { Module } from '@nestjs/common';
import { RatesService } from './rates.service';
import { RatesController } from './rates.controller';
import { RatesScheduler } from './rates.scheduler';
import { FrankfurterProvider } from './providers/frankfurter.provider';

@Module({
  controllers: [RatesController],
  providers: [RatesService, RatesScheduler, FrankfurterProvider],
  exports: [RatesService],
})
export class RatesModule {}
