"use client";

/**
 * Authenticated application shell: desktop sidebar, mobile top bar and bottom
 * tab bar, with a prominent primary action. Used by the expenses app and the
 * admin area; the caller owns the session gate.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./logo";
import { IconLogOut, IconPlus } from "./icons";
import type { UserProfile } from "@/lib/types";

export interface AppNavItem {
  href: string;
  label: string;
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href="/" className="text-ink transition-opacity hover:opacity-80">
            <Wordmark />
          </Link>
        </div>

        <div className="px-3 pt-4">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="inline-flex h-10 w-full select-none items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary shadow-[0_1px_2px_rgba(23,33,27,0.18)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconPlus className="h-4 w-4" />
              {primaryAction.label}
            </Link>
          )}
        </div>

        <nav aria-label="Primary" className="flex-1 space-y-0.5 px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item) ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item)
                  ? "bg-primary-subtle text-primary"
                  : "text-muted hover:bg-surface-muted hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="shrink-0">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/"
            className="mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            ← View site
          </Link>
          {user && (
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2">
              <Avatar user={user} className="h-7 w-7 text-xs" />
              <div className="min-w-0">
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
            className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <IconLogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* --------------------------- Content ------------------------------- */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
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
                {shortLabel(item.label)}
              </Link>
            );
          })}
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-primary"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_2px_6px_rgba(14,90,65,0.35)] transition-colors hover:bg-primary-hover">
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