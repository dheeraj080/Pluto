# Product

<!-- impeccable:product-schema 1 -->

## Platform
android

## Users
Pluto serves three primary cross-border audiences managing money across countries and currencies:
- **International Students**: Managing multi-month semester allowances, tuition commitments, housing/books, and daily discretionary safe-to-spend limits across currencies.
- **Expats & Remote Workers**: Tracking monthly paydays, recurring local living costs, remittances, and multi-currency balances.
- **Short-Term Spenders**: Monitoring fixed-period budgets, day-by-day primary-currency spending, live FX conversion, and reference-zone time awareness.

## Product Purpose
Pluto is a multi-currency expense tracker, live/offline currency converter, and budget runway manager that lets users spend confidently in a primary spending currency while always understanding the real impact in their reference currency.

## Positioning
Unlike single-currency expense apps or generic splitters, Pluto is built around **dual-currency truth** (the actually-spent currency plus the immutable reference snapshot on every transaction, with primary and reference currencies shown together on aggregate totals), **horizon-aware runway pacing** (academic semester, monthly payday, or fixed period), and **offline-first durability** backed by Room + optional Google Sign-In Cloud Firestore sync.

## Operating Context
- **Mobile & Tablet Android, Android-only** (no iOS or web target; Firebase Android app registered as `com.pluto.app`; `minSdk 24`, `compileSdk 36`, Jetpack Compose + Material 3 `NavigationSuiteScaffold` adapting between bottom `NavigationBar` on phones and `NavigationRail` on expanded screens).
- **On-the-go multi-currency usage**: Checked in bright daylight at cafes/transit, with intermittent connectivity (cached/offline FX rates), and across time zones (Dual-Zone Clock comparing live device-local time with the reference zone derived from the reference currency by default; a custom city is stored only when it differs from that default and is cleared when the reference currency changes. Time-zone settings sync is local-wins/manual: sign-in reconciles once and there is no realtime settings observer).
- **Theme support**: System, Light, and Dark modes as first-class experiences.

## Capabilities and Constraints
- **Core modules**:
  - Home Dashboard with stacked wallet hero cards (Unified Balance, Safe-to-Spend daily cap, Semester/Fixed-Period Runway), Dual-Zone Clock chip + searchable Reference Time Zone picker sheet (currency-aware cities; unmapped currencies show "no default" and require a city choice), quick actions, and unified transaction stream.
  - Multi-Currency Wallets (create, edit, deposit, withdraw, inter-wallet FX transfer, portfolio valuation).
  - Expenses & Recurring Expenses (primary/reference currency dual entry, category/date and custom-range filters, audit timestamps, category budgets, edit/delete bottom sheets).
  - Currency Converter with an arithmetic expression evaluator and live/cached market FX rates. Historical comparisons use strict date-matched rates.
  - Budgets & Insights (category progress, safe-to-spend threshold alerts, breakdown charts).
  - Security, Privacy & Portability (Biometric lock with configurable timeout, Privacy Mode `FLAG_SECURE`, JSON backup/restore, optional Google Sign-In via Jetpack Credential Manager + Cloud Firestore real-time sync or Offline Local Vault mode).
- **Technical constraints**:
  - Kotlin + Jetpack Compose + Material 3 exclusively (no web/CSS/DOM layer).
  - Firebase Auth + Cloud Firestore are the only sign-in/data backend; the Pluto NestJS API in `apps/server` is deliberately not called. Deferred integration needs parallel Firebase Auth or exchanging the Google ID token with both Firebase and `POST /v1/auth/google`; the server has no wallets, wallet ledger, dual-currency expense fields, or persona/term settings, and restore, realtime merge, and unsupported native features need explicit decisions before Firebase is removed.
  - All user-facing copy belongs in `app/src/main/res/values/strings.xml` or structured domain labels; all interactive Compose elements must maintain `testTag` identifiers (`snake_case`) and `>= 48.dp` touch targets.
  - Platform rules follow Material 3 and Jetpack Compose conventions; the Pluto-specific visual system is captured in `DESIGN.md`.

## Brand Commitments
- **Name**: Pluto
- **Tone**: Calm, crisp, trustworthy Swiss Fintech clarity — concise labels, zero hype, transparent numbers.
- **Visual System Authority**: Documented in `DESIGN.md` and implemented in `app/src/main/java/com/pluto/app/ui/theme/` (`Color.kt`, `Type.kt`, `Shape.kt`, `Spacing.kt`, `Motion.kt`, `Theme.kt`).

## Evidence on Hand
- Native design token system (`app/src/main/java/com/pluto/app/ui/theme/`) and reusable UI primitives (`app/src/main/java/com/pluto/app/ui/components/SharedComponents.kt`).
- Bundled local typography assets in `app/src/main/res/font/` (`manrope.ttf`, `roboto_mono.ttf`).
- Robolectric + Compose UI test suite in `app/src/test/`, Firebase Auth/Firestore emulator tests, Firestore rules tests (`firestore.test.js`), and `.github/workflows/android.yml` CI running unit tests, emulator tests, and a debug build on every push touching `apps/mobile`.

## Product Principles
1. **Dual-Currency Clarity First**: Always show primary transaction context alongside its reference-currency anchor so users never guess what a purchase costs.
2. **Tabular Financial Precision**: Every currency amount, FX rate, percentage, and live clock readout aligns cleanly in `tnum` monospace without layout jitter.
3. **Offline-First Resilience**: Local Room persistence and cached FX rates remain 100% functional without network access; cloud sync merges cleanly when signed in.
4. **Horizon-Paced Control**: Surface safe-to-spend runway and cap warnings early without noisy alarmism.
5. **Respect System Ergonomics**: Honor edge-to-edge insets, predictive/system Back, `sp` font scaling, TalkBack semantics, and Android reduced-motion settings.

## Accessibility & Inclusion
- Minimum `48.dp x 48.dp` touch targets (`minimumInteractiveComponentSize()`) across all clickable chips, icon buttons, and controls.
- TalkBack `contentDescription` on meaningful icons/images and `semantics { heading() }` (`plutoHeading()`) on section titles.
- System font-scale resilience (`sp` typography, single-line overflow handling on tabular values, responsive rows).
- Reduced-motion support (`rememberPrefersReducedMotion()` reading `Settings.Global.ANIMATOR_DURATION_SCALE`).
