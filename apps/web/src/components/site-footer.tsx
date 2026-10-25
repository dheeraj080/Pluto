import Link from "next/link";
import { WordmarkLockup } from "./logo";

// Evaluated once at module load (build time) — stable across prerender passes,
// unlike calling new Date() inside the component render.
const CURRENT_YEAR = new Date().getFullYear();

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#the-problem", label: "The Problem" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#features", label: "The App" },
      { href: "/#life-abroad", label: "Life Abroad" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/support", label: "Help & FAQ" },
      { href: "/delete-account", label: "Delete account" },
      { href: "/status", label: "Service status" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex text-ink transition-opacity hover:opacity-80">
              <WordmarkLockup markClassName="h-8 w-8" textClassName="text-xl" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Track expenses in any currency and see them in the one that matters
              to you. Account-synced on web and Android.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 font-mono text-[11px] uppercase tracking-wider text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {CURRENT_YEAR} Pluto. All rights reserved.</p>
          <p>Exchange-rate data provided by the European Central Bank.</p>
        </div>
      </div>
    </footer>
  );
}
