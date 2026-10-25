"use client";

/**
 * The report card shell.
 *
 * Unlike the dashboard's chart frame, every report chart carries a small icon
 * toggle between the chart and its data table (the same numbers, in both
 * currencies), and every card owns its own error state: a failure shows a
 * short inline message and a Retry inside that card only, never a page-wide
 * banner. Loading skeletons match the card's final height so nothing jumps.
 */

import { useState, type ReactNode } from "react";
import type { ChartTable } from "@/components/charts";
import { Button, Skeleton } from "@/components/ui";
import { IconChartLine, IconTable } from "./report-icons";

/* ------------------------------------------------------------------ */
/* Inline error                                                        */
/* ------------------------------------------------------------------ */

export function InlineError({
  message,
  onRetry,
  className = "",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card,8px)] border border-danger/25 bg-danger-subtle px-3.5 py-2.5 text-sm text-danger ${className}`}
    >
      <span className="leading-snug">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card shell                                                          */
/* ------------------------------------------------------------------ */

export function ReportCard({
  title,
  subtitle,
  action,
  children,
  table,
  loading = false,
  skeleton,
  empty,
  error,
  onRetry,
  footer,
  className = "",
  bodyClassName = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** The same data as a keyboard-reachable table. */
  table?: ChartTable;
  loading?: boolean;
  skeleton?: ReactNode;
  empty?: ReactNode;
  error?: string | null;
  onRetry?: () => void;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const canToggle = Boolean(table) && !loading && !empty && !error;

  return (
    <section
      className={`relative rounded-[var(--radius-card,8px)] border border-border bg-paper ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {canToggle && (
            <div
              role="group"
              aria-label="Chart or table view"
              className="inline-flex rounded-lg border border-border bg-paper p-0.5"
            >
              <button
                type="button"
                aria-pressed={!showTable}
                aria-label="Chart view"
                onClick={() => setShowTable(false)}
                className={`inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  showTable ? "text-muted hover:text-ink" : "bg-background text-primary"
                }`}
              >
                <IconChartLine className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-pressed={showTable}
                aria-label="Table view"
                onClick={() => setShowTable(true)}
                className={`inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  showTable ? "bg-background text-primary" : "text-muted hover:text-ink"
                }`}
              >
                <IconTable className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={`relative px-4 pb-5 pt-3 sm:px-5 ${bodyClassName}`}>
        {error && !loading ? (
          <InlineError message={error} onRetry={onRetry} />
        ) : loading ? (
          skeleton ?? <Skeleton className="h-40" />
        ) : empty ? (
          empty
        ) : showTable && table ? (
          <DataTable table={table} />
        ) : (
          children
        )}
      </div>

      {footer && (
        <div className="relative px-5 pb-5 text-xs leading-relaxed text-muted sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

/** The chart, as a real table reachable by keyboard. */
export function DataTable({ table }: { table: ChartTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{table.caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {table.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-xs font-medium text-muted"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`whitespace-nowrap px-3 py-2 ${
                    cellIndex === 0 ? "text-ink" : "tabular-nums text-muted"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The one genuinely empty state: a whole range with no spending at all. */
export function EmptyRange({ onWiden }: { onWiden: () => void }) {
  return (
    <ReportCard title="No spending to report">
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <p className="text-base font-medium text-ink">No spending in this period.</p>
        <p className="max-w-sm text-sm text-muted">Try a wider range.</p>
        <Button variant="primary" size="sm" onClick={onWiden}>
          Show the last 12 months
        </Button>
      </div>
    </ReportCard>
  );
}
