# Pluto brand sheet

Everything here is implemented in code. Tokens live in `src/app/globals.css` (CSS variables + Tailwind 4 `@theme inline`); the logo lives in `src/components/logo.tsx` and `public/brand/`.

---

## 1. Brand idea

Pluto is a travel companion, not a bank. It is **friendly, clear and trustworthy, with a little playfulness** — calm and confident, never gimmicky.

The name is a small planet far from the sun: things that feel distant and hard to read become legible when you bring them into view. That is the whole product promise applied to money in other currencies.

- **Voice**: plain, warm, human. Short sentences. Written for people reading in a second language. No idioms, no jargon, no invented statistics.
- Never: dark-green bank sterility, generic dollar signs, globes with arrows, bird silhouettes.

---

## 2. Logo

### Concept — "orbit that converts"

A solid planet wrapped by an orbit ring whose gap closes with an arrowhead. The ring reads two ways at once: an **orbit** (the planet, the trip) and an **exchange arrow** (currency converting) in one shape. The planet is drawn with `currentColor`, so the mark sits correctly on light and dark surfaces; the ring uses the mint accent.

### Files

| File | Use |
| :--- | :--- |
| `public/brand/pluto-mark.svg` | Light surfaces |
| `public/brand/pluto-mark-dark.svg` | Dark surfaces |
| `public/brand/pluto-wordmark.svg` | Light lockup with the wordmark |
| `public/brand/pluto-wordmark-dark.svg` | Dark lockup with the wordmark |
| `src/app/icon.svg` | Favicon (simplified mark on an indigo tile, legible at 16px) |
| `src/app/apple-icon.tsx` | Apple touch icon, generated as PNG |
| `src/app/opengraph-image.tsx` | 1200×630 social card |
| `src/components/logo.tsx` | `PlutoMark`, `Logo`, `Wordmark`, `WordmarkLockup` |
| `public/brand/favicon.svg` | 32×32 PNG favicon variant |

The favicon variant drops the faint orbit line and thickens the ring so the shape survives at 16px.

### Clear space

Keep clear space of at least the planet's radius on all sides. Do not recolour the planet or the ring beyond the light/dark variants, and do not add gradients, shadows or outlines to the mark.

---

## 7. Colour

Warm, optimistic and light by default: an off-white canvas, a deep indigo for text and primary actions, and a sunrise-coral accent for highlights. Dark mode is a deep ink-navy, not black.

### Light

| Token | Hex | Use |
| :--- | :--- | :--- |
| `--canvas` | `#FBF5EC` | Page background |
| `--surface` | `#FFFFFF` | Cards, header, footer |
| `--surface-muted` | `#F4EDE1` | Inset panels, hover fills |
| `--ink` | `#171A2E` | Body and headline text |
| `--muted` | `#5B6076` | Secondary text |
| `--border` / `--border-strong` | `#EBE3D5` / `#D8CDBB` | Hairlines, dividers |
| `--primary` | `#2C2E7E` | Primary actions, links, brand |
| `--primary-hover` / `--primary-active` | `#23256A` / `#1B1D55` | States |
| `--primary-subtle` | `#E7E8F6` | Icon chips, active nav |
| `--accent` | `#E85C33` | Highlights, graphics, the orbit |
| `--accent-strong` | `#B8401F` | Coral text where AA is required |
| `--accent-subtle` | `#FDE7DE` | Soft coral fills |
| `--gold` | `#b8401f` | |
| `--gold-subtle` | `#fd` | #fde7de |
| `--danger` | `#c0392b` | |
| `--danger-hover` | `#a32e22` | |
| `--danger-subtle` | `#fbe6e2` | |
| `--success` | `#1c7a52` | |
| `--success-subtle` | `#e1f3ea` | |
| `--warning` | `#b26a08` | |
| `--warning-subtle` | `#fd` | #fbefda |
| `--tint-indigo-bg` | `#e7e8f6` | |
| `--tint-indigo-fg` | `#2c2e7e` | |
| `--tint-coral-bg` | `#fde7de` | |
| `--tint-coral-fg` | `#b8401f` | |
| `--tint-teal-bg` | `#dcf1ec` | |
| `--tint-teal-fg` | `#0f6b5c` | |
| `--tint-sky-bg` | `#e3eefb` | |
| `--tint-sky-fg` | `#1d4e89` | |
| `--tint-lilac-bg` | `#ece6fa` | |
| `--tint-lilac-fg` | `#4b2e9e` | |
| `--tint-amber-bg` | `#fbfd3` | |
| `--tint-amber-fg` | `#8a5a0b` | |
| `--tint-rose-bg` | `#fce3e6` | |
| `--tint-rose-fg` | `#a62643` | |
| `--tint-sand-bg` | `#f4ecdd` | |
| `--tint-sand-fg` | `#7a5c2e` |

### Dark (follows `prefers-color-scheme`)

| Token | Hex |
| :--- | :--- |
| `--canvas` | `#0E1020` |
| `--surface` / `--surface-muted` | `#161831` / `#1E2140` |
| `--ink` / `--muted` | `#ECEBF6` / `#A8ACC7` |
| `--border` / `--border-strong` | `#2A2E4C` / `#3B4066` |
| `--primary` | `#9AA0FF` |
| `--accent` | `#FF8A66` |
| --accent-hover: | `#FF9C7A` |
| `--accent-strong` | `#FF9C7A` |
| --accent-subtle | `#3A1D14` |
| --on-accent | `#2B1206` |
| `--gold` | `#ff9c7a` |
| --gold-subtle | `#3a1d14` |
| --danger | `#EB6B5A` |
| --danger-hover | `#F08474` |
| --danger-subtle | `#3A1713` |
| --success | `#4CC38A` |
| --success-subtle | `#12301F` |
| --warning | `#E0A346` |
| --warning-subtle | `#33260d` |
| --tint-indigo-bg | `#232755` |
| --tint-indigo-fg: | `#b9bdfb` |
| --tint-coral-bg: `#3a1d14` |
| --tint-coral-fg: `#ffab8d` |
| --tint-teal-bg: `#12302b` |
| --tint-teal-fg: `#6fd8c1` |
| --tint-sky-bg: `#14273f` |
| --tint-sky-fg: `#8ec2f5` |
| --tint-lilac-bg: `#251a45` |
| --tint-lilac-fg: `#c3b1f5` |
| --tint-amber-bg: `#33260d` |
| --tint-amber-fg: `#ecc27a` |
| --tint-rose-bg: `#3a1620` |
| --tint-rose-fg: `#f5a3b3` |
| --tint-sand-bg: `#2c2519` |
| --tint-sand-fg: `#d9c39c` |

### Contrast

Indigo `#2C2E7E` on white is ≈ 11:1, and white on indigo ≈ 11:1 — AA and AAA for both text and buttons. Coral is a **highlight** colour: on its own it is below 4.5:1 for small text, so coral text uses `--accent-strong` (`#B8401F`, ≈ 4.9:1 on the canvas), and solid coral surfaces pair with `--on-accent` (near-black). Muted text (`#5B6076`) is ≈ 5.4:1 on the canvas.

### Currency tints

Currency chips are the recurring motif. Each currency maps to a soft tint in `src/components/currency-chip.tsx` (`--tint-*` tokens), so EUR, USD, JPY and friends stay visually distinct without flag images (which render inconsistently across platforms).

---

## 7. Typography

| Role | Family | Notes |
| :--- | :--- | :--- |
| Display | **Bricolage Grotesque** | Headlines and the wordmark — expressive, a little playful, still clear. |
| Body & numbers | **Inter** | Highly legible at small sizes; money always uses `tabular-nums`. |
| Mono | Geist Mono | Technical values in the admin area (IDs, versions). |

Scale (landing): hero `2.6rem → 3.75rem`, section headings `1.875rem → 2.25rem`, card titles `1.125rem → 1.25rem`, body `1rem`, small `0.875rem`, micro `0.75rem`. Line height tightens as size grows (`1.03` at hero).

---

## 8. Spacing, radii, motion

- **Spacing**: 4px base; sections use 80px vertical padding, cards 24px, tight stacks 8–12px.
- **Radii**: cards `1.5rem` (24px), buttons and inputs `0.75rem` (12px), pills and chips fully rounded, the final CTA band `2rem`.
- **Motion**: subtle and purposeful only — scroll reveals (fade + 14px rise), the converter's number settle, a gentle float. Everything honours `prefers-reduced-motion` (transitions collapse to ~0.01ms globally).

---

## 9. Why this suits students, expats and tourists

- **Students** are funded in one currency and spend in another, often with money arriving from home. The warm, low-pressure palette and the "semester, in the currency your family sends" framing avoid the intimidating bank aesthetic; the budget and category views answer the only question that matters — *how much is left before the next transfer?*
- **Expats** reconcile a salary and a whole life across two currencies. Deep indigo reads as steady and trustworthy (it is the colour of the totals and the primary actions), while the coral accent marks the thing that changed — a converted figure, a highlight. The "salary in one currency, life in another" panel shows the monthly picture without a spreadsheet.
- **Travellers** move fast across several currencies and want one honest number when they land. Currency chips make "which currency is this?" a glance, and the trip-total screenshot turns four countries into a single figure in the money back home.

The layout supports all three the same way: a calm, uncluttered page with generous whitespace, real product screens instead of abstract illustrations, and a privacy section that treats financial data as something to be honest about. Good for a nervous first-time user and a seasoned expat alike.