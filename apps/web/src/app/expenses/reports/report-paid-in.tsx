"use client";

/**
 * The "Paid in" card: one line per original currency behind the KPI total.
 *
 * Each line shows the currency's code, how many expenses were paid in it, the
 * native subtotal (in that currency), the subtotal converted into the
 * reporting currency at each row's historical ECB rate, and a thin share bar
 * against the range total. The three largest currencies are listed; everything
 * else folds under a single expandable "Other currencies" line so the card
 * never grows into a long list.
 *
 * The converted totals reconcile with the Total KPI by construction: the
 * "Other" line carries exactly `total - (sum of the listed converted totals)`,
 * so this card can never disagree with the KPI row above it.
 */

import { useState } from "react";
import type { ChartTable } from "@/components/charts";
import { Skeleton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { CurrencyTotal } from "@/lib/types";
import { ReportCard } from "./report-card";

/** How many currencies stand alone before "Other currencies" takes over. */
const TOP = 3;

const FOOTER = "Native amounts as recorded. Converted using daily ECB rates.";

function fmt(value: number | null | undefined, code: string | null): string {
  if (value == null || !code) return "—";
  return formatMoney(value, code);
}

function shareOf(converted: number | null | undefined, total: number | null): number {
  if (converted == null || total == null || total <= 0) return 0;
  return (converted / total) * 100;
}

function plural(count: number): string {
  return `${count} ${count === 1 ? "expense" : "expenses"}`;
}

export function ReportPaidIn({
  rangeLabel,
  currencies,
  total,
  base,
  loading,
  error,
  onRetry,
  className = "",
}: {
  rangeLabel: string;
  currencies: CurrencyTotal[];
  /** The range total in the base currency — the same figure as the Total KPI. */
  total: number | null;
  /** Reporting (base) currency. */
  base: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Rank by converted (reporting-currency) volume so the bold numbers lead;
  // native volume breaks the tie and covers the unconvertible case.
  const sorted = [...currencies].sort((a, b) => {
    const av = a.convertedTotal ?? -1;
    const bv = b.convertedTotal ?? -1;
    if (bv !== av) return bv - av;
    return b.total - a.total;
  });

  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  const topConverted = top.reduce((sum, c) => sum + (c.convertedTotal ?? 0), 0);
  // The exact difference, so every line sums to the KPI total.
  const restConverted = total != null ? Math.max(0, total - topConverted) : null;
  const restCount = rest.reduce((sum, c) => sum + c.count, 0);

  const isEmpty = currencies.length === 0;

  const table: ChartTable | undefined =
    currencies.length > 0
      ? {
          caption: `Spending by currency, ${rangeLabel}`,
          columns: [
            "Currency",
            "Expenses",
            "Paid (native)",
            `Converted (${base ?? "—"})`,
          ],
          rows: sorted.map((c) => [
            c.currency,
            plural(c.count),
            fmt(c.total, c.currency),
            fmt(c.convertedTotal, base),
          ]),
        }
      : undefined;

  return (
    <ReportCard
      title="Paid in"
      subtitle={`${rangeLabel} · by original currency`}
      table={table}
      loading={loading}
      skeleton={<Skeleton className="h-56" />}
      error={error}
      onRetry={onRetry}
      empty={
        isEmpty ? (
          <p className="py-12 text-center text-sm text-muted">No spending in this period yet</p>
        ) : undefined
      }
      footer={FOOTER}
      className={className}
    >
      <ul className="divide-y divide-border">
        {top.map((c) => (
          <li key={c.currency}>
            <CurrencyLine entry={c} base={base} total={total} />
          </li>
        ))}

        {rest.length > 0 && (
          <li>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 py-2.5 text-left transition-opacity duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary md:flex md:items-center md:gap-3"
              style={{ minHeight: 52 }}
            >
              <span
                aria-hidden="true"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-stock,8px)] border border-border bg-paper text-[11px] font-semibold tracking-tight text-muted md:order-1"
              >
                +{rest.length}
              </span>
              <span className="col-start-2 row-start-1 min-w-0 text-sm font-medium text-ink md:order-2 md:flex-1">
                Other currencies
                <span className="ml-2 text-[11px] font-normal tabular-nums text-muted">
                  {plural(restCount)}
                </span>
              </span>
              <span className="col-start-3 row-start-1 w-32 shrink-0 justify-self-end text-right text-sm font-semibold tabular-nums text-ink md:order-4 md:w-28">
                {fmt(restConverted, base)}
              </span>
              <div className="col-span-2 col-start-1 row-start-2 h-1 min-w-8 overflow-hidden rounded-full bg-paper md:order-3 md:w-24 md:flex-none">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${shareOf(restConverted, total)}%`,
                    backgroundColor: "var(--primary)",
                  }}
                />
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className={`col-start-3 row-start-2 h-4 w-4 shrink-0 justify-self-end text-muted transition-transform duration-150 md:order-5 ${
                  expanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {expanded && (
              <ul className="divide-y divide-border border-t border-border px-2 pb-2 sm:px-4">
                {rest.map((c) => (
                  <li key={c.currency}>
                    <CurrencyLine entry={c} base={base} total={total} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </ReportCard>
  );
}

/** One currency's line: code, count, share bar, native total, converted total. */
function CurrencyLine({
  entry,
  base,
  total,
}: {
  entry: CurrencyTotal;
  base: string | null;
  total: number | null;
}) {
  const share = shareOf(entry.convertedTotal, total);
  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 py-2.5 md:flex md:items-center md:gap-3"
      style={{ minHeight: 52 }}
    >
      <span
        aria-hidden="true"
        className="col-start-1 row-start-1 inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-stock,8px)] border border-border bg-paper text-[11px] font-semibold tracking-tight text-ink md:order-1"
      >
        {entry.currency}
      </span>
      <span className="col-start-2 row-start-1 text-[11px] tabular-nums text-muted md:order-2 md:w-24 md:shrink-0">
        {plural(entry.count)}
      </span>
      <span className="col-start-3 row-start-1 w-28 justify-self-end text-right text-xs tabular-nums text-muted md:order-4 md:w-28 md:shrink-0">
        {fmt(entry.total, entry.currency)}
      </span>
      <div className="col-span-2 col-start-1 row-start-2 h-1 min-w-8 overflow-hidden rounded-full bg-paper md:order-3 md:min-w-8 md:flex-1">
        <span
          className="block h-full rounded-full"
          style={{ width: `${share}%`, backgroundColor: "var(--primary)" }}
        />
      </div>
      <span className="col-start-3 row-start-2 w-32 shrink-0 justify-self-end text-right text-sm font-semibold tabular-nums text-ink md:order-5 md:w-32">
        {fmt(entry.convertedTotal, base)}
      </span>
    </div>
  );
}