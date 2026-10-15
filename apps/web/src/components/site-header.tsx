"use client";

/**
 * Public site header: brand, anchor navigation, and responsive mobile menu.
 *
 * Landing-page sections are reached through `/#anchor` links so the same
 * header works from every public route. The menu closes on link click, so
 * there is no dependency on pathname-triggered effects.
 */

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "./logo";
import { AuthNavLink } from "./auth-nav-link";
import { ThemeToggle } from "./theme";
import { IconClose, IconMenu } from "./icons";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#who", label: "Who it's for" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-ink transition-opacity hover:opacity-80"
          onClick={() => setMenuOpen(false)}
        >
          <Wordmark className="text-lg" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 text-sm lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <AuthNavLink />
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink transition-colors hover:bg-surface-muted lg:hidden"
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
          aria-label="Main"
          className="border-t border-border bg-canvas px-4 pb-4 pt-2 lg:hidden"
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
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
            <ThemeToggle withLabels />
            <AuthNavLink stack onNavigate={() => setMenuOpen(false)} />
          </div>
        </nav>
      )}
    </header>
  );
}
