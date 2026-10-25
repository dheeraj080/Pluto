import Link from "next/link";
import { IconGoogle } from "@/components/icons";
import { convertCurrency, formatCurrencyAmount } from "@/lib/landing-currency";
import { PhoneMockup } from "./phone-mockup";

const TRUST = ["Web + Android", "Google sign-in"] as const;

export function Hero() {
  const sampleRate = convertCurrency(1, "EUR", "INR");
  const reweHome = convertCurrency(38.2, "EUR", "INR");

  return (
    <section className="relative pt-8 pb-12 md:pt-10 md:pb-16 overflow-hidden bg-desk">
      <div className="pointer-events-none absolute -top-10 right-0 w-[580px] h-[460px] rounded-[200px] opacity-[0.04]" style={{ backgroundImage: "url(felt.svg)" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] opacity-40" style={{ backgroundImage: "url(felt.svg)" }} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          <div className="lg:col-span-7 space-y-8">
            <h1
              className="text-4xl sm:text-5xl lg:text-[52px] text-ink tracking-tight leading-[1.08] max-w-xl mx-auto lg:mx-0"
              style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
            >
              Track what you spend abroad.
              <span className="mt-1.5 block text-accent font-medium">
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
              <Link href="/login" className="inline-flex items-center justify-center min-h-12 gap-2 px-6 rounded-[8px] bg-board text-board-type shadow-[var(--cast-stock)] hover:shadow-[var(--cast-stock-lift)] font-medium transition-transform">
                <IconGoogle className="h-4 w-4" />
                Start tracking
              </Link>
              <Link href="#how-it-works" className="inline-flex items-center justify-center min-h-12 px-5 rounded-[8px] bg-paper text-print border border-border shadow-[var(--edge-stock),var(--cast-stock)] hover:shadow-[var(--edge-stock),var(--cast-stock-lift)] font-medium transition-transform">
                See how it works
              </Link>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <div className="px-4 py-2 bg-paper border border-border text-xs font-mono text-print shadow-[var(--edge-stock),var(--cast-stock)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span>Web + Android</span>
              </div>
              <div className="px-4 py-2 bg-paper border border-border text-xs font-mono text-print shadow-[var(--edge-stock),var(--cast-stock)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span>Google sign-in</span>
              </div>
            </div>

            <p className="text-[11px] text-muted font-mono">
              Illustrative rates and amounts.
            </p>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end relative">
            <div className="relative w-full max-w-[365px]">
              <div
                aria-hidden="true"
                className="absolute -right-6 -top-4 z-20 bg-paper/95 backdrop-blur-[2px] border border-border rounded-[var(--radius-card,8px)] px-3.5 py-2 shadow-[var(--cast-stock-lift)] text-xs font-mono"
              >
                <div className="w-2 h-2 rounded-full bg-accent" />
                <div className="font-mono text-[11px]">
                  <span className="font-semibold text-ink tabular-nums">1 EUR</span> ≈{" "}
                  <span className="text-accent font-bold tabular-nums">
                    {formatCurrencyAmount(sampleRate, "INR")}
                  </span>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="hidden sm:flex absolute -left-8 bottom-12 z-20 bg-paper/95 backdrop-blur-md border border-border rounded-[var(--radius-card,8px)] px-3.5 py-2.5 shadow-[var(--cast-stock-lift)] items-center gap-2.5 text-xs"
              >
                <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-xs font-mono">
                  €
                </div>
                <div>
                  <div className="text-[11px] font-bold text-ink leading-tight">
                    Rewe Supermarkt · €38.20
                  </div>
                  <div className="text-[11px] font-semibold text-accent font-mono tabular-nums">
                    ≈ {formatCurrencyAmount(reweHome, "INR")}
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
