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
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { AuthShell, AuthCard } from "@/components/auth-shell";
import { ErrorNote, Skeleton } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { api, clearSession, getAccessToken, getRefreshToken } from "@/lib/api";
import { isOnboardingDismissed, readBaseCurrency } from "@/lib/base-currency";
import type { UserProfile } from "@/lib/types";

const POINTS = [
  "Record expenses in the currency you paid",
  "See totals in your chosen reporting currency",
  "Budgets, categories and reports included",
];

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error] = useState<string | null>(null);

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

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Sign in to Pluto
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Track spending in any currency and understand it in the one you choose. There&apos;s no
          password to create or remember.
        </p>

        <ul className="mt-5 space-y-2 border-t border-border pt-5">
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2.5 text-sm text-muted">
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


      </AuthCard>

      <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-wider leading-relaxed text-muted">
        By signing in you agree to our{" "}
        <Link
          href="/terms"
          className="text-ink underline underline-offset-4 decoration-border-strong hover:no-underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="text-ink underline underline-offset-4 decoration-border-strong hover:no-underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </AuthShell>
  );
}