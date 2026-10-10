/**
 * Static dashboard preview for the landing page.
 *
 * Built with the same primitives the signed-in app uses so the marketing site
 * and product share one visual language. All figures are illustrative.
 */

import { Badge, Card, Money } from "@/components/ui";
import { IconSwap, IconReceipt, IconWallet, IconChart } from "@/components/icons";

const MONTH_TOTAL = { amount: 1248.5, base: "EUR" };
const PREVIOUS_DELTA = { percent: 4.1, direction: "down" };

const CURRENCIES = [
  { code: "EUR", amount: 640, count: 12 },
  { code: "SGD", amount: 210, count: 5 },
  { code: "JPY", amount: 398.5, count: 8 },
];

const CATEGORIES = [
  { name: "Rent & housing", percent: 42 },
  { name: "Groceries", percent: 24 },
  { name: "Transport", percent: 14 },
  { name: "Other", percent: 20 },
];

const TRANSACTIONS = [
  { description: "Co-op groceries", category: "Groceries", amount: 86.4, currency: "EUR" },
  { description: "MRT weekly pass", category: "Transport", amount: 12.5, currency: "SGD" },
  { description: "Sushi lunch", category: "Dining", amount: 1580, currency: "JPY" },
];

export function ProductPreview() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-x-8 -top-6 bottom-6 -z-10 rounded-[2.5rem] bg-primary-subtle/60 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_20px_50px_-20px_rgba(23,33,27,0.25)]">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="ml-3 flex items-center gap-2 text-xs font-medium text-muted">
            <IconSwap className="h-3.5 w-3.5" />
            Pluto — expenses
          </span>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-5">
          {/* Stats column */}
          <div className="space-y-4 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">This month</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">
                  <Money amount={MONTH_TOTAL.amount} currency={MONTH_TOTAL.base} />
                </p>
              </div>
              <Badge tone="ok">{PREVIOUS_DELTA.percent}% vs last month</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((entry) => (
                <div
                  key={entry.code}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-1.5"
                >
                  <span className="text-xs font-semibold text-muted">{entry.code}</span>
                  <span className="text-sm font-medium tabular-nums">
                    <Money amount={entry.amount} currency={entry.code} />
                  </span>
                  <span className="text-xs text-muted">· {entry.count}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  By category
                </p>
                <IconChart className="h-4 w-4 text-muted" />
              </div>
              <ul className="mt-3 space-y-2.5">
                {CATEGORIES.map((category) => (
                  <li key={category.name}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-ink">{category.name}</span>
                      <span className="tabular-nums text-muted">{category.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${category.percent}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recent activity */}
          <div className="lg:col-span-2">
            <Card title="Recent expenses">
              <ul className="divide-y divide-border">
                {TRANSACTIONS.map((tx) => (
                  <li key={tx.description} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary"
                      aria-hidden="true"
                    >
                      <IconReceipt className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{tx.description}</p>
                      <p className="text-xs text-muted">{tx.category}</p>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-ink">
                      <Money amount={tx.amount} currency={tx.currency} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted">
              <IconWallet className="h-3.5 w-3.5" />
              Illustrative preview — your data, your numbers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}