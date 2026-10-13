"use client";

/**
 * Authenticated application shell: desktop sidebar, mobile top bar and bottom
 * tab bar. Used by the expenses app; the caller owns the session gate.
 */

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PlutoMark, Wordmark } from "./logo";
import { IconLogOut, IconSettings } from "./icons";
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
  user,
  onSignOut,
  children,
}: {
  nav: AppNavItem[];
  /** Current path, used for active-link highlighting. */
  pathname: string;
  /** Href that should match exactly (usually the dashboard), e.g. "/expenses". */
  exactMatch: string;
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
                    ? "bg-primary-subtle text-primary"
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

        <div className="relative border-t border-border p-2 lg:p-3">
          <AccountMenu user={user} onSignOut={onSignOut} />
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
        <div className={`mx-auto grid max-w-md ${gridColumns(nav.length)}`}>
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

/**
 * The account row at the bottom of the sidebar. A single row shows the avatar
 * and name/email; clicking it opens a small menu with Settings and Sign out,
 * so Settings lives inside the account rather than as its own link.
 */
function AccountMenu({
  user,
  onSignOut,
}: {
  user: UserProfile | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Account"
        className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted lg:justify-start lg:px-3 ${
          open ? "bg-surface-muted" : ""
        }`}
      >
        <Avatar user={user ?? { name: null, email: "", avatarUrl: null }} className="h-7 w-7 shrink-0 text-xs" />
        <span className="hidden min-w-0 flex-1 text-left lg:block">
          <span className="block truncate text-sm font-medium text-ink">
            {user?.name ?? "Pluto user"}
          </span>
          {user?.email && <span className="block truncate text-xs text-muted">{user.email}</span>}
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
        >
          <Link
            href="/expenses/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            <IconSettings className="h-4 w-4 shrink-0 text-muted" />
            <span className="truncate">Settings</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            <IconLogOut className="h-4 w-4 shrink-0 text-muted" />
            <span className="truncate">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
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