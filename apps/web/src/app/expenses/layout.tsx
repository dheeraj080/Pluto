"use client";

/**
 * Expenses shell: verifies a session exists before rendering any child page.
 *
 * The probe is GET /users/me rather than an admin endpoint — it is the
 * weakest authenticated route, so it works for every account. A 401 after the
 * client's transparent refresh attempt means there is genuinely no session.
 *
 * Mirrors app/admin/layout.tsx, which gates on the admin-only /admin/stats.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError, clearSession, getAccessToken, getRefreshToken } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

const NAV = [
  { href: "/expenses", label: "Dashboard" },
  { href: "/expenses/reports", label: "Reports" },
  { href: "/expenses/budgets", label: "Budgets" },
  { href: "/expenses/categories", label: "Categories" },
] as const;

type Gate = "checking" | "ready" | "denied";

function isActive(pathname: string, href: string): boolean {
  // /expenses/new must not highlight "Dashboard".
  if (href === "/expenses") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  // usePathname is runtime-only during prerender — it must live under Suspense.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <p className="text-sm text-muted">Loading…</p>
        </div>
      }
    >
      <ExpensesShell>{children}</ExpensesShell>
    </Suspense>
  );
}

function ExpensesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [gate, setGate] = useState<Gate>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);

  const verify = useCallback(async () => {
    // No stored credential at all: skip the round trip and go straight to the gate.
    if (!getAccessToken() && !getRefreshToken()) {
      setGate("denied");
      return;
    }
    try {
      setUser(await api.get<UserProfile>("/users/me"));
      setGate("ready");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setErrorMessage(err instanceof Error ? err.message : "Unable to verify your session.");
      // 401 means the refresh replay above already failed — the session is gone.
      if (status === 401) clearSession();
      setGate("denied");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGate("checking");
      void verify();
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname, verify]);

  const handleSignOut = () => {
    clearSession();
    router.push("/");
  };

  if (gate === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted">Checking your session…</p>
      </div>
    );
  }

  if (gate === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-bold">Sign-in required</h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          Expense tracking is available once you are signed in.
          {errorMessage && <span className="mt-2 block text-danger">{errorMessage}</span>}
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Go to sign-in
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-background"
          >
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-background/50 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-14 items-center gap-2 px-5 font-semibold tracking-tight">
          <span className="text-accent">◉</span> Pluto <span className="text-muted">Expenses</span>
        </div>
        <nav className="flex flex-wrap gap-1 px-3 pb-3 md:flex-col md:pb-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(pathname, item.href)
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/expenses/new"
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            + Add expense
          </Link>
          <div className="md:mt-auto" />
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            ← View site
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            Sign out
          </button>
          {user && (
            <p className="truncate px-3 py-2 text-xs text-muted" title={user.email}>
              {user.email}
            </p>
          )}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
