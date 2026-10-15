"use client";

/**
 * Settings: the one place the currency Pair is defined.
 *
 * The Base drives aggregation; the Second is a display companion the server
 * re-expresses every figure in. Deliberately not in the main nav — it is a
 * preference, reached from the user area or the header's "Set a currency pair"
 * link.
 */

import { useMemo } from "react";
import { AppPageHeader } from "@/components/app-page-header";
import { ThemeToggle } from "@/components/theme";
import { Button, ErrorNote, Field, Select } from "@/components/ui";
import { IconSwap } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import { useExpenseSetup, usePair, useRateSnapshot } from "../use-expenses";

/** The illustrative amount used for the live pair preview. */
const SAMPLE = 100;

export default function SettingsPage() {
  const { currencies, error } = useExpenseSetup();
  const { base, second, setBase, setSecond, swap } = usePair();

  const sorted = useMemo(
    () => [...currencies].sort((a, b) => a.code.localeCompare(b.code)),
    [currencies],
  );

  // Rates are quoted against the base, so ask for the base snapshot directly.
  const snapshot = useRateSnapshot(base ?? undefined);
  const rate = second && snapshot ? Number(snapshot.rates[second]) : Number.NaN;

  return (
    <div className="space-y-6">
      <AppPageHeader title="Settings" />

      {error && <ErrorNote message={error} />}

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-medium text-ink">Display currencies</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Pluto shows every amount in two currencies: a Base and a Second. Choose both here, then
          switch which one is the Base from any page header.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Field
            label="Base currency"
            hint="Totals are calculated in this currency."
            htmlFor="setting-base"
          >
            <Select
              id="setting-base"
              value={base ?? ""}
              onChange={(value) => {
                if (value) setBase(value);
              }}
            >
              <option value="">Server default</option>
              {sorted.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code} · {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Button
            variant="secondary"
            onClick={swap}
            disabled={!base || !second}
            className="sm:mb-1"
          >
            <IconSwap aria-hidden="true" className="h-4 w-4" />
            Swap
          </Button>

          <Field
            label="Second currency"
            hint="Shown smaller, beside the base value."
            htmlFor="setting-second"
          >
            <Select
              id="setting-second"
              value={second ?? ""}
              onChange={setSecond}
            >
              <option value="">None</option>
              {sorted
                .filter((entry) => entry.code !== base)
                .map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code} · {entry.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        {base && second && (
          <div className="mt-6 rounded-2xl border border-border bg-surface-muted px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Preview</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="tabular-nums text-lg font-semibold text-ink">
                {formatMoney(SAMPLE, base)}
              </span>
              {Number.isFinite(rate) && (
                <>
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <span aria-hidden="true" className="sr-only">
                    or
                  </span>
                  <span className="tabular-nums text-sm text-muted">
                    {formatMoney(SAMPLE * rate, second)}
                  </span>
                </>
              )}
            </p>
            {Number.isFinite(rate) && (
              <p className="mt-1 text-xs text-muted">
                1 {base} = <span className="tabular-nums">{rate.toFixed(4)}</span> {second}, at the
                latest published rate.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-medium text-ink">Appearance</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Choose a light or dark interface, or follow your device. The setting is saved to this
          browser.
        </p>
        <div className="mt-4">
          <ThemeToggle withLabels />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-medium text-ink">How recorded amounts are kept</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          An expense is stored in the currency you paid in, and that recorded amount is never
          rewritten. The Base and Second values are computed from the exchange rate on the
          expense&rsquo;s own date, so figures stay historically accurate. When you paid in a third
          currency, its amount stays visible as a small &ldquo;Paid …&rdquo; label.
        </p>
      </section>
    </div>
  );
}
