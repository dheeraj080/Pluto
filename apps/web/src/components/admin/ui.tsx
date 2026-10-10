/** Shared building blocks for admin screens. */

import type { ReactNode } from "react";

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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-background">
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "accent";

const BADGE_STYLES: Record<BadgeTone, string> = {
  neutral: "border-border text-muted",
  ok: "border-success/40 text-success",
  warn: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  danger: "border-danger/40 text-danger",
  accent: "border-accent/40 text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  onClick,
  disabled,
  children,
  tone = "default",
  type = "button",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: "default" | "danger" | "accent";
  type?: "button" | "submit";
}) {
  const styles =
    tone === "danger"
      ? "bg-danger text-white hover:opacity-90"
      : tone === "accent"
        ? "bg-accent text-accent-foreground hover:opacity-90"
        : "border border-border hover:bg-background";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="text-sm text-danger" role="alert">
      {message}
    </p>
  );
}

export function LoadingNote({ label = "Loading…" }: { label?: string }) {
  return <p className="text-sm text-muted">{label}</p>;
}

/** Standard table shell; rows are provided by the caller. */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">
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
    <div className="mt-4 flex items-center justify-between text-sm">
      <Button onClick={() => onPage(page - 1)} disabled={page <= 1}>
        ← Previous
      </Button>
      <span className="text-muted">
        Page {page} of {totalPages} · {total} total
      </span>
      <Button onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        Next →
      </Button>
    </div>
  );
}
