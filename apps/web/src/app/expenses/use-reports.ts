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

import { useCallback, useEffect, useMemo, useState } from "react";
import { expensesApi } from "@/lib/expenses";
import { withPrevious, type ReportGranularity } from "@/lib/ranges";
import type {
  ByDayOfWeekResponse,
  CategorySeriesResponse,
  Expense,
  ExpenseComparison,
  ExpenseSeriesResponse,
  ExpenseSummary,
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
}): AsyncState<ExpenseSummary> & { reload: () => void } {
  const { from, to, base, secondary } = params;
  const [nonce, setNonce] = useState(0);
  const key = keyOf([from, to, base, secondary, nonce]);
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

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: !fresh,
    error: fresh ? state.error : null,
    reload,
  };
}

/**
 * The window in force paired with the equal-length window immediately before
 * it, for the KPI row's "vs previous N days" pills. One request, so the current
 * and previous totals — and the count and average built from them — can never
 * disagree.
 */
export function useReportComparison(params: {
  from?: string;
  to?: string;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<ExpenseComparison> & { reload: () => void } {
  const { from, to, base, secondary } = params;
  const window = useMemo(
    () => (from && to ? withPrevious(from, to) : null),
    [from, to],
  );
  const [nonce, setNonce] = useState(0);
  const key = keyOf([from, to, base, secondary, nonce]);
  const [state, setState] = useState<KeyedState<ExpenseComparison>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!window) return;
    let cancelled = false;
    expensesApi
      .getComparison({
        currentFrom: window.from,
        currentTo: window.to,
        previousFrom: window.prevFrom,
        previousTo: window.prevTo,
        base: base ?? undefined,
        secondary: secondary ?? undefined,
      })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ key, data: null, error: message(err, "Failed to load the period comparison.") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, window, base, secondary]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: Boolean(window) && !fresh,
    error: fresh ? state.error : null,
    reload,
  };
}

/** Weekday profile for the day-of-week line. */
export function useReportByDayOfWeek(params: {
  from?: string;
  to?: string;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<ByDayOfWeekResponse> & { reload: () => void } {
  const { from, to, base, secondary } = params;
  const [nonce, setNonce] = useState(0);
  const key = keyOf([from, to, base, secondary, nonce]);
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

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: !fresh,
    error: fresh ? state.error : null,
    reload,
  };
}

export interface ReportSeriesComparison {
  /** The selected window, bucketed at the requested granularity. */
  current: ExpenseSeriesResponse | null;
  /** The equal-length window immediately before it, same buckets. */
  previous: ExpenseSeriesResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Two series for the comparison line — the selected window and the one before
 * it — fetched as a single paired load so the solid and dashed lines can never
 * belong to different ranges or different rates.
 */
export function useReportSeriesComparison(params: {
  from?: string;
  to?: string;
  granularity?: ReportGranularity;
  base?: string | null;
  secondary?: string | null;
}): ReportSeriesComparison {
  const { from, to, granularity, base, secondary } = params;
  const window = useMemo(() => (from && to ? withPrevious(from, to) : null), [from, to]);
  const [nonce, setNonce] = useState(0);
  const key = keyOf([from, to, granularity, base, secondary, nonce]);
  const [state, setState] = useState<
    KeyedState<{ current: ExpenseSeriesResponse; previous: ExpenseSeriesResponse }>
  >({ key: null, data: null, error: null });

  useEffect(() => {
    if (!window || !granularity) return;
    let cancelled = false;
    const query = {
      granularity,
      base: base ?? undefined,
      secondary: secondary ?? undefined,
    };
    Promise.all([
      expensesApi.getSeries({ ...query, from: window.from, to: window.to }),
      expensesApi.getSeries({ ...query, from: window.prevFrom, to: window.prevTo }),
    ])
      .then(([current, previous]) => {
        if (!cancelled) setState({ key, data: { current, previous }, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ key, data: null, error: message(err, "Failed to load the spending series.") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, window, granularity, base, secondary]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const fresh = state.key === key;
  return {
    current: fresh ? (state.data?.current ?? null) : null,
    previous: fresh ? (state.data?.previous ?? null) : null,
    loading: Boolean(window && granularity) && !fresh,
    error: fresh ? state.error : null,
    reload,
  };
}

/** Expenses in a specific window, for the month drill-down list and the category drawer. */
export function useReportExpenses(params: {
  from?: string;
  to?: string;
  categoryId?: string;
  limit?: number;
}): AsyncState<Paginated<Expense>> & { reload: () => void } {
  const { from, to, categoryId, limit = 25 } = params;
  const [nonce, setNonce] = useState(0);
  const key = keyOf([from, to, categoryId, limit, nonce]);
  const enabled = Boolean(from && to && categoryId);
  const [state, setState] = useState<KeyedState<Paginated<Expense>>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!from || !to || !categoryId) return;
    let cancelled = false;
    expensesApi
      .listExpenses({ page: 1, limit, from, to, categoryId, sort: "date_desc" })
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
  }, [key, from, to, categoryId, limit]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: enabled && !fresh,
    error: fresh ? state.error : null,
    reload,
  };
}

/** Per-category series over the same range, for the category section's views. */
export function useReportCategorySeries(params: {
  from?: string;
  to?: string;
  granularity?: ReportGranularity;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<CategorySeriesResponse> & { reload: () => void } {
  const { from, to, granularity, base, secondary } = params;
  const [nonce, setNonce] = useState(0);
  const key = keyOf([from, to, granularity, base, secondary, nonce]);
  const [state, setState] = useState<KeyedState<CategorySeriesResponse>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!from || !to || !granularity) return;
    let cancelled = false;
    expensesApi
      .getCategorySeries({
        from,
        to,
        granularity,
        base: base ?? undefined,
        secondary: secondary ?? undefined,
      })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            key,
            data: null,
            error: message(err, "Failed to load category trends."),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [key, from, to, granularity, base, secondary]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: Boolean(from && to && granularity) && !fresh,
    error: fresh ? state.error : null,
    reload,
  };
}
