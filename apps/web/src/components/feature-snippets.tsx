/**
 * The feature bento: one asymmetric 12-column grid where every tile carries a
 * small, live-looking slice of the product UI rather than a plain icon.
 *
 * Snippets are static and illustrative. Currency examples use exactly two
 * currencies — the one paid in and the one thought in.
 */

import type { ReactNode } from "react";
import { SpendTrendChart } from "./spend-trend-chart";
import {
  IconBolt,
  IconRefresh,
  IconSearch,
  IconTag,
  IconTarget,
  IconTrendUp,
} from "./icons";

function Tile({
  icon,
  title,
  body,
  children,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex flex-col rounded-3xl border border-border bg-surface p-5 transition-colors hover:border-border-strong sm:p-6 ${className}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-5 pt-1">{children}</div>
    </article>
  );
}

export function FeaturesBento() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
      {/* Automatic conversion */}
      <Tile
        className="lg:col-span-7"
        icon={<IconRefresh className="h-5 w-5" />}
        title="Automatic conversion"
        body="Record what you paid; Pluto converts it with the European Central Bank's daily reference rate. Your original amount is never rewritten."
      >
        <div className="rounded-2xl border border-border bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              You paid
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted">
              ECB · daily
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-2xl font-light text-ink tabular-nums">
              €6.50
            </span>
            <span className="text-accent">→</span>
            <span className="font-display text-2xl font-light text-accent-strong tabular-nums">
              ₹585
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted tabular-nums">
            1 EUR = 89.98 INR · Illustrative
          </p>
        </div>
      </Tile>

      {/* Quick entry */}
      <Tile
        className="lg:col-span-5"
        icon={<IconBolt className="h-5 w-5" />}
        title="Quick entry"
        body="Add a purchase in a few seconds: the amount you paid, a category, and it is done."
      >
        <div className="rounded-2xl border border-border bg-canvas p-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
            <span className="font-display text-lg font-light text-ink tabular-nums">
              €6.50
            </span>
            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
              EUR
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-tint-lilac-bg px-2.5 py-1 text-[11px] font-medium text-tint-lilac-fg">
              Coffee
            </span>
            <span className="rounded-full bg-tint-teal-bg px-2.5 py-1 text-[11px] font-medium text-tint-teal-fg">
              Food
            </span>
            <span className="ml-auto rounded-lg bg-primary px-3 py-1 text-[11px] font-semibold text-on-primary">
              Add
            </span>
          </div>
        </div>
      </Tile>

      {/* Reports and trends */}
      <Tile
        className="lg:col-span-5"
        icon={<IconTrendUp className="h-5 w-5" />}
        title="Reports and trends"
        body="See where the month went, in the currency you think in."
      >
        <div className="rounded-2xl border border-border bg-canvas p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">This month</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-subtle px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
              ▲ 5.7%
            </span>
          </div>
          <SpendTrendChart id="bento-trend" values={[30, 44, 38, 55, 49, 64, 58]} className="mt-2 h-14 w-full" />
        </div>
      </Tile>

      {/* Budgets */}
      <Tile
        className="lg:col-span-7"
        icon={<IconTarget className="h-5 w-5" />}
        title="Budgets"
        body="Set a monthly limit per category and watch it in your own currency."
      >
        <div className="space-y-3 rounded-2xl border border-border bg-canvas p-4">
          {[
            { label: "Groceries", spent: "₹12,400", total: "₹18,000", pct: 69 },
            { label: "Transport", spent: "₹4,050", total: "₹9,000", pct: 45 },
          ].map((budget) => (
            <div key={budget.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">{budget.label}</span>
                <span className="text-muted tabular-nums">
                  {budget.spent} / {budget.total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${budget.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Tile>

      {/* Searchable history */}
      <Tile
        className="lg:col-span-7"
        icon={<IconSearch className="h-5 w-5" />}
        title="Searchable history"
        body="Find any purchase by name, category or amount — with its original currency intact."
      >
        <div className="rounded-2xl border border-border bg-canvas p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
            <IconSearch className="h-4 w-4" />
            coffee
          </div>
          <ul className="mt-2 divide-y divide-border">
            {[
              { label: "Coffee", paid: "€6.50", converted: "₹585" },
              { label: "Coffee beans", paid: "€9.20", converted: "₹828" },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{row.label}</span>
                <span className="tabular-nums">
                  <span className="text-muted">{row.paid}</span>
                  <span className="mx-1.5 text-accent">→</span>
                  <span className="font-semibold text-ink">{row.converted}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Tile>

      {/* Custom categories */}
      <Tile
        className="lg:col-span-5"
        icon={<IconTag className="h-5 w-5" />}
        title="Custom categories"
        body="Name your own categories and colour them so a glance says enough."
      >
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Rent", bg: "bg-tint-indigo-bg", fg: "text-tint-indigo-fg" },
            { label: "Tuition", bg: "bg-tint-amber-bg", fg: "text-tint-amber-fg" },
            { label: "Food", bg: "bg-tint-teal-bg", fg: "text-tint-teal-fg" },
            { label: "Travel", bg: "bg-tint-sky-bg", fg: "text-tint-sky-fg" },
            { label: "Phone", bg: "bg-tint-rose-bg", fg: "text-tint-rose-fg" },
            { label: "Fun", bg: "bg-tint-lilac-bg", fg: "text-tint-lilac-fg" },
          ].map((chip) => (
            <span
              key={chip.label}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${chip.bg} ${chip.fg}`}
            >
              {chip.label}
            </span>
          ))}
        </div>
      </Tile>
    </div>
  );
}
