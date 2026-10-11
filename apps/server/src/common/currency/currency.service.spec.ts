import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CURRENCY_REGISTRY, isKnownCurrencyCode, normalizeCurrencyCode } from './currency.registry';

describe('currency.registry', () => {
  it('normalises case and whitespace', () => {
    expect(normalizeCurrencyCode('  thb ')).toBe('THB');
    expect(normalizeCurrencyCode('thb')).toBe('THB');
  });

  it('rejects structural non-codes', () => {
    expect(normalizeCurrencyCode('TH')).toBeNull();
    expect(normalizeCurrencyCode('THBA')).toBeNull();
    expect(normalizeCurrencyCode('')).toBeNull();
    expect(normalizeCurrencyCode('12$')).toBeNull();
  });

  it('distinguishes known codes from every three-letter string', () => {
    expect(isKnownCurrencyCode('VND')).toBe(true);
    expect(isKnownCurrencyCode('THB')).toBe(true);
    expect(isKnownCurrencyCode('XYZ')).toBe(false);
    expect(isKnownCurrencyCode('ABC')).toBe(false);
  });
});

describe('CurrencyService', () => {
  let service: CurrencyService;

  async function build(env: Record<string, unknown>): Promise<CurrencyService> {
    const config: ConfigService = {
      get: jest.fn((key: string, def: unknown) => (key in env ? env[key] : def)),
    } as never;
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrencyService, { provide: ConfigService, useValue: config }],
    }).compile();
    return module.get(CurrencyService);
  }

  it('defaults to the expanded provider-backed reporting set', async () => {
    service = await build({});
    expect(service.supportedReportingCurrencies).toContain('THB');
    expect(service.supportedReportingCurrencies).toContain('KRW');
    // VND stays recordable but is not convertible.
    expect(service.supportedReportingCurrencies).not.toContain('VND');
    expect(service.defaultReportingCurrency).toBe('USD');
  });

  it('parses a configured list and drops unknown codes', async () => {
    service = await build({ SUPPORTED_CURRENCIES: 'USD,thb,XYZ,AED' });
    expect(service.supportedReportingCurrencies).toEqual(['USD', 'THB', 'AED']);
  });

  it('assertValid accepts a valid but unconvertible code', async () => {
    service = await build({});
    expect(service.assertValid(' vnd ')).toBe('VND');
    expect(service.isValid('THB')).toBe(true);
  });

  it('assertValid rejects structural junk', async () => {
    service = await build({});
    expect(() => service.assertValid('X')).toThrow(BadRequestException);
    expect(() => service.assertValid('ZZZ')).toThrow(BadRequestException);
  });

  it('assertSupportedReporting is stricter than recording validity', async () => {
    service = await build({ SUPPORTED_CURRENCIES: 'USD,EUR' });
    // Valid ISO code but not in the configured reporting universe.
    expect(() => service.assertSupportedReporting('VND')).toThrow(BadRequestException);
    expect(service.isSupportedReporting('EUR')).toBe(true);
    expect(service.assertSupportedReporting(' eur ')).toBe('EUR');
  });

  it('provides metadata with a graceful fallback', async () => {
    service = await build({});
    expect(service.meta('THB')).toMatchObject({ name: 'Thai Baht', symbol: '฿' });
    expect(service.meta('ZZZ')).toMatchObject({ name: 'ZZZ', symbol: 'ZZZ' });
  });

  it('every supported reporting code exists in the registry', async () => {
    service = await build({});
    expect(
      service.supportedReportingCurrencies.every((c) => CURRENCY_REGISTRY[c] !== undefined),
    ).toBe(true);
  });
});
