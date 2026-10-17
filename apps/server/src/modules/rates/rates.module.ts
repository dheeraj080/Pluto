import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RatesService } from './rates.service';
import { RatesController } from './rates.controller';
import { RatesScheduler } from './rates.scheduler';
import { IExchangeRateProvider } from './interfaces/exchange-rate-provider.interface';
import { EXCHANGE_RATE_PROVIDER } from './providers/provider.token';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import { MockExchangeRateProvider } from './providers/mock.provider';

/**
 * Chooses the concrete exchange-rate provider from `EXCHANGE_RATE_PROVIDER`.
 *
 * - `frankfurter` — default; Frankfurter v2 (blended central-bank rates,
 *   ~148 currencies). Storage is canonical-base (USD by default).
 * - `mock`        — deterministic offline rates for dev/demo/tests.
 * - `exchangerate_host` — intentionally NOT implemented: throwing at bootstrap
 *   (fail fast) is deliberate. Nothing may silently fall back to another
 *   provider, so an unsupported selection must refuse to boot rather than
 *   serve rates the operator did not opt into.
 */
export const rateProviderFactory: Provider = {
  provide: EXCHANGE_RATE_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): IExchangeRateProvider => {
    const name = (
      configService.get<string>('EXCHANGE_RATE_PROVIDER', 'frankfurter') || 'frankfurter'
    ).toLowerCase();

    switch (name) {
      case 'frankfurter':
        return new FrankfurterProvider(configService);
      case 'mock':
        return new MockExchangeRateProvider();
      case 'exchangerate_host':
        throw new Error(
          "exchange rate provider 'exchangerate_host' is not implemented. " +
            'Select EXCHANGE_RATE_PROVIDER=frankfurter (default) or =mock for offline development.',
        );
      default:
        throw new Error(`Unknown EXCHANGE_RATE_PROVIDER '${name}'. Supported: frankfurter, mock.`);
    }
  },
};

@Module({
  controllers: [RatesController],
  providers: [RatesService, RatesScheduler, rateProviderFactory],
  exports: [RatesService],
})
export class RatesModule {}
