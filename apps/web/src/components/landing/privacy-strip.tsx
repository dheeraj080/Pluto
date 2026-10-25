import Link from "next/link";
import { IconGoogle, IconShield, IconRefresh, IconTrash } from "@/components/icons";
import { Reveal } from "@/components/reveal";

const PRIVACY = [
  {
    icon: IconGoogle,
    title: "Google-only sign-in",
    body: "Sign in with Google. There is no separate Pluto password to create or leak.",
  },
  {
    icon: IconShield,
    title: "No ads, no trackers",
    body: "Your data runs the product only. No advertising, no ad trackers, no marketing profiles.",
  },
  {
    icon: IconRefresh,
    title: "Rotating sessions",
    body: "Refresh tokens rotate one at a time; a reused token revokes every session for your account.",
  },
  {
    icon: IconTrash,
    title: "Immediate deletion",
    body: "Delete your account and everything in it goes at once, permanently.",
  },
];

export function PrivacyStrip() {
  return (
    <section id="privacy" className="scroll-mt-24 border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-9">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Privacy and trust</p>
              <h2
                className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
                style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
              >
                A product you can trust with your money
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
                Financial data deserves stronger promises than &ldquo;we care about privacy&rdquo;. These are the behaviours we can point to.
              </p>
            </div>

            <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {PRIVACY.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.title} className="flex gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
                        {point.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
                        {point.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-6 font-mono text-xs uppercase tracking-wider">
              <Link
                href="/privacy"
                className="text-muted underline underline-offset-4 decoration-border-strong transition-colors hover:text-ink"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-muted underline underline-offset-4 decoration-border-strong transition-colors hover:text-ink"
              >
                Terms of Service
              </Link>
              <Link
                href="/delete-account"
                className="text-muted underline underline-offset-4 decoration-border-strong transition-colors hover:text-ink"
              >
                Delete your account
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
