import { IconFileText, IconTable, IconCheck, IconX } from "@/components/icons";
import { Reveal } from "@/components/reveal";

export function NotesComparisonSection() {
  return (
    <section className="py-10 md:py-14 relative bg-canvas transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-8 md:mb-10">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-muted">Honest Comparison</div>
            <h2
              className="text-3xl sm:text-4xl font-bold text-ink tracking-tight"
              style={{ textWrap: "balance", fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}
            >
              Why not just use Apple Notes or a spreadsheet?
            </h2>
            <p className="text-base text-muted leading-relaxed" style={{ fontFamily: "var(--font-landing-sans), var(--font-inter), system-ui, sans-serif" }}>
              Most people moving abroad try one of these first. Here is why they usually stop after two weeks.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Reveal>
            <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-subtle shadow-xs flex flex-col justify-between h-full">
              <div>
                <div className="w-10 h-10 rounded-xl bg-surface-muted border border-subtle flex items-center justify-center text-muted mb-4">
                  <IconFileText className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                  The Notes App
                </h3>
                <p className="text-xs text-muted mb-5">Fast to type, but numbers sit as dead text.</p>

                <ul className="space-y-3 text-xs text-muted">
                  <li className="flex items-start gap-2">
                    <IconX className="w-4 h-4 text-muted/50 shrink-0 mt-0.5" />
                    <span>No currency conversion — you still do mental math</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconX className="w-4 h-4 text-muted/50 shrink-0 mt-0.5" />
                    <span>No running monthly totals or category sums</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconX className="w-4 h-4 text-muted/50 shrink-0 mt-0.5" />
                    <span>Becomes an unorganized wall of numbers by week three</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-subtle text-[11px] font-mono text-muted/70">
                Verdict: Great for scratchpad, useless for clarity
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="bg-surface rounded-3xl p-6 sm:p-7 border border-subtle shadow-xs flex flex-col justify-between h-full">
              <div>
                <div className="w-10 h-10 rounded-xl bg-surface-muted border border-subtle flex items-center justify-center text-muted mb-4">
                  <IconTable className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-ink mb-1" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                  Spreadsheets
                </h3>
                <p className="text-xs text-muted mb-5">Powerful on paper, painful on a phone.</p>

                <ul className="space-y-3 text-xs text-muted">
                  <li className="flex items-start gap-2">
                    <IconX className="w-4 h-4 text-muted/50 shrink-0 mt-0.5" />
                    <span>Tapping tiny spreadsheet cells while walking is infuriating</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconX className="w-4 h-4 text-muted/50 shrink-0 mt-0.5" />
                    <span>Manual exchange-rate formulas frequently break</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconX className="w-4 h-4 text-muted/50 shrink-0 mt-0.5" />
                    <span>Awkward to maintain on a smartphone while on the move</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-subtle text-[11px] font-mono text-muted/70">
                Verdict: Too much friction for daily coffee runs
              </div>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="bg-surface rounded-3xl p-6 sm:p-7 border-2 border-primary-brand shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-primary-brand/10 rounded-full blur-xl pointer-events-none" />

              <div>
                <div className="w-10 h-10 rounded-xl bg-primary-brand/10 border border-primary-brand/20 flex items-center justify-center text-primary-brand mb-4">
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="9" cy="11.5" r="4.2" fill="currentColor" />
                    <circle cx="15" cy="6.5" r="1.8" fill="currentColor" />
                    <path d="M 6 15 A 8 8 0 0 1 15 5.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" strokeOpacity="0.4" />
                  </svg>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-ink" style={{ fontFamily: "var(--font-landing-display), var(--font-space-grotesk), system-ui, sans-serif" }}>
                    Pluto
                  </h3>
                  <span className="text-[10px] font-bold font-mono text-primary-brand uppercase tracking-wider bg-primary-brand/10 px-2 py-0.5 rounded-full border border-primary-brand/20">
                    Built for this
                  </span>
                </div>
                <p className="text-xs text-muted mb-5">Quick entry at the counter. Zero homework.</p>

                <ul className="space-y-3 text-xs text-ink">
                  <li className="flex items-start gap-2">
                    <IconCheck className="w-4 h-4 text-primary-brand shrink-0 mt-0.5" />
                    <span>Shows your home currency estimate right under the foreign price</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="w-4 h-4 text-primary-brand shrink-0 mt-0.5" />
                    <span>Sign in with Google, sync expenses on web and Android</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="w-4 h-4 text-primary-brand shrink-0 mt-0.5" />
                    <span>Daily ECB rates, and every converted figure is dated with the rate it used</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-subtle text-[11px] font-mono text-primary-brand font-bold">
                Verdict: Built specifically for life across borders
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
