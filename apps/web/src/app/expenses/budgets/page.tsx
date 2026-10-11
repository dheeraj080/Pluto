"use client";

/**
 * Budgets: set per-category or whole-account limits and see how the current
 * month is tracking against them.
 *
 * Spend is converted into the selected base currency server-side; when no rate
 * snapshot is available the server falls back to comparing only spend recorded
 * in the budget's own currency, which is exact for single-currency users.
 *
 * Laid out as a bento: the tracking panel and the add form sit side by side on
 * wide screens and stack on mobile.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { expensesApi } from "@/lib/expenses";
import { currentMonth, formatMoney, formatPercent } from "@/lib/format";
import type { BudgetStatus, BudgetStatusResponse } from "@/lib/types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  LoadingNote,
  PageHeader,
  Select,
} from "@/components/ui";
import { BentoGrid, BentoTile } from "@/components/bento";
import { useBaseCurrency, useExpenseSetup } from "../use-expenses";
import { ConversionNotice } from "../conversion-notice";

/** Visual fill for one budget; clamped so over-budget stops at 100% width. */
function BudgetBar({ status }: { status: BudgetStatus }) {
  const width = Math.min(100, Math.max(0, status.percentage));
  const tone = status.overBudget ? "bg-danger" : status.percentage >= 80 ? "bg-amber-500" : "bg-success";
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default function BudgetsPage() {
  const { categories, currencies, error: setupError, reloadCategories } = useExpenseSetup();
  const { base, setBase } = useBaseCurrency();

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
      setStatus(await expensesApi.getBudgetStatus({ month, base: base ?? undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets.");
    } finally {
      setLoading(false);
    }
  }, [base, month]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // An empty selection means "not chosen yet": fall back to the first loaded
  // option rather than syncing it in an effect.
  const effectiveCurrency = currency || currencies[0]?.code || "";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Set a monthly or yearly limit per category, or one overall limit."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              aria-label="Month to evaluate"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-40"
            />
            <Select
              aria-label="Base currency"
              value={base ?? ""}
              onChange={(event) => setBase(event.target.value)}
              className="w-28"
            >
              <option value="">Default</option>
              {currencies.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}

      {status && (
        <ConversionNotice
          status={status.conversionStatus}
          unconvertedCurrencies={status.unconvertedCurrencies}
          provenance={status.rateProvenance}
        />
      )}

      <BentoGrid>
        <BentoTile title={`Progress — ${month}`} className="lg:col-span-7">
          {loading && !status ? (
            <LoadingNote label="Loading budgets…" />
          ) : !status || status.items.length === 0 ? (
            <EmptyState
              title="No budgets yet"
              description="Add a budget to start tracking spending against a limit."
            />
          ) : (
            <ul className="divide-y divide-border">
              {status.items.map((item) => (
                <li key={item.budgetId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-medium">
                      {item.color && (
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                      {item.categoryName ?? "All expenses"}
                      <span className="text-xs text-muted">{item.period.toLowerCase()}</span>
                      {!item.applied && <Badge tone="warn">not yet active</Badge>}
                      {item.overBudget && <Badge tone="danger">over budget</Badge>}
                      {item.ratePolicy === "estimate" && <Badge tone="gold">estimated</Badge>}
                      {item.conversionStatus === "unavailable" && (
                        <Badge tone="warn">rates unavailable</Badge>
                      )}
                    </span>
                    <span className="tabular-nums">
                      <span className="font-medium">{formatMoney(item.spent, item.currency)}</span>
                      <span className="text-muted">
                        {" / "}
                        {formatMoney(item.budgetAmount, item.currency)}
                      </span>
                    </span>
                  </div>
                  <BudgetBar status={item} />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className={item.remaining < 0 ? "text-danger" : "text-muted"}>
                      {item.remaining < 0
                        ? `${formatMoney(Math.abs(item.remaining), item.currency)} over`
                        : `${formatMoney(item.remaining, item.currency)} left`}
                      {" · "}
                      {formatPercent(item.percentage)} used
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void handleDelete(item.budgetId, item.categoryName ?? "all expenses")
                      }
                      className="text-sm text-danger underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BentoTile>

        <BentoTile title="Add budget" className="lg:col-span-5">
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="grid gap-4 sm:grid-cols-2"
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
                  onChange={(event) => setCategoryId(event.target.value)}
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
                onChange={(event) => setCurrency(event.target.value)}
                required
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
                onChange={(event) => setPeriod(event.target.value as "MONTHLY" | "YEARLY")}
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
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
