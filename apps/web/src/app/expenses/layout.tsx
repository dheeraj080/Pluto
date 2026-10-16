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
import { AppShell, type AppNavItem } from "@/components/app-shell";
import { Spinner } from "@/components/ui";
import { Wordmark } from "@/components/logo";
import { IconChart, IconHome, IconReceipt, IconRefresh, IconTag, IconWallet } from "@/components/icons";
import { useBaseCurrencyReconciliation } from "./use-expenses";

const NAV: AppNavItem[] = [
  { href: "/expenses", label: "Dashboard", short: "Home", icon: <IconHome className="h-4.5 w-4.5" /> },
  {
    href: "/expenses/transactions",
    label: "Transactions",
    short: "Activity",
    icon: <IconReceipt className="h-4.5 w-4.5" />,
  },
  { href: "/expenses/reports", label: "Reports", short: "Reports", icon: <IconChart className="h-4.5 w-4.5" /> },
  { href: "/expenses/budgets", label: "Budgets", short: "Budgets", icon: <IconWallet className="h-4.5 w-4.5" /> },
  { href: "/expenses/recurring", label: "Recurring", short: "Repeat", icon: <IconRefresh className="h-4.5 w-4.5" /> },
  { href: "/expenses/categories", label: "Categories", short: "Tags", icon: <IconTag className="h-4.5 w-4.5" /> },
];

type Gate = "checking" | "ready" | "denied";

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  // usePathname is runtime-only during prerender — it must live under Suspense.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <GateSkeleton label="Loading your expenses…" />
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

  // Once the profile probe resolves, align the persisted base-currency
  // preference with the server-authoritative value for this account.
  useBaseCurrencyReconciliation(user);

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
    return <GateSkeleton label="Checking your session…" />;
  }

  if (gate === "denied") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-8 text-center shadow-[0_1px_2px_rgba(23,33,27,0.04)]">
          <div className="mx-auto flex w-12 items-center justify-center text-primary">
            <Wordmark logoClassName="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">Sign-in required</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Expense tracking is available once you are signed in.
          </p>
          {errorMessage && (
            <p className="mt-3 rounded-xl bg-danger-subtle px-3 py-2 text-xs font-medium text-danger" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/login"
              className="inline-flex h-10 w-full select-none items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-on-primary shadow-[0_1px_2px_rgba(23,33,27,0.18)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Go to sign-in
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 w-full select-none items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              Back to site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      nav={NAV}
      pathname={pathname}
      exactMatch="/expenses"
      user={user}
      onSignOut={handleSignOut}
    >
      {children}
    </AppShell>
  );
}

function GateSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-4">
      <span className="text-primary">
        <Wordmark logoClassName="h-7 w-7" />
      </span>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-3.5 w-3.5 border-[1.5px]" />
        {label}
      </p>
    </div>
  );
}