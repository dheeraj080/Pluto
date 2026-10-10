import Link from "next/link";
import { Logo } from "./logo";

// Evaluated once at module load (build time) — stable across prerender passes,
// unlike calling new Date() inside the component render.
const CURRENT_YEAR = new Date().getFullYear();

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/login", label: "Sign in" },
      { href: "/status", label: "Service status" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/support", label: "Help & FAQ" },
      { href: "/delete-account", label: "Delete account" },
      { href: "/admin", label: "Admin" },
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
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-ink transition-opacity hover:opacity-80">
              <Logo />
              <span className="font-semibold tracking-tight">Pluto</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Track expenses in any currency and see them in the one that matters to you.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {CURRENT_YEAR} Pluto. All rights reserved.</p>
          <p>Exchange-rate data provided by the European Central Bank.</p>
        </div>
      </div>
    </footer>
  );
}