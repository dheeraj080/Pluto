import { dateLabel } from './date';

export interface ExpenseGroup<T> {
  title: string;
  data: T[];
}

/**
 * Buckets expenses by the day they were incurred, with the *groups* ordered by
 * date (`order`) and the rows inside each group left in the order they arrived —
 * so the active sort survives, and the headers still read as a ledger.
 *
 * `incurredOn` is the DTO's date field; `date` is accepted as a fallback for
 * older shapes.
 */
export function groupExpensesByDate<T extends { incurredOn?: string; date?: string; id: string }>(
  expenses: T[],
  order: 'asc' | 'desc' = 'desc',
): ExpenseGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const expense of expenses) {
    const iso = (expense.incurredOn ?? expense.date ?? '').slice(0, 10);
    if (!iso) continue;
    const bucket = groups.get(iso);
    if (bucket) bucket.push(expense);
    else groups.set(iso, [expense]);
  }

  // ISO `YYYY-MM-DD` strings sort lexicographically in date order.
  const dates = [...groups.keys()].sort((a, b) =>
    order === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
  );

  return dates.map((iso) => ({ title: dateLabel(iso), data: groups.get(iso) ?? [] }));
}
