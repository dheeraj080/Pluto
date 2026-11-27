---
name: Pluto
description: Nordic Fintech multi-currency expense tracker, converter, and runway manager for international students, expats, and travelers.
colors:
  brand-cobalt: "#1D4ED8"
  brand-cobalt-light: "#60A5FA"
  brand-cobalt-dark: "#1E40AF"
  brand-cobalt-subtle: "#DBEAFE"
  fjord-teal: "#0D9488"
  fjord-teal-dark: "#0F766E"
  fjord-teal-subtle: "#CCFBF1"
  nordic-crimson: "#DC2626"
  nordic-crimson-subtle: "#FEE2E2"
  arctic-amber: "#D97706"
  arctic-amber-subtle: "#FEF3C7"
  light-background: "#F4F6FA"
  light-surface: "#FFFFFF"
  light-surface-elevated: "#EAF0F7"
  light-text-primary: "#0F172A"
  light-text-secondary: "#475569"
  light-text-muted: "#94A3B8"
  light-border: "#D8E1EE"
  light-border-subtle: "#E8EEF7"
  dark-background: "#0B101B"
  dark-surface: "#131A29"
  dark-surface-elevated: "#1B2438"
  dark-text-primary: "#F1F5F9"
  dark-text-secondary: "#94A3B8"
  dark-text-muted: "#64748B"
  dark-border: "#222E44"
  dark-border-subtle: "#192234"
typography:
  display:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "38sp"
    fontWeight: 700
    lineHeight: "44sp"
    letterSpacing: "-0.5sp"
  headline:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "28sp"
    fontWeight: 700
    lineHeight: "34sp"
    letterSpacing: "-0.2sp"
  title:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "18sp"
    fontWeight: 600
    lineHeight: "24sp"
    letterSpacing: "0sp"
  body:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "15sp"
    fontWeight: 400
    lineHeight: "22sp"
    letterSpacing: "0.15sp"
  label:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "13sp"
    fontWeight: 600
    lineHeight: "18sp"
    letterSpacing: "0.2sp"
  numeric:
    fontFamily: "Roboto Mono"
    fontFeature: "tnum"
rounded:
  xs: "4dp"
  sm: "6dp"
  md: "10dp"
  lg: "14dp"
  xl: "20dp"
spacing:
  xxs: "2dp"
  xs: "4dp"
  sm: "8dp"
  md: "12dp"
  lg: "16dp"
  xl: "20dp"
  xxl: "24dp"
  xxxl: "32dp"
  huge: "48dp"
components:
  button-primary:
    backgroundColor: "{colors.brand-cobalt}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.md}"
    padding: "12dp 16dp"
  button-secondary:
    backgroundColor: "{colors.light-surface-elevated}"
    textColor: "{colors.light-text-primary}"
    rounded: "{rounded.md}"
    padding: "12dp 16dp"
  card-default:
    backgroundColor: "{colors.light-surface}"
    borderColor: "{colors.light-border}"
    rounded: "{rounded.lg}"
    padding: "12dp"
  currency-badge:
    backgroundColor: "{colors.brand-cobalt-subtle}"
    textColor: "{colors.brand-cobalt-dark}"
    rounded: "{rounded.sm}"
    padding: "4dp 8dp"
---

# Design System: Pluto

> **Platform Adaptation Note**: Pluto is a native Android **Kotlin + Jetpack Compose + Material 3** application. This file is the visual-system authority; apply it alongside standard Material 3 and Compose platform conventions when designing, auditing, or editing UI code.

## Overview

**Creative North Star: "Nordic Precision Financial Instrument"**

Pluto is designed as a calm, architectural multi-currency instrument for people living, studying, and traveling across currencies. Light mode pairs a Soft Ice Gray canvas (`#F4F6FA`) with pure white bordered cards (`#FFFFFF`), while dark mode anchors on deep Nordic Midnight (`#0B101B`) with slate-navy surfaces (`#131A29`), tabular monospace figures, and disciplined **Nordic Cobalt** accents (`#1D4ED8` light / `#60A5FA` dark).

The interface operates primarily in **Operate** mode: instant scanability of available balance alongside daily Safe-to-Spend and cycle runway, zero-jitter `tnum` typography, crisp `1.dp` structural borders (`0.dp` shadow elevation), and effortless thumb reach.

**Key Characteristics:**
- **Nordic Cobalt & Soft Ice Gray**: Cool ice-gray canvas separation (`#F4F6FA`) lets crisp `#FFFFFF` instrument cards read cleanly without drop shadows; dark mode switches to Nordic Midnight (`#0B101B`) and `#131A29`.
- **Unified Runway Hero & Action Dock (Home)**: A single Unified Runway Hero Card stacks the total multi-currency balance band above a 2-column split of **Safe-to-Spend Today** and **Cycle Runway** (concentric `PlutoShapes.small` inner tiles), followed by a 4-tile Tactile Action Dock (`Expense`, `Income`, `Wallets`, `Convert`), Spending Velocity Trend, and Collapsible Category & Ledger sections.
- **Single-Scroll Story (Insights)**: An editorial financial narrative flowing top-to-bottom: Period Selector -> **Spend Pulse Bento** (Total Spent Cobalt card + Daily Burn Rate & Avg Expense 2-up row) -> Velocity Over Time curve -> Interactive Category Donut & Ranked Breakdown -> Cross-Border Currency Exposure with proportional share bars -> Highest Expenses & Export Statement Dock.
- **Dual-Currency & Tabular Discipline**: Every amount renders in `RobotoMonoFontFamily` with `fontFeatureSettings = "tnum"` (`PlutoNumericStyle`), anchoring destination currency primary and home currency secondary.
- **Native Material 3 Ergonomics**: `enableEdgeToEdge()`, adaptive `NavigationSuiteScaffold`, `48.dp` minimum touch targets, TalkBack `plutoHeading()` landmarks, and reduced-motion-safe Compose transitions.

## Colors

Pluto restricts chromatic intensity to purposeful brand highlights and semantic financial signals while keeping structural surfaces cool, calm, and high-contrast.

### Primary
- **Nordic Cobalt (`#1D4ED8` light / `#60A5FA` dark)**: Primary brand action color, active selections, focus borders, and key conversion highlights (`MaterialTheme.colorScheme.primary`).
- **Deep Cobalt (`#1E40AF`) & Ice Cobalt Tint (`#DBEAFE` light / `#172554` dark)**: `primaryContainer` and `onPrimaryContainer` pairings for currency badges, active filter chips, and Dual-Zone Clock offset pills.

### Secondary
- **Fjord Teal (`#0D9488` light / `#2DD4BF` dark, Dark `#0F766E`, Subtle `#CCFBF1` light / `#134E4A` dark)**: Positive savings deltas, healthy runway pacing, and incoming wallet deposits (`MaterialTheme.colorScheme.secondary`).

### Tertiary & Semantic Alerts
- **Arctic Amber (`#D97706` light / `#FBBF24` dark, Subtle `#FEF3C7` light / `#78350F` dark)**: Safe-to-spend threshold alerts, runway caution states, and daytime indicator icons (`MaterialTheme.colorScheme.tertiary`).
- **Nordic Crimson (`#DC2626` light / `#F87171` dark, Subtle `#FEE2E2` light / `#7F1D1D` dark)**: Destructive actions, overspend warnings, and expense outflow signals (`MaterialTheme.colorScheme.error`).

### Neutral
- **Light Theme**: Soft Ice Gray canvas (`#F4F6FA`), crisp Pure White card surface (`#FFFFFF`), Ice Elevated (`#EAF0F7`), Onyx primary ink (`#0F172A`), Slate secondary (`#475569`), muted slate (`#94A3B8`), hairline Ice border (`#D8E1EE`), subtle divider (`#E8EEF7`).
- **Dark Theme**: Nordic Midnight canvas (`#0B101B`), Slate-Navy card surface (`#131A29`), Elevated Midnight (`#1B2438`), crisp white primary ink (`#F1F5F9`), Slate secondary (`#94A3B8`), muted slate (`#64748B`), Midnight border (`#222E44`), subtle divider (`#192234`).

### Named Rules
- **The Role-Token Rule.** Always reference `MaterialTheme.colorScheme.*` in Composables (or documented semantic constants like `BrandCobalt`, `FjordTeal`, `ArcticAmber`, `NordicCrimson`). Never hardcode raw hex strings inside screen Composables.
- **The 10% Accent Discipline.** Nordic Cobalt signals primary interaction and selected state—keep structural cards, lists, and headers neutral white/midnight so cobalt CTAs and Fjord Teal/Arctic Amber status cues read immediately.

## Typography

**Display & UI Font:** `ManropeFontFamily` (bundled locally in `res/font/manrope.ttf`, weights 400–800)<br>
**Numeric & Monospace Font:** `RobotoMonoFontFamily` (bundled locally in `res/font/roboto_mono.ttf`, `fontFeatureSettings = "tnum"` via `PlutoNumericStyle`)<br>
**Character:** Crisp geometric `Manrope` paired with engineered tabular alignment in `Roboto Mono` so balances, exchange rates, and live dual-zone clocks never jump horizontally as digits change.

### Hierarchy (`ui/theme/Type.kt`)
- **Display** (`displayLarge` 38.sp / 44.sp Bold, `-0.5.sp` tracking; `displayMedium` 32.sp / 38.sp Bold): Hero balance totals and primary converter outputs (merged with `PlutoNumericStyle` for numbers).
- **Headline** (`headlineLarge` 28.sp / 34.sp Bold; `headlineMedium` 24.sp / 30.sp SemiBold; `headlineSmall` 20.sp / 26.sp SemiBold): Screen headers, onboarding steps, and major section KPIs.
- **Title** (`titleLarge` 18.sp / 24.sp SemiBold; `titleMedium` 15.sp / 22.sp SemiBold; `titleSmall` 13.sp / 18.sp Medium): Card titles, section headers (`Modifier.plutoHeading()`), top bar titles, and clock readouts.
- **Body** (`bodyLarge` 15.sp / 22.sp; `bodyMedium` 13.sp / 18.sp; `bodySmall` 11.sp / 15.sp): Transaction descriptions, hints, empty-state guidance, and secondary currency conversions.
- **Label** (`labelLarge` 13.sp / 18.sp SemiBold; `labelMedium` 11.sp / 16.sp Medium; `labelSmall` 10.sp / 14.sp Medium): Button labels, navigation labels, category pills, and `LOCAL` / `HOME` clock prefixes.

### Named Rules
- **The Tabular Numeric Rule.** Every currency amount, rate, percentage, and live time value MUST merge `PlutoNumericStyle` (`RobotoMonoFontFamily` + `"tnum"`) with `maxLines = 1` and explicit overflow handling (`TextOverflow.Ellipsis` or `softWrap = false` where appropriate).
- **The System Scale Rule.** Specify all type sizes in `.sp`, avoid fixed-height text containers that clip at `font_scale = 1.3`, and verify wrap/truncation behavior on narrow viewports.

## Layout

Pluto builds on a strict `4.dp` / `8.dp` spatial grid defined in `PlutoSpacing` (`xxs = 2.dp`, `xs = 4.dp`, `sm = 8.dp`, `md = 12.dp`, `lg = 16.dp`, `xl = 20.dp`, `xxl = 24.dp`, `xxxl = 32.dp`, `huge = 48.dp`).

- **Adaptive Navigation**: `MainAppShell` uses Material 3 `NavigationSuiteScaffold` (`currentWindowAdaptiveInfo()`) to switch seamlessly from bottom `NavigationBar` on compact screens to side `NavigationRail` on medium/expanded screens across the 4 top-level destinations (`Home`, `Expenses`, `Budgets`, `Insights`). Secondary flows (`Converter`, `Wallets`, `WalletDetail`, `Settings`, `CurrencyPicker`) hide the navigation bar/rail cleanly.
- **Responsive Width Bounds**: Constrain wide form/hero content (e.g., `widthIn(max = 600.dp)` or `widthIn(max = 840.dp)`) centered horizontally so tablet layouts stay readable without stretching.
- **Edge-to-Edge & Insets**: `MainActivity` enables `enableEdgeToEdge()`; scaffolds and custom bottom sheets/bars respect `WindowInsets` (`safeDrawing`, `navigationBars`, `ime`).

## Elevation

Pluto uses a **flat, hairline-bordered tonal elevation model** rather than heavy drop shadows:
- Cards rest at `0.dp` shadow elevation with a crisp `1.dp` `BorderStroke` (`MaterialTheme.colorScheme.outline` or `outlineVariant`) over Pure White `surface` (`#FFFFFF` light / `#131A29` dark) against the Soft Ice Gray / Nordic Midnight `background` (`#F4F6FA` light / `#0B101B` dark).
- Nested metrics and chips step softly via `surfaceVariant` (`#EAF0F7` light / `#1B2438` dark) or `primaryContainer` tinting rather than stacked gray shadows.

## Shapes

Defined centrally in `PlutoShapes` (`ui/theme/Shape.kt`):
- `extraSmall` (`4.dp`): Compact status/delta badges.
- `small` (`6.dp`): `CurrencyBadge`, Dual-Zone Clock offset pills, compact chips, concentric split tiles inside the Unified Runway Hero Card.
- `medium` (`10.dp`): `PlutoButton`, `PlutoMetricTile`, `CurrencyRow`, `OutlinedTextField`, Tactile Action Dock tiles.
- `large` (`14.dp`): Standard `PlutoCard` containers, `DualZoneClockHeaderChip`, story cards.
- `extraLarge` (`20.dp`): `UnifiedRunwayHeroCard` shell, category chart card, empty-state artwork frames, modal sheets.

**The Concentric Radius Rule.** Whenever a padded parent container nests rounded child tiles with an even inset (`<= 24.dp`), keep `outerRadius = innerRadius + padding` (for example, `20.dp` `extraLarge` hero shell with `14.dp` padding enclosing `6.dp` `small` inner split tiles).

## Components

### Buttons & Action Dock (`PlutoButton`, `PrimaryActionButton`, `FintechQuickActionStrip`)
- **Shape**: `PlutoShapes.medium` (`10.dp`).
- **Dimensions**: `48.dp` height (`PRIMARY`, `SECONDARY`, `OUTLINED`, `DESTRUCTIVE`) or `minimumInteractiveComponentSize()` (`GHOST`).
- **Home Action Dock**: 4 tactile tiles (`Expense`, `Income`, `Wallets`, `Convert`) with `1.dp` border (`0.dp` shadow), rounded icon badge, and >= `48.dp` touch target.
- **Motion & Feedback**: `plutoPressableScale` (`0.96f` scale over `150.ms` `FastOutSlowInEasing`), Material ripple, `20.dp` `CircularProgressIndicator` when `isLoading = true`, disabled buttons never scale.

### Cards (`PlutoCard`, `PlutoMetricTile`, `UnifiedRunwayHeroCard`)
- **Shape**: `PlutoShapes.large` (`14.dp`) for content cards, `PlutoShapes.extraLarge` (`20.dp`) for `UnifiedRunwayHeroCard`.
- **Surface & Border**: `MaterialTheme.colorScheme.surface` with `1.dp` `outline` border, `0.dp` elevation.
- **Unified Runway Hero Card**: Top multi-currency balance band (`unified_hero_balance_card`) paired cleanly above two concentric split tiles (`unified_hero_safe_to_spend_card` and `unified_hero_runway_card`).
- **Interaction**: Clickable cards apply `PlutoMotion.CardPressScale` (`0.985f`) gated behind `rememberPrefersReducedMotion()`.

### Chips, Badges & Dual-Zone Clock (`CurrencyBadge`, `DualZoneClockHeaderChip`)
- **CurrencyBadge**: `PlutoShapes.small` (`6.dp`), `primaryContainer` fill, `0.5.dp` `primary.copy(alpha = 0.25f)` border, flag + uppercase bold ISO code.
- **DualZoneClockHeaderChip**: `PlutoShapes.large` (`14.dp`), `surface`, `1.dp` `outline` border, `minimumInteractiveComponentSize()`, `LOCAL · City` + `PlutoNumericStyle` time on left, offset + day-rollover pill centered, `HOME · City` + sun/moon icon (`ArcticAmber` / `BrandCobalt`) on right.

### Headers, Sheets & Inputs (`PlutoTopBar`, `SectionHeader`, `HomeTimeZonePickerSheet`)
- **SectionHeader**: `Modifier.plutoHeading()` on title for TalkBack navigation; optional `48.dp x 48.dp` minimum action target with ripple and press scale.
- **Modal Bottom Sheets**: `ModalBottomSheet` with `containerColor = MaterialTheme.colorScheme.surface`, `OutlinedTextField` (`PlutoShapes.medium`), `FilterChip` (`minimumInteractiveComponentSize()`), and clear `Close` / back navigation.

## Do's and Don'ts

- **Do** use `MaterialTheme.colorScheme`, `PlutoShapes`, `PlutoSpacing`, `PlutoMotion`, and `PlutoNumericStyle` from `ui/theme/`.
- **Do** enforce `minimumInteractiveComponentSize()` (`>= 48.dp`), `testTag(...)` (`snake_case`), `contentDescription`, and `plutoHeading()` on all new interactive Composables.
- **Do** gate every movement/scale animation behind `rememberPrefersReducedMotion()` and use `PlutoMotion.NoBounceSpring` (`DampingRatioNoBouncy`).
- **Do** place user-facing strings in `app/src/main/res/values/strings.xml` and format dual-currency rows with destination primary and home secondary.
- **Don't** emit web CSS, HTML, Tailwind, `oklch()`, or iOS/Cupertino widgets (`CupertinoSwitch`, bottom-only tablet bars) in Android UI code.
- **Don't** hardcode hex colors or raw `.dp` magic spacing numbers when a `PlutoSpacing` or `MaterialTheme.colorScheme` token exists.
- **Don't** omit `tnum` (`PlutoNumericStyle`) on amounts, rates, deltas, or live time readouts.
- **Don't** introduce drop shadows or electric-violet tokens that break the Nordic Cobalt & Soft Ice Gray hairline elevation model.
