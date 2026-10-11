import { ConfigService } from '@nestjs/config';
import { rateProviderFactory, RatesModule } from './rates.module';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import { MockExchangeRateProvider } from './providers/mock.provider';
import { EXCHANGE_RATE_PROVIDER } from './providers/provider.token';

function configWith(providerValue: string): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'EXCHANGE_RATE_PROVIDER') return providerValue;
      return defaultValue;
    }),
  } as never;
}

describe('rateProviderFactory', () => {
  it('issues a FrankfurterProvider when EXCHANGE_RATE_PROVIDER=frankfurter', () => {
    const provider = (
      rateProviderFactory as {
        useFactory: (c: ConfigService) => unknown;
      }
    ).useFactory(configWith('frankfurter'));
    expect(provider).toBeInstanceOf(FrankfurterProvider);
  });

  it('issues the deterministic mock provider when EXCHANGE_RATE_PROVIDER=mock', () => {
    const provider = (
      rateProviderFactory as {
        useFactory: (c: ConfigService) => unknown;
      }
    ).useFactory(configWith('mock'));
    expect(provider).toBeInstanceOf(MockExchangeRateProvider);
  });

  it('fails fast for exchangerate_host (documented gap, no silent fallback)', () => {
    expect(() =>
      (rateProviderFactory as { useFactory: (c: ConfigService) => unknown }).useFactory(
        configWith('exchangerate_host'),
      ),
    ).toThrow(/exchangerate_host.*not implemented/i);
  });

  it('fails fast for an unknown provider value', () => {
    expect(() =>
      (rateProviderFactory as { useFactory: (c: ConfigService) => unknown }).useFactory(
        configWith('nonsense'),
      ),
    ).toThrow(/Unknown EXCHANGE_RATE_PROVIDER/);
  });

  it('defaults to frankfurter when the env var is unset', () => {
    const provider = (
      rateProviderFactory as {
        useFactory: (c: ConfigService) => unknown;
      }
    ).useFactory({
      get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
    } as never);
    expect(provider).toBeInstanceOf(FrankfurterProvider);
  });
});

describe('RatesModule wiring', () => {
  it('binds the factory to the EXCHANGE_RATE_PROVIDER token', () => {
    const providers = (Reflect.getMetadata('providers', RatesModule) ?? []) as unknown[];
    const factory = providers.find(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        (p as { provide?: unknown }).provide === EXCHANGE_RATE_PROVIDER,
    );
    expect(factory).toBeDefined();
  });
});

describe('MockExchangeRateProvider', () => {
  const provider = new MockExchangeRateProvider();

  it('quotes the requested base at exactly 1.0', async () => {
    const res = await provider.fetchLatestRates('THB');
    expect(res.rates['THB']).toBe(1.0);
    expect(res.baseCurrency).toBe('THB');
    expect(res.provider).toBe('mock');
  });

  it('is deterministic and covers the whole Frankfurter universe', async () => {
    const first = await provider.fetchLatestRates('EUR');
    const second = await provider.fetchLatestRates('EUR');
    expect(first.rates).toEqual(second.rates);
    for (const [currency, rate] of Object.entries(first.rates)) {
      expect(typeof rate).toBe('number');
      expect(Number.isFinite(rate)).toBe(true);
      expect(rate).toBeGreaterThan(0);
      expect(currency).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('rejects an unmapped base currency loudly', async () => {
    await expect(provider.fetchLatestRates('XYZ')).rejects.toThrow(/no reference rate/i);
  });
});
