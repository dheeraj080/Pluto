"use client";

/**
 * The dashboard's analytics box: how much was spent this month, this week and
 * today, each shown in the reporting currency with the native per-currency
 * breakdown underneath, plus the rate behind today's conversion.
 *
 * Figures come from three `comparison` payloads (see use-dashboard). When a
 * window could not be converted the converted total is withheld ("—") rather
 * than shown as zero, and only the native amounts remain — the same honesty
 * rule the rest of the app follows.
 */

import { formatDateRange, formatMoney } from "@/lib/format";
import { rateBetween } from "@/lib/convert";
import type { CurrencyTotal, RateSnapshot } from "@/lib/types";
import { Badge, Skeleton } from "@/components/ui";
import { BentoTile } from "@/components/bento";
import {
  comparisonDeltaPct,
  type DashboardWindow,
  type DashboardWindows,
} from "./use-dashboard";
import type { WindowKind } from "@/lib/ranges";

const ROWS: { kind: WindowKind; label: string }[] = [
  { kind: "month", label: "This month" },
  { kind: "week", label: "This week" },
  { kind: "day", label: "Today" },
];

/** The largest native subtotal, used to pick the rate worth surfacing. */
function dominantCurrency(totals: CurrencyTotal[]): CurrencyTotal | null {
  return totals.reduce<CurrencyTotal | null>(
    (max, entry) => (max === null || entry.total > max.total ? entry : max),
    null,
  );
}

function formatRate(rate: number): string {
  return rate.toLocaleString(undefined, { maximumFractionDigits: rate >= 1 ? 4 : 6 });
}

function WindowRow({ win, base }: { win: DashboardWindow; base: string }) {
  const { comparison, range } = win;
  const current = comparison.current;
  const convertedTotal = comparison.converted ? current.total : null;
  const delta = comparisonDeltaPct(comparison);

  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{ROWS.find((r) => r.kind === win.kind)?.label}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDateRange(range.from, range.to)} · {current.count}{" "}
            {current.count === 1 ? "expense" : "expenses"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-ink">
            {convertedTotal === null ? "—" : formatMoney(convertedTotal, base)}
          </p>
          {delta !== null && (
            <Badge tone={delta <= 0 ? "ok" : "warn"} className="mt-0.5">
              {delta <= 0 ? "↓" : "↑"} {Math.abs(delta).toFixed(1)}%
            </Badge>
          )}
        </div>
      </div>

      {current.byCurrency.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {current.byCurrency.slice(0, 4).map((entry) => (
            <span
              key={entry.currency}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] text-muted"
            >
              <span className="font-semibold text-ink">{entry.currency}</span>
              <span className="tabular-nums">{formatMoney(entry.total, entry.currency)}</span>
            </span>
          ))}
          {current.byCurrency.length > 4 && (
            <span className="self-center text-[11px] text-muted">
              +{current.byCurrency.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalyticsBox({
  windows,
  base,
  snapshot,
  loading,
}: {
  windows: DashboardWindows | null;
  base: string | null;
  snapshot: RateSnapshot | null;
  loading: boolean;
}) {
  if (!windows) {
    return (
      <BentoTile title="Analytics" className="lg:col-span-7" bodyClassName="flex flex-col">
        {loading ? (
          <div className="space-y-4">
            {ROWS.map((row) => (
              <Skeleton key={row.kind} className="h-14" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Analytics are unavailable right now.</p>
        )}
      </BentoTile>
    );
  }

  const effectiveBase = base ?? windows.month.comparison.current.baseCurrency;
  const dominant = dominantCurrency(windows.month.comparison.current.byCurrency);
  const rate =
    dominant && snapshot ? rateBetween(dominant.currency, effectiveBase, snapshot.rates) : null;

  return (
    <BentoTile
      title="Analytics"
      className="lg:col-span-7"
      bodyClassName="flex flex-col divide-y divide-border"
    >
      {ROWS.map((row) => (
        <WindowRow key={row.kind} win={windows[row.kind]} base={effectiveBase} />
      ))}

      <p className="pt-4 text-xs leading-relaxed text-muted">
        {rate !== null && dominant && snapshot ? (
          <>
            Today&apos;s rate: 1 {dominant.currency} ={" "}
            <span className="font-medium tabular-nums text-ink">
              {formatRate(rate)} {effectiveBase}
            </span>{" "}
            · {snapshot.effectiveDate} · {snapshot.provider}
          </>
        ) : (
          "Converted totals use the latest published daily rate."
        )}
      </p>
    </BentoTile>
  );
}
