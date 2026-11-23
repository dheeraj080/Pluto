---
name: Pluto
description: Multi-currency expense tracker — spend in any currency, understand it in yours. The signed-in app uses the Graphite Ledger register; the public landing route uses Folded Margin.
colors:
  graphite-deep: "#0b0c0e"
  graphite-surface: "#131518"
  graphite-surface-muted: "#1b1e22"
  graphite-ink: "#f2f4f5"
  graphite-muted: "#a4abb2"
  border-hairline: "rgba(255, 255, 255, 0.07)"
  border-strong: "rgba(255, 255, 255, 0.14)"
  mint-emerald: "#34d399"
  mint-emerald-hover: "#10b981"
  mint-emerald-active: "#059669"
  mint-emerald-subtle: "rgba(52, 211, 153, 0.12)"
  on-mint-emerald: "#05130d"
  warm-gold: "#fbbf24"
  warm-gold-subtle: "rgba(251, 191, 36, 0.14)"
  alert-red: "#f87171"
  alert-red-hover: "#fca5a5"
  alert-red-solid: "#b91c1c"
  alert-red-solid-hover: "#991b1b"
  alert-red-subtle: "rgba(248, 113, 113, 0.14)"
  on-alert-red: "#2a0808"
  focus-ring: "#34d399"
  glow: "rgba(255, 255, 255, 0.06)"
  glow-strong: "rgba(255, 255, 255, 0.1)"
  cat-mint: "#34d399"
  cat-sky: "#7dd3fc"
  cat-amber: "#fcd34d"
  cat-rose: "#fda4af"
  cat-violet: "#c4b5fd"
  cat-slate: "#94a3b8"
  folded-paper: "#f2eee3"
  folded-paper-deep: "#e8e2d4"
  folded-ink: "#1c2b33"
  folded-muted: "#4f6169"
  folded-rule: "#3e6478"
  folded-rule-soft: "rgba(62, 100, 120, 0.28)"
  folded-tab: "#b23f24"
  folded-tab-text: "#9f351d"
  folded-tab-bright: "#c54a2c"
  folded-night: "#0a1115"
  folded-night-raised: "#17262d"
  folded-on-night: "#f4f0e6"
  folded-on-night-muted: "#d7d3c8"
  folded-focus: "#c54a2c"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontWeight: 600
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontWeight: 400
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontWeight: 500
    fontSize: "0.875rem"
    letterSpacing: "0.025em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontWeight: 400
  folded-display:
    fontFamily: "Barlow Condensed Local, Arial Narrow, sans-serif"
    fontWeight: 700
    fontSize: "clamp(3.1rem, 5.4vw, 5.4rem)"
    lineHeight: 0.96
    letterSpacing: "-0.025em"
  folded-heading:
    fontFamily: "Barlow Condensed Local, Arial Narrow, sans-serif"
    fontWeight: 700
    fontSize: "clamp(2.2rem, 3.6vw, 3.5rem)"
    lineHeight: 1.01
    letterSpacing: "-0.02em"
  folded-body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontWeight: 400
    fontSize: "1rem"
    lineHeight: 1.72
  folded-mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontWeight: 400
    fontSize: "0.72rem"
    letterSpacing: "0.06em"
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  "2xl": "1rem"
  "3xl": "1.5rem"
  full: "9999px"
  none: "0"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  folded-section: "clamp(4.375rem, 8vw, 7.375rem)"
components:
  button-primary:
    backgroundColor: "{colors.mint-emerald}"
    textColor: "{colors.on-mint-emerald}"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1.25rem"
    size: "md"
  button-primary-hover:
    backgroundColor: "{colors.mint-emerald-hover}"
    textColor: "{colors.on-mint-emerald}"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1.25rem"
    size: "md"
  button-primary-active:
    backgroundColor: "{colors.mint-emerald-active}"
    textColor: "{colors.on-mint-emerald}"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1.25rem"
    size: "md"
  button-secondary:
    backgroundColor: "{colors.graphite-surface-muted}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1rem"
    size: "md"
  button-ghost:
    textColor: "{colors.graphite-muted}"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1rem"
    size: "md"
  button-danger:
    backgroundColor: "{colors.alert-red-solid}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1rem"
    size: "md"
  input:
    backgroundColor: "{colors.graphite-surface-muted}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.xl}"
    padding: "0.625rem 0.875rem"
    size: "sm"
  chip:
    backgroundColor: "{colors.graphite-surface-muted}"
    textColor: "{colors.graphite-muted}"
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
    size: "xs"
  card:
    backgroundColor: "{colors.graphite-surface}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  landing-action:
    backgroundColor: "{colors.folded-paper}"
    textColor: "{colors.folded-ink}"
    rounded: "{rounded.none}"
    padding: "0.85rem 0.95rem"
  landing-action-android:
    backgroundColor: "{colors.folded-ink}"
    textColor: "{colors.folded-on-night}"
    rounded: "{rounded.none}"
    padding: "0.85rem 0.95rem"
  landing-fold-leaf:
    backgroundColor: "{colors.folded-paper}"
    textColor: "{colors.folded-ink}"
    rounded: "{rounded.none}"
    padding: "clamp(1.1rem, 2vw, 1.8rem)"
  landing-preset:
    backgroundColor: "transparent"
    textColor: "{colors.folded-ink}"
    rounded: "{rounded.none}"
    padding: "0.35rem 0.7rem"
---
# Design System: Pluto

## Overview

**Creative North Star: "Two registers, one truth — the Graphite Ledger and the Folded Margin."**

The signed-in product remains the Graphite Ledger: calm, precise, low-pressure, with graphite tonal layers, hairlines, and one mint-emerald accent for functional emphasis. The public landing route is Folded Margin: a traveller's paper spread where the foreign price sits in the outer margin and one fold reveals the home figure in the crease. It is ruled, folioed, stitched, and square-cornered, with vermilion reserved for fold tabs, rate marks, and focus.

Both registers share the same discipline: tabular money figures, plain language, visible focus, and motion that collapses under `prefers-reduced-motion`. Landing figures are labelled illustrative; the app remains the source of truth.

**Key Characteristics:**
- App: near-black graphite canvas with a single mint-emerald accent and hairline tonal layering.
- Landing: uncoated paper ground, deep ink, rule blue, one vermilion fold accent.
- Landing first viewport: two-leaf paper spread, stitched gutter, rate stamp, two equal action plaques.
- Money figures are tabular in both registers.
- Landing surfaces are square; app surfaces use the existing rounded scale.
- Light and dark are use-scene choices: desk paper and night desk, not category defaults.

## Colors

Two scoped palettes; never mix their accents inside one register.

### Primary
- **Mint Emerald** (#34d399): app CTAs, brand mark, active and positive states, key converted numbers. Pairs with near-black on-mint-emerald (#05130d).
- **Fold Vermilion** (#c54a2c): landing fold tabs, arrows, active markers, focus rings, and the one emphasis on the converted figure. Text on paper uses the darker #9f351d for AA contrast.
- **Fold Ink** (#1c2b33): landing headings, body text, and dark plaques.

### Secondary
- **Rule Blue** (#3e6478): landing hairlines, ruled paper lines, and panel borders.
- **Warm Gold** (#fbbf24): app warning and gold-tone state only.

### Tertiary
- **Night Desk** (#0a1115): landing dark surfaces for plaques, close section, and footer.
- **Category palette**: app chart and chip tones only (mint, sky, amber, rose, violet, slate).

### Neutral
- **Graphite Deep / Surface / Surface Muted** (#0b0c0e / #131518 / #1b1e22): app canvas and layered containers.
- **Graphite Ink / Muted** (#f2f4f5 / #a4abb2): app text and secondary text.
- **Folded Paper / Paper Deep** (#f2eee3 / #e8e2d4): landing ground and inset leaf.
- **Folded Muted** (#4f6169): landing secondary text; switches to #b8c2c4 on the night desk.
- **On Night / On Night Muted** (#f4f0e6 / #d7d3c8): text on landing dark surfaces.

### Named Rules
**The One Accent Per Register Rule.** Mint-emerald is the only bright accent in the app; vermilion is the only bright accent on the landing route. Neither becomes a wash, glow, or decorative halo.

**The Fold Rule.** Vermilion marks a fold, a rate, an active state, or focus. It never becomes body copy.

## Typography

**Display Font:** app — Space Grotesk; landing — locally self-hosted Barlow Condensed (with Arial Narrow fallback).
**Body Font:** app — Inter; landing — system UI stack.
**Label/Mono Font:** Geist Mono for app technical data and landing rates, folios, and measurements.

**Character:** The app pairing is clean and rational. The landing pairing is compressed and printed: tall display lettering for the folded-page headline, workmanlike system text for explanation, and monospaced stamps for rates and folios.

### Hierarchy
- **Display** (700, clamp 3.1–5.4rem, 0.96 line-height): landing hero and close headline.
- **Headline / Heading** (700, clamp 2.2–3.5rem, 1.01 line-height): landing section headings.
- **Title** (600, app scale): app page headers.
- **Body** (400, 1rem, 1.72 line-height): landing prose, max 65–75ch; app body unchanged.
- **Label** (500, 0.875rem, letter-spaced): app table headers and form labels.
- **Fold Label** (400, ≥0.7rem, 0.06em letter-spacing): landing folios, rate kind, route notes, and slider label; never below 11px.

### Named Rules
**The Tabular Rule.** Every money figure uses tabular numerals, in Inter or Geist Mono in the app and Barlow Condensed or Geist Mono on the landing page.

## Layout

The app keeps its existing shell: top header, scrollable content, Tailwind breakpoints, and deep-linked report filters.

The landing route is a route-scoped grid. The hero is two columns above 1100px (copy left, paper spread right) and one column below. The paper spread itself is three columns above 760px (outer leaf, gutter, folded leaf) and stacks below 760px. Sections use a margin-folio column of 96–140px beside a 980px content column; the folio column collapses below 760px. Vertical rhythm is `clamp(4.375rem, 8vw, 7.375rem)` per section. The close section and shared footer use night-desk surfaces.

## Elevation & Depth

App: flat at rest, with tonal layering and hairlines; state shadows only.

Landing: paper depth comes from ruled lines, a crease shadow inset on the folded leaf, and soft offset shadows under the spread and plaques. No zero-blur coloured halos.

### Shadow Vocabulary
- **App primary button glow** (`0 6px 20px -10px rgba(0,0,0,0.55)`): active app CTA only.
- **App stat card** (`0 1px 2px rgba(23,33,27,0.04)`): metric lift.
- **Landing spread** (`0 24px 46px -30px rgba(16,30,36,0.8)`): paper sheet above the ground.
- **Landing plaque hover** (`0 16px 30px -20px rgba(16,30,36,0.8)`): action lift.

## Shapes

App surfaces keep their 0.5–1.5rem radii and pill chips. Landing surfaces are square: 0px radius, 1px rule borders, a 3px vermilion bottom rule on action plaques, and a dashed stitch in the gutter. No rounded card shells on the landing route.

## Components

### App Buttons and Controls
Unchanged from the incumbent system: rounded-xl variants, mint-emerald primary, graphite secondary/ghost, alert-red danger, and 2px focus rings.

### Landing Action Plaque
- **Shape:** square plaque, 1px rule border, 3px vermilion bottom rule.
- **Web:** folded-paper background, fold-ink text, Google icon.
- **Android:** fold-ink / night-desk background, on-night text, device icon.
- **Hover:** 2px lift with soft shadow; focus uses a 2px vermilion outline at 3px offset.
- **Voice:** short action name plus one plain-language line; no hype.

### Landing Fold Spread
Three-column paper artifact: outer leaf, stitched gutter carrying the sample rate and arrow, folded leaf carrying the converted figure. Ruled lines are a repeating 28px line tile. The folded panel replays one `clip-path` + `rotateY` unfold when a preset or slider commits a new amount. Content is visible by default and the animation collapses under reduced motion.

### Landing Presets and Slider
Square preset buttons with tabular numerals; selected state fills with the dark surface and cream text. Range slider uses the vermilion accent. Labels never drop below 11px.

### Navigation
App navigation is unchanged. On the landing route the shared header takes the paper ground and ink; the shared footer takes the night-desk ground and cream text. Auth buttons keep their own app-system colours.

## Do's and Don'ts

### Do
- **Do** keep the landing first viewport built around the two-figure fold and two equal actions.
- **Do** label demonstration rates and figures as sample or illustrative.
- **Do** keep every landing label at 11px or above and every money figure tabular.
- **Do** theme selection, caret, scrollbars, focus, and reduced motion from the active register.
- **Do** preserve the Graphite Ledger for signed-in screens.

### Don't
- **Don't** put a phone mockup, feature-card grid, or kicker-and-heading hero on the landing route.
- **Don't** use mint-emerald as a landing accent or vermilion as an app accent.
- **Don't** add gradients, glows, glass, or rounded card shells to Folded Margin.
- **Don't** invent testimonials, statistics, claims, or unlabelled exchange-rate figures.
- **Don't** reassert token hex values in prose; the YAML frontmatter is normative.
