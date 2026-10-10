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
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { api, clearSession, getAccessToken, getRefreshToken } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

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
