"use client";

/**
 * Reports: period summary, monthly trend, and category breakdown.
 *
 * Charts are only rendered when the server was able to convert into a single
 * base currency. When it could not (no rate snapshot) the summary returns null
 * totals, and plotting those as zeroes would invent data — so the charts are
 * replaced by an explanatory banner and the native per-currency subtotals.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { expensesApi } from "@/lib/expenses";
import { formatMoney, formatMonth, formatPercent } from "@/lib/format";
import type { ExpenseSummary, ExpenseTrend } from "@/lib/types";
import {
  Card,
  EmptyState,
  ErrorNote,
  Input,
  LoadingNote,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui";
import { useBaseCurrency, useExpenseSetup } from "../use-expenses";

/** Months of history drawn alongside the selected summary range. */
const TREND_MONTHS = 12;

/** Y-axis ticks are plain numbers; the currency symbol lives in the tooltip. */
function axisTick(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value);
}

/**
 * Recharts' Tooltip `formatter` value is `number | string | Array<...> | undefined`.
 * This series is scalar, but the union still has to be normalised before it can
 * be formatted as money.
 */
function toNumber(value: unknown): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

export default function ReportsPage() {
  const { currencies, error: setupError } = useExpenseSetup();
  const { base, setBase } = useBaseCurrency();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [trend, setTrend] = useState<ExpenseTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryResult, trendResult] = await Promise.all([
        expensesApi.getSummary({
          from: from || undefined,
          to: to || undefined,
          base: base ?? undefined,
        }),
        expensesApi.getTrends({ months: TREND_MONTHS, base: base ?? undefined }),
      ]);
      setSummary(summaryResult);
      setTrend(trendResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the report.");
    } finally {
      setLoading(false);
    }
  }, [base, from, to]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const converted = summary?.converted === true && trend?.converted === true;
  const topCategory = summary?.byCategory[0];

  const trendData =
    trend?.points.map((point) => ({
      month: formatMonth(point.month),
      total: point.total ?? 0,
    })) ?? [];

  const pieData =
    summary?.byCategory.map((entry) => ({
      name: entry.categoryName,
      value: entry.total,
      color: entry.color,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={
          summary
            ? `Figures converted into ${summary.baseCurrency}`
            : "Spending over time, by category and currency."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
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
      {loading && <LoadingNote label="Building report…" />}

      {summary && !converted && (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <p>
            Exchange rates are unavailable, so spending cannot be combined across currencies.
            Totals and charts are hidden rather than estimated; per-currency subtotals are listed
            below.
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.byCurrency.map((entry) => (
              <span
                key={entry.currency}
                className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs font-medium"
              >
                {entry.currency} {formatMoney(entry.total, entry.currency)} · {entry.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary && converted && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={`Total (${summary.baseCurrency})`}
              value={
                summary.total === null ? "—" : formatMoney(summary.total, summary.baseCurrency)
              }
            />
            <StatCard label="Expenses" value={summary.count} />
            <StatCard
              label="Average"
              value={
                summary.average === null
                  ? "—"
                  : formatMoney(summary.average, summary.baseCurrency)
              }
            />
            <StatCard
              label="Top category"
              value={
                topCategory ? (
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: topCategory.color }}
                    />
                    <span className="truncate text-lg">{topCategory.categoryName}</span>
                    <span className="text-sm font-normal text-muted">
                      {formatPercent(topCategory.percentage)}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </div>

          <Card title={`Spending, last ${TREND_MONTHS} months`}>
            {summary.count === 0 && trendData.every((point) => point.total === 0) ? (
              <EmptyState
                title="Nothing to chart yet"
                description="No expenses fall inside this range. Widen the dates or record a few expenses first."
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                      tickLine={false}
                    />
                    <YAxis tickFormatter={axisTick} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip
                      formatter={(value) => [
                        formatMoney(toNumber(value), summary.baseCurrency),
                        "Spent",
                      ]}
                    />
                    <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="By category">
              {pieData.length === 0 ? (
                <EmptyState title="No category data" />
              ) : (
                <>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={1}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            formatMoney(toNumber(value), summary.baseCurrency),
                            "Spent",
                          ]}
                        />
                        <Legend
                          formatter={(value: string) => (
                            <span className="text-xs text-muted">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {summary.byCategory.map((entry) => (
                      <li
                        key={entry.categoryId}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="truncate">{entry.categoryName}</span>
                          <span className="shrink-0 text-muted">×{entry.count}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatMoney(entry.total, summary.baseCurrency)}
                          <span className="ml-2 text-muted">
                            {formatPercent(entry.percentage)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card title="By currency">
              <ul className="space-y-3">
                {summary.byCurrency.map((entry) => (
                  <li
                    key={entry.currency}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="font-medium">{entry.currency}</span>
                      <span className="text-muted">{entry.count} expense(s)</span>
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatMoney(entry.total, entry.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">
                Native amounts as recorded. Converted totals are combined across these currencies
                into {summary.baseCurrency}.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
