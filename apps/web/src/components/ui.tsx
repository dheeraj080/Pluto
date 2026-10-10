/**
 * Shared building blocks for every screen (admin and the signed-in app).
 *
 * Deliberately dependency-free: no form/state library, matching the rest of
 * this codebase where pages own their state with useState/useEffect.
 *
 * Design language: warm surfaces, forest-green primary, hairline borders,
 * tabular numerals for every money figure, visible focus rings, restrained
 * motion (respected via the global reduced-motion override).
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { formatMoney } from "@/lib/format";
import { IconChevronDown, IconSparkle } from "./icons";

/* ------------------------------------------------------------------ */
/* Text & layout                                                       */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  children,
  action,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(23,33,27,0.04)] ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 sm:px-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {action}
        </div>
      )}
      <div className={`p-5 sm:p-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-[0_1px_2px_rgba(23,33,27,0.04)]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink md:text-[1.75rem]">
        {value}
      </p>
      {sub && <div className="mt-1 text-sm">{sub}</div>}
    </div>
  );
}

/** Renders a money amount with currency-aware formatting and fixed-width digits. */
export function Money({
  amount,
  currency,
  className = "",
}: {
  amount: number;
  currency: string;
  className?: string;
}) {
  return <span className={`tabular-nums ${className}`}>{formatMoney(amount, currency)}</span>;
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "accent" | "gold";

const BADGE_STYLES: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-muted text-muted",
  ok: "border-success/25 bg-success-subtle text-success",
  warn: "border-warning/25 bg-warning-subtle text-warning",
  danger: "border-danger/25 bg-danger-subtle text-danger",
  accent: "border-primary/25 bg-primary-subtle text-primary",
  gold: "border-gold/30 bg-gold-subtle text-gold",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-[0_1px_2px_rgba(23,33,27,0.18)] hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-border bg-background text-ink hover:bg-surface-muted hover:border-border-strong",
  ghost: "text-muted hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger text-white shadow-[0_1px_2px_rgba(23,33,27,0.18)] hover:bg-danger-hover",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-[15px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** @deprecated Use `variant`. Map: accent → primary, danger → danger. */
  tone?: "default" | "danger" | "accent";
  size?: ButtonSize;
  /** Shows an inline spinner and blocks interaction. */
  loading?: boolean;
}

export function Button({
  variant,
  tone,
  size = "md",
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const resolved: ButtonVariant =
    variant ??
    (tone === "accent" ? "primary" : tone === "danger" ? "danger" : "secondary");

  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center rounded-xl font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 ${BUTTON_VARIANTS[resolved]} ${BUTTON_SIZES[size]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4 border-[1.5px]" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Status & feedback                                                   */
/* ------------------------------------------------------------------ */

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-subtle px-3.5 py-3 text-sm text-danger"
    >
      <span aria-hidden="true" className="mt-0.5">
        !
      </span>
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}

export function LoadingNote({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      <Spinner className="h-3.5 w-3.5 border-[1.5px]" />
      {label}
    </p>
  );
}

/** Pulsing placeholder used while fetch-based content is in flight. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-surface-muted ${className}`} />;
}

/**
 * Table-like skeleton rows, sized to match the real table. Prevents layout
 * jump when the data arrives.
 */
export function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/3" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Used when a list is loaded and genuinely has nothing in it. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Standard table shell; rows are provided by the caller. */
export function Table({
  headers,
  children,
  className = "",
}: {
  headers: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-border bg-background ${className}`}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        ← Previous
      </Button>
      <span className="text-muted">
        Page <span className="tabular-nums">{page}</span> of{" "}
        <span className="tabular-nums">{totalPages}</span> ·{" "}
        <span className="tabular-nums">{total}</span> total
      </span>
      <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        Next →
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control & tabs                                            */
/* ------------------------------------------------------------------ */

export interface SegmentOption {
  value: string;
  label: string;
}

/** Pill-style single-choice switcher (period pickers, scopes, …). */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex rounded-xl border border-border bg-surface-muted p-0.5 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-[10px] px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary ${
              active ? "bg-background text-ink shadow-[0_1px_2px_rgba(23,33,27,0.08)]" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Accessible tab list (panels are rendered by the caller). */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  className = "",
}: {
  tabs: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-1 border-b border-border ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:border-border-strong hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

/** Label + control + optional hint/error, laid out as a form row. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  optional = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
          {optional && (
            <span className="ml-1 text-xs font-normal text-muted">(optional)</span>
          )}
        </label>
      </div>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-ink shadow-[0_1px_2px_rgba(23,33,27,0.04)] transition placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${className ?? ""}`} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${CONTROL} appearance-none pr-9 ${className ?? ""}`} />
      <IconChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} min-h-24 leading-relaxed ${className ?? ""}`} />;
}

/** Small hint used under form sections (e.g. an illustrative note). */
export function InlineNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
      <IconSparkle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
      <span>{children}</span>
    </p>
  );
}