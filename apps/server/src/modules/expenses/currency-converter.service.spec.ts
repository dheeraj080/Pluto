import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrencyConverter, CurrencyConverterService, round2 } from './currency-converter.service';
import { CurrencyService } from '../../common/currency/currency.service';
import { RatesService } from '../rates/rates.service';

const SNAPSHOT = {
  USD: '1.000000',
  EUR: '0.920000',
  GBP: '0.780000',
  JPY: '152.000000',
};

describe('round2', () => {
  it('rounds half up to two decimals', () => {
    expect(round2(10.869565)).toBe(10.87);
    expect(round2(1)).toBe(1);
    expect(round2(0.005)).toBe(0.01);
  });
});

describe('CurrencyConverter', () => {
  const converter = new CurrencyConverter('USD', SNAPSHOT, '2026-10-09');

  it('exposes the base currency and supported list', () => {
    expect(converter.baseCurrency).toBe('USD');
    expect(converter.supports('eur')).toBe(true);
    expect(converter.supports('XYZ')).toBe(false);
    expect(converter.supportedCurrencies).toEqual(['EUR', 'GBP', 'JPY', 'USD']);
  });

  it('treats same-currency conversion as identity', () => {
    expect(converter.convert(123.45, 'USD')).toBe(123.45);
    expect(converter.convertBetween(123.45, 'USD', 'USD')).toBe(123.45);
  });

  it('converts into the base by dividing by the quoted rate', () => {
    // 1 USD = 0.92 EUR, so 92 EUR is 100 USD.
    expect(converter.convert(92, 'EUR')).toBe(100);
    // 1 USD = 0.78 GBP, so 78 GBP is 100 USD.
    expect(converter.convert(78, 'GBP')).toBe(100);
  });

  it('cross-converts between two non-base currencies via the shared base', () => {
    // 1 USD = 0.92 EUR and 1 USD = 0.78 GBP, so 78 GBP = 92 EUR.
    expect(converter.convertBetween(78, 'GBP', 'EUR')).toBe(92);
    // Inverse of the above.
    expect(converter.convertBetween(92, 'EUR', 'GBP')).toBe(78);
  });

  it('cross-converts from a non-base currency into the base', () => {
    expect(converter.convertBetween(92, 'EUR', 'USD')).toBe(100);
  });

  it('rounds cross-converted values to two decimals', () => {
    // 10 EUR -> base JPY: 10 / 0.92 * 152 = 1652.17...
    expect(converter.convertBetween(10, 'EUR', 'JPY')).toBe(1652.17);
  });

  it('convertBetweenOrNull returns null instead of throwing on a missing rate', () => {
    expect(converter.convertBetweenOrNull(10, 'XYZ', 'USD')).toBeNull();
    expect(converter.convertBetweenOrNull(10, 'USD', 'XYZ')).toBeNull();
    expect(converter.convertBetweenOrNull(10, 'USD', 'USD')).toBe(10);
  });

  it('is case-insensitive on the source currency', () => {
    expect(converter.convert(92, 'eur')).toBe(converter.convert(92, 'EUR'));
  });

  it('rounds converted values to two decimals', () => {
    // 10 / 0.92 = 10.8695...
    expect(converter.convert(10, 'EUR')).toBe(10.87);
    // 10 / 152 = 0.0657...
    expect(converter.convert(10, 'JPY')).toBe(0.07);
  });

  it('handles sub-unit amounts without floating point drift', () => {
    expect(converter.convert(0.01, 'EUR')).toBe(0.01);
  });

  it('rejects a currency missing from the snapshot', () => {
    expect(() => converter.convert(10, 'XYZ')).toThrow(BadRequestException);
    expect(() => converter.convert(10, 'XYZ')).toThrow(/No XYZ rate/);
    expect(() => converter.convertBetween(10, 'XYZ', 'USD')).toThrow(/No XYZ->USD rate/);
  });

  it('inserts an identity rate when the snapshot omits its own base row', () => {
    const withoutBase = new CurrencyConverter('USD', { EUR: '0.92' });
    expect(withoutBase.convert(50, 'USD')).toBe(50);
    expect(withoutBase.supports('USD')).toBe(true);
  });

  it('normalises an uppercase base currency', () => {
    const lowerBase = new CurrencyConverter('usd', SNAPSHOT);
    expect(lowerBase.baseCurrency).toBe('usd');
    expect(lowerBase.convert(50, 'USD')).toBe(50);
  });

  it('accepts Decimal instances directly', () => {
    expect(converter.convert(new Prisma.Decimal('92.00'), 'EUR')).toBe(100);
  });
});

describe('CurrencyConverterService', () => {
  let service: CurrencyConverterService;

  const mockRatesService = {
    getSupportedCurrencies: jest.fn(),
    getLatestRates: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
  };

  const mockCurrencyService = {
    supportedReportingCurrencies: ['USD', 'EUR', 'JPY'],
    defaultReportingCurrency: 'USD',
    assertValid: jest.fn(),
    assertSupportedReporting: jest.fn(),
    isValid: jest.fn(),
    normalize: jest.fn(),
    meta: jest.fn((code: string) => ({ name: code, symbol: code, decimals: 2 })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Must be configured before compile(): the service reads these in its constructor.
    mockRatesService.getSupportedCurrencies.mockReturnValue([
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'JPY', name: 'Yen', symbol: '¥' },
    ]);
    mockConfigService.get.mockImplementation((key: string, defaultValue: unknown) => defaultValue);
    mockCurrencyService.assertValid.mockImplementation((currency: string) => {
      const code = currency.trim().toUpperCase();
      if (!['USD', 'EUR', 'JPY', 'THB', 'VND'].includes(code)) {
        throw new BadRequestException(`'${currency}' is not a valid ISO 4217 currency code`);
      }
      return code;
    });
    mockCurrencyService.assertSupportedReporting.mockImplementation((currency: string) => {
      const code = currency.trim().toUpperCase();
      if (!['USD', 'EUR', 'JPY'].includes(code)) {
        throw new BadRequestException(`Unsupported reporting currency '${currency}'`);
      }
      return code;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyConverterService,
        { provide: RatesService, useValue: mockRatesService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CurrencyService, useValue: mockCurrencyService },
      ],
    }).compile();

    service = module.get<CurrencyConverterService>(CurrencyConverterService);
  });

  it('reads the supported currency list from the currency module', () => {
    expect(
      new CurrencyConverterService(mockRatesService as never, mockCurrencyService as never)
        .supportedCurrencies,
    ).toEqual(['USD', 'EUR', 'JPY']);
  });

  it('assertSupported normalises case and whitespace', () => {
    expect(service.assertSupported(' eur ')).toBe('EUR');
  });

  it('assertSupported rejects unsupported codes', () => {
    expect(() => service.assertSupported('XYZ')).toThrow(BadRequestException);
    expect(() => service.assertSupported('XYZ')).toThrow(/Unsupported reporting currency 'XYZ'/);
  });

  it('assertValidCode accepts a valid code the provider cannot convert', () => {
    expect(service.assertValidCode(' thb ')).toBe('THB');
  });

  it('assertValidCode rejects a structural non-code', () => {
    expect(() => service.assertValidCode('XY')).toThrow(BadRequestException);
  });

  it('falls back to the configured default base', () => {
    expect(service.resolveBase()).toBe('USD');
    expect(service.resolveBase(undefined)).toBe('USD');
  });

  it('honours an explicit base override', () => {
    expect(service.resolveBase('jpy')).toBe('JPY');
  });

  it('rejects an unsupported explicit base', () => {
    expect(() => service.resolveBase('XYZ')).toThrow(BadRequestException);
  });

  it('builds a converter from the latest snapshot', async () => {
    mockRatesService.getLatestRates.mockResolvedValue({
      baseCurrency: 'USD',
      rates: SNAPSHOT,
      effectiveDate: '2026-10-09',
    });

    const converter = await service.getConverter('EUR');

    expect(mockRatesService.getLatestRates).toHaveBeenCalledWith('EUR');
    expect(converter.baseCurrency).toBe('USD');
    expect(converter.convert(92, 'EUR')).toBe(100);
  });

  it('tryGetConverter returns null instead of throwing when rates fail', async () => {
    mockRatesService.getLatestRates.mockRejectedValue(new Error('provider unreachable'));

    await expect(service.tryGetConverter()).resolves.toBeNull();
  });

  it('tryGetConverter propagates an unsupported base as an error before the lookup', async () => {
    await expect(service.tryGetConverter('XYZ')).rejects.toThrow(BadRequestException);
    expect(mockRatesService.getLatestRates).not.toHaveBeenCalled();
  });

  it('tryGetConverter returns a converter on success', async () => {
    mockRatesService.getLatestRates.mockResolvedValue({
      baseCurrency: 'USD',
      rates: SNAPSHOT,
      effectiveDate: '2026-10-09',
    });

    const converter = await service.tryGetConverter();
    expect(converter?.baseCurrency).toBe('USD');
  });
});
