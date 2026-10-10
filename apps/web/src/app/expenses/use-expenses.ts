"use client";

/**
 * Shared loaders for the expense screens.
 *
 * Pages in this app own their state with useState/useEffect rather than a
 * data-fetching library, so the repeated category/currency loading and the
 * base-currency resolution live here instead of being copy-pasted five times.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { expensesApi, ratesApi } from "@/lib/expenses";
import {
  getBaseCurrency,
  getBaseCurrencyServerSnapshot,
  isOnboardingDismissed,
  markOnboardingDone,
  subscribeBaseCurrency,
  writeBaseCurrency,
} from "@/lib/base-currency";
import type { ExpenseCategory, RateSnapshot, SupportedCurrency } from "@/lib/types";

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
 */
export function useBaseCurrency(): BaseCurrencyState {
  const base = useSyncExternalStore(
    subscribeBaseCurrency,
    getBaseCurrency,
    getBaseCurrencyServerSnapshot,
  );

  const setBase = useCallback((code: string) => {
    writeBaseCurrency(code);
  }, []);

  return { base, setBase };
}

/**
 * Latest public rate snapshot, for display-only conversion previews.
 *
 * Loaded once per screen; failure is non-fatal (the preview simply stays
 * hidden), so errors are swallowed intentionally.
 */
export function useRateSnapshot(): RateSnapshot | null {
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    ratesApi
      .getLatest()
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        /* preview is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
