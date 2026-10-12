"use client";

/**
 * The dashboard's analytics card: spending this month, this week and today.
 *
 * Each row shows the period total in the Pair (Base bold, Second grey), the
 * change against the previous period as a pill, and a small sparkline of the
 * recent trend. The footer names the current Base ⇄ Second rate quietly, in
 * place of the old per-currency chip rows and "By currency" list.
 */

import { formatDateRange } from "@/lib/format";
import { rateBetween } from "@/lib/convert";
import type { RateSnapshot } from "@/lib/types";
import type { WindowKind } from "@/lib/ranges";
import { ChartFrame, Sparkline, type TrendRow } from "@/components/charts";
import { DualAmount } from "@/components/amount";
import { ChangePill } from "@/components/pill";
import { Skeleton } from "@/components/ui";
import {
  comparisonDeltaPct,
  type DashboardWindow,
  type DashboardWindows,
} from "./use-dashboard";

const ROWS: { kind: WindowKind; label: string }[] = [
  { kind: "month", label: "This month" },
  { kind: "week", label: "This week" },
  { kind: "day", label: "Today" },
];

export type AnalyticsSparks = Record<WindowKind, TrendRow[]>;

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return rate.toLocaleString(undefined, { maximumFractionDigits: rate >= 1 ? 4 : 6 });
}

export function DashboardAnalytics({
  windows,
  base,
  second,
  sparks,
  snapshot,
  loading,
}: {
  windows: DashboardWindows | null;
  base: string | null;
  second: string | null;
  sparks: AnalyticsSparks;
  snapshot: RateSnapshot | null;
  loading: boolean;
}) {
  if (!windows) {
    return (
      <ChartFrame
        title="Analytics"
        className="lg:col-span-7"
        loading={loading}
        skeleton={<RowsSkeleton />}
      >
        <p className="px-2 text-sm text-muted">Analytics are unavailable right now.</p>
      </ChartFrame>
    );
  }

  const effectiveBase = base ?? windows.month.comparison.current.baseCurrency;
  const effectiveSecond = second ?? windows.month.comparison.current.secondaryCurrency ?? null;
  const rate =
    effectiveSecond && snapshot
      ? rateBetween(effectiveBase, effectiveSecond, snapshot.rates)
      : null;

  return (
    <ChartFrame
      title="Analytics"
      className="lg:col-span-7"
      bodyClassName="flex flex-1 flex-col divide-y divide-border pt-1"
      footer={
        effectiveSecond && rate !== null
          ? `1 ${effectiveBase} = ${formatRate(rate)} ${effectiveSecond} at the latest published rate${
              snapshot ? ` (${snapshot.effectiveDate})` : ""
            }.`
          : "Converted totals use the latest published daily rate."
      }
    >
      {ROWS.map((row) => (
        <WindowRow
          key={row.kind}
          label={row.label}
          win={windows[row.kind]}
          base={effectiveBase}
          second={effectiveSecond}
          spark={sparks[row.kind]}
        />
      ))}
    </ChartFrame>
  );
}

function WindowRow({
  label,
  win,
  base,
  second,
  spark,
}: {
  label: string;
  win: DashboardWindow;
  base: string;
  second: string | null;
  spark: TrendRow[];
}) {
  const { comparison, range } = win;
  const current = comparison.current;
  const total = comparison.converted ? current.total : null;
  const delta = comparisonDeltaPct(comparison);
  const secondTotal = comparison.converted ? (current.secondaryTotal ?? null) : null;

  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDateRange(range.from, range.to)} · {current.count}{" "}
            {current.count === 1 ? "expense" : "expenses"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {total === null ? (
            <span className="text-lg font-semibold text-muted">—</span>
          ) : (
            <DualAmount
              amount={total}
              currency={base}
              secondaryAmount={secondTotal}
              secondaryCurrency={secondTotal !== null ? second : null}
              size="sm"
              layout="stack"
              align="right"
            />
          )}
          {delta !== null && <ChangePill percent={delta} className="mt-1" />}
        </div>
      </div>
      {spark.length > 1 && (
        <Sparkline data={spark} dataKey="value" className="mt-2" height={28} />
      )}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-4 px-2" aria-busy="true">
      {ROWS.map((row) => (
        <Skeleton key={row.kind} className="h-16" />
      ))}
    </div>
  );
}
