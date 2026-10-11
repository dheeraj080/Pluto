/**
 * Bento layout primitives.
 *
 * A 12-column grid on large screens that collapses to a single column on
 * mobile. Tiles are `BentoTile`s whose span is set by the caller with static
 * Tailwind classes — e.g. `className="lg:col-span-7"` — because `col-span`
 * utilities must appear literally to be generated. The tile is a flex column
 * so a footer can be pushed to the bottom with `mt-auto`.
 */

import type { ReactNode } from "react";

export function BentoGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12 ${className}`}>
      {children}
    </div>
  );
}

/** A self-contained panel in the grid. The caller sets its column span. */
export function BentoTile({
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Grid placement, e.g. `lg:col-span-5`. */
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-border bg-background p-5 shadow-[0_1px_2px_rgba(23,33,27,0.04)] sm:p-6 ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {typeof title === "string" ? (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
