/**
 * Product showcase ("Your expenses, in context."): a static, faithful
 * recreation of the app's expense list.
 *
 * The row hierarchy mirrors the signed-in dashboard exactly: the converted
 * reporting amount is the primary value, with the amount as paid sitting
 * beneath it in grey — so the original currency is always visible but never
 * dominates (see `transaction-row.tsx`).
 *
 * All figures are illustrative and labelled as such. Two currencies only: paid
 * in EUR, reporting currency INR, consistent with the site's standing
 * examples. Rows are static markup — no links or controls, because nothing
 * here is the running application.
 */

const ROWS = [
  { title: "Groceries", meta: "Food · 14 Oct", home: "₹3,807.00", paid: "€42.30", dot: "bg-cat-mint" },
  { title: "Coffee", meta: "Food · 12 Oct", home: "₹585.00", paid: "€6.50", dot: "bg-cat-mint" },
  { title: "Metro pass", meta: "Transport · 10 Oct", home: "₹1,791.00", paid: "€19.90", dot: "bg-cat-slate" },
  { title: "Hotel", meta: "Travel · 9 Oct", home: "₹7,198.40", paid: "€80.00", dot: "bg-cat-sky" },
] as const;

export function ExpenseShowcase() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_50px_120px_-60px_rgba(0,0,0,0.95)]">
      {/* Panel header: period, combined total, illustrative label. */}
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            October
          </p>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Illustrative
          </span>
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
          Total spent
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="font-display text-3xl font-semibold leading-none tracking-tight text-ink tabular-nums sm:text-4xl">
            ₹1,12,340
          </span>
          <span className="text-sm text-muted tabular-nums">€1,248.50 as paid</span>
        </div>
      </div>

      {/* Rows mirror the signed-in list: reporting amount primary,
          amount as paid beneath it in grey. */}
      <ul className="divide-y divide-border px-2 sm:px-3">
        {ROWS.map((row) => (
          <li key={row.title} className="flex items-center gap-3 px-3 py-3">
            <span
              aria-hidden="true"
              className={`inline-block size-2.5 shrink-0 rounded-full ${row.dot}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {row.title}
              </span>
              <span className="block truncate text-xs text-muted">{row.meta}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold text-ink tabular-nums">
                {row.home}
              </span>
              <span className="mt-0.5 block text-xs text-muted tabular-nums">
                {row.paid}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-border px-5 py-4 font-mono text-[11px] leading-relaxed text-muted sm:px-6">
        Illustrative data · The app converts at the European Central Bank&apos;s
        daily reference rate.
      </p>
    </div>
  );
}
