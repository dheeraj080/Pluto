"use client";

/**
 * Budgets: set per-category or whole-account limits and see how the current
 * month is tracking against them.
 *
 * Every figure is shown in the Pair: the spend as a Base value with the Second
 * beside it, and the limit underneath in both. Progress is a thin mint line
 * that turns soft amber when a budget is exceeded — never red, because going
 * over a budget is information, not an error.
 *
 * Spend is converted into the Base server-side; when no rate snapshot is
 * available the server compares only same-currency spend and flags it.
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { expensesApi } from "@/lib/expenses";
import { currentMonth, formatMoney, formatMonth, formatPercent } from "@/lib/format";
import type { BudgetStatus, BudgetStatusResponse } from "@/lib/types";
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { DualAmount } from "@/components/amount";
import { CategorySwatch } from "@/components/category-swatch";
import { useExpenseSetup, usePair } from "../use-expenses";
import { ConversionAlert, ConversionPill } from "../conversion-notice";

/** A quiet status tag; amber for the states worth noticing, grey otherwise. */
function Tag({ tone = "neutral", children }: { tone?: "neutral" | "warn"; children: ReactNode }) {
  const tones = {
    neutral: "border-border bg-surface-muted text-muted",
    warn: "border-warning/25 bg-warning-subtle text-warning",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function BudgetRow({
  item,
  baseCurrency,
  secondCurrency,
  onRemove,
}: {
  item: BudgetStatus;
  baseCurrency: string;
  secondCurrency: string | null;
  onRemove: () => void;
}) {
  const secondSpent = item.secondarySpent ?? null;
  const secondLimit = item.secondaryBudgetAmount ?? null;
  const secondRemaining = item.secondaryRemaining ?? null;
  const width = Math.min(100, Math.max(0, item.percentage));
  const over = item.overBudget;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            {item.color && <CategorySwatch color={item.color} size={9} />}
            <span className="text-sm font-medium text-ink">
              {item.categoryName ?? "All expenses"}
            </span>
            <span className="text-xs text-muted">
              {item.period === "MONTHLY" ? "monthly" : "yearly"}
            </span>
            {!item.applied && <Tag>not yet active</Tag>}
            {over && <Tag tone="warn">over budget</Tag>}
            {item.ratePolicy === "estimate" && <Tag>estimated</Tag>}
            {item.conversionStatus === "unavailable" && <Tag tone="warn">rates unavailable</Tag>}
          </span>
          <p className="mt-1 text-xs text-muted">
            <span className="tabular-nums text-ink">
              {formatMoney(Math.abs(item.remaining), baseCurrency)}
            </span>
            {secondRemaining !== null && secondCurrency && (
              <span className="tabular-nums"> · {formatMoney(Math.abs(secondRemaining), secondCurrency)}</span>
            )}{" "}
            {over ? "over" : "left"} · {formatPercent(item.percentage)} used
          </p>
        </div>
        <div className="shrink-0 text-right">
          <DualAmount
            amount={item.spent}
            currency={baseCurrency}
            secondaryAmount={secondSpent}
            secondaryCurrency={secondSpent !== null ? secondCurrency : null}
            size="sm"
            layout="stack"
            align="right"
          />
          <p className="mt-0.5 text-xs tabular-nums text-muted">
            of {formatMoney(item.budgetAmount, baseCurrency)}
            {secondLimit !== null && secondCurrency
              ? ` · ${formatMoney(secondLimit, secondCurrency)}`
              : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            backgroundColor: over ? "var(--warning)" : "var(--primary)",
          }}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-muted underline-offset-2 transition-colors hover:text-danger hover:underline"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export default function BudgetsPage() {
  const { categories, currencies, error: setupError, reloadCategories } = useExpenseSetup();
  const { base, second, swap } = usePair();

  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState<BudgetStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [period, setPeriod] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // The status payload already carries each budget's id, so the separate
      // budget list is not needed to render or delete from this screen.
      setStatus(
        await expensesApi.getBudgetStatus({
          month,
          base: base ?? undefined,
          secondary: second ?? undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets.");
    } finally {
      setLoading(false);
    }
  }, [base, second, month]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // An empty selection means "not chosen yet": fall back to the first loaded
  // option rather than syncing it in an effect.
  const effectiveCurrency = currency || currencies[0]?.code || "";
  const baseCurrency = status?.baseCurrency ?? base ?? "USD";
  const secondCurrency = status?.secondaryCurrency ?? second;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!(Number(amount) > 0) || !effectiveCurrency) return;
    setSaving(true);
    setError(null);
    try {
      await expensesApi.createBudget({
        // An empty select value means "no category" — an overall budget.
        categoryId: categoryId || null,
        amount: Number(amount),
        currency: effectiveCurrency,
        period,
        startDate,
      });
      setAmount("");
      await reloadCategories();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the budget.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (budgetId: string, label: string) => {
    if (!window.confirm(`Delete the budget for ${label}?`)) return;
    setError(null);
    try {
      await expensesApi.deleteBudget(budgetId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the budget.");
    }
  };

  const items = status?.items ?? [];

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Budgets"
        dateRange={
          <Input
            type="month"
            aria-label="Month to evaluate"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 w-40"
          />
        }
        info={status ? <ConversionPill provenance={status.rateProvenance} /> : undefined}
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
      />

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}
      {status && (
        <ConversionAlert
          status={status.conversionStatus}
          unconvertedCurrencies={status.unconvertedCurrencies}
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="rounded-3xl border border-border bg-surface lg:col-span-7">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="text-sm font-medium text-ink">Progress</h2>
            <p className="mt-0.5 text-xs text-muted">{formatMonth(month)}</p>
          </div>
          <div className="px-4 pb-5 pt-4 sm:px-5">
            {loading && !status ? (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="No budgets yet"
                description="Add a budget to start tracking spending against a limit."
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <BudgetRow
                    key={item.budgetId}
                    item={item}
                    baseCurrency={baseCurrency}
                    secondCurrency={secondCurrency}
                    onRemove={() =>
                      void handleDelete(item.budgetId, item.categoryName ?? "all expenses")
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface lg:col-span-5">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="text-sm font-medium text-ink">Add budget</h2>
            <p className="mt-0.5 text-xs text-muted">
              A limit per category, or one overall limit.
            </p>
          </div>
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="grid gap-4 px-5 pb-5 pt-4 sm:grid-cols-2 sm:px-6"
          >
            <div className="sm:col-span-2">
              <Field
                label="Applies to"
                htmlFor="budget-category"
                hint="Leave as “All expenses” for an overall budget"
              >
                <Select
                  id="budget-category"
                  value={categoryId}
                  onChange={setCategoryId}
                >
                  <option value="">All expenses</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Amount" htmlFor="budget-amount">
              <Input
                id="budget-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </Field>

            <Field label="Currency" htmlFor="budget-currency">
              <Select
                id="budget-currency"
                value={effectiveCurrency}
                onChange={setCurrency}
              >
                {currencies.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code} — {entry.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Period" htmlFor="budget-period">
              <Select
                id="budget-period"
                value={period}
                onChange={(value) => setPeriod(value as "MONTHLY" | "YEARLY")}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </Select>
            </Field>

            <Field label="Starts" htmlFor="budget-start" hint="Spend before this date is not counted">
              <Input
                id="budget-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </Field>

            <div className="sm:col-span-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving…" : "Add budget"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
