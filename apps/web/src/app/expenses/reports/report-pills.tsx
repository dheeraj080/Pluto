"use client";

/**
 * The two honest caveats that live in the Reports header.
 *
 * `RatesPill` always names the most recent rate snapshot the figures used, so
 * "as of" is never a guess. `EstimatePill` appears only when at least one
 * conversion fell back to a nearby snapshot — replacing the old full-width
 * estimate banner with a quiet amber pill and a tooltip.
 */

import { formatAsOf } from "@/lib/format";
import { InfoPill } from "@/components/pill";
import type { RateProvenance } from "@/lib/types";

function policies(provenance?: RateProvenance | null): string {
  const list = provenance?.policies ?? [];
  if (list.includes("unavailable")) return "Some amounts could not be converted.";
  if (list.includes("estimate")) return "Includes estimated rates.";
  return "All figures converted at published rates.";
}

export function RatesPill({
  provenance,
  fallbackDate,
}: {
  provenance?: RateProvenance | null;
  /**
   * Snapshot date to name while the range's own provenance is still loading, so
   * the pill reads "Rates as of 9 Oct" from the first paint rather than "Rates".
   */
  fallbackDate?: string | null;
}) {
  const asOf = provenance?.latestRateDate ?? provenance?.earliestRateDate ?? fallbackDate ?? null;
  const earliest = provenance?.earliestRateDate ?? null;
  return (
    <InfoPill
      label={asOf ? `Rates as of ${formatAsOf(asOf)}` : "Rates"}
      title="Exchange rates"
    >
      <p>
        Every line is converted on its own date, from the latest published daily ECB snapshot
        on or before that day.
      </p>
      {earliest && asOf && earliest !== asOf && (
        <p className="mt-1.5">
          This period drew on snapshots from {formatAsOf(earliest)} to {formatAsOf(asOf)}.
        </p>
      )}
      <p className="mt-1.5">{policies(provenance)}</p>
    </InfoPill>
  );
}

export function EstimatePill({ provenance }: { provenance?: RateProvenance | null }) {
  const estimated = provenance?.policies?.includes("estimate");
  if (!estimated) return null;
  return (
    <InfoPill tone="warning" label="Includes estimated rates" title="Some figures are estimated">
      A published rate was not available for every transaction date, so the closest snapshot was
      used instead. Affected rows are tagged <span className="text-warning">est.</span> and your
      recorded amounts are unchanged.
    </InfoPill>
  );
}
