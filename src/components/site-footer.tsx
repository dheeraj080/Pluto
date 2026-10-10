import Link from "next/link";

// Evaluated once at module load (build time) — stable across prerender passes,
// unlike calling new Date() inside the component render.
const CURRENT_YEAR = new Date().getFullYear();

const LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/support", label: "Support" },
  { href: "/status", label: "Status" },
  { href: "/delete-account", label: "Delete account" },
  { href: "/admin", label: "Admin" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {CURRENT_YEAR} Pluto. All rights reserved.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
