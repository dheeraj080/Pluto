"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { AuthShell, AuthCard } from "@/components/auth-shell";
import { ErrorNote, Skeleton } from "@/components/ui";
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
    <AuthShell brand="Admin">
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin sign-in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Administrator access requires your e-mail to be listed in the server&apos;s{" "}
          <code className="rounded bg-paper px-1 font-mono text-xs">ADMIN_EMAILS</code>{" "}
          configuration.
        </p>

        <div className="mt-6">
          {checkingSession ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <GoogleSignInButton onSignedIn={() => void handleSignedIn()} />
          )}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
          <Link href="/" className="text-muted transition-colors hover:text-ink">
            ← Back to site
          </Link>
          <Link href="/status" className="text-muted transition-colors hover:text-ink">
            Status
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}