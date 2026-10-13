/**
 * Shared building blocks for every screen (admin and the signed-in app).
 *
 * Deliberately dependency-free: no form/state library, matching the rest of
 * this codebase where pages own their state with useState/useEffect.
 *
 * Design language: near-black graphite surfaces, a single mint-emerald accent,
 * hairline borders, tabular numerals for every money figure, visible focus
 * rings, restrained motion (respected via the global reduced-motion override).
 */

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type OptionHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "@/lib/format";
import { IconCheck, IconChevronDown, IconSparkle } from "./icons";

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
      className={`rounded-3xl border border-border bg-surface ${className}`}
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
    "bg-primary text-on-primary shadow-[0_6px_20px_-10px_rgba(52,211,153,0.7)] hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-border bg-surface-muted text-ink hover:border-border-strong hover:bg-surface",
  ghost: "text-muted hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger-solid text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:bg-danger-solid-hover",
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
  "w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-sm text-ink transition placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${className ?? ""}`} />;
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Recursively flattens an `<option>`'s children into plain text. */
function optionText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return optionText(node.props.children);
  return "";
}

/** Reads the `<option>` children a caller passes, exactly like a native select. */
function readOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as OptionHTMLAttributes<HTMLOptionElement>;
    if (typeof props.value !== "string") return;
    options.push({
      value: props.value,
      label: optionText(props.children).replace(/\s+/g, " ").trim(),
      disabled: props.disabled,
    });
  });
  return options;
}

/**
 * Dropdown replacement for a native `<select>`, matching the app's form
 * controls and the Account-menu popover.
 *
 * A button trigger opens a floating listbox rendered in a portal, so tall
 * menus are never clipped by a scrollable parent (the Add-expense drawer, the
 * Filters row, …) and can flip above the trigger near the viewport bottom.
 * Options come from plain `<option>` children; `onChange` receives the chosen
 * string value directly. Arrow keys navigate, Enter selects, Esc and outside
 * clicks close, and focus returns to the trigger.
 */
export function Select({
  className,
  children,
  value,
  onChange,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  className?: string;
  children: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const options = useMemo(() => readOptions(children), [children]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const [openUp, setOpenUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex] ?? null;

  // Close on outside clicks; the floating menu lives in a portal, so include it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Measure the trigger and flip the menu above it when there is no room below.
  useEffect(() => {
    if (!open) return undefined;
    const trigger = triggerRef.current;
    if (!trigger) return undefined;
    const rect = trigger.getBoundingClientRect();
    const estimate = options.length * 36 + 40;
    setOpenUp(window.innerHeight - rect.bottom < estimate);
    setPos({ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width });
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, options.length]);

  // Give the selected option (or the first enabled one) focus when it opens.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      let target = options.findIndex((option) => !option.disabled);
      if (options[selectedIndex] && !options[selectedIndex].disabled) target = selectedIndex;
      optionRefs.current[target]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, options, selectedIndex, pos]);

  const choose = (value: string) => {
    onChange(value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const step = (from: number, dir: 1 | -1) => {
    const n = options.length;
    for (let i = 1; i <= n; i += 1) {
      const index = (from + dir * i + n) % n;
      if (!options[index].disabled) {
        optionRefs.current[index]?.focus();
        return;
      }
    }
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = optionRefs.current.findIndex((el) => el === document.activeElement);
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        step(current < 0 ? last : current, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        step(current < 0 ? 0 : current, -1);
        break;
      case "Home":
        event.preventDefault();
        step(-1, 1);
        break;
      case "End":
        event.preventDefault();
        step(last + 1, -1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (current >= 0 && !options[current].disabled) choose(options[current].value);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted py-2.5 pl-3.5 pr-2.5 text-sm text-ink transition focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-primary" : "focus:border-primary"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : "Select…"}</span>
        <IconChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-label={ariaLabel}
            onKeyDown={onMenuKeyDown}
            className="fixed z-[70] min-w-40 rounded-xl border border-border bg-surface p-1.5 shadow-2xl animate-[dialog-in_160ms_ease-out]"
            style={
              openUp
                ? { top: pos.top - 6, left: pos.left, width: pos.width }
                : { top: pos.bottom + 6, left: pos.left, width: pos.width }
            }
          >
            <ul className="max-h-[min(20rem,60vh)] overflow-y-auto">
              {options.map((option, index) => {
                const active = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={option.disabled}
                      tabIndex={-1}
                      onClick={() => {
                        if (!option.disabled) choose(option.value);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 ${
                        active
                          ? "bg-surface-muted font-medium text-ink"
                          : "text-muted hover:bg-surface-muted hover:text-ink"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {active && <IconCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
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