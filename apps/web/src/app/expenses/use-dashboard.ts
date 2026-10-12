"use client";

/**
 * Loaders for the dashboard.
 *
 * The dashboard is organised around the questions a person actually asks:
 * "how much this month?", "am I on budget?", "faster or slower than last
 * month?" — so the month is compared **month-to-date against the same days of
 * the previous month**, never a partial month against a whole one.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { expensesApi } from "@/lib/expenses";
import { compareWindows, monthToDate, type CompareRange, type MonthWindow } from "@/lib/ranges";
import type { ComparisonRow } from "@/components/charts";
import type {
  BudgetStatus,
  Expense,
  ExpenseComparison,
  Paginated,
} from "@/lib/types";
import { useSeries } from "./use-expenses";

/**
 * Percentage change between the current and previous totals, or null when the
 * comparison is not meaningful: unconvertible, a missing total, or a previous
 * total of zero (which would make the ratio unbounded).
 */
export function comparisonDeltaPct(comparison: ExpenseComparison | null): number | null {
  if (!comparison || !comparison.converted) return null;
  const { current, previous } = comparison;
  if (current.total === null || previous.total === null || previous.total <= 0) return null;
  return Number.isFinite(comparison.delta.totalPct) ? comparison.delta.totalPct : null;
}

export interface MonthComparisonState {
  comparison: ExpenseComparison | null;
  window: MonthWindow;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Month-to-date in the Pair, compared with the same days of last month. */
export function useMonthComparison(
  base: string | null,
  second: string | null,
): MonthComparisonState {
  const window = useMemo(() => monthToDate(), []);
  const [comparison, setComparison] = useState<ExpenseComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      expensesApi
        .getComparison({
          currentFrom: window.from,
          currentTo: window.to,
          previousFrom: window.prevFrom,
          previousTo: window.prevTo,
          base: base ?? undefined,
          secondary: second ?? undefined,
        })
        .then((result) => {
          if (!cancelled) setComparison(result);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load your spending.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [base, second, nonce, window]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { comparison, window, loading, error, reload };
}

export interface ComparisonSeriesState {
  rows: ComparisonRow[];
  loading: boolean;
  error: string | null;
}

/**
 * Two cumulative series — the selected window and the equivalent one before —
 * aligned index by index so the lines can be read against each other.
 */
export function useComparisonSeries(
  range: CompareRange,
  base: string | null,
  second: string | null,
  refreshKey = 0,
): ComparisonSeriesState {
  const windows = useMemo(() => compareWindows(range), [range]);

  const current = useSeries({
    from: windows.current.from,
    to: windows.current.to,
    granularity: windows.granularity,
    base,
    secondary: second,
    refreshKey,
  });
  const previous = useSeries({
    from: windows.previous.from,
    to: windows.previous.to,
    granularity: windows.granularity,
    base,
    secondary: second,
    refreshKey,
  });

  const rows = useMemo(() => {
    const cur = current.data?.points ?? [];
    const prev = previous.data?.points ?? [];
    const length = Math.max(cur.length, prev.length);
    const out: ComparisonRow[] = [];

    let cumCurrent = 0;
    let cumPrevious = 0;
    let cumCurrentSecond = 0;
    let cumPreviousSecond = 0;
    let sawCurrentSecond = false;
    let sawPreviousSecond = false;

    for (let i = 0; i < length; i += 1) {
      const c = cur[i];
      const p = prev[i];

      let currentTotal: number | null = null;
      let previousTotal: number | null = null;

      if (c && c.total != null) {
        cumCurrent += c.total;
        currentTotal = cumCurrent;
      }
      if (p && p.total != null) {
        cumPrevious += p.total;
        previousTotal = cumPrevious;
      }
      if (c?.secondaryTotal != null) {
        cumCurrentSecond += c.secondaryTotal;
        sawCurrentSecond = true;
      }
      if (p?.secondaryTotal != null) {
        cumPreviousSecond += p.secondaryTotal;
        sawPreviousSecond = true;
      }

      out.push({
        key: c?.bucket ?? p?.bucket ?? String(i),
        current: currentTotal,
        previous: previousTotal,
        currentSecond: sawCurrentSecond ? cumCurrentSecond : null,
        previousSecond: sawPreviousSecond ? cumPreviousSecond : null,
      });
    }

    return out;
  }, [current.data, previous.data]);

  return {
    rows,
    loading: current.loading || previous.loading,
    error: current.error ?? previous.error,
  };
}

/**
 * The overall (uncategorised) budget for `month`, if one exists.
 *
 * The budget card is driven by the whole-account budget, so only the budget
 * whose `categoryId` is null is relevant; a null result drives the "Set a
 * budget" prompt rather than inventing a number.
 */
export function useDashboardBudget(
  base: string | null,
  second: string | null,
  month: string,
): { budget: BudgetStatus | null; loading: boolean; error: string | null; reload: () => void } {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      expensesApi
        .getBudgetStatus({ month, base: base ?? undefined, secondary: second ?? undefined })
        .then((result) => {
          if (!cancelled) setBudget(result.items.find((item) => item.categoryId === null) ?? null);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load your budget.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [base, second, month, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { budget, loading, error, reload };
}

/** The most recent expenses, newest first, for the dashboard's recent card. */
export function useRecentExpenses(limit = 6): {
  data: Paginated<Expense> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<Paginated<Expense> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      expensesApi
        .listExpenses({ page: 1, limit, sort: "date_desc" })
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load recent expenses.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [limit, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, reload };
}
