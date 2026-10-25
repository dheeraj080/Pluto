import Link from "next/link";
import { IconGoogle, IconCheckCircle2, IconShieldCheck, IconSmartphone } from "@/components/icons";
import { Reveal } from "@/components/reveal";

export function CTASection() {
  return (
    <section className="py-10 md:py-14 bg-desk relative transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="bg-paper rounded-[var(--radius-card,8px)] p-8 sm:p-14 text-ink text-center relative overflow-hidden shadow-[var(--cast-stock-lift)] border border-border">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <div className="text-xs font-mono font-bold text-accent">
                Simple &amp; Private by Design
              </div>

              <h2
                className="text-3xl sm:text-5xl font-bold tracking-tight text-ink"
                style={{ textWrap: "balance", fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
              >
                Everyday clarity on what you spend abroad.
              </h2>

              <p className="text-base sm:text-lg text-muted leading-relaxed font-normal" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
                Sign in with Google. Record expenses in any supported currency. See totals in the currency you think in.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <div className="px-5 py-3 bg-paper text-ink border border-border rounded-[var(--radius-stock,8px)] text-xs font-mono font-semibold flex items-center gap-2">
                  <IconSmartphone className="w-4 h-4 text-accent" />
                  <span>Web &amp; Android</span>
                </div>
                <div className="px-5 py-3 bg-paper text-ink border border-border rounded-[var(--radius-stock,8px)] text-xs font-mono font-semibold flex items-center gap-2">
                  <IconShieldCheck className="w-4 h-4 text-accent" />
                  <span>Google sign-in</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-[var(--radius-stock,8px)] bg-accent text-on-primary font-semibold shadow-[var(--edge-stock),var(--cast-stock)] hover:opacity-90 transition-opacity"
                  style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}
                >
                  <IconGoogle className="w-4 h-4" />
                  Start tracking
                </Link>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <IconCheckCircle2 className="w-4 h-4 text-accent" aria-hidden="true" />
                  Dual-currency at a glance
                </span>
                <span className="flex items-center gap-1.5">
                  <IconCheckCircle2 className="w-4 h-4 text-accent" aria-hidden="true" />
                  Daily ECB reference rates
                </span>
                <span className="flex items-center gap-1.5">
                  <IconCheckCircle2 className="w-4 h-4 text-accent" aria-hidden="true" />
                  Account-synced on web and Android
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
