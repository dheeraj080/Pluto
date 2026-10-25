"use client";

/**
 * Sign-in / app-access control for the public site header.
 *
 * The persisted session lives in localStorage, so it is read through
 * `useSyncExternalStore` — the same pattern as the base-currency preference.
 * That keeps the server snapshot (signed out) deterministic during prerender
 * and re-renders immediately when `saveSession`/`clearSession` notify.
 */

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getSessionServerSnapshot,
  getSessionSnapshot,
  signOut,
  subscribeSession,
} from "@/lib/api";
import { IconLogOut } from "./icons";

export function AuthNavLink({
  onNavigate,
  stack = false,
}: {
  /** Called after navigating (used to close the mobile menu). */
  onNavigate?: () => void;
  /** Renders the controls stacked full-width (mobile menu). */
  stack?: boolean;
}) {
  const signedIn = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getSessionServerSnapshot,
  );

  const navigate = (action?: () => void) => () => {
    action?.();
    onNavigate?.();
  };

  if (!signedIn) {
    return (
      <Link
        href="/login"
        onClick={onNavigate ? navigate(undefined) : undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-stock,8px)] bg-primary px-5 py-2.5 text-sm font-medium text-on-primary shadow-[0_1px_2px_rgba(23,26,46,0.18)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          stack ? "w-full" : ""
        }`}
      >
        Get started
      </Link>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${stack ? "w-full flex-col [&>*]:w-full" : ""}`}>
      <Link
        href="/expenses"
        onClick={onNavigate ? navigate(undefined) : undefined}
        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-stock,8px)] bg-primary px-5 py-2.5 text-sm font-medium text-on-primary shadow-[0_1px_2px_rgba(23,33,27,0.18)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Open expenses
      </Link>
      <button
        type="button"
        onClick={navigate(() => {
          // Local session clears synchronously; the server revocation is
          // best-effort and must not block closing the mobile menu.
          void signOut();
        })}
        className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-stock,8px)] px-3 py-2 text-sm text-muted transition-colors hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <IconLogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}