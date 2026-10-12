/**
 * The hero product mockup: a browser-like dashboard with an icon sidebar, a
 * large balance beside its converted value, a glowing spend chart and a recent
 * expenses list — with a small phone overlapping the corner to show the same
 * account on web and mobile.
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
    <div className="relative pb-10 sm:pb-14">
      {/* Soft emerald glow behind the card and chart. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 bottom-10 -z-10 bg-[radial-gradient(60%_50%_at_50%_20%,var(--glow),transparent_72%)]"
      />

      <div className="relative overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_40px_120px_-50px_rgba(0,0,0,0.9)]">
        <div className="flex">
          {/* Icon sidebar */}
          <aside className="hidden w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border py-4 sm:flex">
            {SIDEBAR.map((item) => {
              const Icon = item.icon;
              return (
                <span
                  key={item.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
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
              <p className="text-xs font-medium text-muted">October</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-subtle px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                ▲ 5.7%
              </span>
            </div>

            <div className="px-4 pt-5 sm:px-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Total spent
              </p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-display text-[2rem] font-light leading-none tracking-tight text-ink tabular-nums sm:text-[2.6rem]">
                  €1,248.50
                </span>
                <span className="text-base font-medium text-accent-strong tabular-nums sm:text-lg">
                  ₹1,12,000
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Converted at the daily ECB rate · Illustrative
              </p>
            </div>

            <div className="relative mt-3 px-1">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 top-2 bottom-2 bg-[radial-gradient(50%_60%_at_60%_40%,var(--glow),transparent_70%)]"
              />
              <SpendTrendChart id="hero-trend" values={TREND} className="h-28 w-full sm:h-36" />
            </div>

            <div className="mx-4 mb-4 mt-2 rounded-2xl border border-border bg-canvas p-3 sm:mx-5 sm:mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
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

      {/* Phone overlapping the corner. */}
      <div className="absolute bottom-0 right-2 w-28 sm:right-5 sm:w-36" aria-hidden="true">
        <div className="rounded-[1.6rem] border border-border-strong bg-canvas p-1.5 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.95)]">
          <div className="overflow-hidden rounded-[1.2rem] bg-surface">
            <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-white/20" />
            <div className="px-2.5 pb-3 pt-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                October
              </p>
              <p className="mt-0.5 font-display text-sm font-light text-ink tabular-nums">
                ₹1,12,000
              </p>
              <p className="text-[9px] text-muted tabular-nums">≈ €1,248.50</p>
              <div className="mt-2 rounded-lg border border-border bg-canvas px-2 py-1.5">
                <p className="text-[9px] font-medium text-ink">Coffee</p>
                <p className="text-[9px] text-muted tabular-nums">
                  €6.50 <span className="text-accent">→</span> ₹585
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
