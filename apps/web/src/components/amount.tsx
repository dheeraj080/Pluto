/**
 * Two-currency money display.
 *
 * Every money value in the app is shown in the user's Pair: a large Base value
 * with the Second value beside or below it in smaller grey text. When an
 * expense was recorded in a third currency, that original amount stays visible
 * as a small "Paid …" label — the recorded amount is never rewritten.
 *
 * Presentation only: the caller decides which currency is Base and which is
 * Second, and supplies both amounts. Digits are always tabular so columns line
 * up and figures do not jump as values change.
 */

import { formatMoney } from "@/lib/format";

export type AmountSize = "display" | "hero" | "kpi" | "lg" | "md" | "sm";

export interface DualAmountProps {
  /** Amount in the primary (large) currency. */
  amount: number;
  currency: string;
  /** Amount in the secondary (smaller, grey) currency; omit to show one value. */
  secondaryAmount?: number | null;
  secondaryCurrency?: string | null;
  /** The amount as originally recorded, when that is a third currency. */
  recorded?: { amount: number; currency: string } | null;
  size?: AmountSize;
  /** `inline` puts the Second value beside the Base; `stack` puts it below. */
  layout?: "inline" | "stack";
  align?: "left" | "center" | "right";
  /** Explicit locale for server-rendered figures; omit in client screens. */
  locale?: string;
  className?: string;
}

const PRIMARY_SIZE: Record<AmountSize, string> = {
  display: "text-[2.75rem] font-light leading-none tracking-tight",
  hero: "text-4xl font-light tracking-tight md:text-5xl",
  kpi: "text-[1.75rem] font-light leading-none tracking-tight",
  lg: "text-2xl font-semibold tracking-tight",
  md: "text-base font-semibold",
  sm: "text-sm font-semibold",
};

const SECONDARY_SIZE: Record<AmountSize, string> = {
  display: "text-lg",
  hero: "text-lg md:text-xl",
  kpi: "text-sm",
  lg: "text-sm",
  md: "text-xs",
  sm: "text-xs",
};

const RECORDED_SIZE: Record<AmountSize, string> = {
  display: "text-sm",
  hero: "text-sm",
  kpi: "text-xs",
  lg: "text-xs",
  md: "text-xs",
  sm: "text-[11px]",
};

export function DualAmount({
  amount,
  currency,
  secondaryAmount,
  secondaryCurrency,
  recorded,
  size = "md",
  layout = "inline",
  align = "left",
  locale,
  className = "",
}: DualAmountProps) {
  const showSecond = secondaryAmount != null && secondaryCurrency != null;
  const inline = layout === "inline";
  const showRecorded = recorded != null && recorded.currency !== currency;

  return (
    <span
      className={`inline-flex flex-col ${
        align === "right"
          ? "items-end text-right"
          : align === "center"
            ? "items-center text-center"
            : "items-start"
      } ${className}`}
    >
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`tabular-nums text-ink ${PRIMARY_SIZE[size]}`}>
          {formatMoney(amount, currency, locale)}
        </span>
        {showSecond && inline && (
          <>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <span className="sr-only">or</span>
            <span className={`tabular-nums text-muted ${SECONDARY_SIZE[size]}`}>
              {formatMoney(secondaryAmount, secondaryCurrency, locale)}
            </span>
          </>
        )}
      </span>
      {showSecond && !inline && (
        <span className={`tabular-nums text-muted ${SECONDARY_SIZE[size]}`}>
          {formatMoney(secondaryAmount, secondaryCurrency, locale)}
        </span>
      )}
      {showRecorded && (
        <span className={`mt-0.5 text-muted ${RECORDED_SIZE[size]}`}>
          Paid {formatMoney(recorded.amount, recorded.currency, locale)}
        </span>
      )}
    </span>
  );
}
