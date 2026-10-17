import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Public, crawlable routes only. Authenticated areas (/expenses, /admin,
  // /onboarding) are excluded and disallowed in robots.ts.
  const routes: Array<{ path: string; priority: number }> = [
    { path: "", priority: 1 },
    { path: "/privacy", priority: 0.5 },
    { path: "/terms", priority: 0.5 },
    { path: "/support", priority: 0.4 },
    { path: "/status", priority: 0.4 },
    { path: "/delete-account", priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority,
  }));
}
