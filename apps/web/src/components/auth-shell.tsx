/**
 * Branded, distraction-free shell for sign-in and account flows.
 *
 * Split layout: a brand panel on the left (desktop) carrying the product line
 * over a hairline grid, and a quiet form column on the right. The wordmark
 * links home so users are never trapped. An optional `brand` tag distinguishes
 * the admin sign-in without duplicating the layout.
 *
 * Panel copy mirrors the landing headline; both live in marketing surfaces
 * only, so the sentence stays consistent.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark, WordmarkLockup } from "./logo";

export function AuthShell({ children, brand }: { children: ReactNode; brand?: string }) {
  return (
    <div className="grid min-h-dvh overflow-hidden bg-desk lg:grid-cols-2">
      {/* Brand panel — desktop only; the form column stands alone on mobile. */}
      <aside className="relative hidden flex-col justify-between border-r border-border bg-paper p-10 lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(90%_80%_at_10%_100%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/4 h-96 w-96 bg-[radial-gradient(closest-side,var(--glow-strong),transparent)]"
        />

        <Link
          href="/"
          className="relative text-ink transition-opacity hover:opacity-80"
        >
          <WordmarkLockup markClassName="h-8 w-8" textClassName="text-xl" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-ink xl:text-4xl">
            Track what you spend abroad.{" "}
            <span className="text-muted">
              Understand it in the currency that{" "}
              <span className="text-primary">feels like home</span>.
            </span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Record each purchase in the currency you actually paid. Totals, budgets
            and reports appear in the one you think in.
          </p>
        </div>

        <p className="relative font-mono text-[11px] text-muted">
          Rates: European Central Bank · Daily
        </p>
      </aside>

      {/* Form column */}
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5">
          <Link
            href="/"
            className="text-ink transition-opacity hover:opacity-80 lg:hidden"
          >
            <Wordmark />
          </Link>
          {brand && (
            <span className="rounded-full border border-border bg-paper px-3 py-1 font-mono text-[11px] font-medium text-muted lg:ml-auto">
              {brand}
            </span>
          )}
        </header>

        <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:pt-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Card wrapper used inside AuthShell for the actual form surface. */
export function AuthCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-card,8px)] border border-border bg-paper p-6 shadow-[0_30px_80px_-55px_rgba(0,0,0,0.9)] sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}
