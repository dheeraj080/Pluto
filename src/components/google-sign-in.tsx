"use client";

/**
 * Google Identity Services sign-in button.
 *
 * Loads https://accounts.google.com/gsi/client, renders the official button,
 * then exchanges the returned ID token for a pluto-server session via
 * POST /v1/auth/google (the same endpoint the Android client uses — the web
 * client ID must be present in the server's GOOGLE_ALLOWED_CLIENT_IDS).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, saveSession } from "@/lib/api";
import type { AuthSession } from "@/lib/types";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GsiCredentialResponse {
  credential: string;
}

interface GsiWindow {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: {
          client_id: string;
          callback: (response: GsiCredentialResponse) => void;
        }) => void;
        renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
      };
    };
  };
}

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as GsiWindow;
    if (w.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Sign-In.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
    document.head.appendChild(script);
  });
}

interface GoogleSignInButtonProps {
  /** Called after the ID token has been exchanged for a server session. */
  onSignedIn?: (session: AuthSession) => void;
}

export function GoogleSignInButton({ onSignedIn }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSignedInRef = useRef(onSignedIn);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the callback ref fresh without touching refs during render.
  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  // Build-time constant: render the configuration error directly instead of
  // setting state from inside the effect.
  const configError = CLIENT_ID
    ? null
    : "Google Sign-In is not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing).";
  const displayError = configError ?? error;

  const handleCredential = useCallback(async (response: GsiCredentialResponse) => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<AuthSession>("/auth/google", {
        idToken: response.credential,
      });
      saveSession(session);
      onSignedInRef.current?.(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const w = window as GsiWindow;
        const id = w.google?.accounts?.id;
        if (!id) return;
        id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
        id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 280,
          text: "signin_with",
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Sign-in failed.");
      });
    return () => {
      cancelled = true;
    };
  }, [handleCredential]);

  return (
    <div className="flex flex-col items-start gap-3">
      <div ref={containerRef} data-testid="google-sign-in" />
      {busy && <p className="text-sm text-muted">Signing in…</p>}
      {displayError && (
        <p className="text-sm text-danger" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
