"use client";

/**
 * Report loaders.
 *
 * Reports coordinate several server aggregates that all react to the same
 * period and Pair, so each loader follows the keyed-state pattern used by the
 * chart hooks: it records the request key its data belongs to and derives
 * `loading` by comparison, so a parameter change flips back to loading during
 * render rather than via a synchronous `setState` in an effect body.
 *
 * Every loader passes `secondary` through, so the server can express each
 * figure in both currencies from one resolved rate snapshot.
 */

import { useEffect, useState } from "react";
import { expensesApi } from "@/lib/expenses";
import type {
  ByDayOfWeekResponse,
  Expense,
  ExpenseSummary,
  ExpenseTrend,
  Paginated,
} from "@/lib/types";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface KeyedState<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

function keyOf(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => (part == null ? "" : String(part))).join("|");
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Period totals, with both Pair values, for the KPI row and category list. */
export function useReportSummary(params: {
  from?: string;
  to?: string;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<ExpenseSummary> {
  const { from, to, base, secondary } = params;
  const key = keyOf([from, to, base, secondary]);
  const [state, setState] = useState<KeyedState<ExpenseSummary>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    expensesApi
      .getSummary({
        from,
        to,
        base: base ?? undefined,
        secondary: secondary ?? undefined,
      })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ key, data: null, error: message(err, "Failed to load the summary.") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, from, to, base, secondary]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, loading: !fresh, error: fresh ? state.error : null };
}

/** Month-by-month totals for the long trend line. */
export function useReportTrends(params: {
  months?: number;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<ExpenseTrend> {
  const { months, base, secondary } = params;
  const key = keyOf([months, base, secondary]);
  const [state, setState] = useState<KeyedState<ExpenseTrend>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    expensesApi
      .getTrends({ months, base: base ?? undefined, secondary: secondary ?? undefined })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ key, data: null, error: message(err, "Failed to load the trend.") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, months, base, secondary]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, loading: !fresh, error: fresh ? state.error : null };
}

/** Weekday profile for the day-of-week line. */
export function useReportByDayOfWeek(params: {
  from?: string;
  to?: string;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<ByDayOfWeekResponse> {
  const { from, to, base, secondary } = params;
  const key = keyOf([from, to, base, secondary]);
  const [state, setState] = useState<KeyedState<ByDayOfWeekResponse>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    expensesApi
      .getByDayOfWeek({
        from,
        to,
        base: base ?? undefined,
        secondary: secondary ?? undefined,
      })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ key, data: null, error: message(err, "Failed to load the weekday profile.") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, from, to, base, secondary]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, loading: !fresh, error: fresh ? state.error : null };
}

/** Expenses in a specific window, for the month drill-down list. */
export function useReportExpenses(params: {
  from?: string;
  to?: string;
  limit?: number;
}): AsyncState<Paginated<Expense>> {
  const { from, to, limit = 25 } = params;
  const key = keyOf([from, to, limit]);
  const enabled = Boolean(from && to);
  const [state, setState] = useState<KeyedState<Paginated<Expense>>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    expensesApi
      .listExpenses({ page: 1, limit, from, to, sort: "date_desc" })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ key, data: null, error: message(err, "Failed to load these expenses.") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, from, to, limit]);

  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: enabled && !fresh,
    error: fresh ? state.error : null,
  };
}
