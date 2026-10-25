import { IconCreditCard, IconSmartphone, IconCheckCircle } from "@/components/icons";
import { Reveal } from "@/components/reveal";

export function WorkflowSection() {
  const steps = [
    {
      num: "01",
      title: "Spend naturally",
      description: "Pay however you want—local currency, card, or cash. No specific card linking required.",
      detail: "At the counter",
      icon: IconCreditCard,
      badge: "At the counter",
    },
    {
      num: "02",
      title: "Log in seconds",
      description: "Add the amount and category in your Pluto account on web or Android. Sign in with Google to sync across devices.",
      detail: "While walking away",
      icon: IconSmartphone,
      badge: "While walking away",
    },
    {
      num: "03",
      title: "Understand clearly",
      description: "See the amount in your reporting currency with daily ECB rates, so totals add up without mental math.",
      detail: "Clear intuition",
      icon: IconCheckCircle,
      badge: "Clear intuition",
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24 py-10 md:py-14 relative bg-desk transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted mb-3">
            <span className="w-6 h-[1px] bg-border-strong" />
            <span>Simple 3-Step Habit</span>
            <span className="w-6 h-[1px] bg-border-strong" />
          </div>

          <div className="max-w-2xl mx-auto text-center space-y-3 mb-8 md:mb-10">
            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-ink tracking-tight leading-tight"
              style={{ textWrap: "balance", fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
            >
              A three-second habit.
              <span className="block text-accent">Designed for life on the move.</span>
            </h2>
            <p className="text-base sm:text-lg text-muted leading-relaxed" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
              Built for the moments between paying and moving on. Record what you spent, see it in your home currency.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.num} delay={idx * 80}>
                <div className="bg-paper rounded-[var(--radius-card,8px)] p-7 sm:p-8 border border-border shadow-[var(--edge-stock),var(--cast-stock)] hover:border-strong transition-all flex flex-col justify-between group h-full">
                  <div>
                    <div className="flex items-center justify-between mb-8">
                      <span className="text-4xl font-extrabold text-muted/30 group-hover:text-accent transition-colors" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                        {step.num}
                      </span>
                      <span className="text-[11px] font-semibold text-muted font-mono bg-paper border border-border px-2.5 py-1 rounded-md">
                        {step.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2.5">
                      <Icon className="w-5 h-5 text-accent" />
                      <h3 className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                        {step.title}
                      </h3>
                    </div>

                    <p className="text-sm text-muted leading-relaxed mb-6" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center gap-2 text-xs text-accent font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>{step.detail}</span>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <div className="mt-8 md:mt-10 max-w-2xl mx-auto text-center p-5 sm:p-6 bg-paper rounded-[var(--radius-card,8px)] border border-border shadow-[var(--edge-stock),var(--cast-stock)]">
            <p className="text-sm sm:text-base font-semibold text-ink leading-snug" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
              Sign in with Google, record in any supported currency, see totals in your reporting currency.
            </p>
            <div className="mt-1 text-xs text-muted font-mono">
              Daily ECB rates · Account-synced on web and Android
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
