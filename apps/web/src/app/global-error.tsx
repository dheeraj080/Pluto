"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 *
 * `global-error` replaces the root layout, so it does not inherit the app's
 * global stylesheet, fonts, or theme provider — everything here is inline.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: "#0b1120",
          color: "#e2e8f0",
        }}
      >
        <title>Something went wrong · Pluto</title>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#818cf8", fontWeight: 600 }}>
          Something went wrong
        </p>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
          The app failed to start
        </h1>
        <p style={{ margin: 0, maxWidth: "28rem", color: "#94a3b8", fontSize: "0.95rem" }}>
          An unexpected error prevented this page from loading. Reload to try again.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: "0.75rem",
            borderRadius: "0.75rem",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            background: "#6366f1",
            color: "#ffffff",
          }}
        >
          Try again
        </button>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
            Reference: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
