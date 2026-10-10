import Link from "next/link";
import { ProductPreview } from "@/components/product-preview";
import { ConversionExample } from "@/components/conversion-example";
import {
  IconBolt,
  IconCheck,
  IconChart,
  IconChevronDown,
  IconGlobe,
  IconReceipt,
  IconSearch,
  IconShield,
  IconSwap,
  IconTag,
  IconWallet,
} from "@/components/icons";

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

const PROBLEMS = [
  {
    title: "Totals that don't add up",
    body: "Adding 4,000 ¥ to 62 CHF gives you a number that means nothing until you convert it — at whatever rate you happen to remember.",
  },
  {
    title: "Rates move every day",
    body: "A rate you looked up last week is already stale. Your spending decisions deserve numbers that are current, not remembered.",
  },
  {
    title: "No single source of truth",
    body: "Wallet receipts, bank apps and chat messages each tell a different story about what you actually spent abroad.",
  },
];

const FEATURES = [
  {
    icon: <IconReceipt className="h-5 w-5" />,
    title: "Record it as you pay",
    body: "Amount, currency, category, date — one quick form. Each expense stays in the currency you actually paid; it is never quietly rewritten.",
  },
  {
    icon: <IconSwap className="h-5 w-5" />,
    title: "Conversion that's automatic",
    body: "Dashboards, reports and budgets convert your totals into your chosen base currency using daily reference rates from the European Central Bank.",
  },
  {
    icon: <IconChart className="h-5 w-5" />,
    title: "Reports, trends, breakdowns",
    body: "This month against last, your biggest categories, and the trend over time — charts drawn from your real expenses, not decoration.",
  },
  {
    icon: <IconWallet className="h-5 w-5" />,
    title: "Budgets that keep you honest",
    body: "Set a monthly or yearly cap per category — or for everything — and watch each budget track against actual spending.",
  },
  {
    icon: <IconSearch className="h-5 w-5" />,
    title: "A history you can search",
    body: "Find any transaction by description, category, currency, date range or amount, and sort the list the way you need to see it.",
  },
  {
    icon: <IconTag className="h-5 w-5" />,
    title: "Categories that fit your life",
    body: "Rename and recolour the starter set, add your own, and every report and budget breaks spending down by them.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Sign in with Google",
    body: "No password to create, remember or reset. Your account follows you across sign-in with short-lived, rotating sessions.",
  },
  {
    n: "02",
    title: "Record as you spend",
    body: "Capture the purchase in the currency you paid — CHF coffee, SGD groceries, ¥ metro passes all sit together, untouched.",
  },
  {
    n: "03",
    title: "Review in your currency",
    body: "Your total, category breakdowns and budgets are converted into your preferred base currency — automatically, every day.",
  },
];

const USE_CASES = [
  {
    title: "International students",
    body: "Manage a budget in your home currency while rent, tuition and groceries happen abroad — and know exactly what's left at the end of the month.",
  },
  {
    title: "Expats & new residents",
    body: "Salary in one currency, life in another. Pluto keeps your spending view consistent no matter where the money flows.",
  },
  {
    title: "Frequent travellers",
    body: "Weeks on the road across several currencies? Record each day in the local currency and review it as one total when you land.",
  },
];

const PRIVACY_POINTS = [
  "Sign in only with Google — there's no separate password, and we never see your Google password.",
  "Your expense data is stored securely and used only to run the product: no ads, no ad trackers, no marketing profiles.",
  "Sessions rotate one at a time, and a reused token revokes every session for your account.",
  "Delete your account at any time — your profile, expenses, backups and sessions are erased immediately and permanently.",
];

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-base leading-relaxed text-muted">{intro}</p>}
    </div>
  );
}

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
    >
      {children}
      <IconChevronDown className="h-4 w-4 -rotate-90" />
    </Link>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ------------------------------- Hero ------------------------------ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(14,90,65,0.08),transparent)]"
        />
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>International expense tracking</Eyebrow>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
              Spend in any currency.
              <br />
              Understand it in yours.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              Pluto records every purchase in the currency you actually paid — then shows your
              totals in the currency you think in, converted with daily ECB reference rates.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-medium text-on-primary shadow-[0_2px_8px_rgba(14,90,65,0.3)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Start tracking free
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-7 text-base font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                See how it works
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
              {["Google Sign-In", "No card required", "Daily ECB reference rates"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <IconCheck className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto mt-16 max-w-4xl">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ----------------------------- Problem ----------------------------- */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="The problem"
            title="Cross-border spending is hard to read"
            intro="When your rent is in one currency, groceries in another and a trip in a third, “how much did I spend?” becomes mental arithmetic on top of a spreadsheet."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PROBLEMS.map((problem) => (
              <div
                key={problem.title}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <h3 className="text-base font-semibold text-ink">{problem.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{problem.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Features ---------------------------- */}
      <section id="features" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Features"
            title="Everything you need to see clearly"
            intro="No forty bloat features. Just the mechanics that make foreign spending legible — and they all work against real data."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col rounded-2xl border border-border bg-background p-6 transition-shadow hover:shadow-[0_8px_30px_-18px_rgba(23,33,27,0.25)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                  {feature.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------- Money example -------------------------- */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>Conversion</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                One purchase, three currencies, no maths
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Here is what it looks like when your spending happens around the world but you
                think in euros. The rates below are today&apos;s live ECB reference rates; the
                purchases are illustrative.
              </p>
              <ol className="mt-8 space-y-6">
                {STEPS.map((step) => (
                  <li key={step.n} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle font-mono text-sm font-semibold text-primary">
                      {step.n}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <ConversionExample />
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- Use cases --------------------------- */}
      <section id="use-cases" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Who it's for"
            title="Made for life that crosses borders"
            intro="If you live, study or travel in more than one currency, this is built for you — no spreadsheet required."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <div
                key={useCase.title}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                  <IconGlobe className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{useCase.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{useCase.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Privacy ---------------------------- */}
      <section id="privacy" className="scroll-mt-20 border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>Privacy</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                A product you can trust with your money
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Financial data deserves stronger promises than “we care about privacy.” These are
                the behaviours we can actually point to:
              </p>
              <ul className="mt-8 space-y-4">
                {PRIVACY_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                      <IconShield className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm leading-relaxed text-ink">{point}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <ArrowLink href="/privacy">Privacy Policy</ArrowLink>
                <ArrowLink href="/terms">Terms of Service</ArrowLink>
                <ArrowLink href="/delete-account">Delete your account</ArrowLink>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                  <IconBolt className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Always-on facts</p>
                  <p className="text-xs text-muted">Things we can show you working</p>
                </div>
              </div>
              <dl className="mt-6 space-y-5">
                <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
                  <dt className="text-sm text-muted">Rates updated</dt>
                  <dd className="text-sm font-semibold tabular-nums text-ink">Daily, from the ECB</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
                  <dt className="text-sm text-muted">Sign-in methods</dt>
                  <dd className="text-sm font-semibold text-ink">Google only</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
                  <dt className="text-sm text-muted">Advertising</dt>
                  <dd className="text-sm font-semibold text-ink">None</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted">Account deletion</dt>
                  <dd className="text-sm font-semibold text-ink">Immediate & permanent</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- Final CTA --------------------------- */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Your spending, in one currency — starting now
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
            Sign in with Google and record your first expense in under a minute. Everything else —
            conversion, totals, reports, budgets — happens for you.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-medium text-on-primary shadow-[0_2px_8px_rgba(14,90,65,0.3)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Start tracking free
            </Link>
            <Link
              href="/status"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-7 text-base font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              View service status
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}