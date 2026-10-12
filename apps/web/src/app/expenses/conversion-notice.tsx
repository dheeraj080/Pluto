"use client";

import { formatDate } from "@/lib/format";
import { rateBetween } from "@/lib/convert";
import { InfoPill } from "@/components/pill";
import type { ConversionStatus, RateProvenance, RateSnapshot } from "@/lib/types";

/**
 * The compact "Rates as of …" pill in the dashboard header.
 *
 * Shows the latest published snapshot date on the pill and, on click, the rate
 * for the current pair plus its source — so the number behind every converted
 * figure is one tap away without a banner.
 */
export function RateAsOfPill({
  snapshot,
  base,
  second,
  provenance,
}: {
  snapshot: RateSnapshot | null;
  base: string | null;
  second: string | null;
  provenance?: RateProvenance | null;
}) {
  if (!snapshot) return null;
  const rate = base && second ? rateBetween(base, second, snapshot.rates) : null;
  const estimated = provenance?.policies?.includes("estimate");

  return (
    <InfoPill
      label={`Rates as of ${formatDate(snapshot.effectiveDate)}`}
      title="Published exchange rates"
    >
      {rate != null && base && second ? (
        <p>
          1 {base} = <span className="tabular-nums">{formatRate(rate)}</span> {second}.
        </p>
      ) : (
        <p>The latest published rate snapshot.</p>
      )}
      <p className="mt-1.5">
        Source: {snapshot.provider} · {formatDate(snapshot.effectiveDate)}.
      </p>
      {estimated && (
        <p className="mt-1.5">
          Some figures use the closest published snapshot instead of the exact transaction date.
        </p>
      )}
    </InfoPill>
  );
}

function formatRate(value: number): string {
  return value.toFixed(value >= 100 ? 2 : 4);
}

/**
 * The quiet rate note that sits beside the date range.
 *
 * Only the estimate case gets a pill: figures look normal but are
 * approximations, so the caveat stays available on click without a full-width
 * banner. Exact and unavailable states render nothing here (the latter is an
 * inline alert below instead).
 */
export function ConversionPill({ provenance }: { provenance?: RateProvenance | null }) {
  const estimated = provenance?.policies?.includes("estimate");
  if (!estimated) return null;
  const asOf = provenance?.latestRateDate ?? provenance?.earliestRateDate ?? null;
  return (
    <InfoPill
      label={asOf ? `Rates as of ${formatDate(asOf)}` : "Estimated rates"}
      title="Some figures are estimated"
    >
      A published rate was not available for every transaction date, so the closest published
      snapshot was used instead of today&rsquo;s rate. Your recorded amounts are unchanged.
    </InfoPill>
  );
}

/**
 * A compact inline alert for the two states that change what the numbers mean:
 * nothing convertible, or some currencies excluded. Kept below the header so
 * it never competes with the summary.
 */
export function ConversionAlert({
  status,
  unconvertedCurrencies = [],
}: {
  status?: ConversionStatus;
  unconvertedCurrencies?: string[];
}) {
  if (status === "unavailable") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-warning/25 bg-warning-subtle px-4 py-3 text-sm text-warning"
      >
        Exchange rates are unavailable, so totals are shown per currency only. Converted totals and
        charts appear once rates can be fetched again.
      </div>
    );
  }

  if (status === "partially_converted" && unconvertedCurrencies.length > 0) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-warning/25 bg-warning-subtle px-4 py-3 text-sm text-warning"
      >
        Some currencies cannot be converted right now ({unconvertedCurrencies.join(", ")}).
        Converted totals cover the rest; native amounts are always shown exactly as recorded.
      </div>
    );
  }

  return null;
}
