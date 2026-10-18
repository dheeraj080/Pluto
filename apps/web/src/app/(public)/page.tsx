import type { Metadata } from "next";
import Link from "next/link";
import { AudienceCards } from "@/components/audience-cards";
import { ConverterSingle } from "@/components/converter-single";
import { DashboardMockup } from "@/components/dashboard-mockup";
import { ExpenseShowcase } from "@/components/expense-showcase";
import { Faq } from "@/components/faq";
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
  description:
    "Track expenses in foreign currencies and see what they add up to in your home currency. Made for students, expats, and travellers.",
};

const TRUST = [
  { icon: IconGoogle, label: "Google sign-in" },
  { icon: IconCheck, label: "No card required" },
  { icon: IconSun, label: "Daily ECB rates" },
  { icon: IconMobile, label: "Web and mobile" },
] as const;

/**
 * Hero fact band. Real facts only — no invented customer counts.
 */
const BAND = [
  "Daily ECB rates",
  "≈30 currencies",
  "No card required",
  "Web + Android",
] as const;

/** The problem, shown honestly: paid amounts are known, the total is not. */
const PROBLEM_ROWS = [
  { label: "Espresso", paid: "€4.80" },
  { label: "Train ticket", paid: "€23.00" },
  { label: "Groceries", paid: "€42.30" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Add an expense",
    body: "Enter the amount and the currency you paid in.",
  },
  {
    n: "02",
    title: "See the conversion",
    body: "View the equivalent in your chosen home currency.",
  },
  {
    n: "03",
    title: "Keep track of your total",
    body: "See your recorded expenses add up in a consistent currency.",
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
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
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
        {/* Hairline grid, faded out — texture without a colour wash. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(80%_70%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(70%_60%_at_50%_-8%,var(--glow-strong),transparent_66%)]"
        />

        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pb-20 lg:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Copy */}
            <div className="lg:col-span-5">
              <Eyebrow>For students, expats and tourists</Eyebrow>
              <h1 className="mt-4 font-display text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.025em] text-ink sm:text-5xl lg:text-[3rem]">
                Track what you spend abroad.
                <span className="mt-1.5 block text-muted">
                  Understand it in the currency that{" "}
                  <span className="text-primary">feels like home</span>.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Every purchase is recorded in the currency you actually paid —
                the original amount is never rewritten. Totals, budgets and
                reports appear in your reporting currency, converted at the
                European Central Bank&rsquo;s daily reference rate.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-primary px-6 text-base font-semibold text-on-primary shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <IconGoogle className="h-[18px] w-[18px]" />
                  Start tracking
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 text-base font-semibold text-ink transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  See how it works
                  <IconArrowRight className="h-[18px] w-[18px] text-muted" />
                </Link>
              </div>

              <ul className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                {TRUST.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label} className="flex items-center gap-4">
                      {i > 0 && (
                        <span aria-hidden="true" className="text-border-strong">
                          /
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Product */}
            <div className="lg:col-span-7">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- Fact band ---------------------------- */}
      <section className="border-y border-border bg-surface" aria-label="Product facts">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 lg:grid-cols-4">
          {BAND.map((fact, i) => (
            <div
              key={fact}
              className={[
                "flex items-center justify-center border-border px-4 py-4 text-center font-mono text-[11px] uppercase tracking-wider text-muted",
                i % 2 === 1 ? "border-l" : "",
                i < 2 ? "border-b lg:border-b-0" : "",
                i > 0 ? "lg:border-l" : "lg:border-l-0",
              ].join(" ")}
            >
              {fact}
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------- Problem ----------------------------- */}
      <section id="problem" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <div className="max-w-xl">
                <Eyebrow>The problem</Eyebrow>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Every purchase shouldn&apos;t require mental math.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted">
                  When you live or travel abroad, you spend in one currency
                  while thinking and budgeting in another. Keeping track of what
                  everything adds up to shouldn&apos;t require constant manual
                  conversion.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    This week, abroad
                  </p>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    Illustrative
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-end gap-3 font-mono text-[10px] uppercase tracking-wider text-muted">
                  <span className="flex-1">Expense</span>
                  <span className="w-16 text-right">Paid</span>
                  <span className="w-8 text-right">Home</span>
                </div>

                <ul className="mt-1 divide-y divide-border">
                  {PROBLEM_ROWS.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center gap-3 py-2.5 font-mono text-sm"
                    >
                      <span className="flex-1 font-sans font-medium text-ink">
                        {row.label}
                      </span>
                      <span className="w-16 text-right text-muted tabular-nums">
                        {row.paid}
                      </span>
                      <span className="w-8 text-right font-display text-base text-muted">
                        ?
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 font-mono text-sm">
                  <span className="flex-1 font-sans font-semibold text-ink">
                    Adds up to
                  </span>
                  <span className="w-16 text-right text-muted">—</span>
                  <span className="w-8 text-right font-display text-base text-muted">
                    ?
                  </span>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Without one reporting currency, the total stays unknown.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* --------------------------- How it works -------------------------- */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="One clearer picture of your spending."
            />
          </Reveal>

          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 80}>
                <li className="relative">
                  <span className="font-mono text-xs font-medium tracking-[0.2em] text-muted tabular-nums">
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

      {/* --------------------------- Showcase ------------------------------ */}
      <section id="showcase" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="The product"
              title="Your expenses, in context."
              intro="Every entry keeps the amount you paid beside its value in your reporting currency, and the month adds up to one running total."
            />
          </Reveal>
          <Reveal className="mx-auto mt-12 max-w-2xl">
            <ExpenseShowcase />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------- Who it's for ------------------------- */}
      <section id="who" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading eyebrow="Who it's for" title="Wherever life takes you." />
          </Reveal>
          <Reveal className="mt-12">
            <AudienceCards />
          </Reveal>
        </div>
      </section>

      {/* ------------------------- Privacy and trust ----------------------- */}
      <section id="privacy" className="scroll-mt-24 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal>
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-9">
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
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink">
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
            {/* The one place the accent gets to breathe. */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-surface shadow-[0_0_100px_-40px_rgba(52,211,153,0.5)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(50%_70%_at_50%_0%,rgba(52,211,153,0.12),transparent_70%)]"
              />
              <div className="relative px-6 py-14 text-center sm:px-12 sm:py-16">
                <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Know what you&apos;re spending. Wherever you are.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
                  Track expenses abroad and see what they mean in your home
                  currency.
                </p>
                <div className="mt-9 flex justify-center">
                  <Link
                    href="/login"
                    className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-primary px-7 text-base font-semibold text-on-primary shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <IconGoogle className="h-[18px] w-[18px]" />
                    Start tracking
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
