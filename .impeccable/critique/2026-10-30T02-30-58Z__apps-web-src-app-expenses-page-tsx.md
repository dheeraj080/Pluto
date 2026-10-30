---
target: the dashboard
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:D:\\project\\pluto\\apps\\web\\src\\app\\expenses\\page.tsx"
target_fingerprint: "sha256:d78b6ab3fda96e1028f1130acb5c98ea8dd77cc0008c108c8852508f8398375d"
target_path: "D:\\project\\pluto\\apps\\web\\src\\app\\expenses\\page.tsx"
timestamp: 2026-10-30T02-30-58Z
slug: apps-web-src-app-expenses-page-tsx
---
# Critique: the dashboard (apps/web/src/app/expenses/page.tsx)

**Target:** apps-web-src-app-expenses-page-tsx
**Method:** dual-agent (A: ses_e755e6c84ffeiNKjPD5RUK0a20 · B: ses_e755e6c82ffeFjWTIsok6jr65U)

## Design Health Score

Operate surface — all 10 Nielsen heuristics apply.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Per-card skeletons, refresh spinner, rate-as-of pill, inline errors exist, but no page-level stale-data indicator and multi-card load states aren't unified. |
| 2 | Match Between System and Real World | 3 | Currency pairs, "left to spend," per-day allowance, and "rates as of" map well; jargon leaks in ("combine currencies," "secondary currency," "provenance"). |
| 3 | User Control and Freedom | 3 | Refresh, retry, swap currencies, range picker, Escape-to-close all work; no undo after saving an expense and no cancel on the add drawer. |
| 4 | Consistency and Standards | 3 | Consistent cards, buttons, focus rings, tabular numerals; blemished by the raw `<input>` in RateConverterCard (not the standard Input component) and the disabled comparison menu. |
| 5 | Error Prevention | 3 | Decimal input mode, clamped progress bar, "—" for nulls, estimated-rate and conversion alerts all prevent misunderstanding; little destructive action here to guard. |
| 6 | Recognition Rather Than Recall | 3 | Date range, rate as-of, category name + color, labels on everything; undercut by the accessible data table being disabled on the comparison chart. |
| 7 | Flexibility and Efficiency of Use | 2 | Range presets + refresh + swap serve speed, but no keyboard accelerators (no add/refresh/switch-pair hotkeys) for power users. |
| 8 | Aesthetic and Minimalist Design | 4 | Restrained graphite + single mint accent, hairline borders, tabular numerals, calm motion; no decoration or gimmicks. Strong. |
| 9 | Error Recognition, Diagnosis, Recovery | 3 | CardError + Retry per card; ConversionAlert explains missing/unavailable currencies; messages are plain but could be more recovery-specific. |
| 10 | Help and Documentation | 2 | Contextual InfoPills exist but no onboarding tour, no documentation link, no help surface beyond hover-reveal tooltips. |
| **Total** | | **29 / 40** | **Good** |

## Design Specificity Verdict

**LLM assessment:** The dashboard is product-specific at the data/voice layer but generic at the chrome layer. Everything that makes it *this* product lives in the currency domain: the base/second Pair switcher, the DualAmount pattern (large base value with small grey second-currency companion), currency-chip category tints instead of flags, the RateAsOfPill and ConversionAlert, estimated-rate honesty, and the per-day "how much is left before the next transfer" allowance in BudgetCard. The warm, plain copy ("Add your first expense", "Choose a currency pair", "Rates as of…") matches the "travel companion, not a bank" positioning, and the dark graphite + mint-emerald palette avoids the never-list (no bank green, no dollar signs, no globes with arrows, no bird silhouettes). But the surrounding machinery — a six-card grid, StatCard/KPI pattern, 3-option segmented range picker, cumulative line chart, empty-state CTA, "Set a budget" prompt — could be lifted unchanged into a generic personal-finance or SaaS usage dashboard. The specificity is in the domain layer and the voice; the layout and primitives are reusable dashboard infrastructure. That's defensible (keep primitives generic, make the domain specific), but an unrelated budgeting product could reuse roughly half of this unchanged.

**Deterministic scan:** 23 findings, all rule `design-system-font-size` ("Font size outside DESIGN.md"), all `severity: advisory`, `category: quality`. The detector flagged non-ramp font sizes across `page.tsx` and its imported sub-components (dashboard-categories, dashboard-rate, dashboard-spending, report-*, budgets, recurring). The detector did not catch the semantic issues (empty grid cell, disabled chart table, contrast risk) — those are design-judgment calls outside a font-size rule's scope.

**Visual overlays:** Browser visualization / overlay injection was not attempted — no browser automation tool is exposed in this session, and no dev server was started. No user-visible overlay is available; the fallback signal is the CLI detector output above.

## Overall Impression

A calm, honest dashboard that answers the student's core job ("how much is left before the next transfer?") within five seconds, anchored by a strong hero card and a restrained graphite + mint-emerald aesthetic. The biggest opportunity is tightening the six-card split into a clearer primary-vs-supporting hierarchy and shipping the accessible chart table that's currently commented out. At 29/40 it's solid but not yet excellent — efficiency (no keyboard shortcuts) and help (no onboarding or docs) are the weakest areas.

## What's Working

1. **The paired-currency display is genuinely specific and usable.** DualAmount (base large + second-currency companion in grey, tabular numerals) appears everywhere — spending, budget, categories, recent rows, converter. It answers the student's actual question ("funded in EUR, spending in USD, what does this look like in both?") without flags or gimmicks, with the second value always secondary, never competing.

2. **Calm, honest treatment of money stress.** Over-budget uses amber rather than red; empty states are friendly invitations; rate unavailability is disclosed with reassurance that recorded amounts are exact; estimates are flagged transparently via InfoPill. For students on semester budgets, this low-pressure tone is a real asset.

3. **Per-card error isolation with graceful degradation.** A failed fetch degrades only its own card (CardError + Retry); the rest of the dashboard stays live; skeletons prevent layout jump. The dashboard never dies wholesale because one aggregate endpoint lagged.

## Priority Issues

**[P0] Empty stat cell in SpendingCard.** What: The Top Category Stat is commented out (dashboard-spending.tsx lines 112–129) while the grid remains `grid-cols-3`, rendering a blank third column beside "Expenses" and "Average." Why it matters: looks unfinished/broken on the dashboard's hero card — the first thing a user sees. Fix: either restore the top-category row (uncomment) or collapse to `grid-cols-2` so no empty cell exists. Suggested command: `$impeccable layout`.

**[P1] Accessible chart data table is disabled.** What: ComparisonCard passes `hideTableToggle` and its "…" options menu (which controlled Table/Second axis) is entirely commented out, so the keyboard-reachable `ChartDataTable` alternative can never be reached. Why it matters: a line chart with no accessible table equivalent on an Operate surface is an accessibility gap and contradicts the component's own intent ("keyboard-reachable, not just screen-reader hidden"). Fix: re-enable the table toggle (and second-axis opt-in) or surface the table another way; remove the dead commented menu. Suggested command: `$impeccable harden`.

**[P2] Contrast risk for muted/secondary text on dark graphite.** What: Small labels (11px), secondary currency amounts, captions, and `text-muted` body text sit on the #0b0c0e canvas. Why it matters: WCAG AA (4.5:1 normal, 3:1 large) is a stated brand commitment; grey-on-graphite at small sizes is the classic failure zone, and it cannot be confirmed without measuring token values. Fix: audit token contrast for `text-muted`, secondary amounts, and axis labels on dark theme; adjust lightness or increase size where below AA. Suggested command: `$impeccable colorize` (or `$impeccable audit` to measure first).

**[P3] Six concurrent cards exceed the ≤4 chunking guideline.** What: The dashboard shows six cards at once. Why it matters: the "five-second" promise relies on ignoring five of them; weaker visual hierarchy for budget/categories/rate means the core per-day answer competes for attention. Fix: reinforce hero hierarchy (already strong on spending) and consider progressive disclosure or a "More" collapse for the two lowest-priority cards on small viewports. Suggested command: `$impeccable layout`.

**[P3] No keyboard accelerators for power users.** What: No hotkeys for add expense, refresh, or pair swap; everything is click-driven. Why it matters: Alex (impatient power user) checks the dashboard repeatedly; mouse-only interaction slows the core loop. Fix: add keyboard shortcuts (e.g., `a` for add, `r` for refresh, modifier for pair swap) with discoverable hints. Suggested command: `$impeccable optimize`.

## Persona Red Flags

### Alex — Impatient Power User (primary)
Primary action: check "how much left," add an expense, swap the pair, refresh — fast, repeatedly.
- **No keyboard shortcuts.** Every action (add expense, refresh, swap pair, change range) requires a click; no hotkeys for the highest-frequency loop.
- **Refresh is button-only.** No pull-to-refresh, keyboard trigger, or affordance beyond the header Refresh button.
- **Per-day allowance is in BudgetCard, right column.** Not adjacent to the "Spent this month" hero, so the two halves of the core answer are spatially split.
- **Comparison range locked to 3 presets.** No custom date range on the dashboard; power users wanting a specific window must navigate to Reports.
- **Converter is a blank text field.** No quick chips (100 / 500 / 1000) for common amounts; must type each time.
- **Add expense opens a drawer.** Extra interaction layer rather than inline fast-add.

### Sam — Accessibility-Dependent User (primary)
Primary action: perceive card status, operate by keyboard/screen reader, verify converted figures.
- **Muted text contrast unverified.** Small grey labels (11px), secondary amounts, axis text on #0b0c0e may fail WCAG AA — cannot be confirmed without token measurements.
- **Accessible chart table disabled.** ComparisonChart's `ChartDataTable` fallback is unreachable (`hideTableToggle` + commented menu); a screen-reader user has no table equivalent for the line chart.
- **`srTable` prop unused on all dashboard cards.** The screen-reader table mechanism in ChartFrame exists but is never wired, so charts lack an SR-only data alternative.
- **InfoPill popover has no focus trap / no return focus.** `role="dialog"` popovers (estimated-rate detail, rate as-of) can trap or lose keyboard focus.
- **RateConverterCard uses a raw `<input>` with `aria-label` only.** Not the standard `Input`/`Field` component; no visible label, inconsistent with the rest of the form system.
- **Limited live regions.** Only the converter output uses `aria-live="polite"`; card load/error transitions are not announced.

### Jordan — Confused First-Timer (secondary)
Primary action: understand what the dashboard shows and make the first entry.
- **Empty state only at page level.** Card-level empties ("Category breakdowns need a rate to combine currencies") are technical and explain implementation, not what to do next.
- **"Set a currency pair" in PairSwitcher assumes domain knowledge.** A first-timer may not know what a "pair" is or that it lives in Settings.
- **No onboarding or tour.** First visit shows either an empty state or live data with no explanation of Base vs. Second, or what "vs last month" green means.
- **Estimated-rate caveat behind an InfoPill click.** Jordan may not realize some figures are approximate unless they discover and open the pill.
- **"Combine currencies" / "provenance" copy.** Slightly technical phrasing in empty and notice states that doesn't match the otherwise plain voice.

## Minor Observations

- The commented-out Top Category stat leaves a visible empty grid cell (P0 above).
- The entire comparison options menu (table toggle, second axis) is commented-out dead code — either ship it or remove it; don't leave it in the source.
- RateConverterCard uses a raw `<input type="text" inputMode="decimal">` instead of the standard `Input` component — minor inconsistency.
- `formatMoney` relies on runtime `Intl` locale; all dashboard rendering is client-side so hydration mismatch risk is low, but worth noting if server rendering is added later.
- The `order-*` classes on cards (`order-1`…`order-6`) are scoped within separate flex-column containers, so they don't cause cross-column reflow — functionally fine, though the naming suggests a more global reordering intent than exists.

## Questions to Consider

1. Is six cards really the right "five-second" answer? Would collapsing categories and rate behind a "More" affordance improve focus on the core job ("how much left before next transfer?") without hiding value?
2. The comparison menu and second-axis toggle are commented out — ship decision or abandoned work? If the accessible table is the mandated fallback for charts, shipping it disabled contradicts the accessibility commitment.
3. Is "left to spend" prominent enough? For a student whose job is "how much before next transfer?", that answer lives in BudgetCard (right column) while the hero headline is total spent. Should "left to spend" be co-equal with — or replace — "spent this month" as the hero?
4. Has dark graphite + mint-emerald actually been measured for WCAG AA at small sizes? The brand commits to AA, but 11px labels and secondary amounts on #0b0c0e are the classic failure zone. Is the commitment backed by token measurements, or aspirational?
