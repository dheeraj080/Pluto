/**
 * Golden parity tests for the on-device CSV export.
 *
 * Every expectation is copied from the server's own
 * `expenses-reports.service.spec.ts` `exportCsv` block — the same fixtures,
 * the same lines — so a file generated offline is pinned to byte-equality with
 * `GET /expenses/export.csv`. If the server's export changes, one of these
 * must change with it.
 */
import { describe, expect, it } from 'vitest';

import type { RateTable } from '@pluto/domain';

import { buildExpensesCsv, type CsvExpenseRow } from './csv';

/** Base USD: 1 USD buys 0.92 EUR, so 92 EUR converts to 100 USD. */
const TABLES: RateTable[] = [
  {
    version: 1,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-01',
    provider: 'mock',
    rates: { USD: '1.000000', EUR: '0.920000' },
  },
  {
    version: 2,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-09',
    provider: 'mock',
    rates: { USD: '1.000000', EUR: '0.920000' },
  },
];

function expense(overrides: Partial<CsvExpenseRow> = {}): CsvExpenseRow {
  return {
    incurredOn: '2026-10-01',
    description: null,
    categoryName: null,
    amount: 0,
    currency: 'USD',
    ...overrides,
  };
}

function csv(rows: CsvExpenseRow[], tables: RateTable[] = TABLES): string {
  return buildExpensesCsv(rows, { base: 'USD', to: '2026-10-31', tables });
}

describe('buildExpensesCsv', () => {
  it('emits just the header for an empty range', () => {
    expect(csv([])).toBe(
      'Date,Description,Category,Amount Paid,Currency Paid,Converted Amount,Reporting Currency,Rate Used,Rate Date,Estimated',
    );
  });

  it('renders a base-currency identity and a converted row exactly as the server does', () => {
    const output = csv([
      expense({
        incurredOn: '2026-10-01',
        description: 'Rent, "monthly"',
        categoryName: 'Housing',
        amount: 1000,
        currency: 'USD',
      }),
      expense({
        incurredOn: '2026-10-02',
        description: 'Trip',
        categoryName: 'Travel',
        amount: 92,
        currency: 'EUR',
      }),
    ]);
    const [header, row1, row2] = output.split('\n');

    expect(header).toBe(
      'Date,Description,Category,Amount Paid,Currency Paid,Converted Amount,Reporting Currency,Rate Used,Rate Date,Estimated',
    );
    // A base-currency row is an identity conversion: rate 1, no rate date, not estimated.
    expect(row1).toBe('"2026-10-01","Rent, ""monthly""","Housing",1000.00,USD,1000.00,USD,1,,no');
    // The EUR row carries the actual multiplier, the true snapshot date and no estimate.
    expect(row2).toBe('"2026-10-02","Trip","Travel",92.00,EUR,100.00,USD,1.086957,2026-10-01,no');
  });

  it('escapes quotes in every free-text column so columns cannot shift', () => {
    const output = csv([
      expense({
        incurredOn: '2026-10-03',
        description: 'Says "hi", twice',
        categoryName: 'Books, "sale"',
        amount: 10,
        currency: 'USD',
      }),
    ]);
    const [, row] = output.split('\n');

    // Category names are only length-checked, so they need the same escaping
    // as descriptions — unescaped, `"Books, "sale""` would close its own
    // field early and shift every later column.
    expect(row).toBe(
      '"2026-10-03","Says ""hi"", twice","Books, ""sale""",10.00,USD,10.00,USD,1,,no',
    );
  });

  it('labels a row unconvertible when no snapshot can reach it', () => {
    const output = csv([expense({ incurredOn: '2026-10-05', amount: 4.5, currency: 'EUR' })], []);
    const [, row] = output.split('\n');

    // Conversion cells ride bare and empty; the estimated column stays a
    // definite "no" because nothing was estimated — nothing was converted.
    expect(row).toBe('"2026-10-05","","Uncategorised",4.50,EUR,,,,,no');
  });

  it('marks a stale snapshot an estimate with its own date', () => {
    const output = csv([
      expense({ incurredOn: '2026-10-25', description: 'Late', amount: 92, currency: 'EUR' }),
    ]);
    const [, row] = output.split('\n');

    // 2026-10-25 is 16 days past the newest table — beyond the 10-day lookback
    // — so the policy flips to `estimate` and the rate date stays the snapshot's.
    expect(row).toBe('"2026-10-25","Late","Uncategorised",92.00,EUR,100.00,USD,1.086957,2026-10-09,yes');
  });

  it('falls back to Uncategorised with an empty category cell for null fields', () => {
    const output = csv([expense({ incurredOn: '2026-10-06', amount: 4.5 })]);
    const [, row] = output.split('\n');

    expect(row).toBe('"2026-10-06","","Uncategorised",4.50,USD,4.50,USD,1,,no');
  });
});
