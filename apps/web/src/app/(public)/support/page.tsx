import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Frequently asked questions about Pluto — expense tracking, currency conversion, reporting currency, and privacy.",
};

const FAQ = [
  {
    q: "What is Pluto?",
    a: "Pluto is an expense tracker for people who spend in more than one currency. Record a purchase in the currency you actually paid — CHF, SGD, JPY, whatever — and Pluto converts totals, reports and budgets into the currency you choose to think in. You sign in with your Google account, so there is no separate password to create or remember.",
  },
  {
    q: "How do I record an expense?",
    a: "Sign in and open Add expense. Enter the amount, the currency you paid in, a category, a description and the date. The amount is always stored exactly as you paid it — conversion only happens when you view reports or budgets in your reporting currency.",
  },
  {
    q: "What is my reporting currency?",
    a: "The currency you see totals in, sometimes called the base currency. You choose it when you set up your account and can change it at any time from the app; your choice is saved on your device. Every total on the dashboard and in reports is converted into it.",
  },
  {
    q: "How is currency conversion done?",
    a: "Pluto uses daily reference rates from the European Central Bank, refreshed once a day. Rates are consulted at report time, and every converted figure is dated with the rate snapshot it used. When rates are unavailable, reports show your native per-currency totals instead of guessing.",
  },
  {
    q: "Why do your rates differ from my bank's?",
    a: "Banks and card providers set their own retail rates and margins. Pluto shows the official ECB reference rates — the same numbers financial institutions use as a reference point.",
  },
  {
    q: "How do I sign in?",
    a: "Choose Sign in with Google and pick your account. We receive only your email address, name, profile picture, and a Google account identifier — never your Google password.",
  },
  {
    q: "Is my data safe?",
    a: "All traffic uses TLS, access tokens are short-lived, and refresh tokens rotate one at a time — a reused token revokes every session for your account. Your expense data is used only to run the product: no ads, no ad trackers, no marketing profiles. See the Privacy Policy for the full picture.",
  },
  {
    q: "How do I delete my account?",
    a: "Open the Delete account page, sign in with Google, optionally download a copy of any cloud backups first, and confirm. Your profile, expenses, backups and sessions are erased immediately and permanently.",
  },
] as const;

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Support</h1>
      <p className="mt-2 text-muted">
        Answers to the most common questions. Still stuck? Contact us at{" "}
        <a href="mailto:support@pluto.app" className="text-primary underline underline-offset-2">
          support@pluto.app
        </a>
        .
      </p>

      <div className="mt-8 divide-y divide-border rounded-xl border border-border">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/privacy"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-background"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-background"
        >
          Terms of Service
        </Link>
        <Link
          href="/status"
          className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-background"
        >
          Service status
        </Link>
      </div>
    </div>
  );
}
