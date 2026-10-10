"use client";

/** Live exchange-rate card on the landing page (public endpoint, no auth). */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RateSnapshot } from "@/lib/types";

const HIGHLIGHTED = ["EUR", "GBP", "JPY", "INR", "CHF", "CAD"] as const;

export function RatesPreview() {
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .get<RateSnapshot>("/rates/latest")
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border" />
        ))}
      </div>
    );
  }

  if (state === "error" || !snapshot) {
    return (
      <p className="text-sm text-muted">
        Live rates are temporarily unavailable — check the{" "}
        <a href="/status" className="text-accent underline underline-offset-2">
          status page
        </a>
        .
      </p>
    );
  }

  const rates: { code: string; rate: string }[] = [];
  for (const code of HIGHLIGHTED) {
    const rate = snapshot.rates[code];
    if (rate !== undefined) rates.push({ code, rate });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rates.map(({ code, rate }) => (
          <div key={code} className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              1 {snapshot.baseCurrency} → {code}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold">
              {Number(rate).toFixed(4)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {snapshot.provider} · effective {snapshot.effectiveDate} · snapshot v
        {snapshot.version}
      </p>
    </div>
  );
}
