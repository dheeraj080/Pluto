"use client";

/**
 * The "How it works" converter: one purchase, one conversion, between exactly
 * two currencies (EUR paid → INR thought in).
 *
 * The target value comes from the live ECB snapshot (`GET /rates/latest`,
 * public) so the demo is truthful; when that is unavailable a clearly-labelled
 * illustrative rate is used. The figure counts up once when it arrives — the
 * global reduced-motion override skips the animation.
 */

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { RateSnapshot } from "@/lib/types";

const AMOUNT = 42.3;
const FROM = "EUR";
const TO = "INR";
/** Illustrative fallback only; live ECB rates are preferred. */
const FALLBACK_RATE = 89.98;

function useCountUp(target: number | null): number | null {
  const [display, setDisplay] = useState<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target === null) return;

    let raf = 0;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      raf = requestAnimationFrame(() => {
        fromRef.current = target;
        setDisplay(target);
      });
      return () => cancelAnimationFrame(raf);
    }

    const from = fromRef.current;
    const start = performance.now();
    const duration = 900;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setDisplay(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        setDisplay(target);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return display;
}

export function ConverterSingle() {
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

  let rate = FALLBACK_RATE;
  if (live && snapshot) {
    const rateFrom = Number(snapshot.rates[FROM]);
    const rateTo = Number(snapshot.rates[TO]);
    if (Number.isFinite(rateFrom) && Number.isFinite(rateTo) && rateFrom > 0) {
      rate = rateTo / rateFrom;
    }
  }

  const converted = useCountUp(AMOUNT * rate);

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          One purchase
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-2.5 py-0.5 text-[11px] font-medium text-muted">
          ECB · daily
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-3xl font-light text-ink tabular-nums">
          €42.30
        </span>
        <span className="text-xl text-accent">→</span>
        <span className="font-display text-3xl font-light text-accent-strong tabular-nums">
          {converted === null ? (
            <span className="text-muted">—</span>
          ) : (
            formatMoney(converted, TO, "en-IN")
          )}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted tabular-nums">
        1 {FROM} = {rate.toFixed(2)} {TO}
      </p>

      <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted">
        {live && snapshot
          ? `Illustrative amount, converted with the ECB reference rate effective ${snapshot.effectiveDate}. Your own expenses keep the currency you paid in.`
          : "Live rates are unavailable right now, so this preview uses an illustrative rate. Your own expenses keep the currency you paid in."}
      </p>
    </div>
  );
}
