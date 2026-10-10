"use client";

/**
 * Public site header: brand, anchor navigation, and responsive mobile menu.
 *
 * The landing page sections are reached through `/#anchor` links so the same
 * header works from every public route. The menu is closed on link click so
 * there is no dependency on pathname-triggered effects.
 */

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "./logo";
import { AuthNavLink } from "./auth-nav-link";
import { IconClose, IconMenu } from "./icons";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/support", label: "Support" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-ink transition-opacity hover:opacity-80"
          onClick={() => setMenuOpen(false)}
        >
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <AuthNavLink />
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink transition-colors hover:bg-surface-muted md:hidden"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="site-nav"
          className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden"
        >
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <AuthNavLink onNavigate={() => setMenuOpen(false)} />
          </div>
        </nav>
      )}
    </header>
  );
}