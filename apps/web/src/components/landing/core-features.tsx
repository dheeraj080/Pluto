import { IconCheck } from "@/components/icons";
import { convertCurrency, formatCurrencyAmount } from "@/lib/landing-currency";
import { Reveal } from "@/components/reveal";

const series = ["var(--cat-mint)", "var(--cat-sky)", "var(--cat-violet)", "var(--cat-amber)"];

export function CoreFeatures() {
  const homeCurrency = "INR";
  const currentRate = convertCurrency(1, "EUR", homeCurrency);
  const staticAddAmount = "18.50";
  const convertedAddAmount = convertCurrency(18.5, "EUR", homeCurrency);

  return (
    <section id="features" className="scroll-mt-24 py-10 md:py-14 bg-desk relative transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted mb-3">
            <span className="w-6 h-[1px] bg-border-strong" />
            <span>The Product · Visual System</span>
            <span className="w-6 h-[1px] bg-border-strong" />
          </div>

          <div className="max-w-2xl mx-auto text-center space-y-3 mb-8 md:mb-10">
            <h2
              className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-ink tracking-tight leading-tight"
              style={{ textWrap: "balance", fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
            >
              Designed for clear comprehension.
              <span className="block text-accent">Three views. Zero financial clutter.</span>
            </h2>
            <p className="text-base sm:text-lg text-muted leading-relaxed" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
              High-contrast typography, calibrated dark and light surfaces, and your familiar home currency right where you expect it.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Reveal>
            <div className="bg-paper rounded-[var(--radius-card,8px)] p-6 border border-border shadow-[var(--edge-stock),var(--cast-stock)] flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                  <span className="text-[11px] font-bold font-mono text-accent">
                    01 · Quick Entry View
                  </span>
                  <span className="text-[10px] text-muted font-mono">Fast entry</span>
                </div>

                <div className="bg-desk rounded-[var(--radius-card,8px)] p-4 border border-border space-y-3.5">
                  <div className="bg-paper rounded-[var(--radius-stock,8px)] p-4 text-center border border-border shadow-[var(--edge-stock),var(--cast-stock)]">
                    <span className="text-[10px] font-bold text-muted font-mono">
                      Amount
                    </span>
                    <div
                      className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight my-1 tabular-nums"
                      style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
                    >
                      € {staticAddAmount}
                    </div>
                    <div className="text-xs font-semibold text-accent bg-accent/10 inline-flex items-center px-2.5 py-0.5 rounded-full font-mono tabular-nums">
                      ≈ {formatCurrencyAmount(convertedAddAmount, homeCurrency)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted block mb-1.5">Category</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { name: "Groceries", index: 0, active: true },
                        { name: "Dining", index: 1, active: false },
                        { name: "Transit", index: 2, active: false },
                        { name: "Housing", index: 3, active: false },
                      ].map((cat) => {
                        const catColor = series[cat.index];
                        return (
                          <div
                            key={cat.name}
                            className="py-2 px-2 text-center rounded-[var(--radius-stock,8px)] text-xs font-semibold border transition-all"
                            style={{
                              backgroundColor: cat.active ? catColor : "var(--surface)",
                              color: cat.active ? "#FFFFFF" : "var(--ink)",
                              borderColor: cat.active ? catColor : "var(--border)",
                            }}
                          >
                            {cat.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted block mb-1">Preset amounts:</span>
                    <div className="flex gap-1.5">
                      {["4.50", "18.50", "38.20", "65.00"].map((amt) => (
                        <div
                          key={amt}
                          className={`flex-1 py-1 text-center text-[11px] font-mono rounded-lg border tabular-nums ${
                            amt === "18.50"
                              ? "bg-accent text-on-primary border-accent font-bold"
                              : "bg-paper text-ink border-border"
                          }`}
                        >
                          €{amt}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w-full py-2.5 bg-accent text-on-primary rounded-[var(--radius-stock,8px)] text-xs font-bold flex items-center justify-center gap-1.5 shadow-[var(--edge-stock),var(--cast-stock)]">
                    <IconCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Save expense</span>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted leading-relaxed">
                The amount stays the focus. Enter it, see the conversion, and record the purchase.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="bg-paper rounded-[var(--radius-card,8px)] p-6 border border-border shadow-[var(--edge-stock),var(--cast-stock)] flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                  <span className="text-[11px] font-bold font-mono text-accent">
                    02 · Home Ledger
                  </span>
                  <span className="text-[10px] text-muted font-mono">Calm overview</span>
                </div>

                <div className="bg-desk rounded-[var(--radius-card,8px)] p-4 border border-border space-y-3">
                  <div className="text-[11px] text-muted font-medium">Good morning</div>

                  <div className="bg-paper rounded-[var(--radius-stock,8px)] p-3.5 border border-border shadow-[var(--edge-stock),var(--cast-stock)]">
                    <div className="text-[10px] font-bold text-muted font-mono">
                      This month
                    </div>
                    <div
                      className="text-2xl font-extrabold text-ink tracking-tight mt-0.5 tabular-nums"
                      style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
                    >
                      €428.60
                    </div>
                    <div className="text-xs font-bold text-accent font-mono mt-0.5 tabular-nums">
                      ≈ {formatCurrencyAmount(convertCurrency(428.6, "EUR", homeCurrency), homeCurrency)}
                    </div>

                    <div className="h-2 w-full bg-paper rounded-full flex overflow-hidden gap-0.5 mt-3 mb-2">
                      <div className="h-full" style={{ width: "39%", backgroundColor: series[0] }} />
                      <div className="h-full" style={{ width: "25%", backgroundColor: series[1] }} />
                      <div className="h-full" style={{ width: "15%", backgroundColor: series[2] }} />
                      <div className="h-full" style={{ width: "21%", backgroundColor: series[3] }} />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {[
                        { name: "Groceries", value: "€168", color: series[0] },
                        { name: "Dining", value: "€107", color: series[1] },
                        { name: "Transit", value: "€62", color: series[2] },
                        { name: "Housing", value: "€91", color: series[3] },
                      ].map((cat) => (
                        <div key={cat.name} className="flex justify-between items-center text-muted">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span>{cat.name}</span>
                          </span>
                          <span className="font-bold text-ink tabular-nums">{cat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-muted mb-1.5 px-0.5 font-mono">
                      Recent
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { emoji: "☕", label: "Cafe Einstein", value: "€4.50" },
                        { emoji: "🛒", label: "Rewe Supermarkt", value: "€38.20" },
                        { emoji: "🚇", label: "U-Bahn Metro", value: "€2.10" },
                      ].map((item) => (
                        <div key={item.label} className="bg-paper p-2 rounded-lg border border-border flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span>{item.emoji}</span> {item.label}
                          </span>
                          <span className="font-bold text-ink tabular-nums">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted leading-relaxed">
                See what you spent this month and where it went—without complex spreadsheets.
              </p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="bg-paper rounded-[var(--radius-card,8px)] p-6 border border-border shadow-[var(--edge-stock),var(--cast-stock)] flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                  <span className="text-[11px] font-bold font-mono text-accent">
                    03 · Expense Ledger
                  </span>
                  <span className="text-[10px] text-muted font-mono">Dual-currency</span>
                </div>

                <div className="bg-desk rounded-[var(--radius-card,8px)] p-4 border border-border space-y-3">
                  <div className="bg-paper rounded-[var(--radius-stock,8px)] p-2.5 border border-border flex items-center justify-between text-[11px] font-mono shadow-[var(--edge-stock),var(--cast-stock)]">
                    <div>
                      <span className="text-muted block text-[10px]">Reference Rate</span>
                      <span className="font-bold text-ink tabular-nums">
                        1 EUR ≈ {currentRate.toFixed(2)} {homeCurrency}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted bg-paper border border-border px-2 py-0.5 rounded">
                      Illustrative · ECB-style daily
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { emoji: "☕", name: "Coffee", venue: "Cafe Einstein", eur: 4.5, color: series[1] },
                      { emoji: "🛒", name: "Groceries", venue: "Rewe Supermarkt", eur: 38.2, color: series[0] },
                      { emoji: "🚇", name: "Metro", venue: "U-Bahn Single Ride", eur: 2.1, color: series[2] },
                      { emoji: "🍝", name: "Dinner", venue: "Trattoria Corso", eur: 17.8, color: series[1] },
                    ].map((item, idx) => {
                      const converted = convertCurrency(item.eur, "EUR", homeCurrency);
                      return (
                        <div
                          key={idx}
                          className="bg-paper p-2.5 rounded-[var(--radius-stock,8px)] border border-border shadow-[var(--edge-stock),var(--cast-stock)] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-7 h-7 rounded-lg bg-paper flex items-center justify-center text-xs"
                              style={{ color: item.color }}
                            >
                              {item.emoji}
                            </span>
                            <div>
                              <div className="font-bold text-ink leading-tight">{item.name}</div>
                              <div className="text-[10px] text-muted">{item.venue}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-ink tabular-nums">€{item.eur.toFixed(2)}</div>
                            <div className="text-[11px] font-semibold text-accent font-mono tabular-nums">
                              ≈ {formatCurrencyAmount(converted, homeCurrency)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2 bg-paper border border-border rounded-lg text-center text-[10px] text-muted font-mono">
                    Account-synced · Web and Android
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted leading-relaxed">
                Every purchase preserves the foreign price for the counter, and your familiar home currency for peace of mind.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-14 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-6 text-xs text-muted font-mono">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Dual-currency clarity</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Google sign-in</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Stored with your account · Web and Android</span>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
