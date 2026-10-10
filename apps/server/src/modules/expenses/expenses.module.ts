import { Module } from '@nestjs/common';
import { RatesModule } from '../rates/rates.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesReportsService } from './expenses-reports.service';
import { CurrencyConverterService } from './currency-converter.service';

@Module({
  imports: [RatesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesReportsService, CurrencyConverterService],
  exports: [CurrencyConverterService],
})
export class ExpensesModule {}
