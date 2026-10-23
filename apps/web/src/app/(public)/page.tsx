import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { Faq } from "@/components/faq";
import { Hero } from "@/components/landing/hero";
import { TheProblemSection } from "@/components/landing/problem";
import { WorkflowSection } from "@/components/landing/workflow";
import { CoreFeatures } from "@/components/landing/core-features";
import { NotesComparisonSection } from "@/components/landing/comparison";
import { LifeAbroadSection } from "@/components/landing/life-abroad";
import { PrivacyStrip } from "@/components/landing/privacy-strip";
import { CTASection } from "@/components/landing/cta";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Track expenses in foreign currencies and see what they add up to in your home currency. Made for students, expats, and travellers.",
};

export default function HomePage() {
  return (
    <div
      className="bg-canvas text-ink"
      style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}
    >
      <Hero />
      <TheProblemSection />
      <WorkflowSection />
      <CoreFeatures />
      <NotesComparisonSection />
      <LifeAbroadSection />
      <PrivacyStrip />

      {/* -------------------------------- FAQ ------------------------------ */}
      <section id="faq" className="scroll-mt-24 py-10 md:py-14 bg-canvas transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center space-y-3 mb-8 md:mb-10">
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted uppercase tracking-widest">
                <span className="w-6 h-[1px] bg-border-strong" />
                <span>Honest Answers</span>
                <span className="w-6 h-[1px] bg-border-strong" />
              </div>
              <h2
                className="text-3xl sm:text-4xl font-bold text-ink tracking-tight"
                style={{
                  textWrap: "balance",
                  fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif",
                }}
              >
                Common questions about Pluto.
              </h2>
              <p className="text-base text-muted max-w-xl mx-auto">
                Everything you need to know about how Pluto works with your daily routine and respects your privacy.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <Faq />
          </Reveal>
        </div>
      </section>

      <CTASection />
    </div>
  );
}
