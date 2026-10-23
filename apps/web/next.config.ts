import type { NextConfig } from "next";

/**
 * Baseline security headers for every response. A Content-Security-Policy is
 * deliberately not set here: Next.js injects inline bootstrap scripts and
 * styles, so a correct CSP needs per-request nonces and is best applied at the
 * edge/reverse proxy where it can be tuned without redeploying the app.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** Signed-in, per-account areas that must never be indexed or crawled. */
const noIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small runtime Docker image.
  //
  // Skipped on Vercel: Vercel's own adapter consumes the build output, and on
  // Next 16.3+ `output: "standalone"` breaks the deploy (the adapter's
  // onBuildComplete can no longer find `.next/next-server.js.nft.json`). The
  // guard is the documented workaround; Vercel produces its own output without
  // it. Locally (Docker/`next start`) nothing changes.
  output: process.env.VERCEL ? undefined : "standalone",
  // Do not advertise the framework.
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Record that this configuration belongs to the agent-driven security
    // upgrade, so later upgrade runs can identify it.
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Defence-in-depth: robots.txt also disallows these, but the header
      // covers anything that is linked or reached directly.
      { source: "/admin/:path*", headers: noIndexHeaders },
      { source: "/expenses/:path*", headers: noIndexHeaders },
    ];
  },
};

export default nextConfig;
