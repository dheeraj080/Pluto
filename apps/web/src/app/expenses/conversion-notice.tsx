"use client";

import type { ConversionStatus, RateProvenance } from "@/lib/types";

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