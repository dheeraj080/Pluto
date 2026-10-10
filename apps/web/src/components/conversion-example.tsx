"use client";

/**
 * "Spend in one currency, understand it in another" — a live illustrative
 * example driven by the real public rate snapshot (no auth required).
 *
 * The example amounts are fixed marketing illustrations; the conversion and
 * the quoted rate come from the live ECB snapshot. When the snapshot (or the
 * two involved currencies) is unavailable the example falls back to a clearly
 * labelled illustrative rate rather than silently guessing.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { RateSnapshot } from "@/lib/types";
import { IconSwap } from "./icons";

interface ExampleRow {
  label: string;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
}

const ROWS: ExampleRow[] = [
  { label: "Coffee run in Zurich", fromCurrency: "CHF", fromAmount: 6.5, toCurrency: "EUR" },
  { label: "Groceries in Singapore", fromCurrency: "SGD", fromAmount: 84, toCurrency: "EUR" },
  { label: "Weekly metro pass in Tokyo", fromCurrency: "JPY", fromAmount: 3920, toCurrency: "EUR" },
];

const ILLUSTRATIVE_RATE = 0.62; // CHF → EUR "typical" fallback, clearly labelled.

function convert(amount: number, rateTo: number, rateFrom: number): number {
  return (amount * rateTo) / rateFrom;
}

export function ConversionExample() {
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<RateSnapshot>("/rates/latest")
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = snapshot !== null && !failed;

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-[0_1px_2px_rgba(23,33,27,0.04)] sm:p-8">
      <ul className="space-y-6">
        {ROWS.map((row) => {
          let converted: number | null = null;
          let usedLiveRate = false;
          if (live && snapshot) {
            const rateTo = Number(snapshot.rates[row.toCurrency]);
            const rateFrom = Number(snapshot.rates[row.fromCurrency]);
            if (Number.isFinite(rateTo) && Number.isFinite(rateFrom) && rateFrom > 0) {
              converted = convert(row.fromAmount, rateTo, rateFrom);
              usedLiveRate = true;
            }
          }
          if (converted === null && row.fromCurrency === "CHF" && row.toCurrency === "EUR") {
            converted = row.fromAmount * ILLUSTRATIVE_RATE;
          }

          return (
            <li key={row.label} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{row.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {usedLiveRate ? "Converted with today's ECB reference rate" : "Illustrative rate for the preview"}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3">
                <span className="text-base font-semibold tabular-nums text-ink">
                  {formatMoney(row.fromAmount, row.fromCurrency)}
                </span>
                <IconSwap aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-base font-semibold tabular-nums text-ink">
                  {converted !== null ? (
                    formatMoney(converted, row.toCurrency)
                  ) : (
                    <span aria-busy="true" className="text-muted">
                      …
                    </span>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted">
        {live && snapshot ? (
          <>
            Reference rate {snapshot.baseCurrency} ↔ foreign currencies, effective{" "}
            {snapshot.effectiveDate}, published by {snapshot.provider}. Amounts are illustrative;
            your expenses are stored exactly as you paid them.
          </>
        ) : (
          "Live ECB rates are temporarily unavailable — the example above uses an illustrative rate."
        )}
      </p>
    </div>
  );
}