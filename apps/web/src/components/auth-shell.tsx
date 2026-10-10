/**
 * Branded, distraction-free shell for sign-in and account flows.
 *
 * A single centered column keeps the focus on the task; the wordmark links
 * home so users are never trapped. An optional `brand` tag distinguishes the
 * admin sign-in without duplicating the layout.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./logo";

export function AuthShell({ children, brand }: { children: ReactNode; brand?: string }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(50%_100%_at_50%_0%,rgba(14,90,65,0.10),transparent)]"
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="text-ink transition-opacity hover:opacity-80">
          <Wordmark />
        </Link>
        {brand && (
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
            {brand}
          </span>
        )}
      </header>
      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:pt-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

/** Card wrapper used inside AuthShell for the actual form surface. */
export function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-background p-6 shadow-[0_10px_40px_-24px_rgba(23,33,27,0.3)] sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}