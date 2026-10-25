/**
 * A single transaction row, shared by the dashboard and the reports drill-down.
 *
 * A list row shows exactly **two** values: the amount in the primary currency,
 * and beneath it one small grey value. Which one sits beneath is the caller's
 * choice:
 *
 * - `beneath="paid"` (reports) shows the amount as it was actually paid
 *   whenever that differs from the primary currency;
 * - `beneath="secondary"` (dashboard) shows the amount in the second currency
 *   of the user's Pair instead, so the currency the expense was paid in never
 *   appears on the row.
 *
 * Everything else — the original currency, the rate used and its date — is
 * revealed on hover or focus in a tooltip, so the row stays quiet and the
 * detail is one gesture away.
 *
 * Returns the `<li>` itself, so the tooltip can be positioned relative to the
 * whole row; callers render it straight into a `<ul>`.
 */

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { formatRateValue } from "@/lib/convert";

export interface TransactionRowProps {
  href: string;
  /** Category colour used for the leading dot. */
  color?: string | null;
  /** Primary line: the description, or the category name as a fallback. */
  title: string;
  /** Secondary line: typically `${category} · ${date}`. */
  meta: string;
  /** Amount converted into the primary currency. */
  amount: number;
  /** Primary currency. */
  currency: string;
  /** The amount as recorded, revealed in the tooltip when its currency differs. */
  paid?: { amount: number; currency: string } | null;
  /** Second-currency value of the amount. */
  secondary?: { amount: number; currency: string } | null;
  /** The rate used to reach the primary amount, shown in the tooltip. */
  rate?: { from: string; to: string; value: number; date: string; provider: string } | null;
  /** Flags a conversion that used the closest published snapshot. */
  estimated?: boolean;
  /** Which small grey value sits beneath the primary amount on the row. */
  beneath?: "paid" | "secondary";
  className?: string;
}

export function TransactionRow({
  href,
  color = null,
  title,
  meta,
  amount,
  currency,
  paid = null,
  secondary = null,
  rate = null,
  estimated = false,
  beneath = "paid",
  className = "",
}: TransactionRowProps) {
  const showPaid = paid != null && paid.currency !== currency;
  const showSecondaryOnRow = beneath === "secondary" && secondary != null;

  const hasTooltip = Boolean(
    rate ||
      estimated ||
      (showPaid && beneath !== "paid") ||
      (secondary && !showSecondaryOnRow),
  );

  return (
    <li className={`group relative ${className}`}>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-[var(--radius-stock,8px)] px-2 py-2.5 transition-colors duration-150 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {color && (
          <span
            aria-hidden="true"
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{title}</span>
          <span className="block truncate text-xs text-muted">{meta}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-ink">
            {formatMoney(amount, currency)}
          </span>
          {beneath === "secondary" ? (
            secondary && (
              <span className="mt-0.5 block text-xs tabular-nums text-muted">
                {formatMoney(secondary.amount, secondary.currency)}
              </span>
            )
          ) : showPaid ? (
            <span className="mt-0.5 block text-xs tabular-nums text-muted">
              {formatMoney(paid.amount, paid.currency)}
            </span>
          ) : null}
        </span>
      </Link>

      {hasTooltip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-2 top-full z-20 mt-1 hidden w-max max-w-[17rem] rounded-[var(--radius-stock,8px)] border border-border bg-paper px-3 py-2 text-left text-xs shadow-2xl group-hover:block group-focus-within:block"
        >
          {showPaid && beneath !== "paid" && (
            <span className="block tabular-nums">
              Paid {formatMoney(paid.amount, paid.currency)}
              <span className="ml-1 font-normal text-muted">{paid.currency}</span>
            </span>
          )}
          {secondary && !showSecondaryOnRow && (
            <span className="block tabular-nums">
              {formatMoney(secondary.amount, secondary.currency)}
              <span className="ml-1 font-normal text-muted">{secondary.currency}</span>
            </span>
          )}
          {rate && (
            <span className="mt-1 block text-muted">
              1 {rate.from} = <span className="tabular-nums">{formatRate(rate.value)}</span> {rate.to}
              {" · "}
              {rate.provider} {rate.date}
            </span>
          )}
          {estimated && <span className="mt-1 block text-warning">Estimated rate</span>}
        </span>
      )}
    </li>
  );
}

/** Rates need more digits when a single unit is worth very little. */
function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return formatRateValue(value);
}