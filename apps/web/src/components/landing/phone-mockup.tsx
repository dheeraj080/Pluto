import { IconWifi, IconBattery } from "@/components/icons";
import { formatMoney } from "@/lib/format";

const monthCategories = [
  { name: "Groceries", eur: 168, percent: 39, color: "var(--cat-mint)" },
  { name: "Dining", eur: 107, percent: 25, color: "var(--cat-sky)" },
  { name: "Transit", eur: 62, percent: 15, color: "var(--cat-violet)" },
  { name: "Housing", eur: 91, percent: 21, color: "var(--cat-amber)" },
];

const recentExpenses = [
  { id: "r1", emoji: "☕", title: "Cafe Einstein", venue: "Flat White on Campus", categoryIndex: 1, eur: 4.5 },
  { id: "r2", emoji: "🛒", title: "Rewe Supermarkt", venue: "Weekly Groceries & Fruit", categoryIndex: 0, eur: 38.2 },
  { id: "r3", emoji: "🚇", title: "U-Bahn Ride", venue: "Single AB Zone Ticket", categoryIndex: 2, eur: 2.1 },
];

const series = ["var(--cat-mint)", "var(--cat-sky)", "var(--cat-violet)", "var(--cat-amber)", "var(--cat-rose)", "var(--cat-slate)"];

export function PhoneMockup({ className = "" }: { className?: string }) {
  const monthTotalEur = 428.6;
  const monthTotalHome = 428.6 * 90;

  return (
    <div className={`relative mx-auto select-none ${className}`}>
      <div className="w-[315px] sm:w-[350px] md:w-[365px] h-[670px] sm:h-[705px] bg-[#101216] rounded-[50px] p-[10px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08),0_0_0_4px_#1B1E22] relative">
        <div className="absolute -left-[13px] top-[120px] w-[3px] h-[28px] bg-[#272B30] rounded-l-md" />
        <div className="absolute -left-[13px] top-[165px] w-[3px] h-[48px] bg-[#272B30] rounded-l-md" />
        <div className="absolute -left-[13px] top-[225px] w-[3px] h-[48px] bg-[#272B30] rounded-l-md" />
        <div className="absolute -right-[13px] top-[170px] w-[3px] h-[68px] bg-[#272B30] rounded-r-md" />

        <div className="w-full h-full bg-surface rounded-[40px] overflow-hidden flex flex-col relative text-ink border border-subtle">
          <div className="pt-3.5 px-6 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-muted z-30 shrink-0">
            <span className="font-mono tracking-tight text-ink">9:41</span>
            <div className="w-24 h-5 bg-[#0B0C0E] rounded-full shadow-xs border border-white/5" />
            <div className="flex items-center gap-1.5 text-muted">
              <IconWifi className="w-3 h-3" />
              <IconBattery className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="px-5 pt-1 pb-2 border-b border-subtle bg-surface/95 backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted font-medium block">Good morning</span>
                <span className="text-sm font-bold tracking-tight text-ink" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                  Munich · Living in EUR
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-muted border border-subtle text-xs font-semibold rounded-full text-ink shadow-2xs">
                <span>🇮🇳</span>
                <span className="font-mono text-[11px]">INR</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 relative bg-canvas space-y-3.5">
            <div className="bg-surface rounded-2xl p-4 border border-subtle shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">
                  This Month
                </span>
                <span className="text-[10px] font-mono font-semibold text-muted">
                  EUR / INR
                </span>
              </div>

              <div>
                <div className="text-3xl font-extrabold tracking-tight text-ink tabular-nums" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                  €{monthTotalEur.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-primary-brand font-mono mt-0.5 tabular-nums">
                  ≈ {formatMoney(monthTotalHome, "INR", "en-US")}
                </div>
              </div>

              <div>
                <div className="h-2 w-full bg-surface-muted rounded-full flex overflow-hidden gap-0.5">
                  {monthCategories.map((cat, idx) => (
                    <div
                      key={idx}
                      className="h-full"
                      style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2.5 text-[11px]">
                  {monthCategories.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="font-bold text-ink tabular-nums">€{cat.eur}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-surface p-2.5 rounded-xl border border-subtle flex items-center justify-between text-xs shadow-2xs">
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                <span>Daily avg:</span>
                <span className="font-bold text-ink tabular-nums">€14.28</span>
              </div>
              <div className="text-[11px] font-semibold text-primary-brand font-mono tabular-nums">
                ≈ {formatMoney(14.28 * 90, "INR", "en-US")}/day
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 px-0.5 font-mono">
                <span>Recent Expenses</span>
              </div>

              <div className="space-y-1.5">
                {recentExpenses.map((exp) => {
                  const catColor = series[exp.categoryIndex] ?? "var(--cat-slate)";
                  return (
                    <div
                      key={exp.id}
                      className="bg-surface p-2.5 rounded-xl border border-subtle shadow-2xs flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-7 h-7 rounded-lg bg-surface-muted flex items-center justify-center text-xs"
                          style={{ color: catColor }}
                        >
                          {exp.emoji}
                        </span>
                        <div>
                          <div className="font-bold text-ink leading-tight">{exp.title}</div>
                          <div className="text-[10px] text-muted">{exp.venue}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-ink tabular-nums">
                          €{exp.eur.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-semibold text-primary-brand font-mono tabular-nums">
                          ≈ {formatMoney(exp.eur * 90, "INR", "en-US")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
