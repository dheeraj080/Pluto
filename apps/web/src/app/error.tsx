"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Any uncaught render/runtime error below the root
 * layout lands here instead of a blank screen, with a way to retry.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Surface the error for whatever log/telemetry sink is wired up.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        Something went wrong
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        We hit an unexpected error
      </h1>
      <p className="mt-3 max-w-md text-muted">
        This page failed to load. Try again — if the problem persists, please contact support.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
      >
        Try again
      </button>
      {error.digest ? (
        <p className="mt-4 text-xs text-muted">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
