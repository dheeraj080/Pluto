"use client";

/**
 * Expense dashboard: a period-driven total with comparison, a category and
 * currency breakdown, and the filterable transaction list.
 *
 * The selected period drives both the summary and the list so the headline and
 * the rows below always describe the same window. Conversion figures come from
 * the server aggregates; the per-row "≈" amounts are display-only, computed
 * from the public ECB snapshot.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { expensesApi, type ExpenseSort } from "@/lib/expenses";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { buildConversionPreview } from "@/lib/convert";
import type {
  Expense,
  ExpenseCategory,
  ExpenseSummary,
  Paginated,
  TopExpenseItem,
} from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  Money,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  Skeleton,
  StatCard,
  Table,
  TableSkeleton,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { downloadTextFile } from "@/lib/download";
import { IconGlobe, IconPlus, IconReceipt, IconSearch } from "@/components/icons";
import { useBaseCurrency, useExpenseSetup, useRateSnapshot, useReportingSetup } from "./use-expenses";
import { ConversionNotice } from "./conversion-notice";

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

/* --------------------------- Period helpers --------------------------- */

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function startOfMonthIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

interface Range {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** False when a comparison window is not meaningful (all time / open range). */
  comparable: boolean;
}

function computeRange(period: string, customFrom: string, customTo: string): Range {
  const today = isoDaysAgo(0);
  let from = today;
  let to = today;
  let comparable = true;

  switch (period) {
    case "month":
      from = startOfMonthIso();
      break;
    case "30d":
      from = isoDaysAgo(29);
      break;
    case "year":
      from = startOfYearIso();
      break;
    case "all":
      from = "1970-01-01";
      comparable = false;
      break;
    case "custom":
      from = customFrom || "1970-01-01";
      to = customTo || today;
      comparable = Boolean(customFrom && customTo);
      break;
  }

  const length = Math.max(1, diffDays(from, to) + 1);
  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(prevTo, -(length - 1));
  return { from, to, prevFrom, prevTo, comparable };
}

/* ------------------------------ Component ----------------------------- */

export default function ExpensesDashboardPage() {
  const { categories, currencies, loading: setupLoading, error: setupError } = useExpenseSetup();
  const { base, setBase } = useBaseCurrency();
  const { needsSetup, dismiss } = useReportingSetup();
  const snapshot = useRateSnapshot();

  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<ExpenseSummary | null>(null);
  const [page, setPage] = useState<Paginated<Expense> | null>(null);
  const [topExpenses, setTopExpenses] = useState<TopExpenseItem[]>([]);
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
    () => computeRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setError(null);
    const baseParam = base ?? undefined;
    try {
      const [summaryResult, listResult, prevResult, topResult] = await Promise.all([
        expensesApi.getSummary({ from: range.from, to: range.to, base: baseParam }),
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
        range.comparable
          ? expensesApi.getSummary({ from: range.prevFrom, to: range.prevTo, base: baseParam })
          : Promise.resolve(null),
        expensesApi.getTop({ from: range.from, to: range.to, limit: 5, base: baseParam }),
      ]);
      setSummary(summaryResult);
      setPage(listResult);
      setPrevSummary(prevResult);
      setTopExpenses(topResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses.");
    }
  }, [base, categoryId, currency, pageNumber, range, search, sort]);

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
      });
      downloadTextFile(`expenses-${range.from}_${range.to}.csv`, csv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export expenses.");
    } finally {
      setExporting(false);
    }
  }, [base, categoryId, currency, range, search]);

  // Deep links from the reports page carry ?categoryId / ?from / ?to so a
  // chart element can open a pre-filtered transaction list.
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

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
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

  /* -------- Derived display values -------- */
  const effectiveBase = base ?? summary?.baseCurrency ?? null;
  const topCategory = summary?.byCategory[0];

  const delta =
    summary && prevSummary && summary.converted && prevSummary.converted &&
    summary.total !== null && prevSummary.total !== null && prevSummary.total > 0
      ? ((summary.total - prevSummary.total) / prevSummary.total) * 100
      : null;

  const hasFilters = Boolean(search || categoryId || currency);
  const maxCategoryTotal = summary?.byCategory.reduce((max, c) => Math.max(max, c.total), 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          summary
            ? `${formatDate(range.from)} – ${formatDate(range.to)} · totals in ${summary.baseCurrency}`
            : "Track spending across currencies."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="base-currency" className="text-sm text-muted">
              Reporting
            </label>
            <Select
              id="base-currency"
              aria-label="Reporting currency"
              value={base ?? ""}
              onChange={(event) => setBase(event.target.value)}
              className="w-32"
            >
              <option value="">{summary?.baseCurrency ?? "Default"}</option>
              {currencies
                .filter((entry) => entry.code !== summary?.baseCurrency)
                .map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code}
                  </option>
                ))}
            </Select>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void exportCsv()}
              loading={exporting}
              disabled={!page || page.total === 0}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {needsSetup && (
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary-subtle/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-primary">
              <IconGlobe className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Choose your reporting currency</p>
              <p className="text-sm text-muted">
                Pick the currency your totals and reports should be shown in.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/onboarding"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              Set up
            </Link>
            <Button variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={resetPage(setPeriod)}
          label="Reporting period"
        />
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              value={customFrom}
              onChange={(event) => resetPage(setCustomFrom)(event.target.value)}
              className="w-40"
            />
            <span className="text-sm text-muted">to</span>
            <Input
              type="date"
              aria-label="To date"
              value={customTo}
              onChange={(event) => resetPage(setCustomTo)(event.target.value)}
              className="w-40"
            />
          </div>
        )}
      </div>

      {summary && (
        <ConversionNotice
          status={summary.conversionStatus}
          unconvertedCurrencies={summary.unconvertedCurrencies}
          provenance={summary.rateProvenance}
        />
      )}

      {/* Stats */}
      {!summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={`Spent (${summary.baseCurrency})`}
            value={summary.total === null ? "—" : <Money amount={summary.total} currency={summary.baseCurrency} />}
            sub={
              delta !== null ? (
                <Badge tone={delta <= 0 ? "ok" : "warn"}>
                  {delta <= 0 ? "↓" : "↑"} {Math.abs(delta).toFixed(1)}% vs previous
                </Badge>
              ) : (
                <span className="text-xs text-muted">No comparison available</span>
              )
            }
          />
          <StatCard label="Expenses" value={summary.count} />
          <StatCard
            label="Average"
            value={
              summary.average === null ? "—" : <Money amount={summary.average} currency={summary.baseCurrency} />
            }
          />
          <StatCard
            label="Top category"
            value={
              topCategory ? (
                <span className="flex items-center gap-2 text-base font-medium">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: topCategory.color }}
                  />
                  <span className="truncate">{topCategory.categoryName}</span>
                </span>
              ) : (
                "—"
              )
            }
            sub={
              topCategory && (
                <span className="text-xs text-muted">{formatPercent(topCategory.percentage)} of spending</span>
              )
            }
          />
        </div>
      )}

      {/* Breakdown */}
      {summary && summary.conversionStatus !== "unavailable" && summary.count > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Spending by category">
            <ul className="space-y-3.5">
              {summary.byCategory.map((entry) => {
                const width = maxCategoryTotal > 0 ? (entry.total / maxCategoryTotal) * 100 : 0;
                return (
                  <li key={entry.categoryId}>
                    <button
                      type="button"
                      aria-label={`Filter by ${entry.categoryName}`}
                      onClick={() => resetPage(setCategoryId)(entry.categoryId)}
                      className="block w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-muted"
                    >
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="truncate font-medium text-ink">{entry.categoryName}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">
                          <Money amount={entry.total} currency={summary.baseCurrency} />
                          <span className="ml-2 text-xs text-muted">{formatPercent(entry.percentage)}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${width}%`, backgroundColor: entry.color }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="By currency" bodyClassName="pt-4">
            {summary.byCurrency.length === 0 ? (
              <p className="text-sm text-muted">No expenses in this period.</p>
            ) : (
              <>
                <ul className="space-y-3">
                  {summary.byCurrency.map((entry) => (
                    <li
                      key={entry.currency}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="font-semibold text-ink">{entry.currency}</span>
                        <span className="text-muted">
                          {entry.count} {entry.count === 1 ? "expense" : "expenses"}
                        </span>
                      </span>
                      <span className="tabular-nums font-medium text-ink">
                        <Money amount={entry.total} currency={entry.currency} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Native amounts as recorded. Combined totals above are converted into{" "}
                  {summary.baseCurrency}.
                </p>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Transactions */}
      <Card
        title="Transactions"
        action={
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={setupLoading}>
            Refresh
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        {!page && !error && <TableSkeleton rows={4} cols={4} />}

        {page && (
          <>
            {page.items.length === 0 ? (
              hasFilters ? (
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
                      Add expense
                    </Link>
                  }
                />
              )
            ) : (
              <Table headers={["Date", "Description", "Category", "Amount", ""]}>
                {page.items.map((expense) => {
                  const converted =
                    effectiveBase && effectiveBase !== expense.currency && snapshot
                      ? buildConversionPreview(expense.amount, expense.currency, effectiveBase, snapshot)
                      : null;
                  return (
                    <tr key={expense.id} className="transition-colors hover:bg-surface-muted/60">
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-muted">
                        {formatDate(expense.incurredOn)}
                      </td>
                      <td className="px-5 py-3">
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
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 text-sm text-ink">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: expense.categoryColor }}
                          />
                          {expense.categoryName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <span className="font-medium tabular-nums text-ink">
                          <Money amount={expense.amount} currency={expense.currency} />
                        </span>
                        {converted && (
                          <span className="block text-xs text-muted">
                            ≈ <Money amount={converted.amount} currency={converted.to} />
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
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
              </Table>
            )}
            <Pagination
              page={page.page}
              total={page.total}
              limit={page.limit}
              onPage={setPageNumber}
            />
          </>
        )}
      </Card>

      {topExpenses.length > 0 && summary && (
        <Card title="Top expenses">
          <ul className="space-y-2.5">
            {topExpenses.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/expenses/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {item.description || item.categoryName || "Expense"}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(item.incurredOn)}
                      {item.categoryName ? ` · ${item.categoryName}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5">
                      {item.ratePolicy === "estimate" && (
                        <Badge tone="gold" className="text-[10px]">
                          estimate
                        </Badge>
                      )}
                      {item.conversionStatus === "unavailable" && (
                        <Badge tone="warn" className="text-[10px]">
                          unconverted · {item.currency}
                        </Badge>
                      )}
                    </p>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums font-medium text-ink">
                      <Money
                        amount={item.amount ?? item.amountNative}
                        currency={
                          item.amount !== null && item.amount !== undefined
                            ? summary.baseCurrency
                            : item.currency
                        }
                      />
                    </span>
                    {item.amount !== null && item.amount !== undefined && item.currency !== summary.baseCurrency && (
                      <span className="block text-xs text-muted">
                        {item.currency} {formatMoney(item.amountNative, item.currency)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
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