import { describe, expect, it } from 'vitest';
import { groupExpensesByDate } from './date-grouping';

type Expense = { id: string; incurredOn?: string; date?: string };

describe('groupExpensesByDate', () => {
  const a: Expense = { id: '1', incurredOn: '2026-10-16' };
  const b: Expense = { id: '2', incurredOn: '2026-10-16' };
  const c: Expense = { id: '3', incurredOn: '2026-10-15' };
  const d: Expense = { id: '4', incurredOn: '2026-10-16', date: '2026-10-15' };
  const withoutDate: Expense = { id: '5' };
  const bad: Expense = { id: '6', incurredOn: '' };

  it('buckets rows by incurredOn, preferring it over the legacy date field', () => {
    const groups = groupExpensesByDate(
      [b, c, a, d, withoutDate, bad, ...[c].map((e) => ({ ...e, id: '7' }))],
      'desc',
    );
    expect(groups.map((g) => g.title)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].data.map((e) => e.id)).toEqual(['2', '1', '4']);
  });

  it('sorts the group headers ascending on demand while preserving row order inside each bucket', () => {
    const groups = groupExpensesByDate([c, b, a], 'asc');
    expect(groups.map((g) => g.data[0].id)).toEqual(['3', '2']);
  });

  it('drops rows that carry no date at all', () => {
    expect(groupExpensesByDate([withoutDate], 'desc')).toEqual([]);
  });
});
