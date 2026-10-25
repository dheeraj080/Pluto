"use client";

/**
 * First-visit onboarding: pick the reporting (base) currency.
 *
 * Persisted through the existing localStorage preference — no backend change.
 * The choice only affects how spending is *summarised*; each expense stays in
 * the currency it was recorded in. Skipping marks onboarding done so the
 * prompt does not reappear.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthCard } from "@/components/auth-shell";
import { Button, ErrorNote, Field, Select, Skeleton } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { ratesApi } from "@/lib/expenses";
import {
  markOnboardingDone,
  readBaseCurrency,
  writeBaseCurrency,
} from "@/lib/base-currency";
import { getAccessToken, getRefreshToken } from "@/lib/api";
import type { SupportedCurrency } from "@/lib/types";

const POPULAR = ["EUR", "USD", "GBP", "SGD", "CHF", "JPY", "INR", "AUD", "CAD"];

export default function OnboardingPage() {
  const router = useRouter();
  const [currencies, setCurrencies] = useState<SupportedCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("USD");

  useEffect(() => {
    if (!getAccessToken() && !getRefreshToken()) {
      router.replace("/login");
      return;
    }
    const stored = readBaseCurrency();
    let cancelled = false;
    const timer = setTimeout(() => {
      ratesApi
        .getSupportedCurrencies()
        .then((list) => {
          if (cancelled) return;
          setCurrencies(list);
          if (stored && list.some((c) => c.code === stored)) setSelected(stored);
          else if (list.some((c) => c.code === "USD")) setSelected("USD");
          else if (list[0]) setSelected(list[0].code);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Could not load currencies.");
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
  }, [router]);

  const finish = (code: string | null) => {
    if (code) writeBaseCurrency(code);
    markOnboardingDone();
    router.replace("/expenses");
  };

  const popular = currencies.filter((c) => POPULAR.includes(c.code));
  const selectedCurrency = currencies.find((c) => c.code === selected) ?? null;

  return (
    <AuthShell>
      <AuthCard>
        <p className="text-xs font-semibold text-primary">
          Welcome to Pluto
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
          Choose your reporting currency
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Every total, budget and report will be shown in this currency. Your expenses stay exactly
          as you paid them — this only changes how they&apos;re summarised.
        </p>

        {loading ? (
          <div className="mt-6 space-y-3" aria-busy="true">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {popular.map((currency) => {
                const active = currency.code === selected;
                return (
                  <button
                    key={currency.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(currency.code)}
                    className={`flex flex-col items-start rounded-[var(--radius-stock,8px)] border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      active
                        ? "border-primary bg-primary-subtle text-primary"
                        : "border-border bg-background text-ink hover:border-border-strong hover:bg-paper"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between text-sm font-semibold">
                      {currency.code}
                      {active && <IconCheck className="h-4 w-4" />}
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-xs text-muted">{currency.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <Field
                label="All currencies"
                htmlFor="all-currencies"
                hint={
                  selectedCurrency
                    ? `${selectedCurrency.name} (${selectedCurrency.symbol})`
                    : undefined
                }
              >
                <Select
                  id="all-currencies"
                  value={selected}
                  onChange={setSelected}
                >
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} — {currency.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </>
        )}

        {error && (
          <div className="mt-5">
            <ErrorNote message={error} />
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primary" size="lg" className="w-full" onClick={() => finish(selected)}>
            Continue to expenses
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => finish(null)}>
            Skip for now
          </Button>
        </div>
      </AuthCard>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        You can change your reporting currency at any time from the dashboard.
      </p>
    </AuthShell>
  );
}