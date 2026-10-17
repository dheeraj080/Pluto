/**
 * Display-only currency conversion, shared with the web client.
 *
 * The server converts when it aggregates; everything here only decides what a
 * row, a preview or a summary shows, so the tests pin the two rules that
 * matter: a recorded amount is never rewritten, and a missing rate yields no
 * figure rather than a wrong one.
 */
import { describe, expect, it } from 'vitest';
import type { Schemas } from '@pluto/api-client';

import {
  buildConversionPreview,
  rateBetween,
  recordedAmounts,
  summaryAmounts,
  toRateSnapshot,
  type RateSnapshot,
} from './convert';

/** Units of CODE per 1 USD, as the server serialises them (exact strings). */
const RATES = { USD: '1', EUR: '0.9', INR: '83' };

function snapshot(overrides: Partial<RateSnapshot> = {}): RateSnapshot {
  return {
    version: 42,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-09',
    fetchedAt: '2026-10-09T04:00:15.123Z',
    provider: 'frankfurter',
    etag: 'W/"rates-v42-20261009"',
    rates: RATES,
    ...overrides,
  };
}

/** The generated `rates` is `Record<string, never>`; the wire values are strings. */
function snapshotDto(): Schemas['RateSnapshotResponseDto'] {
  return { ...snapshot(), rates: RATES as unknown as Record<string, never> };
}

describe('toRateSnapshot', () => {
  it('passes the DTO through with its rates still strings', () => {
    const dto = snapshotDto();
    const result = toRateSnapshot(dto);

    expect(result).toEqual(dto);
    expect(result.rates).toEqual({ USD: '1', EUR: '0.9', INR: '83' });
    expect(typeof result.rates.INR).toBe('string');
  });
});

describe('rateBetween', () => {
  it('is exactly 1 for a currency against itself, rate table or not', () => {
    expect(rateBetween('USD', 'USD', RATES)).toBe(1);
    expect(rateBetween('USD', 'USD', {})).toBe(1);
  });

  it('divides the target rate by the source rate', () => {
    expect(rateBetween('EUR', 'USD', RATES)).toBe(1 / 0.9);
    expect(rateBetween('USD', 'INR', RATES)).toBe(83);
  });

  it('returns null for a code the snapshot does not carry', () => {
    expect(rateBetween('USD', 'ZZZ', RATES)).toBeNull();
    expect(rateBetween('ZZZ', 'USD', RATES)).toBeNull();
  });

  it('returns null when either side of the table is unusable', () => {
    expect(rateBetween('USD', 'EUR', { USD: '0', EUR: '0.9' })).toBeNull();
    expect(rateBetween('USD', 'EUR', { USD: 'abc', EUR: '0.9' })).toBeNull();
    expect(rateBetween('USD', 'EUR', { USD: '1', EUR: 'abc' })).toBeNull();
  });
});

describe('buildConversionPreview', () => {
  it('returns null without a snapshot', () => {
    expect(buildConversionPreview(10, 'USD', 'EUR', null)).toBeNull();
  });

  it('returns null for amounts that are negative or not finite', () => {
    expect(buildConversionPreview(-1, 'USD', 'EUR', snapshot())).toBeNull();
    expect(buildConversionPreview(Number.NaN, 'USD', 'EUR', snapshot())).toBeNull();
    expect(buildConversionPreview(Number.POSITIVE_INFINITY, 'USD', 'EUR', snapshot())).toBeNull();
  });

  it('returns null when a currency is missing from the snapshot', () => {
    expect(buildConversionPreview(10, 'GBP', 'EUR', snapshot())).toBeNull();
  });

  it('carries the converted amount and the rate provenance', () => {
    expect(buildConversionPreview(5, 'USD', 'INR', snapshot())).toEqual({
      amount: 415,
      rate: 83,
      from: 'USD',
      to: 'INR',
      effectiveDate: '2026-10-09',
      provider: 'frankfurter',
    });
  });
});

describe('recordedAmounts', () => {
  it('always echoes the recorded amount and currency', () => {
    expect(recordedAmounts(100, 'EUR', null, null)).toEqual({
      amount: 100,
      currency: 'EUR',
      companionAmount: null,
      companionCurrency: null,
    });
  });

  it('shows the home currency beside a foreign expense', () => {
    expect(recordedAmounts(100, 'EUR', 'USD', snapshot())).toEqual({
      amount: 100,
      currency: 'EUR',
      companionAmount: 100 * (1 / 0.9),
      companionCurrency: 'USD',
    });
  });

  it('falls back to the Second when the expense already is the home currency', () => {
    expect(recordedAmounts(100, 'USD', 'USD', snapshot(), 'EUR')).toEqual({
      amount: 100,
      currency: 'USD',
      companionAmount: 100 * 0.9,
      companionCurrency: 'EUR',
    });
  });

  it('has no companion when home and Second are the recorded currency', () => {
    expect(recordedAmounts(100, 'USD', 'USD', snapshot(), 'USD')).toEqual({
      amount: 100,
      currency: 'USD',
      companionAmount: null,
      companionCurrency: null,
    });
  });

  it('returns no companion figure when no rate is available', () => {
    const recorded = recordedAmounts(100, 'EUR', 'USD', null);

    expect(recorded.amount).toBe(100);
    expect(recorded.currency).toBe('EUR');
    expect(recorded.companionAmount).toBeNull();
    expect(recorded.companionCurrency).toBeNull();
  });
});

describe('summaryAmounts', () => {
  it('returns null without a home amount', () => {
    expect(summaryAmounts(null, 'USD', 10, 'EUR')).toBeNull();
    expect(summaryAmounts(undefined, 'USD', 10, 'EUR')).toBeNull();
  });

  it('returns null without a home currency', () => {
    expect(summaryAmounts(10, null, 20, 'EUR')).toBeNull();
    expect(summaryAmounts(10, '', 20, 'EUR')).toBeNull();
  });

  it('leads with the Second and puts the home figure beneath it', () => {
    expect(summaryAmounts(10, 'USD', 20, 'EUR')).toEqual({
      amount: 20,
      currency: 'EUR',
      secondaryAmount: 10,
      secondaryCurrency: 'USD',
    });
  });

  it('collapses to a single figure when both sides are the same currency', () => {
    expect(summaryAmounts(10, 'USD', 20, 'USD')).toEqual({
      amount: 10,
      currency: 'USD',
      secondaryAmount: null,
      secondaryCurrency: null,
    });
  });

  it('collapses to a single figure when the Second side is incomplete', () => {
    expect(summaryAmounts(10, 'USD', 20, null)).toEqual({
      amount: 10,
      currency: 'USD',
      secondaryAmount: null,
      secondaryCurrency: null,
    });
    expect(summaryAmounts(10, 'USD', null, 'EUR')).toEqual({
      amount: 10,
      currency: 'USD',
      secondaryAmount: null,
      secondaryCurrency: null,
    });
  });
});
