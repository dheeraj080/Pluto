"use client";

/**
 * Public sign-in page.
 *
 * The admin area has its own login (`/admin/login`) that rejects non-admins;
 * this is the entry point for regular accounts, so it works for every user and
 * lands them in the expense tracker.
 *
 * Sign-in state is resolved by probing `GET /users/me` — the weakest
 * authenticated route — which also transparently exercises the refresh replay
 * in the API client, so an expired access token with a live refresh token still
 * signs the user straight through.
 *
 * When `NEXT_PUBLIC_ENABLE_DEV_AUTH=true` (baked at build time) an additional
 * mock sign-in panel is shown. It calls `POST /v1/auth/dev-login`, which the
 * server only serves when its own `ENABLE_DEV_AUTH=true` and `NODE_ENV` is not
 * production — in production the endpoint returns 404 and the button simply
 * errors.
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { Button, Input } from "@/components/ui";
import { api, clearSession, getAccessToken, getRefreshToken, saveSession } from "@/lib/api";
import type { AuthSession, UserProfile } from "@/lib/types";

const DEV_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock sign-in form state; only used when the panel is rendered.
  const [devEmail, setDevEmail] = useState("");
  const [devBusy, setDevBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      // No stored credential at all: skip the round trip.
      if (!getAccessToken() && !getRefreshToken()) {
        setChecking(false);
        return;
      }
      api
        .get<UserProfile>("/users/me")
        .then(() => {
          if (!cancelled) router.replace("/expenses");
        })
        .catch(() => {
          if (cancelled) return;
          // The stored session is dead — clear it and offer a fresh sign-in.
          clearSession();
          setChecking(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  const handleDevSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setDevBusy(true);
    setError(null);
    try {
      const session = await api.post<AuthSession>(
        "/auth/dev-login",
        devEmail.trim() ? { email: devEmail.trim() } : {},
      );
      saveSession(session);
      router.replace("/expenses");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Mock sign-in failed. Is ENABLE_DEV_AUTH set?",
      );
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Pluto uses Google Sign-In, so there is no separate password to remember. Signing in
        unlocks the expense tracker — record spending in any currency, set budgets, and see
        where your money goes.
      </p>

      <div className="mt-8 rounded-2xl border border-border p-6">
        {checking ? (
          <p className="text-sm text-muted">Checking your session…</p>
        ) : (
          <GoogleSignInButton onSignedIn={() => router.replace("/expenses")} />
        )}
      </div>

      {DEV_AUTH_ENABLED && (
        <form
          onSubmit={(event) => void handleDevSignIn(event)}
          className="mt-6 rounded-2xl border border-dashed border-border p-6"
        >
          <h2 className="text-sm font-semibold">Mock sign-in (development only)</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Creates or reuses a local account without Google — handy when there is no real
            OAuth client ID set up. Leave the e-mail empty to use{" "}
            <code className="rounded bg-background px-1 font-mono text-xs">dev@pluto.local</code>.
          </p>
          <div className="mt-4 flex gap-2">
            <Input
              type="email"
              value={devEmail}
              onChange={(event) => setDevEmail(event.target.value)}
              placeholder="dev@pluto.local"
              aria-label="Mock account e-mail"
              className="min-w-0 flex-1"
            />
            <Button type="submit" tone="accent" disabled={devBusy}>
              {devBusy ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <p className="mt-6 text-sm text-muted">
        By signing in you agree to our{" "}
        <Link href="/terms" className="text-accent underline underline-offset-2">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}