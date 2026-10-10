"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { api, ApiError, clearSession, getAccessToken, getRefreshToken } from "@/lib/api";
import type { AdminStats } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Already signed in as admin? Skip the login screen.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!getAccessToken() && !getRefreshToken()) {
        if (!cancelled) setCheckingSession(false);
        return;
      }
      api
        .get<AdminStats>("/admin/stats")
        .then(() => {
          if (!cancelled) router.replace("/admin");
        })
        .catch(() => {
          if (!cancelled) setCheckingSession(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  const handleSignedIn = async () => {
    setError(null);
    try {
      await api.get<AdminStats>("/admin/stats");
      router.replace("/admin");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        clearSession();
        setError("This Google account does not have administrator access.");
      } else if (err instanceof ApiError && err.status === 401) {
        clearSession();
        setError("The server rejected this account. Sign in again.");
      } else {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border p-8">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-accent">◉</span> Pluto <span className="text-muted">Admin</span>
        </div>
        <h1 className="mt-5 text-xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Administrator access requires your e-mail to be listed in the server&apos;s{" "}
          <code className="rounded bg-background px-1 font-mono text-xs">ADMIN_EMAILS</code>{" "}
          configuration.
        </p>

        <div className="mt-6">
          {checkingSession ? (
            <p className="text-sm text-muted">Checking existing session…</p>
          ) : (
            <GoogleSignInButton onSignedIn={handleSignedIn} />
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/" className="text-muted underline underline-offset-2 hover:text-foreground">
            Back to site
          </Link>
          <Link href="/status" className="text-muted underline underline-offset-2 hover:text-foreground">
            Status
          </Link>
        </div>
      </div>
    </div>
  );
}
