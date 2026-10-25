import { IconWifi, IconBattery } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import { convertCurrency } from "@/lib/landing-currency";

/** One illustrative ratio drives every figure in the mockup. */
const HOME_CURRENCY = "INR";

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
  const monthTotalHome = convertCurrency(monthTotalEur, "EUR", HOME_CURRENCY);

  return (
    <div className={`relative mx-auto select-none ${className}`}>
      <div className="w-[280px] sm:w-[350px] md:w-[365px] h-[600px] sm:h-[705px] bg-[#101216] rounded-[50px] p-[10px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08),0_0_0_4px_#1B1E22] relative">
        <div className="absolute -left-[13px] top-[120px] w-[3px] h-[28px] bg-[#272B30] rounded-l-md" />
        <div className="absolute -left-[13px] top-[165px] w-[3px] h-[48px] bg-[#272B30] rounded-l-md" />
        <div className="absolute -left-[13px] top-[225px] w-[3px] h-[48px] bg-[#272B30] rounded-l-md" />
        <div className="absolute -right-[13px] top-[170px] w-[3px] h-[68px] bg-[#272B30] rounded-r-md" />

        <div className="w-full h-full bg-white rounded-[40px] overflow-hidden flex flex-col relative text-gray-900 border border-gray-200">
          <div className="pt-3.5 px-6 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-500 z-30 shrink-0">
            <span className="font-mono tracking-tight text-gray-900">9:41</span>
            <div className="w-24 h-5 bg-[#0B0C0E] rounded-full shadow-[var(--edge-stock),var(--cast-stock)] border border-white/5" />
            <div className="flex items-center gap-1.5 text-gray-500">
              <IconWifi className="w-3 h-3" />
              <IconBattery className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="px-5 pt-1 pb-2 border-b border-gray-200 bg-white/95 backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-gray-500 font-medium block">Good morning</span>
                <span className="text-sm font-bold tracking-tight text-gray-900" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                  Munich · Living in EUR
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 text-xs font-semibold rounded-full text-gray-900 shadow-[var(--edge-stock),var(--cast-stock)]">
                <span>🇮🇳</span>
                <span className="font-mono text-[11px]">INR</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 relative bg-gray-100 space-y-3.5">
            <div className="bg-white rounded-[var(--radius-card,8px)] p-4 border border-gray-200 shadow-[var(--edge-stock),var(--cast-stock)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 font-mono">
                  This Month
                </span>
                <span className="text-[10px] font-mono font-semibold text-gray-500">
                  EUR / INR
                </span>
              </div>

              <div>
                <div className="text-3xl font-extrabold tracking-tight text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                  €{monthTotalEur.toFixed(2)}
                </div>
                <div className="text-xs font-bold text-emerald-600 font-mono mt-0.5 tabular-nums">
                  ≈ {formatMoney(monthTotalHome, HOME_CURRENCY, "en-US")}
                </div>
              </div>

              <div>
                <div className="h-2 w-full bg-white rounded-full flex overflow-hidden gap-0.5">
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
                    <div key={idx} className="flex items-center justify-between text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="font-bold text-gray-900 tabular-nums">€{cat.eur}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-[var(--radius-stock,8px)] border border-gray-200 flex items-center justify-between text-xs shadow-[var(--edge-stock),var(--cast-stock)]">
              <div className="flex items-center gap-2 font-mono text-[11px] text-gray-500">
                <span>Daily avg:</span>
                <span className="font-bold text-gray-900 tabular-nums">€14.28</span>
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 font-mono tabular-nums">
                ≈ {formatMoney(convertCurrency(14.28, "EUR", HOME_CURRENCY), HOME_CURRENCY, "en-US")}/day
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-500 mb-1.5 px-0.5 font-mono">
                <span>Recent Expenses</span>
              </div>

              <div className="space-y-1.5">
                {recentExpenses.map((exp) => {
                  const catColor = series[exp.categoryIndex] ?? "var(--cat-slate)";
                  return (
                    <div
                      key={exp.id}
                      className="bg-white p-2.5 rounded-[var(--radius-stock,8px)] border border-gray-200 shadow-[var(--edge-stock),var(--cast-stock)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-xs"
                          style={{ color: catColor }}
                        >
                          {exp.emoji}
                        </span>
                        <div>
                          <div className="font-bold text-gray-900 leading-tight">{exp.title}</div>
                          <div className="text-[10px] text-gray-500">{exp.venue}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-gray-900 tabular-nums">
                          €{exp.eur.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-600 font-mono tabular-nums">
                          ≈ {formatMoney(convertCurrency(exp.eur, "EUR", HOME_CURRENCY), HOME_CURRENCY, "en-US")}
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
