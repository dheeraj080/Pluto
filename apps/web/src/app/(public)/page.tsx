import type { Metadata } from "next";
import Link from "next/link";
import { AudienceCards } from "@/components/audience-cards";
import { ConverterSingle } from "@/components/converter-single";
import { DashboardMockup } from "@/components/dashboard-mockup";
import { Faq } from "@/components/faq";
import { FeaturesBento } from "@/components/feature-snippets";
import { Reveal } from "@/components/reveal";
import {
  IconArrowRight,
  IconCheck,
  IconGoogle,
  IconMobile,
  IconRefresh,
  IconShield,
  IconSun,
  IconTrash,
} from "@/components/icons";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const TRUST = [
  { icon: IconGoogle, label: "Google sign-in" },
  { icon: IconCheck, label: "No card required" },
  { icon: IconSun, label: "Daily ECB rates" },
  { icon: IconMobile, label: "Web and mobile" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Sign in with Google",
    body: "No password to create or remember. Sessions are short-lived and rotate.",
  },
  {
    n: "02",
    title: "Record what you paid",
    body: "Add each purchase in its own currency. The original amount is never rewritten.",
  },
  {
    n: "03",
    title: "Read it in your currency",
    body: "Totals, budgets and reports appear in the currency you think in.",
  },
] as const;

const PRIVACY = [
  {
    icon: IconGoogle,
    title: "Google-only sign-in",
    body: "There is no Pluto password to leak, and we never see your Google password.",
  },
  {
    icon: IconShield,
    title: "No ads, no trackers",
    body: "Your data runs the product only. No advertising, no ad trackers, no profiles.",
  },
  {
    icon: IconRefresh,
    title: "Rotating sessions",
    body: "Refresh tokens rotate one at a time; a reused token revokes every session.",
  },
  {
    icon: IconTrash,
    title: "Immediate deletion",
    body: "Delete your account and everything in it goes at once, permanently.",
  },
] as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  align?: "center" | "left";
}) {
  const alignment = align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl";
  return (
    <div className={alignment}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-base leading-relaxed text-muted">{intro}</p>}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ------------------------------- Hero ------------------------------ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(70%_60%_at_50%_-8%,var(--glow-strong),transparent_66%)]"
        />
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Multi-currency expense tracking
            </span>
            <h1 className="mt-6 font-display text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.75rem]">
              Spend in any currency.
              <span className="block text-primary">Understand it in yours.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              Pluto records each purchase in the currency you actually paid, then
              shows your totals, budgets and trends in the one you think in —
              converted with daily European Central Bank rates.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-primary px-6 text-base font-semibold text-on-primary shadow-[0_18px_50px_-18px_rgba(52,211,153,0.7)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <IconGoogle className="h-[18px] w-[18px]" />
                Start tracking free
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 text-base font-semibold text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                See how it works
                <IconArrowRight className="h-[18px] w-[18px] text-muted" />
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
              {TRUST.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mx-auto mt-16 max-w-4xl">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ----------------------------- Features ---------------------------- */}
      <section id="features" className="scroll-mt-24 border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Features"
              title="Everything you need, and nothing you do not"
              intro="Just the pieces that make foreign spending readable, working on your real numbers."
            />
          </Reveal>
          <Reveal className="mt-12">
            <FeaturesBento />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------- Who it's for ------------------------- */}
      <section id="who" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Built for people who cross borders"
              title="Made for life in more than one currency"
            />
          </Reveal>
          <Reveal className="mt-12">
            <AudienceCards />
          </Reveal>
        </div>
      </section>

      {/* --------------------------- How it works -------------------------- */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="Three steps, then it runs itself"
              intro="Pluto does the converting so you can spend your attention on the month ahead."
            />
          </Reveal>

          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 80}>
                <li className="relative">
                  <span className="font-display text-sm font-semibold tracking-[0.2em] text-primary tabular-nums">
                    {step.n}
                  </span>
                  <div className="mt-3 h-px w-full bg-border" />
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal className="mx-auto mt-12 max-w-md">
            <ConverterSingle />
          </Reveal>
        </div>
      </section>

      {/* ------------------------- Privacy and trust ----------------------- */}
      <section id="privacy" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <div className="rounded-[24px] border border-border bg-surface p-6 sm:p-9">
              <div className="max-w-2xl">
                <Eyebrow>Privacy and trust</Eyebrow>
                <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  A product you can trust with your money
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Financial data deserves stronger promises than &ldquo;we care about
                  privacy&rdquo;. These are the behaviours we can point to.
                </p>
              </div>

              <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {PRIVACY.map((point) => {
                  const Icon = point.icon;
                  return (
                    <li key={point.title} className="flex gap-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-ink">{point.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted">{point.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-6 text-sm">
                <Link href="/privacy" className="font-medium text-primary hover:text-primary-hover">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="font-medium text-primary hover:text-primary-hover">
                  Terms of Service
                </Link>
                <Link
                  href="/delete-account"
                  className="font-medium text-primary hover:text-primary-hover"
                >
                  Delete your account
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------- FAQ ------------------------------ */}
      <section id="faq" className="scroll-mt-24 border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="FAQ"
              title="Questions people ask first"
              intro="Short answers about currencies, rates, privacy and your data."
            />
          </Reveal>
          <Reveal className="mt-12">
            <Faq />
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- Final CTA --------------------------- */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-[24px] border border-primary/25 bg-surface shadow-[0_0_80px_-24px_rgba(52,211,153,0.45)]">
              <div className="relative overflow-hidden rounded-[23px] px-6 py-14 text-center sm:px-12 sm:py-16">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(50%_70%_at_50%_0%,var(--glow),transparent_70%)]"
                />
                <div className="relative">
                  <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                    Your spending, in one currency, starting now
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
                    Sign in with Google and record your first expense in under a
                    minute. Conversion, totals and budgets happen for you.
                  </p>
                  <div className="mt-9 flex justify-center">
                    <Link
                      href="/login"
                      className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-primary px-7 text-base font-semibold text-on-primary shadow-[0_18px_50px_-18px_rgba(52,211,153,0.7)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <IconGoogle className="h-[18px] w-[18px]" />
                      Start tracking free
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
