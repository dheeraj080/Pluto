/**
 * The hero product mockup: a browser-framed dashboard with an icon sidebar, a
 * large balance beside its converted value, the spend chart and a recent
 * expenses list.
 *
 * Presentation follows the marketing design rules: hairline borders, neutral
 * elevation, no colour washes — the accent appears only where the product
 * speaks (active nav item, positive delta, converted key numbers, chart line).
 *
 * Everything here is static and illustrative. Two currencies only: the one
 * paid in (EUR) and the one thought in (INR).
 */

import { SpendTrendChart } from "./spend-trend-chart";
import {
  IconChart,
  IconHome,
  IconTag,
  IconTarget,
  IconWallet,
} from "./icons";

const SIDEBAR = [
  { icon: IconHome, label: "Home", active: true },
  { icon: IconChart, label: "Reports", active: false },
  { icon: IconWallet, label: "Budgets", active: false },
  { icon: IconTag, label: "Categories", active: false },
  { icon: IconTarget, label: "Goals", active: false },
] as const;

const TREND = [34, 41, 37, 52, 47, 61, 56, 72, 66, 83];

const RECENT = [
  { label: "Coffee", paid: "€6.50", converted: "₹585" },
  { label: "Groceries", paid: "€42.30", converted: "₹3,807" },
  { label: "Metro pass", paid: "€19.90", converted: "₹1,791" },
] as const;

export function DashboardMockup() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_50px_120px_-60px_rgba(0,0,0,0.95)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-border bg-canvas px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="rounded-md border border-border bg-surface px-2.5 py-0.5 font-mono text-[11px] text-muted">
          pluto.app/expenses
        </span>
      </div>

      <div className="flex">
        {/* Icon sidebar */}
        <aside className="hidden w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border py-4 sm:flex">
          {SIDEBAR.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  item.active
                    ? "bg-primary-subtle text-primary"
                    : "text-muted"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="sr-only">{item.label}</span>
              </span>
            );
          })}
        </aside>

        {/* Main panel */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
              October
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-subtle px-2.5 py-0.5 font-mono text-[11px] font-medium text-primary tabular-nums">
              ▲ 5.7%
            </span>
          </div>

          <div className="px-4 pt-5 sm:px-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Total spent
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-display text-[2rem] font-light leading-none tracking-tight text-ink tabular-nums sm:text-[2.6rem]">
                €1,248.50
              </span>
              <span className="text-base font-medium text-primary tabular-nums sm:text-lg">
                ₹1,12,000
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted tabular-nums">
              Converted at the daily ECB rate · Illustrative
            </p>
          </div>

          <div className="mt-3 px-1">
            <SpendTrendChart id="hero-trend" values={TREND} className="h-28 w-full sm:h-36" />
          </div>

          <div className="mx-4 mb-4 mt-2 rounded-xl border border-border bg-canvas p-3 sm:mx-5 sm:mb-5">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              Recent
            </p>
            <ul className="divide-y divide-border">
              {RECENT.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="truncate text-sm font-medium text-ink">{row.label}</span>
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="text-muted">{row.paid}</span>
                    <span className="mx-1.5 text-accent">→</span>
                    <span className="font-semibold text-ink">{row.converted}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
