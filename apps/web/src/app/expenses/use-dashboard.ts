"use client";

/**
 * Loaders for the bento dashboard.
 *
 * The dashboard answers "how much did I spend today / this week / this month?"
 * with three `GET /expenses/comparison` calls — one per window — each of which
 * already returns the current total, the previous total and the delta, so no
 * client-side percentage math is needed. A separate call feeds the recent
 * transactions tile.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { expensesApi } from "@/lib/expenses";
import { windowFor, type DateWindow, type WindowKind } from "@/lib/ranges";
import type { Expense, ExpenseComparison, Paginated } from "@/lib/types";

export interface DashboardWindow {
  kind: WindowKind;
  range: DateWindow;
  comparison: ExpenseComparison;
}

export type DashboardWindows = Record<WindowKind, DashboardWindow>;

/**
 * Percentage change between the current and previous totals, or null when the
 * comparison is not meaningful: unconvertible, a missing total, or a previous
 * total of zero (which would make the ratio unbounded).
 */
export function comparisonDeltaPct(comparison: ExpenseComparison): number | null {
  if (!comparison.converted) return null;
  const { current, previous } = comparison;
  if (current.total === null || previous.total === null || previous.total <= 0) return null;
  return Number.isFinite(comparison.delta.totalPct) ? comparison.delta.totalPct : null;
}

/** Today / this week / this month, each with its previous-period comparison. */
export function useDashboardWindows(base: string | null): {
  windows: DashboardWindows | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  // Computed once per mount: the windows describe "now", which should not
  // move out from under an in-flight request.
  const ranges = useMemo(
    () => ({
      day: windowFor("day"),
      week: windowFor("week"),
      month: windowFor("month"),
    }),
    [],
  );

  const [windows, setWindows] = useState<DashboardWindows | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      const load = (kind: WindowKind): Promise<DashboardWindow> => {
        const range = ranges[kind];
        return expensesApi
          .getComparison({
            currentFrom: range.from,
            currentTo: range.to,
            previousFrom: range.prevFrom,
            previousTo: range.prevTo,
            base: base ?? undefined,
          })
          .then((comparison) => ({ kind, range, comparison }));
      };

      Promise.all([load("day"), load("week"), load("month")])
        .then(([day, week, month]) => {
          if (cancelled) return;
          setWindows({ day, week, month });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Failed to load your spending.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [base, nonce, ranges]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { windows, loading, error, reload };
}

/** The most recent expenses, newest first, for the dashboard's left column. */
export function useRecentExpenses(limit = 8): {
  data: Paginated<Expense> | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<Paginated<Expense> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [limit]);

  return { data, loading, error };
}
