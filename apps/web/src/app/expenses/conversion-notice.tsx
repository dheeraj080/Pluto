"use client";

import { formatDate } from "@/lib/format";
import { InfoPill } from "@/components/pill";
import type { ConversionStatus, RateProvenance } from "@/lib/types";

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


/**
 * Explains the conversion health of a report payload.
 *
 * Three distinct states, all driven by the server's `conversionStatus`:
 * - unavailable            — nothing could be converted; totals are native only
 * - partially_converted    — some rows converted, `unconvertedCurrencies` named
 * - converted with estimates — every row converted but some used the closest
 *   snapshot (never today's rate), which is explicitly labeled `estimate`
 *
 * The estimate note matters because it is the one case where figures look
 * normal but are approximations — it stays subtle rather than scary.
 */
export function ConversionNotice({
  status,
  unconvertedCurrencies = [],
  provenance = null,
}: {
  status?: ConversionStatus;
  unconvertedCurrencies?: string[];
  provenance?: RateProvenance | null;
}) {
  if (!status) return null;

  if (status === "unavailable") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-warning/25 bg-warning-subtle px-4 py-3 text-sm text-warning"
      >
        Exchange rates are unavailable, so totals are shown per currency only. Converted totals and
        category breakdowns will appear once rates can be fetched again.
      </div>
    );
  }

  if (status === "partially_converted" && unconvertedCurrencies.length > 0) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-warning/25 bg-warning-subtle px-4 py-3 text-sm text-warning"
      >
        Some currencies cannot be converted right now ({unconvertedCurrencies.join(", ")}). Converted
        totals cover the rest; native amounts are always shown exactly as recorded.
      </div>
    );
  }

  if (provenance?.policies?.includes("estimate")) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
        Some figures are estimates: a published snapshot was not available for every transaction
        date, so the closest one was used instead of today&apos;s rate (effective{" "}
        {provenance.earliestRateDate ?? "unknown"}). Estimates are always labeled in exports too.
      </div>
    );
  }

  return null;
}