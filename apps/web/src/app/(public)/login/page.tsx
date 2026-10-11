"use client";

/**
 * Public sign-in page.
 *
 * The admin area has its own login (`/admin/login`) that rejects non-admins;
 * this is the entry point for regular accounts, so it works for every user and
 * lands them in the expense tracker (or onboarding on a first visit).
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
import { AuthShell, AuthCard } from "@/components/auth-shell";
import { Button, ErrorNote, Input, Skeleton } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { api, clearSession, getAccessToken, getRefreshToken, saveSession } from "@/lib/api";
import { isOnboardingDismissed, readBaseCurrency } from "@/lib/base-currency";
import type { AuthSession, UserProfile } from "@/lib/types";

const DEV_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true";

const POINTS = [
  "Record expenses in the currency you paid",
  "See totals in your chosen reporting currency",
  "Budgets, categories and reports included",
];

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock sign-in form state; only used when the panel is rendered.
  const [devEmail, setDevEmail] = useState("");
  const [devBusy, setDevBusy] = useState(false);

  const routeAfterSignIn = () => {
    // First visit without a reporting currency → offer the picker.
    if (!readBaseCurrency() && !isOnboardingDismissed()) {
      router.replace("/onboarding");
    } else {
      router.replace("/expenses");
    }
  };

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
      routeAfterSignIn();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Mock sign-in failed. Is ENABLE_DEV_AUTH set?",
      );
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in to Pluto</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Track spending in any currency and understand it in the one you choose. There&apos;s no
          password to create or remember.
        </p>

        <ul className="mt-5 space-y-2">
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2 text-sm text-muted">
              <IconCheck className="h-4 w-4 shrink-0 text-primary" />
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {checking ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <GoogleSignInButton onSignedIn={routeAfterSignIn} />
          )}
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}

        {DEV_AUTH_ENABLED && (
          <form
            onSubmit={(event) => void handleDevSignIn(event)}
            className="mt-6 rounded-xl border border-dashed border-border-strong bg-surface-muted/50 p-4"
          >
            <h2 className="text-sm font-semibold text-ink">Mock sign-in (development only)</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Creates or reuses a local account without Google — handy when there is no real OAuth
              client ID set up. A brand-new account is pre-filled with sample expenses and budgets so
              the dashboard and reports have data. Leave the e-mail empty to use{" "}
              <code className="rounded bg-background px-1 font-mono text-[11px]">
                dev@pluto.local
              </code>
              .
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={devEmail}
                onChange={(event) => setDevEmail(event.target.value)}
                placeholder="dev@pluto.local"
                aria-label="Mock account e-mail"
                className="min-w-0 flex-1"
              />
              <Button type="submit" variant="secondary" loading={devBusy}>
                Sign in
              </Button>
            </div>
          </form>
        )}
      </AuthCard>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        By signing in you agree to our{" "}
        <Link href="/terms" className="text-primary underline underline-offset-2">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-primary underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </AuthShell>
  );
}