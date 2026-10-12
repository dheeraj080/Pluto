"use client";

/**
 * Shared loaders for the expense screens.
 *
 * Pages in this app own their state with useState/useEffect rather than a
 * data-fetching library, so the repeated category/currency loading and the
 * base-currency resolution live here instead of being copy-pasted five times.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { expensesApi, ratesApi, usersApi } from "@/lib/expenses";
import { hasStoredSession } from "@/lib/api";
import {
  getBaseCurrency,
  getBaseCurrencyServerSnapshot,
  getSecondaryCurrencyServerSnapshot,
  isOnboardingDismissed,
  markOnboardingDone,
  readBaseCurrency,
  readSecondaryCurrency,
  subscribeBaseCurrency,
  writeBaseCurrency,
  writeSecondaryCurrency,
} from "@/lib/base-currency";
import type {
  CategoryTrendsResponse,
  ExpenseCategory,
  ExpenseSeriesResponse,
  RateHistoryResponse,
  RateSnapshot,
  SeriesGranularity,
  SupportedCurrency,
  UserProfile,
} from "@/lib/types";

interface ExpenseSetup {
  categories: ExpenseCategory[];
  currencies: SupportedCurrency[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads categories and the supported-currency list together.
 *
 * Categories feed the dashboard filter, the add/edit forms and the budget
 * form; currencies feed every amount input. The server seeds a default
 * category set on first read, so this call is also what makes a new account
 * immediately usable.
 */
export function useExpenseSetup(): ExpenseSetup & { reloadCategories: () => Promise<void> } {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [currencies, setCurrencies] = useState<SupportedCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      Promise.all([expensesApi.listCategories(), ratesApi.getSupportedCurrencies()])
        .then(([categoryList, currencyList]) => {
          if (cancelled) return;
          setCategories(categoryList);
          setCurrencies(currencyList);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Failed to load expense settings.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const reloadCategories = useCallback(async () => {
    setCategories(await expensesApi.listCategories());
  }, []);

  return { categories, currencies, loading, error, reloadCategories };
}

interface BaseCurrencyState {
  /** Effective base, or null to let the server default apply. */
  base: string | null;
  /** Persist the user's choice. */
  setBase: (code: string) => void;
}

/**
 * Reporting base currency for the current screen.
 *
 * Backed by localStorage (`?base=` override first, then the stored preference),
 * read as an external store so the value is already correct on the first
 * render — no effect-driven refetch and no hydration mismatch.
 *
 * `setBase` also persists the choice to the server (`PATCH /users/me`) when a
 * session exists, so a chosen reporting currency follows the user across
 * devices. The persisted write is fire-and-forget: a failure keeps the local
 * preference working for this session.
 */
export function useBaseCurrency(): BaseCurrencyState {
  const base = useSyncExternalStore(
    subscribeBaseCurrency,
    getBaseCurrency,
    getBaseCurrencyServerSnapshot,
  );

  const setBase = useCallback((code: string) => {
    writeBaseCurrency(code);
    if (hasStoredSession()) {
      usersApi
        .updateProfile({ baseCurrency: code })
        .then((updated) => {
          // Echo the server-normalized value so the local store mirrors
          // exactly what was persisted (e.g. casing).
          if (code !== updated.baseCurrency) {
            writeBaseCurrency(updated.baseCurrency ?? code);
          }
        })
        .catch(() => {
          /* Non-fatal: the local preference still applies this session. */
        });
    }
  }, []);

  return { base, setBase };
}

export interface PairState {
  /** Effective base currency, or null to let the server default apply. */
  base: string | null;
  /** Second currency, or null when the user has not chosen one. */
  second: string | null;
  /** Persist a new base currency (also pushed to the server profile). */
  setBase: (code: string) => void;
  /** Persist a new second currency. */
  setSecond: (code: string) => void;
  /** Swap base ⇄ second so the header control can flip the pair. */
  swap: () => void;
}

/**
 * The Pair: the two currencies every figure is shown in.
 *
 * `base` drives the server aggregation; `second` is a display companion the
 * server re-expresses each figure in. Both are external stores, so screens
 * re-render the moment either changes. A null `second` simply means
 * single-currency display — the honest default for someone who never crosses
 * borders.
 */
export function usePair(): PairState {
  const { base, setBase } = useBaseCurrency();
  const second = useSyncExternalStore(
    subscribeBaseCurrency,
    readSecondaryCurrency,
    getSecondaryCurrencyServerSnapshot,
  );

  const setSecond = useCallback((code: string) => writeSecondaryCurrency(code), []);

  const swap = useCallback(() => {
    if (!second) return;
    setBase(second);
    writeSecondaryCurrency(base);
  }, [base, second, setBase]);

  return { base, second, setBase, setSecond, swap };
}

/**
 * Reconciles the persisted base-currency preference with the authenticated
 * profile once `GET /users/me` has resolved.
 *
 * The server value is authoritative after auth:
 * - a server-set base is written back into localStorage so every screen
 *   renders consistently (the `?base=` URL override still wins at render time);
 * - a preference that only exists client-side (e.g. picked during onboarding)
 *   is pushed to the server exactly once, so it follows the user across
 *   devices. It is skipped once the server echoes it back;
 * - an uninitialized client never writes over the server value.
 */
export function useBaseCurrencyReconciliation(profile: UserProfile | null): void {
  useEffect(() => {
    if (!profile) return;
    const serverBase = profile.baseCurrency;
    const localBase = readBaseCurrency();

    if (serverBase) {
      // Server wins: mirror its value into local storage.
      if (localBase !== serverBase) writeBaseCurrency(serverBase);
      return;
    }
    if (localBase) {
      usersApi
        .updateProfile({ baseCurrency: localBase })
        .then((updated) => {
          if (localBase !== updated.baseCurrency) {
            writeBaseCurrency(updated.baseCurrency ?? localBase);
          }
        })
        .catch(() => {
          /* Non-fatal: the local preference still works this session. */
        });
    }
  }, [profile]);
}

/**
 * Latest public rate snapshot, for display-only conversion previews.
 *
 * Loaded once per screen (or per base, when one is passed); failure is
 * non-fatal (the preview simply stays hidden), so errors are swallowed
 * intentionally.
 */
export function useRateSnapshot(base?: string): RateSnapshot | null {
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    ratesApi
      .getLatest(base)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        /* preview is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  return snapshot;
}

/**
 * Whether the user still needs to choose a reporting currency.
 *
 * Server snapshot reports "already dismissed" so the prompt never flashes in
 * prerendered HTML; it appears after hydration only for genuinely new users.
 */
function getReportingSetupSnapshot(): string {
  return `${getBaseCurrency() ?? ""}|${isOnboardingDismissed() ? "1" : "0"}`;
}

function getReportingSetupServerSnapshot(): string {
  return "|1";
}

export function useReportingSetup(): { needsSetup: boolean; hasBase: boolean; dismiss: () => void } {
  const snapshot = useSyncExternalStore(
    subscribeBaseCurrency,
    getReportingSetupSnapshot,
    getReportingSetupServerSnapshot,
  );
  const separator = snapshot.lastIndexOf("|");
  const base = snapshot.slice(0, separator);
  const dismissed = snapshot.slice(separator + 1) === "1";

  return {
    needsSetup: base === "" && !dismissed,
    hasBase: base !== "",
    dismiss: markOnboardingDone,
  };
}

/* ------------------------------------------------------------------ */
/* Chart data loaders                                                  */
/* ------------------------------------------------------------------ */

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * A stable string for a set of request parameters. The hook records the key its
 * data belongs to and derives `loading` by comparing it to the current key —
 * so a parameter change flips back to the loading state during render, without
 * a synchronous `setState` inside an effect.
 */
function asyncKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => (part == null ? "" : String(part))).join("|");
}

interface KeyedState<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Exchange-rate history for a pair; idle until a quote currency is known. */
export function useRateHistory(params: {
  base?: string | null;
  quote?: string | null;
  from?: string;
  to?: string;
}): AsyncState<RateHistoryResponse> {
  const { base, quote, from, to } = params;
  const key = asyncKey([base, quote, from, to]);
  const [state, setState] = useState<KeyedState<RateHistoryResponse>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!quote) return;
    let cancelled = false;
    ratesApi
      .getHistory({ base: base ?? undefined, quote, from, to })
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ key, data: null, error: errorMessage(err, "Failed to load rate history.") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, base, quote, from, to]);

  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    loading: Boolean(quote) && !fresh,
    error: fresh ? state.error : null,
  };
}

/** Bucketed spending series for line charts and sparklines. */
export function useSeries(params: {
  from?: string;
  to?: string;
  granularity?: SeriesGranularity;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<ExpenseSeriesResponse> {
  const { from, to, granularity, base, secondary } = params;
  const key = asyncKey([from, to, granularity, base, secondary]);
  const [state, setState] = useState<KeyedState<ExpenseSeriesResponse>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    expensesApi
      .getSeries({
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
            error: errorMessage(err, "Failed to load the spending series."),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [key, from, to, granularity, base, secondary]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, loading: !fresh, error: fresh ? state.error : null };
}

/** Per-category monthly series for the multi-line category chart. */
export function useCategoryTrends(params: {
  months?: number;
  top?: number;
  base?: string | null;
  secondary?: string | null;
}): AsyncState<CategoryTrendsResponse> {
  const { months, top, base, secondary } = params;
  const key = asyncKey([months, top, base, secondary]);
  const [state, setState] = useState<KeyedState<CategoryTrendsResponse>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    expensesApi
      .getCategoryTrends({
        months,
        top,
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
            error: errorMessage(err, "Failed to load category trends."),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [key, months, top, base, secondary]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, loading: !fresh, error: fresh ? state.error : null };
}
