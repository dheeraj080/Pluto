---
name: Pluto
description: Multi-currency expense tracker — spend in any currency, understand it in yours.
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
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  "2xl": "1rem"
  "3xl": "1.5rem"
  full: "9999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
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
---
# Design System: Pluto

## Overview

**Creative North Star: "The Graphite Ledger"**

Calm, precise, and low-pressure. Dark graphite surfaces carry hairline borders and tonal surface variants instead of colour; a single mint-emerald accent is reserved for CTAs, the brand mark, active and positive states, and key converted numbers — never as a decorative wash. Every money figure uses tabular numerals, every interactive control shows a visible focus ring, and all motion collapses to near-still under `prefers-reduced-motion`. Light mode is a 1:1 mirror of the dark ramp, shifted to darker steps so ink keeps WCAG AA on a white surface.

**Key Characteristics:**
- Near-black graphite canvas (`#0b0c0e`) with off-white ink (`#f2f4f5`)
- Single bright accent: mint-emerald (`#34d399`), used sparingly
- Hairline borders (`rgba(255,255,255,0.07)`) and tonal layering over shadows
- Tabular numerals for all money figures
- Visible focus rings on every interactive control
- Light theme is a value-for-value mirror of the dark ramp

## Colors

One bright accent on a graphite neutral base; the accent is the only saturated colour in the system.

**The One Accent Rule.** Mint-emerald is the single bright colour; it appears on primary CTAs, the brand mark, active/positive states, and key converted numbers — never as a decorative wash, glow, shadow, or eyebrow.

### Primary
- **Mint Emerald** (#34d399): primary actions, links, the brand mark's orbit ring, active and positive states, and key converted numbers. Pairs with near-black on-mint-emerald (`#05130d`) for contrast.
- **Mint Emerald Hover** (#10b981): primary button hover state.
- **Mint Emerald Active** (#059669): primary button active state.
- **Mint Emerald Subtle** (`rgba(52, 211, 153, 0.12)`): soft fills for active navigation chips and badge backgrounds.

### Secondary
Omitted. The project has one accent; secondary roles are expressed through tonal graphite surfaces rather than a second hue.

### Tertiary
Omitted. No tertiary hue exists in the system.

### Neutral
- **Graphite Deep** (#0b0c0e): page canvas and default dark-theme background.
- **Graphite Surface** (#131518): cards, header, and raised containers.
- **Graphite Surface Muted** (#1b1e22): inset panels and hover fills.
- **Graphite Ink** (#f2f4f5): body and headline text (~17:1 on canvas).
- **Graphite Muted** (#a4abb2): secondary text (~8:1 on canvas).
- **Border Hairline** (`rgba(255,255,255,0.07)`): dividers and input borders.
- **Border Strong** (`rgba(255,255,255,0.14)`): stronger dividers and active states.
- **Focus Ring** (#34d399): keyboard focus indicator, 2px with 2px offset.
- **Glow** (`rgba(255,255,255,0.06)`) / **Glow Strong** (`rgba(255,255,255,0.1)`): neutral radial spotlight behind hero/product surfaces — never coloured.

### Named Rules (Optional)
**The Restraint Rule.** Category chips and chart series draw from a six-hue muted palette (mint, sky, amber, rose, violet, slate) — never a saturated rainbow, never flag images.

## Typography

**Display Font:** Space Grotesk (with system-ui, sans-serif fallback) — used for headlines and the wordmark; expressive but still clear.
**Body Font:** Inter (with system-ui, -apple-system, "Segoe UI", sans-serif fallback) — highly legible at small sizes; money always uses tabular numerals.
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback) — technical values in the admin area (IDs, versions).

**Character:** A clean, rational pairing. Space Grotesk carries the expressive display moments; Inter does the working text and figures; Geist Mono handles technical admin data. Landing pages additionally use Outfit (landing display) and Plus Jakarta Sans (landing sans).

### Hierarchy
- **Display** (600, clamp-scale hero/section headings): hero and section headlines; `text-wrap: balance` for even racking.
- **Headline** (bold, ~1.125–1.25rem): card and section titles.
- **Title** (semibold, ~1rem): app page headers.
- **Body** (400, 1rem, leading-relaxed): supporting prose; max comfortable line length.
- **Label** (500, 0.875rem, letter-spaced, uppercase): table headers, card section titles, form labels.
- **Mono** (400): money figures and technical IDs with `tabular-nums`.

## Layout

A single-column content model on the public site; the signed-in app uses a shell with a top header and scrollable content regions. Containers are full-bleed with section vertical padding of 80px on marketing surfaces. Cards use 24px internal padding (20px default, 24px at sm breakpoint); tight stacks use 8–12px gaps. The dashboard and reports accept deep-link pre-filters (`?categoryId=`, `?from=`, `?to=`) that drill from chart elements into matching expense lists.

Breakpoints follow the Tailwind default scale (sm 640px, md 768px, lg 1024px, xl 1280px); no custom breakpoints are defined in source.

## Elevation & Depth

Flat-by-default. Depth is conveyed through tonal surface layering (canvas → surface → surface-muted) and hairline borders rather than shadows. Shadows appear only as a response to state: a diffuse glow under primary buttons on hover/active, and a lift on dialogs and floating menus.

### Shadow Vocabulary (if applicable)
- **Primary button glow** (`0 6px 20px -10px rgba(0,0,0,0.55)`): diffuse shadow under the primary accent button in its active state.
- **Stat card shadow** (`0 1px 2px rgba(23,33,27,0.04)`): subtle lift on metric cards.
- **Dialog / menu lift** (`shadow-2xl`): elevated floating lists and dialogs portaled to `document.body`.

### Named Rules (Optional)
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, active, elevation, focus); no ambient coloured glows.

## Shapes

Corners are generous but not extreme: buttons and cards use `0.75rem` radius; stat cards, empty states, and tables use `1rem`; card section headers use `1.5rem`; badges, chips, and the orbit mark's ring ends are fully rounded (`9999px`); the segmented control's active state uses `0.625rem`. Borders are hairlines (`1px`, `rgba(255,255,255,0.07)`); strong dividers use `rgba(255,255,255,0.14)`. No clipping beyond border-radius; no drop-shadow silhouettes.

## Components

### Buttons
- **Shape:** rounded-xl (0.75rem) on all variants; medium height (h-10, ~2.5rem) with px-4 (~1rem) horizontal padding.
- **Primary:** mint-emerald (#34d399) background, near-black text (#05130d); hover shifts to #10b981, active to #059669; carries a diffuse glow shadow.
- **Secondary:** graphite-surface-muted background, graphite-ink text, hairline border; hover strengthens the border to border-strong.
- **Ghost:** graphite-muted text, no background at rest; hover fills surface-muted and shifts text to ink.
- **Danger:** alert-red-solid (#b91c1c) background, white text; hover deepens to #991b1b.
- **Focus:** all variants show a 2px outline-2 focus ring in mint-emerald with 2px offset; disabled state drops opacity to 45%.

### Chips
- **Style:** fully rounded (9999px), hairline border, surface-muted background, muted text, px-2.5 / py-0.5 padding, text-xs font-medium.
- **State:** neutral default; tone variants (ok/warn/danger/accent/gold) tint the border at 25–30% opacity, the background as a subtle fill, and the text to the tone colour. Selected state fills surface-muted and sets text to ink.

### Cards / Containers
- **Corner Style:** rounded-xl (0.75rem).
- **Background:** graphite-surface (#131518).
- **Shadow Strategy:** flat at rest; refer to Elevation & Depth.
- **Border:** hairline border-hairline.
- **Internal Padding:** p-5 (1.25rem) default, sm:p-6 (1.5rem); section headers px-5 / py-3.5.

### Inputs / Fields
- **Style:** rounded-xl (0.75rem), hairline border, surface-muted background, px-3.5 / py-2.5 padding, text-sm, ink text.
- **Focus:** border shifts to mint-emerald with a 2px focus ring in mint-emerald at 15% opacity; no outline.
- **Error / Disabled:** error text uses alert-red (#f87171); disabled controls show cursor-not-allowed and 50% opacity.

### Navigation
- **Style:** top shell header; tabs use a border-bottom hairline with an active state in border-primary / text-primary, inactive in border-transparent / text-muted with hover states. Segmented controls are pill-style (rounded-xl, surface-muted background, p-0.5) with an active state in rounded-[10px], surface background, text-ink, and a subtle shadow.

### Signature Component — The Orbit Mark
A planet (circle, currentColor) wrapped by an orbit ring whose gap closes with an exchange arrowhead, painted in mint-emerald. The planet reads correctly on light and dark surfaces; the ring uses the accent. Light/dark variants only; no gradients, shadows, or outlines. Kept simple so it survives at 16px (see the static favicon, which drops the faint orbit and thickens the ring).

## Do's and Don'ts

### Do:
- **Do** use mint-emerald (#34d399) as the single bright accent, on primary CTAs, the brand mark, active/positive states, and key converted numbers only.
- **Do** render all money figures with `tabular-nums` in Inter or Geist Mono so digits align.
- **Do** show a visible 2px mint-emerald focus ring on every interactive control.
- **Do** honour `prefers-reduced-motion` — collapse all transitions and animations to ~0.01ms.
- **Do** keep category distinctions to the six-hue muted palette; never use flag images or a saturated rainbow.

### Don't:
- **Don't** use mint-emerald as a decorative wash, glow, shadow, or eyebrow — it is reserved for functional emphasis.
- **Don't** introduce a second bright accent hue; secondary and tertiary roles are expressed through tonal graphite, not colour.
- **Don't** use dark-green bank sterility, generic dollar signs, globes with arrows, or bird silhouettes.
- **Don't** add gradients, shadows, or outlines to the orbit mark; use the light/dark SVG variants only.
- **Don't** reassert token hex values in prose; the YAML frontmatter is normative.
