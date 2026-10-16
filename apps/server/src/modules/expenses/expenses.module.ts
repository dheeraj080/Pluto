import { Module } from '@nestjs/common';
import { CurrencyModule } from '../../common/currency/currency.module';
import { RatesModule } from '../rates/rates.module';
import { ExpensesController } from './expenses.controller';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesReportsService } from './expenses-reports.service';
import { RecurringExpensesService } from './recurring-expenses.service';
import { CurrencyConverterService } from './currency-converter.service';

@Module({
  imports: [RatesModule, CurrencyModule],
  // RecurringExpensesController first: its `/expenses/recurring` prefix must be
  // matched before the `/expenses/:id` routes in ExpensesController.
  controllers: [RecurringExpensesController, ExpensesController],
  providers: [
    ExpensesService,
    ExpensesReportsService,
    RecurringExpensesService,
    CurrencyConverterService,
  ],
  exports: [CurrencyConverterService],
})
export class ExpensesModule {}
