/**
 * Golden parity tests for the on-device report engine.
 *
 * Every expectation here is copied from the server's own
 * `expenses-reports.service.spec.ts` — the same fixtures, the same numbers —
 * so the phone and the server are pinned to one answer. If the server's
 * aggregation changes, one of these must change with it.
 */
import { describe, expect, it } from 'vitest';

import { divideMultiplyRound2, roundHalfUp2 } from './decimal';
import {
  budgetStatus,
  buildCategorySeries,
  buildSeries,
  byDayOfWeek,
  compare,
  summarize,
  type BudgetStatusInput,
  type SummaryInput,
} from './engine';
import type { Budget, CategoryIndex, ReportRow, RateTable } from './types';

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

const TABLES_WITH_INR: RateTable[] = [
  {
    version: 1,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-01',
    provider: 'mock',
    rates: { USD: '1.000000', EUR: '0.920000', INR: '83.000000' },
  },
];

const CATEGORIES: CategoryIndex = new Map([
  ['cat-1', { id: 'cat-1', name: 'Food', color: '#f59e0b' }],
  ['cat-2', { id: 'cat-2', name: 'Transport', color: '#3b82f6' }],
]);

function row(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    amount: '0.00',
    currency: 'USD',
    incurredOn: '2026-10-05',
    categoryId: 'cat-1',
    ...overrides,
  };
}

function summary(rows: ReportRow[], extra: Partial<SummaryInput> = {}) {
  return summarize({
    rows,
    tables: TABLES,
    categories: CATEGORIES,
    base: 'USD',
    from: '2026-10-01',
    to: '2026-10-31',
    ...extra,
  });
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-uuid-1',
    categoryId: 'cat-1',
    amount: '100.00',
    currency: 'USD',
    period: 'MONTHLY',
    startDate: '2026-10-01',
    ...overrides,
  };
}

function status(extra: Partial<BudgetStatusInput> = {}) {
  return budgetStatus({
    budgets: [budget()],
    rows: [],
    tables: TABLES,
    categories: CATEGORIES,
    base: 'USD',
    month: '2026-10',
    ...extra,
  });
}

describe('decimal', () => {
  it('rounds half away from zero, exactly', () => {
    // A JS double would answer 1.00 here because 1.005 is not representable.
    expect(roundHalfUp2('1.005')).toBe(1.01);
    expect(roundHalfUp2(1.005)).toBe(1.01);
    expect(roundHalfUp2('1.004999')).toBe(1);
  });

  it('divides and multiplies without floating-point drift', () => {
    expect(divideMultiplyRound2('1', '8', '1')).toBe(0.13);
    expect(divideMultiplyRound2('92.00', '0.920000', '1.000000')).toBe(100);
  });
});

describe('summarize', () => {
  it('folds multiple currencies together per category using the base as pivot', () => {
    const result = summary([
      row({ amount: '100.00' }),
      row({ amount: '92.00', currency: 'EUR' }),
      row({ amount: '50.00', categoryId: 'cat-2' }),
    ]);

    const food = result.byCategory.find((c) => c.categoryId === 'cat-1');
    expect(food?.total).toBe(200);
    expect(food?.count).toBe(2);
    expect(result.total).toBe(250);
    expect(result.count).toBe(3);
    expect(result.average).toBe(83.33);
    expect(result.conversionStatus).toBe('converted');
    expect(result.converted).toBe(true);
  });

  it('computes category shares that sum to 100', () => {
    const result = summary([
      row({ amount: '100.00' }),
      row({ amount: '92.00', currency: 'EUR' }),
      row({ amount: '50.00', categoryId: 'cat-2' }),
    ]);

    expect(result.byCategory.map((c) => c.percentage)).toEqual([80, 20]);
    expect(result.byCategory.reduce((s, c) => s + c.percentage, 0)).toBe(100);
    expect(result.byCategory.map((c) => c.total).reduce((s, t) => s + t, 0)).toBe(result.total);
  });

  it('reports native subtotals per currency alongside converted totals', () => {
    const result = summary([
      row({ amount: '100.00' }),
      row({ amount: '92.00', currency: 'EUR' }),
      row({ amount: '50.00', categoryId: 'cat-2' }),
    ]);

    expect(result.byCurrency).toEqual([
      { currency: 'USD', total: 150, count: 2, convertedTotal: 150 },
      { currency: 'EUR', total: 92, count: 1, convertedTotal: 100 },
    ]);
    expect(result.baseCurrency).toBe('USD');
  });

  it('resolves the latest snapshot on-or-before each expense date (historical)', () => {
    const result = summary([row({ amount: '92.00', currency: 'EUR' })]);

    expect(result.total).toBe(100);
    expect(result.rateProvenance.earliestRateDate).toBe('2026-10-01');
    expect(result.rateProvenance.policies).toContain('historical');
  });

  it('labels rows older than every snapshot as estimate without lying about the rate date', () => {
    const result = summary([row({ amount: '92.00', currency: 'EUR', incurredOn: '2026-05-15' })], {
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(result.total).toBe(100);
    expect(result.rateProvenance.policies).toContain('estimate');
    expect(result.rateProvenance.earliestRateDate).toBe('2026-10-01');
  });

  it('flags partially-converted reports and lists the unconvertible currencies', () => {
    const result = summary([
      row({ amount: '100.00' }),
      row({ amount: '50000.00', currency: 'VND' }),
    ]);

    expect(result.converted).toBe(false);
    expect(result.conversionStatus).toBe('partially_converted');
    expect(result.unconvertedCurrencies).toEqual(['VND']);
    expect(result.total).toBe(100);
    expect(result.byCurrency.find((c) => c.currency === 'VND')?.total).toBe(50000);
  });

  it('reports unavailable (null totals, no breakdown) when nothing can convert', () => {
    const result = summary([row({ amount: '92.00', currency: 'EUR' })], { tables: [] });

    expect(result.converted).toBe(false);
    expect(result.conversionStatus).toBe('unavailable');
    expect(result.conversionUnavailableReason).toBeTruthy();
    expect(result.total).toBeNull();
    expect(result.average).toBeNull();
    expect(result.byCategory).toEqual([]);
    expect(result.count).toBe(1);
    expect(result.byCurrency).toEqual([
      { currency: 'EUR', total: 92, count: 1, convertedTotal: null },
    ]);
  });

  it('still converts base-currency rows exactly when no snapshots exist', () => {
    const result = summary([row({ amount: '100.00' }), row({ amount: '92.00', currency: 'EUR' })], {
      tables: [],
    });

    expect(result.conversionStatus).toBe('partially_converted');
    expect(result.total).toBe(100);
    expect(result.unconvertedCurrencies).toEqual(['EUR']);
  });

  it('expresses the summary in a secondary currency from the same snapshot', () => {
    const result = summary(
      [
        row({ amount: '100.00' }),
        row({ amount: '92.00', currency: 'EUR' }),
        row({ amount: '50.00', categoryId: 'cat-2' }),
      ],
      { tables: TABLES_WITH_INR, secondary: 'INR' },
    );

    expect(result.secondaryCurrency).toBe('INR');
    expect(result.secondaryTotal).toBe(20750);
    expect(result.byCategory.find((c) => c.categoryId === 'cat-1')?.secondaryTotal).toBe(16600);
  });

  it('omits secondary fields when no secondary currency is requested', () => {
    const result = summary([row({ amount: '100.00' })]);

    expect(result.secondaryCurrency).toBeUndefined();
    expect(result.secondaryTotal).toBeUndefined();
    expect(result.byCategory[0].secondaryTotal).toBeUndefined();
  });

  it('only aggregates rows inside the range', () => {
    const result = summary([
      row({ amount: '100.00' }),
      row({ amount: '999.00', incurredOn: '2026-11-05' }),
      row({ amount: '999.00', incurredOn: '2026-09-05' }),
    ]);

    expect(result.total).toBe(100);
    expect(result.count).toBe(1);
  });
});

describe('buildSeries', () => {
  it('buckets a day series continuously, zero-filling empty days', () => {
    const result = buildSeries({
      rows: [
        row({ amount: '10.00', incurredOn: '2026-10-03' }),
        row({ amount: '9.20', currency: 'EUR', incurredOn: '2026-10-05' }),
      ],
      tables: TABLES,
      base: 'USD',
      from: '2026-10-01',
      to: '2026-10-05',
      granularity: 'day',
    });

    expect(result.granularity).toBe('day');
    expect(result.points.map((p) => p.bucket)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
    expect(result.points.map((p) => p.total)).toEqual([0, 0, 10, 0, 10]);
    expect(result.points[2].count).toBe(1);
  });

  it('groups into Monday-anchored week buckets', () => {
    const result = buildSeries({
      rows: [row({ amount: '10.00', incurredOn: '2026-10-03' })],
      tables: TABLES,
      base: 'USD',
      from: '2026-10-01',
      to: '2026-10-31',
      granularity: 'week',
    });

    expect(result.points.map((p) => p.bucket)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
    expect(result.points[0].total).toBe(10);
  });

  it('expresses the series in a secondary currency when requested', () => {
    const result = buildSeries({
      rows: [row({ amount: '10.00', incurredOn: '2026-10-03' })],
      tables: TABLES_WITH_INR,
      base: 'USD',
      from: '2026-10-01',
      to: '2026-10-05',
      granularity: 'day',
      secondary: 'INR',
    });

    expect(result.secondaryCurrency).toBe('INR');
    expect(result.points[2].total).toBe(10);
    expect(result.points[2].secondaryTotal).toBe(830);
    expect(result.points[0].secondaryTotal).toBe(0);
  });

  it('rejects a range that would yield too many buckets', () => {
    expect(() =>
      buildSeries({
        rows: [],
        tables: TABLES,
        base: 'USD',
        from: '2020-01-01',
        to: '2026-12-31',
        granularity: 'day',
      }),
    ).toThrow();
  });
});

describe('buildCategorySeries', () => {
  it('returns one continuous series per category, largest first', () => {
    const result = buildCategorySeries({
      rows: [
        row({ amount: '100.00', categoryId: 'cat-1', incurredOn: '2026-10-05' }),
        row({ amount: '20.00', categoryId: 'cat-2', incurredOn: '2026-10-06' }),
        row({ amount: '5.00', categoryId: 'cat-3', incurredOn: '2026-10-07' }),
      ],
      tables: TABLES,
      categories: CATEGORIES,
      base: 'USD',
      from: '2026-10-01',
      to: '2026-10-31',
      granularity: 'month',
    });

    expect(result.buckets).toEqual(['2026-10']);
    expect(result.series.map((s) => s.categoryId)).toEqual(['cat-1', 'cat-2', 'cat-3']);
    expect(result.series[0].categoryName).toBe('Food');
    expect(result.series[2].categoryName).toBe('Uncategorised');
    expect(result.series[0].points[0].total).toBe(100);
    expect(result.series[1].points[0].total).toBe(20);
  });
});

describe('byDayOfWeek', () => {
  it('buckets totals into the seven UTC weekdays', () => {
    const result = byDayOfWeek({
      rows: [
        row({ amount: '10.00', incurredOn: '2026-10-05' }), // Monday
        row({ amount: '20.00', incurredOn: '2026-10-06' }), // Tuesday
      ],
      tables: TABLES,
      base: 'USD',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(result.items).toHaveLength(7);
    expect(result.items[1].label).toBe('Mon');
    expect(result.items[1].total).toBe(10);
    expect(result.items[1].count).toBe(1);
    expect(result.items[2].total).toBe(20);
    expect(result.items[0].total).toBe(0);
    expect(result.conversionStatus).toBe('converted');
  });
});

describe('compare', () => {
  it('computes absolute and percentage deltas between two periods', () => {
    const result = compare({
      rows: [
        row({ amount: '50.00', incurredOn: '2026-10-05' }),
        row({ amount: '50.00', incurredOn: '2026-10-15' }),
        row({ amount: '50.00', incurredOn: '2026-10-25' }),
        row({ amount: '50.00', incurredOn: '2026-09-05' }),
        row({ amount: '50.00', incurredOn: '2026-09-15' }),
      ],
      tables: TABLES,
      categories: CATEGORIES,
      base: 'USD',
      currentFrom: '2026-10-01',
      currentTo: '2026-10-31',
      previousFrom: '2026-09-01',
      previousTo: '2026-09-30',
    });

    expect(result.converted).toBe(true);
    expect(result.current.total).toBe(150);
    expect(result.previous.total).toBe(100);
    expect(result.delta.totalAbs).toBe(50);
    expect(result.delta.totalPct).toBe(50);
    expect(result.delta.countAbs).toBe(1);
    expect(result.delta.countPct).toBe(50);
  });
});

describe('budgetStatus', () => {
  it('compares spend against a category budget', () => {
    const result = status({
      rows: [
        row({ amount: '60.00', incurredOn: '2026-10-05' }),
        row({ amount: '20.00', incurredOn: '2026-10-07' }),
        row({ amount: '30.00', categoryId: 'cat-2', incurredOn: '2026-10-08' }),
      ],
    });

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.spent).toBe(80);
    expect(item.budgetAmount).toBe(100);
    expect(item.remaining).toBe(20);
    expect(item.percentage).toBe(80);
    expect(item.overBudget).toBe(false);
    expect(item.applied).toBe(true);
    expect(item.categoryName).toBe('Food');
    expect(item.conversionStatus).toBe('converted');
  });

  it('converts the budget target at the start of the window', () => {
    const result = status({
      budgets: [budget({ amount: '92.00', currency: 'EUR' })],
    });

    const item = result.items[0];
    expect(item.budgetAmount).toBe(100);
    expect(item.currency).toBe('USD');
    expect(item.rateDate).toBe('2026-10-01');
    expect(item.ratePolicy).toBe('historical');
  });

  it('flags over-budget spending', () => {
    const item = status({ rows: [row({ amount: '150.00', incurredOn: '2026-10-05' })] }).items[0];

    expect(item.overBudget).toBe(true);
    expect(item.remaining).toBe(-50);
    expect(item.percentage).toBe(150);
  });

  it('an overall budget counts every category', () => {
    const item = status({
      budgets: [budget({ categoryId: null })],
      rows: [
        row({ amount: '60.00', incurredOn: '2026-10-05' }),
        row({ amount: '30.00', categoryId: 'cat-2', incurredOn: '2026-10-06' }),
      ],
    }).items[0];

    expect(item.categoryId).toBeNull();
    expect(item.categoryName).toBeNull();
    expect(item.spent).toBe(90);
  });

  it('marks a budget that starts after the window as not yet applied', () => {
    const item = status({ budgets: [budget({ startDate: '2026-11-01' })] }).items[0];

    expect(item.applied).toBe(false);
    expect(item.spent).toBe(0);
  });

  it('keeps spend native and marks the item unavailable when rates are missing', () => {
    const result = status({
      tables: [],
      rows: [
        row({ amount: '75.00', incurredOn: '2026-10-05' }),
        row({ amount: '92.00', currency: 'EUR', incurredOn: '2026-10-06' }),
      ],
    });

    const item = result.items[0];
    expect(item.spent).toBe(75);
    expect(item.conversionStatus).toBe('unavailable');
    expect(item.convertedAmount).toBe(100); // the USD target is an identity conversion
    expect(result.conversionStatus).toBe('partially_converted');
    expect(result.converted).toBe(false);
    expect(result.unconvertedCurrencies).toEqual(['EUR']);
  });

  it('returns an empty list when there are no budgets', () => {
    const result = status({ budgets: [] });

    expect(result.items).toEqual([]);
    expect(result.conversionStatus).toBe('converted');
  });
});
