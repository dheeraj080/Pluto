"use client";

/**
 * The dashboard's rate-and-converter card.
 *
 * Answers "what is today's rate, and what is X worth?" in place: the headline
 * rate with its source and date, and a single-row converter — input, swap
 * button, output side by side. A small 30-day rate line appears only when at
 * least a month of published history exists; with less history it shows
 * nothing rather than an empty chart.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatAsOf, formatMoney } from "@/lib/format";
import { formatRateValue, rateBetween } from "@/lib/convert";
import { ChartFrame, Sparkline, type TrendRow } from "@/components/charts";
import { IconSwap } from "@/components/icons";
import { Skeleton } from "@/components/ui";
import type { RateHistoryResponse, RateSnapshot } from "@/lib/types";

const MIN_HISTORY_POINTS = 30;

export function RateConverterCard({
  snapshot,
  base,
  second,
  history,
  loading,
}: {
  snapshot: RateSnapshot | null;
  base: string | null;
  second: string | null;
  history: RateHistoryResponse | null;
  loading: boolean;
}) {
  const [swapped, setSwapped] = useState(false);
  const [amount, setAmount] = useState("100");

  const spark = useMemo<TrendRow[]>(
    () => (history?.points ?? []).map((point) => ({ value: point.rate })),
    [history],
  );

  if (!base || !second) {
    return (
      <ChartFrame
        compact
        title="Rate & converter"
        className="order-6"
      >
        <p className="text-sm text-muted">
          Choose a second currency to see today&rsquo;s rate and convert amounts.
        </p>
        <Link
          href="/expenses/settings"
          className="mt-3 inline-flex h-9 items-center rounded-xl border border-border bg-surface-muted px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Choose currencies
        </Link>
      </ChartFrame>
    );
  }

  const headlineRate = snapshot ? rateBetween(base, second, snapshot.rates) : null;
  const from = swapped ? second : base;
  const to = swapped ? base : second;
  const rate = snapshot ? rateBetween(from, to, snapshot.rates) : null;
  const parsed = Number(amount.replace(",", "."));
  const result = rate != null && Number.isFinite(parsed) ? parsed * rate : null;

  return (
    <ChartFrame
      compact
      title="Rate & converter"
      className="order-6"
      loading={loading && !snapshot}
      skeleton={<Skeleton className="h-[150px]" />}
    >
      <p className="text-base font-medium text-ink">
        1 {base} ={" "}
        <span className="tabular-nums text-primary">
          {headlineRate == null ? "—" : rateDigits(headlineRate)}
        </span>{" "}
        {second}
      </p>
      {snapshot && (
        <p className="mt-1 text-xs text-muted">
          {snapshot.provider}, {formatAsOf(snapshot.effectiveDate)}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={`Amount in ${from}`}
            className="w-full min-w-0 bg-transparent text-sm tabular-nums text-ink outline-none placeholder:text-muted/60"
          />
          <span className="shrink-0 text-xs font-medium text-muted">{from}</span>
        </div>

        <button
          type="button"
          onClick={() => setSwapped((value) => !value)}
          aria-label="Swap currencies"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors duration-150 hover:border-border-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <IconSwap className="h-3.5 w-3.5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-transparent bg-surface-muted/50 px-3 py-2">
          <output
            aria-live="polite"
            className="w-full min-w-0 truncate text-sm font-medium tabular-nums text-ink"
          >
            {result == null ? "—" : formatMoney(result, to)}
          </output>
          <span className="shrink-0 text-xs font-medium text-muted">{to}</span>
        </div>
      </div>

      {spark.length >= MIN_HISTORY_POINTS && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Last 30 days</p>
          <Sparkline
            data={spark}
            dataKey="value"
            color="var(--chart-secondary)"
            height={34}
            className="mt-1"
          />
        </div>
      )}
    </ChartFrame>
  );
}

function rateDigits(rate: number): string {
  return formatRateValue(rate);
}