"use client";

/**
 * Authenticated application shell: desktop sidebar, mobile top bar and bottom
 * tab bar, with a prominent primary action. Used by the expenses app and the
 * admin area; the caller owns the session gate.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { PlutoMark, Wordmark } from "./logo";
import { IconGlobe, IconLogOut, IconPlus, IconSettings } from "./icons";
import type { UserProfile } from "@/lib/types";

export interface AppNavItem {
  href: string;
  label: string;
  /** Optional shorter label for the cramped mobile tab bar. */
  short?: string;
  icon: ReactNode;
}

export function AppShell({
  nav,
  pathname,
  exactMatch,
  primaryAction,
  user,
  onSignOut,
  children,
}: {
  nav: AppNavItem[];
  /** Current path, used for active-link highlighting. */
  pathname: string;
  /** Href that should match exactly (usually the dashboard), e.g. "/expenses". */
  exactMatch: string;
  primaryAction?: { href: string; label: string };
  user: UserProfile | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const isActive = (item: AppNavItem): boolean => {
    if (item.href === exactMatch) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="min-h-dvh bg-canvas md:flex">
      {/* ------------------------- Desktop sidebar ------------------------- */}
      {/* Icon rail from `md`, full labels and the wordmark from `lg`. */}
      <aside className="sticky top-0 hidden h-dvh w-[4.75rem] shrink-0 flex-col border-r border-border bg-surface md:flex lg:w-60">
        <div className="flex h-16 items-center border-b border-border px-2 lg:px-5">
          <Link
            href="/"
            aria-label="Pluto home"
            className="mx-auto text-ink transition-opacity hover:opacity-80 lg:mx-0"
          >
            <PlutoMark className="h-7 w-7 lg:hidden" />
            <Wordmark className="hidden lg:inline-flex" />
          </Link>
        </div>

        <div className="px-2 pt-4 lg:px-3">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              title={primaryAction.label}
              className="inline-flex h-10 w-full select-none items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-on-primary shadow-[0_6px_20px_-8px_rgba(52,211,153,0.6)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:px-4"
            >
              <IconPlus className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">{primaryAction.label}</span>
            </Link>
          )}
        </div>

        <nav aria-label="Primary" className="flex-1 space-y-1 px-2 py-4 lg:px-3">
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center gap-2.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors duration-150 lg:justify-start lg:px-3 ${
                  active
                    ? "bg-primary-subtle text-primary shadow-[0_0_0_1px_rgba(52,211,153,0.16),0_10px_26px_-14px_rgba(52,211,153,0.8)]"
                    : "text-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <span aria-hidden="true" className="shrink-0">
                  {item.icon}
                </span>
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2 lg:p-3">
          <Link
            href="/expenses/settings"
            title="Settings"
            className="flex items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-ink lg:justify-start lg:px-3"
          >
            <IconSettings className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden lg:inline">Settings</span>
          </Link>
          <Link
            href="/"
            title="View site"
            className="flex items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-ink lg:justify-start lg:px-3"
          >
            <IconGlobe className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden lg:inline">View site</span>
          </Link>
          {user && (
            <div className="flex items-center justify-center gap-2.5 rounded-xl px-2 py-2 lg:justify-start lg:px-3">
              <Avatar user={user} className="h-7 w-7 text-xs" />
              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm font-medium text-ink">
                  {user.name ?? "Pluto user"}
                </p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            className="mt-1 flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-muted hover:text-ink lg:justify-start lg:px-3"
          >
            <IconLogOut className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* --------------------------- Content ------------------------------- */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/85 px-4 backdrop-blur md:hidden">
          <Link href="/" className="text-ink transition-opacity hover:opacity-80">
            <Wordmark />
          </Link>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <IconLogOut className="h-5 w-5" />
            </button>
          )}
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-10 lg:pb-12">
          {children}
        </main>
      </div>

      {/* ------------------------- Mobile bottom nav ----------------------- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      >
        <div
          className={`mx-auto grid max-w-md ${gridColumns(nav.length + (primaryAction ? 1 : 0))}`}
        >
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                <span aria-hidden="true" className="[&>svg]:h-5 [&>svg]:w-5">
                  {item.icon}
                </span>
                {item.short ?? shortLabel(item.label)}
              </Link>
            );
          })}
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-primary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_2px_10px_rgba(52,211,153,0.45)] transition-colors hover:bg-primary-hover">
                <IconPlus className="h-4 w-4" />
              </span>
              Add
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}

function shortLabel(label: string): string {
  if (label.length <= 9) return label;
  // "Categories" → "Cats" style trimming is not friendly; use the first word.
  return label.split(" ")[0];
}

/**
 * Maps an item count to a static `grid-cols-*` class. The values must be
 * literal strings so Tailwind generates them.
 */
function gridColumns(count: number): string {
  switch (count) {
    case 2:
      return "grid-cols-2";
    case 3:
      return "grid-cols-3";
    case 4:
      return "grid-cols-4";
    case 5:
      return "grid-cols-5";
    default:
      return "grid-cols-6";
  }
}

function Avatar({
  user,
  className = "",
}: {
  user: Pick<UserProfile, "name" | "email" | "avatarUrl">;
  className?: string;
}) {
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  const initial = (user.name ?? user.email ?? "P").charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-semibold text-primary ${className}`}
    >
      {initial}
    </span>
  );
}