"use client";

/**
 * Admin shell: verifies the session is ADMIN-authorized (via GET /admin/stats)
 * before rendering any child page. The /admin/login route is exempt and
 * rendered without the sidebar.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError, clearSession, getAccessToken, getRefreshToken } from "@/lib/api";
import type { AdminStats } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/backups", label: "Backups" },
  { href: "/admin/rates", label: "Rates" },
  { href: "/admin/system", label: "System" },
] as const;

type Gate = "checking" | "ready" | "denied";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // usePathname is runtime-only during prerender — it must live under Suspense.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <p className="text-sm text-muted">Loading…</p>
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  const [gate, setGate] = useState<Gate>("checking");
  const [reason, setReason] = useState<"unauthenticated" | "forbidden" | "error">(
    "unauthenticated",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const verify = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      setReason("unauthenticated");
      setGate("denied");
      return;
    }
    try {
      await api.get<AdminStats>("/admin/stats");
      setGate("ready");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setReason(status === 403 ? "forbidden" : status === 401 ? "unauthenticated" : "error");
      setErrorMessage(err instanceof Error ? err.message : "Unable to verify admin access.");
      if (status === 401) clearSession();
      setGate("denied");
    }
  }, []);

  useEffect(() => {
    if (isLogin) return;
    const timer = setTimeout(() => {
      setGate("checking");
      void verify();
    }, 0);
    return () => clearTimeout(timer);
  }, [isLogin, pathname, verify]);

  const handleSignOut = () => {
    clearSession();
    router.push("/admin/login");
  };

  if (isLogin) return <>{children}</>;

  if (gate === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted">Verifying admin access…</p>
      </div>
    );
  }

  if (gate === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-bold">
          {reason === "forbidden" ? "No admin access" : "Sign-in required"}
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          {reason === "forbidden"
            ? "Your account is not an administrator. Ask an operator to add your e-mail to ADMIN_EMAILS, then sign in again."
            : reason === "error"
              ? errorMessage
              : "Your session has expired or you are not signed in."}
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/admin/login"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            {reason === "forbidden" ? "Sign in with another account" : "Go to sign-in"}
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-background"
          >
            Back to site
          </Link>
        </div>
        {reason === "forbidden" && (
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 text-sm text-muted underline underline-offset-2 hover:text-foreground"
          >
            Sign out
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-background/50 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-14 items-center gap-2 px-5 font-semibold tracking-tight">
          <span className="text-accent">◉</span> Pluto <span className="text-muted">Admin</span>
        </div>
        <nav className="flex gap-1 px-3 pb-3 md:flex-col md:pb-6">
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
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
