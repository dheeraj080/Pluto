"use client";

/**
 * Sign-in / sign-out control for the public site header.
 *
 * The persisted session lives in localStorage, so it is read through
 * `useSyncExternalStore` — the same pattern as the base-currency preference.
 * That keeps the server snapshot (signed out) deterministic during prerender
 * and re-renders immediately when `saveSession`/`clearSession` notify.
 */

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  clearSession,
  getSessionServerSnapshot,
  getSessionSnapshot,
  subscribeSession,
} from "@/lib/api";

export function AuthNavLink() {
  const signedIn = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getSessionServerSnapshot,
  );

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <Link href="/expenses" className="font-medium text-accent hover:underline">
        My expenses
      </Link>
      <button
        type="button"
        onClick={() => clearSession()}
        className="transition-colors hover:text-foreground"
      >
        Sign out
      </button>
    </span>
  );
}
