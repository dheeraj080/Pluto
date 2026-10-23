/**
 * Landing-page FAQ: seven questions in a stacked accordion. Uses native
 * `details`/`summary` so it works without JavaScript and stays
 * keyboard-accessible. Every answer is verifiable against the product.
 */

import { IconChevronDown } from "@/components/icons";

const FAQ = [
  {
    q: "Which currencies are supported?",
    a: "Pluto uses the European Central Bank reference set — around thirty currencies, including EUR, USD, GBP, CHF, JPY, SGD and INR. Record a purchase in any of them and read your totals in the one you think in.",
  },
  {
    q: "Where do the exchange rates come from?",
    a: "From the European Central Bank's daily reference rates, refreshed once a day. Every converted figure is dated with the rate it used, so you always know which day's numbers you are looking at.",
  },
  {
    q: "Can I choose my home currency?",
    a: "Yes. You pick your reporting currency when you first sign in, and you can change it later in settings. Totals, budgets and reports are shown in that currency.",
  },
  {
    q: "Can I use the same account on web and mobile?",
    a: "Yes. The web app and the Android app sign in with the same Google account, and your expenses are stored with your account rather than on a single device.",
  },
  {
    q: "Is Pluto free?",
    a: "Yes. Recording expenses, conversion, budgets and reports are free. There are no ads and no paid tiers that unlock your own data.",
  },
  {
    q: "Is my data safe?",
    a: "You sign in only with Google, so there is no Pluto password to leak. Access tokens are short-lived and refresh tokens rotate one at a time. Your data is used only to run the product — no ads, no trackers, no marketing profiles.",
  },
  {
    q: "How do I delete my account?",
    a: "Open the Delete account page, sign in with Google and confirm. Your profile, expenses, backups and sessions are erased immediately and permanently.",
  },
] as const;

function Item({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-surface rounded-2xl border border-subtle shadow-xs overflow-hidden transition-colors open:border-strong">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left marker:hidden sm:p-6">
        <span
          className="text-base font-semibold text-ink"
          style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
        >
          {q}
        </span>
        <IconChevronDown
          className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 group-open:text-primary-brand"
        />
      </summary>
      <p
        className="border-t border-subtle px-5 pb-5 pt-3 text-sm leading-relaxed text-muted sm:px-6 sm:pb-6"
        style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}
      >
        {a}
      </p>
    </details>
  );
}

export function Faq() {
  return (
    <div className="space-y-3">
      {FAQ.map((item) => (
        <Item key={item.q} {...item} />
      ))}
    </div>
  );
}
