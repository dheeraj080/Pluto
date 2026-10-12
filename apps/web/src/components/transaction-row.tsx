/**
 * A single transaction row, shared by the dashboard and the transactions list.
 *
 * The layout is the app's standard row: a category dot, the description, a
 * date · category line, and the amount right-aligned in the Pair — the Base in
 * bold ink, the Second smaller and grey, and the original recorded amount as a
 * quiet "Paid …" label when it is a third currency.
 */

import Link from "next/link";
import { DualAmount } from "./amount";

export interface TransactionRowProps {
  href: string;
  /** Category colour used for the leading dot. */
  color?: string | null;
  /** Primary line: the description, or the category name as a fallback. */
  title: string;
  /** Secondary line: typically `${date} · ${category}`. */
  meta: string;
  /** Amount in the base currency. */
  amount: number;
  currency: string;
  /** Amount in the second currency, when a pair is set. */
  secondAmount?: number | null;
  secondCurrency?: string | null;
  /** Original amount, shown as "Paid …" only when it is a third currency. */
  recorded?: { amount: number; currency: string } | null;
  className?: string;
}

export function TransactionRow({
  href,
  color = null,
  title,
  meta,
  amount,
  currency,
  secondAmount = null,
  secondCurrency = null,
  recorded = null,
  className = "",
}: TransactionRowProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-surface-muted ${className}`}
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
      <DualAmount
        amount={amount}
        currency={currency}
        secondaryAmount={secondAmount}
        secondaryCurrency={secondCurrency}
        recorded={recorded}
        size="sm"
        layout="stack"
        align="right"
        className="shrink-0"
      />
    </Link>
  );
}
