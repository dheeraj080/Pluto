/**
 * The on-device rate mirror's pure transforms: the offline stand-in for
 * `GET /rates/latest` (a mirrored table mapped onto the snapshot shape), and
 * the rebase that re-expresses one base's window against another — the read
 * path that keeps a profile base change from resetting conversion depth.
 */
import { describe, expect, it } from 'vitest';

import type { RateTable } from '@pluto/domain';

import { rebaseRateTable, rebaseRateTables, snapshotFromRateTable } from './rates';

describe('snapshotFromRateTable', () => {
  it('maps the mirrored table onto the snapshot shape', () => {
    const snapshot = snapshotFromRateTable({
      version: 7,
      baseCurrency: 'USD',
      effectiveDate: '2026-10-15',
      provider: 'ECB',
      rates: { EUR: '0.92', GBP: '0.79' },
    });

    expect(snapshot).toEqual({
      version: 7,
      baseCurrency: 'USD',
      effectiveDate: '2026-10-15',
      fetchedAt: '2026-10-15T00:00:00.000Z',
      provider: 'ECB',
      etag: 'local-7',
      rates: { EUR: '0.92', GBP: '0.79' },
    });
  });
});

describe('rebaseRateTable', () => {
  const usdTable: RateTable = {
    version: 7,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-15',
    provider: 'ECB',
    rates: { USD: '1.000000', EUR: '0.920000', GBP: '0.790000' },
    dates: { GBP: '2026-10-14' },
  };

  it('returns the table untouched when the base already matches', () => {
    expect(rebaseRateTable(usdTable, 'usd')).toBe(usdTable);
  });

  it('divides every quote by the target leg and quotes the target at 1', () => {
    const rebased = rebaseRateTable(usdTable, 'EUR');

    expect(rebased).not.toBeNull();
    expect(rebased?.baseCurrency).toBe('EUR');
    expect(rebased?.effectiveDate).toBe('2026-10-15');
    expect(rebased?.version).toBe(7);
    expect(rebased?.provider).toBe('ECB');
    expect(rebased?.rates).toEqual({
      USD: '1.086957', // 1 / 0.92
      EUR: '1.000000',
      GBP: '0.858696', // 0.79 / 0.92
    });
  });

  it('dates each rebased leg the older of the two legs', () => {
    const rebased = rebaseRateTable(usdTable, 'EUR');

    // The target's own leg is the table date (no EUR entry), so only GBP —
    // observed a day earlier — keeps the older date.
    expect(rebased?.dates).toEqual({
      USD: '2026-10-15',
      EUR: '2026-10-15',
      GBP: '2026-10-14',
    });
  });

  it('caps every leg at an older target observation date', () => {
    const rebased = rebaseRateTable(
      { ...usdTable, dates: { ...usdTable.dates, EUR: '2026-10-10' } },
      'EUR',
    );

    expect(rebased?.dates).toEqual({
      USD: '2026-10-10',
      EUR: '2026-10-10',
      GBP: '2026-10-10',
    });
  });

  it('refuses a table that never quotes the target', () => {
    expect(rebaseRateTable(usdTable, 'JPY')).toBeNull();
  });

  it('refuses an unusable target leg', () => {
    expect(rebaseRateTable({ ...usdTable, rates: { ...usdTable.rates, EUR: '0' } }, 'EUR'))
      .toBeNull();
    expect(rebaseRateTable({ ...usdTable, rates: { ...usdTable.rates, EUR: 'n/a' } }, 'EUR'))
      .toBeNull();
  });
});

describe('rebaseRateTables', () => {
  it('rebases every usable table and drops the rest', () => {
    const tables: RateTable[] = [
      {
        version: 1,
        baseCurrency: 'USD',
        effectiveDate: '2026-10-14',
        provider: 'ECB',
        rates: { USD: '1.000000', EUR: '0.920000' },
      },
      {
        version: 2,
        baseCurrency: 'USD',
        effectiveDate: '2026-10-15',
        provider: 'ECB',
        rates: { USD: '1.000000' }, // quotes no EUR: cannot serve an EUR base
      },
    ];

    const rebased = rebaseRateTables(tables, 'EUR');
    expect(rebased).toHaveLength(1);
    expect(rebased[0].baseCurrency).toBe('EUR');
    expect(rebased[0].effectiveDate).toBe('2026-10-14');
  });
});
