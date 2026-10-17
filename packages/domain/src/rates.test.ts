/**
 * The shared rate math and its display precision.
 *
 * `rateBetween` / `buildConversionPreview` are display-only: they never touch a
 * stored amount, and a missing or unusable currency yields `null` rather than a
 * wrong figure. `formatRateValue` is the single definition of the precision
 * rule the two clients used to re-implement separately.
 */
import { describe, expect, it } from 'vitest';

import {
  buildConversionPreview,
  effectiveRate,
  formatRateValue,
  rateBetween,
  type RateSnapshot,
} from './rates';

/** Units of CODE per 1 USD, as the server serialises them (exact strings). */
const RATES = { USD: '1', EUR: '0.9', INR: '83' };

function snapshot(overrides: Partial<RateSnapshot> = {}): RateSnapshot {
  return {
    version: 42,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-09',
    fetchedAt: '2026-10-09T04:00:15.123Z',
    provider: 'frankfurter',
    etag: 'abc',
    rates: RATES,
    ...overrides,
  };
}

describe('rateBetween', () => {
  it('is 1 for a currency against itself, even with no snapshot rates', () => {
    expect(rateBetween('USD', 'USD', {})).toBe(1);
  });

  it('divides the two legs of the snapshot', () => {
    expect(rateBetween('USD', 'INR', RATES)).toBeCloseTo(83);
    expect(rateBetween('INR', 'USD', RATES)).toBeCloseTo(1 / 83);
    expect(rateBetween('EUR', 'INR', RATES)).toBeCloseTo(83 / 0.9);
  });

  it('returns null when a leg is missing, zero or not a number', () => {
    expect(rateBetween('USD', 'ZZZ', RATES)).toBeNull();
    expect(rateBetween('ZZZ', 'USD', RATES)).toBeNull();
    expect(rateBetween('USD', 'EUR', { USD: '0', EUR: '0.9' })).toBeNull();
    expect(rateBetween('USD', 'EUR', { USD: 'nope', EUR: '0.9' })).toBeNull();
  });
});

describe('buildConversionPreview', () => {
  it('converts and reports the effective rate and provenance', () => {
    expect(buildConversionPreview(10, 'USD', 'EUR', snapshot())).toEqual({
      amount: 9,
      rate: 0.9,
      from: 'USD',
      to: 'EUR',
      effectiveDate: '2026-10-09',
      provider: 'frankfurter',
    });
  });

  it('returns null without a snapshot, a bad amount or an unknown currency', () => {
    expect(buildConversionPreview(10, 'USD', 'EUR', null)).toBeNull();
    expect(buildConversionPreview(-1, 'USD', 'EUR', snapshot())).toBeNull();
    expect(buildConversionPreview(Number.NaN, 'USD', 'EUR', snapshot())).toBeNull();
    expect(buildConversionPreview(10, 'USD', 'ZZZ', snapshot())).toBeNull();
  });
});

describe('formatRateValue', () => {
  it('keeps four decimals for a sub-unit rate', () => {
    expect(formatRateValue(0.9234)).toBe('0.9234');
    expect(formatRateValue(1.5)).toBe('1.5');
  });

  it('drops to two decimals once a single unit is worth 100 or more', () => {
    expect(formatRateValue(150.1234)).toBe('150.12');
    expect(formatRateValue(1234.5678)).toMatch(/\.\d{2}$/);
    expect(formatRateValue(1234.5678)).not.toMatch(/\.\d{4}$/);
  });

  it('shows no fraction at all for a whole number', () => {
    expect(formatRateValue(100)).toBe('100');
  });
});

describe('effectiveRate', () => {
  it('divides secondary by primary', () => {
    expect(effectiveRate(100, 90)).toBeCloseTo(0.9);
  });

  it('is null when either side is missing or nothing was spent', () => {
    expect(effectiveRate(null, 90)).toBeNull();
    expect(effectiveRate(100, null)).toBeNull();
    expect(effectiveRate(0, 90)).toBeNull();
    expect(effectiveRate(undefined, undefined)).toBeNull();
  });
});
