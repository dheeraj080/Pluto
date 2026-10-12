"use client";

/**
 * Transactions: the full, filterable expense list.
 *
 * A table with a sticky header on tablet and up, and stacked cards on phones;
 * both show the recorded amount re-expressed in the Pair (Base bold, Second
 * grey, and a "Paid …" label when the expense was a third currency). Filter
 * chips name the active search / category / currency and clear individually.
 * Deep links from Reports carry `?categoryId` / `?from` / `?to`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { expensesApi, type ExpenseSort } from "@/lib/expenses";
import { formatDate, formatDateRange } from "@/lib/format";
import { dualAmounts } from "@/lib/convert";
import { periodRange, type Period } from "@/lib/ranges";
import type {
  Expense,
  ExpenseCategory,
  ExpenseSummary,
  Paginated,
  TopExpensesResponse,
} from "@/lib/types";
import {
  Button,
  EmptyState,
  ErrorNote,
  Input,
  Pagination,
  SegmentedControl,
  Select,
  Skeleton,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { DualAmount } from "@/components/amount";
import { CategorySwatch } from "@/components/category-swatch";
import { downloadTextFile } from "@/lib/download";
import { IconPlus, IconReceipt, IconSearch } from "@/components/icons";
import { useExpenseSetup, usePair, useRateSnapshot } from "../use-expenses";
import { ConversionAlert, ConversionPill } from "../conversion-notice";

const SORTS: { value: ExpenseSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
];

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "30d", label: "30 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

const LIMIT = 10;

export default function TransactionsPage() {
  const { categories, currencies, error: setupError } = useExpenseSetup();
  const { base, second, swap } = usePair();
  const snapshot = useRateSnapshot();

  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [list, setList] = useState<Paginated<Expense> | null>(null);
  const [top, setTop] = useState<TopExpensesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState("");
  const [sort, setSort] = useState<ExpenseSort>("date_desc");
  const [pageNumber, setPageNumber] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const range = useMemo(
    () => periodRange(period as Period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryResult, listResult, topResult] = await Promise.all([
        expensesApi.getSummary({
          from: range.from,
          to: range.to,
          base: base ?? undefined,
          secondary: second ?? undefined,
        }),
        expensesApi.listExpenses({
          page: pageNumber,
          limit: LIMIT,
          categoryId: categoryId || undefined,
          currency: currency || undefined,
          from: range.from,
          to: range.to,
          search: search || undefined,
          sort,
        }),
        expensesApi.getTop({
          from: range.from,
          to: range.to,
          limit: 5,
          base: base ?? undefined,
          secondary: second ?? undefined,
        }),
      ]);
      setSummary(summaryResult);
      setList(listResult);
      setTop(topResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses.");
    }
  }, [base, second, categoryId, currency, pageNumber, range, search, sort]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = await expensesApi.exportCsv({
        from: range.from,
        to: range.to,
        categoryId: categoryId || undefined,
        currency: currency || undefined,
        search: search || undefined,
        base: base ?? undefined,
        secondary: second ?? undefined,
      });
      downloadTextFile(`expenses-${range.from}_${range.to}.csv`, csv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export expenses.");
    } finally {
      setExporting(false);
    }
  }, [base, second, categoryId, currency, range, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const urlCategory = params.get("categoryId");
      const urlFrom = params.get("from");
      const urlTo = params.get("to");
      if (urlCategory) setCategoryId(urlCategory);
      if (urlFrom || urlTo) {
        setPeriod("custom");
        if (urlFrom) setCustomFrom(urlFrom);
        if (urlTo) setCustomTo(urlTo);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPageNumber(1);
    };

  const clearFilters = () => {
    setSearch("");
    setCategoryId("");
    setCurrency("");
    setPageNumber(1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expensesApi.deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the expense.");
    } finally {
      setDeleting(false);
    }
  };

  const effectiveBase = base ?? summary?.baseCurrency ?? snapshot?.baseCurrency ?? null;
  const busy = !list && !error;

  /** The Pair values for one recorded expense, for either layout. */
  const describe = (expense: Expense) => {
    const pair = dualAmounts(expense.amount, expense.currency, effectiveBase, second, snapshot);
    const primaryCurrency = pair.base !== null ? (effectiveBase ?? expense.currency) : expense.currency;
    const primaryAmount = pair.base ?? expense.amount;
    return {
      amount: primaryAmount,
      currency: primaryCurrency,
      secondAmount: pair.second,
      secondCurrency: pair.second !== null ? second : null,
      recorded:
        expense.currency !== primaryCurrency
          ? { amount: expense.amount, currency: expense.currency }
          : null,
    };
  };

  const chips: { key: string; label: string; onClear: () => void }[] = [];
  if (search) {
    chips.push({ key: "search", label: `“${search}”`, onClear: () => resetPage(setSearch)("") });
  }
  if (categoryId) {
    const name = categories.find((category) => category.id === categoryId)?.name ?? categoryId;
    chips.push({ key: "category", label: name, onClear: () => resetPage(setCategoryId)("") });
  }
  if (currency) {
    chips.push({ key: "currency", label: currency, onClear: () => resetPage(setCurrency)("") });
  }

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Transactions"
        dateRange={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={PERIODS}
              value={period}
              onChange={resetPage(setPeriod)}
              label="Reporting period"
            />
            {period === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  aria-label="From date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(event) => resetPage(setCustomFrom)(event.target.value)}
                  className="h-9 w-36"
                />
                <span aria-hidden="true" className="text-muted">
                  –
                </span>
                <Input
                  type="date"
                  aria-label="To date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) => resetPage(setCustomTo)(event.target.value)}
                  className="h-9 w-36"
                />
              </div>
            )}
          </div>
        }
        info={summary ? <ConversionPill provenance={summary.rateProvenance} /> : undefined}
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
        actions={
          <>
            <Link
              href="/expenses/new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconPlus className="h-4 w-4" />
              Add expense
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void exportCsv()}
              loading={exporting}
              disabled={!list || list.total === 0}
            >
              Export CSV
            </Button>
          </>
        }
      />

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}
      {summary && (
        <ConversionAlert
          status={summary.conversionStatus}
          unconvertedCurrencies={summary.unconvertedCurrencies}
        />
      )}

      <section className="rounded-3xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <div>
            <h2 className="text-sm font-medium text-ink">All expenses</h2>
            <p className="mt-0.5 text-xs text-muted">
              {formatDateRange(range.from, range.to)} ·{" "}
              <span className="tabular-nums">{summary?.count ?? 0}</span>{" "}
              {summary?.count === 1 ? "expense" : "expenses"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <IconSearch
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <Input
                type="search"
                placeholder="Search description…"
                aria-label="Search description"
                value={search}
                onChange={(event) => resetPage(setSearch)(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              aria-label="Filter by category"
              value={categoryId}
              onChange={(event) => resetPage(setCategoryId)(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category: ExpenseCategory) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by currency"
              value={currency}
              onChange={(event) => resetPage(setCurrency)(event.target.value)}
            >
              <option value="">All currencies</option>
              {currencies.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Sort order"
              value={sort}
              onChange={(event) => resetPage(setSort)(event.target.value as ExpenseSort)}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink"
                >
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Clear ${chip.key} filter`}
                    onClick={chip.onClear}
                    className="text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="mt-4">
            {busy ? (
              <div className="space-y-2.5" aria-busy="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : list && list.items.length === 0 ? (
              chips.length > 0 ? (
                <EmptyState
                  icon={<IconSearch className="h-5 w-5" />}
                  title="No expenses match these filters"
                  description="Try a different search, category or currency."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<IconReceipt className="h-5 w-5" />}
                  title="No expenses yet"
                  description="Record your first expense to start building a picture of where your money goes."
                  action={
                    <Link
                      href="/expenses/new"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
                    >
                      <IconPlus className="h-4 w-4" />
                      Add your first expense
                    </Link>
                  }
                />
              )
            ) : list ? (
              <>
                {/* Tablet and up: a table with a sticky header. */}
                <div className="hidden md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-surface">
                      <tr className="border-b border-border">
                        <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                          Date
                        </th>
                        <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                          Description
                        </th>
                        <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                          Category
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                          Amount
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {list.items.map((expense) => {
                        const described = describe(expense);
                        return (
                          <tr key={expense.id} className="transition-colors hover:bg-surface-muted/60">
                            <td className="whitespace-nowrap px-3 py-3 text-sm text-muted">
                              {formatDate(expense.incurredOn)}
                            </td>
                            <td className="px-3 py-3">
                              <Link
                                href={`/expenses/${expense.id}`}
                                className="font-medium text-ink underline-offset-2 hover:text-primary hover:underline"
                              >
                                {expense.description ?? "—"}
                              </Link>
                              {expense.paymentMethod && (
                                <p className="text-xs text-muted">{expense.paymentMethod}</p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-2 text-sm text-ink">
                                <CategorySwatch color={expense.categoryColor} size={10} />
                                {expense.categoryName}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">
                              <DualAmount
                                amount={described.amount}
                                currency={described.currency}
                                secondaryAmount={described.secondAmount}
                                secondaryCurrency={described.secondCurrency}
                                recorded={described.recorded}
                                size="sm"
                                layout="stack"
                                align="right"
                                className="ml-auto"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">
                              <Link
                                href={`/expenses/${expense.id}/edit`}
                                className="mr-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(expense)}
                                className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Phones: stacked cards. */}
                <ul className="divide-y divide-border md:hidden">
                  {list.items.map((expense) => {
                    const described = describe(expense);
                    return (
                      <li key={expense.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/expenses/${expense.id}`} className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <CategorySwatch color={expense.categoryColor} size={9} />
                              <span className="truncate text-sm font-medium text-ink">
                                {expense.description || expense.categoryName}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {formatDate(expense.incurredOn)} · {expense.categoryName}
                            </span>
                          </Link>
                          <DualAmount
                            amount={described.amount}
                            currency={described.currency}
                            secondaryAmount={described.secondAmount}
                            secondaryCurrency={described.secondCurrency}
                            recorded={described.recorded}
                            size="sm"
                            layout="stack"
                            align="right"
                            className="shrink-0"
                          />
                        </div>
                        <div className="mt-2 flex items-center gap-4">
                          <Link
                            href={`/expenses/${expense.id}/edit`}
                            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(expense)}
                            className="text-xs font-medium text-danger underline-offset-2 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Pagination
                  page={list.page}
                  total={list.total}
                  limit={list.limit}
                  onPage={setPageNumber}
                />
              </>
            ) : null}
          </div>
        </div>
      </section>

      {top && top.items.length > 0 && summary && (
        <section className="rounded-3xl border border-border bg-surface">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="text-sm font-medium text-ink">Top expenses</h2>
            <p className="mt-0.5 text-xs text-muted">{formatDateRange(range.from, range.to)}</p>
          </div>
          <ul className="divide-y divide-border px-4 pb-4 pt-2 sm:px-5">
            {top.items.map((item) => {
              const native = dualAmounts(
                item.amountNative,
                item.currency,
                effectiveBase,
                second,
                snapshot,
              );
              const convertedBase = item.amount ?? null;
              const baseCurrency = summary.baseCurrency;
              return (
                <li key={item.id}>
                  <Link
                    href={`/expenses/${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.description || item.categoryName || "Expense"}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatDate(item.incurredOn)}
                        {item.categoryName ? ` · ${item.categoryName}` : ""}
                        {item.ratePolicy === "estimate" ? " · estimate" : ""}
                      </span>
                    </span>
                    {convertedBase !== null ? (
                      <DualAmount
                        amount={convertedBase}
                        currency={baseCurrency}
                        secondaryAmount={item.amountSecondary ?? null}
                        secondaryCurrency={item.amountSecondary != null ? second : null}
                        recorded={
                          item.currency !== baseCurrency
                            ? { amount: item.amountNative, currency: item.currency }
                            : null
                        }
                        size="sm"
                        layout="stack"
                        align="right"
                        className="shrink-0"
                      />
                    ) : (
                      <DualAmount
                        amount={native.base ?? item.amountNative}
                        currency={native.base !== null ? (effectiveBase ?? item.currency) : item.currency}
                        secondaryAmount={native.second}
                        secondaryCurrency={native.second !== null ? second : null}
                        size="sm"
                        layout="stack"
                        align="right"
                        className="shrink-0"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this expense?"
        message={
          deleteTarget
            ? `“${deleteTarget.description ?? deleteTarget.categoryName}” will be permanently removed. This can't be undone.`
            : ""
        }
        confirmLabel="Delete expense"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
