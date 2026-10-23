import { convertCurrency, formatCurrencyAmount } from "@/lib/landing-currency";
import { Reveal } from "@/components/reveal";

export function TheProblemSection() {
  const homeCurrency = "INR";
  const promptExampleEur = 32;
  const promptExampleHome = convertCurrency(promptExampleEur, "EUR", homeCurrency);

  return (
    <section id="the-problem" className="scroll-mt-24 py-10 md:py-14 bg-canvas relative transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-8 md:mb-10">
            <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted uppercase tracking-widest mb-2">
              <span className="w-6 h-[1px] bg-border-strong" />
              <span>The Everyday Friction</span>
              <span className="w-6 h-[1px] bg-border-strong" />
            </div>
            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-ink tracking-tight leading-tight"
              style={{ textWrap: "balance", fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
            >
              Foreign prices strip away your intuition.
            </h2>
            <p className="text-base text-muted leading-relaxed" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
              Back home, you immediately know if a price makes sense. In a new country, foreign amounts feel abstract until converted into your familiar baseline.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="bg-surface rounded-3xl p-6 sm:p-10 border border-subtle shadow-xs max-w-3xl mx-auto mb-8 text-center">
            <div className="space-y-4">
              <div className="text-sm sm:text-base font-medium text-muted font-mono">At the register in Berlin · Illustrative</div>
              <div
                className="text-3xl sm:text-5xl font-extrabold text-ink tracking-tight tabular-nums"
                style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
              >
                &ldquo;I spent €32 today.&rdquo;
              </div>
              <div className="text-base sm:text-xl font-medium text-muted italic">&ldquo;But how much did I actually spend?&rdquo;</div>
              <div className="pt-2">
                <span className="inline-block text-2xl sm:text-4xl font-extrabold text-primary-brand bg-primary-brand/10 border border-primary-brand/20 px-6 py-2.5 rounded-2xl shadow-xs font-mono tabular-nums">
                  ≈ {formatCurrencyAmount(promptExampleHome, homeCurrency)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted pt-2 max-w-md mx-auto">
                Without automatic dual-currency context, everyday money either feels arbitrary or requires endless mental math while walking through aisles.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-subtle shadow-xs max-w-3xl mx-auto">
            <div className="flex items-center justify-between pb-4 border-b border-subtle mb-4 text-xs font-mono">
              <span className="font-bold text-ink uppercase">Typical Day Abroad</span>
              <span className="text-muted">EUR (€) · Illustrative</span>
            </div>

            <div className="space-y-2.5">
              {[
                { emoji: "☕", name: "Coffee", venue: "Cafe Einstein", eur: 4.5 },
                { emoji: "🛒", name: "Groceries", venue: "Rewe Supermarkt", eur: 38.2 },
                { emoji: "🚇", name: "Metro", venue: "U-Bahn Single Ride", eur: 2.1 },
                { emoji: "🍝", name: "Dinner", venue: "Trattoria Corso", eur: 17.8 },
              ].map((item, idx) => {
                const converted = convertCurrency(item.eur, "EUR", homeCurrency);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-surface-muted border border-subtle flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg leading-none">{item.emoji}</span>
                      <div>
                        <div className="font-bold text-ink">{item.name}</div>
                        <div className="text-[11px] text-muted">{item.venue}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-ink text-sm tabular-nums">€{item.eur.toFixed(2)}</div>
                      <div className="text-xs font-semibold text-primary-brand font-mono tabular-nums">
                        ≈ {formatCurrencyAmount(converted, homeCurrency)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
