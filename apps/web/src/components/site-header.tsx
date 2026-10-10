import Link from "next/link";
import { AuthNavLink } from "./auth-nav-link";

const NAV = [
  { href: "/expenses", label: "Expenses" },
  { href: "/support", label: "Support" },
  { href: "/status", label: "Status" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

function Logo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="6" fill="currentColor" />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="4"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(-20 12 12)"
      />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <Logo />
          <span>Pluto</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted sm:gap-6">
          <nav className="flex items-center gap-4 sm:gap-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <AuthNavLink />
        </div>
      </div>
    </header>
  );
}
