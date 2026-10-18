/**
 * The registry is the single source of truth for currency metadata: the server
 * validates recorded codes against it, and the mobile app seeds its offline
 * `currencies` table from it, so its shape is pinned here.
 */
import { describe, expect, it } from 'vitest';

import {
  CURRENCY_REGISTRY,
  DEFAULT_SUPPORTED_CURRENCIES,
  getCurrencyMeta,
  isIsoCodeShape,
  isKnownCurrencyCode,
  normalizeCurrencyCode,
} from './currencies';

describe('CURRENCY_REGISTRY', () => {
  it('keys every entry with an uppercase three-letter ISO code', () => {
    for (const code of Object.keys(CURRENCY_REGISTRY)) {
      expect(code, `${code} is not an uppercase ISO 4217 shape`).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('gives every entry a name, a symbol and a plausible minor-unit exponent', () => {
    for (const [code, meta] of Object.entries(CURRENCY_REGISTRY)) {
      expect(meta.name.length, `${code} name`).toBeGreaterThan(0);
      expect(meta.symbol.length, `${code} symbol`).toBeGreaterThan(0);
      expect(meta.decimals, `${code} decimals`).toBeGreaterThanOrEqual(0);
      expect(meta.decimals, `${code} decimals`).toBeLessThanOrEqual(4);
    }
  });

  it('exposes the whole registry as the default convertible set', () => {
    expect([...DEFAULT_SUPPORTED_CURRENCIES]).toEqual(Object.keys(CURRENCY_REGISTRY));
  });

  it('contains the majors every picker expects to find', () => {
    expect(Object.keys(CURRENCY_REGISTRY)).toEqual(
      expect.arrayContaining(['USD', 'EUR', 'GBP', 'JPY', 'CNY']),
    );
  });
});

describe('currency code helpers', () => {
  it('normalises a user-typed value only when it has the ISO shape', () => {
    expect(normalizeCurrencyCode(' usd ')).toBe('USD');
    expect(normalizeCurrencyCode('eu')).toBeNull();
    expect(normalizeCurrencyCode('US1')).toBeNull();
  });

  it('accepts any three-letter shape regardless of registry membership', () => {
    expect(isIsoCodeShape('zzz')).toBe(true);
    expect(isIsoCodeShape('to')).toBe(false);
  });

  it('answers registry membership by exact code', () => {
    expect(isKnownCurrencyCode('USD')).toBe(true);
    expect(isKnownCurrencyCode('us')).toBe(false);
    expect(isKnownCurrencyCode('US')).toBe(false);
  });

  it('falls back to the code itself when metadata is unknown', () => {
    expect(getCurrencyMeta('JPY')).toEqual({ name: 'Japanese Yen', symbol: '¥', decimals: 0 });
    expect(getCurrencyMeta('ZZZ')).toEqual({ name: 'ZZZ', symbol: 'ZZZ', decimals: 2 });
  });
});
