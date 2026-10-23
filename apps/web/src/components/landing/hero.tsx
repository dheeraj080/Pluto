import Link from "next/link";
import { IconGoogle } from "@/components/icons";
import { PhoneMockup } from "./phone-mockup";

const TRUST = ["Web + Android", "Google sign-in"] as const;

export function Hero() {
  return (
    <section className="relative pt-6 pb-8 md:pt-10 md:pb-12 overflow-hidden bg-canvas">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[520px] bg-primary-brand/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            <h1
              className="text-4xl sm:text-5xl lg:text-[52px] font-bold text-ink tracking-tight leading-[1.08] max-w-xl mx-auto lg:mx-0"
              style={{ textWrap: "balance", fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
            >
              Track what you spend abroad.
              <span className="block text-primary-brand mt-1.5">
                Understand it in the currency that feels like home.
              </span>
            </h1>

            <p
              className="text-base sm:text-lg text-muted leading-relaxed max-w-lg mx-auto lg:mx-0"
              style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}
            >
              Pluto records every purchase in the currency you actually paid and shows totals, budgets and reports in the reporting currency you choose, converted at the European Central Bank’s daily reference rate.
            </p>

            <div
              className="flex items-center justify-center lg:justify-start gap-2 text-xs text-muted"
              style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}
            >
              <span className="font-semibold text-ink">Built for:</span>
              <span>International students</span>
              <span aria-hidden="true">·</span>
              <span>Expats</span>
              <span aria-hidden="true">·</span>
              <span>Travellers</span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-brand text-on-primary font-semibold shadow-xs hover:opacity-90 transition-opacity"
                style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}
              >
                <IconGoogle className="w-4 h-4" />
                Start tracking
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface text-ink border border-subtle font-semibold hover:border-strong transition-colors"
                style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}
              >
                See how it works
              </Link>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              {TRUST.map((item) => (
                <div
                  key={item}
                  className="px-4 py-2 bg-surface border border-subtle rounded-xl text-xs font-mono text-ink shadow-2xs flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-primary-brand" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end relative">
            <div className="relative w-full max-w-[365px]">
              <div
                aria-hidden="true"
                className="hidden sm:flex absolute -right-6 -top-4 z-20 bg-surface/95 backdrop-blur-md border border-subtle rounded-2xl px-3.5 py-2 shadow-xl items-center gap-2.5 text-xs"
              >
                <div className="w-2 h-2 rounded-full bg-primary-brand" />
                <div className="font-mono text-[11px]">
                  <span className="font-semibold text-ink tabular-nums">1 EUR</span> ≈{" "}
                  <span className="text-primary-brand font-bold tabular-nums">₹90.00</span>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="hidden sm:flex absolute -left-8 bottom-12 z-20 bg-surface/95 backdrop-blur-md border border-subtle rounded-2xl px-3.5 py-2.5 shadow-xl items-center gap-2.5 text-xs"
              >
                <div className="w-7 h-7 rounded-lg bg-primary-brand/10 text-primary-brand flex items-center justify-center font-bold text-xs font-mono">
                  €
                </div>
                <div>
                  <div className="text-[11px] font-bold text-ink leading-tight">
                    Rewe Supermarkt · €38.20
                  </div>
                  <div className="text-[11px] font-semibold text-primary-brand font-mono tabular-nums">
                    ≈ ₹3,438.00
                  </div>
                </div>
              </div>

              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
