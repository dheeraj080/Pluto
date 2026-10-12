# Pluto brand sheet

Everything here is implemented in code. Tokens live in `src/app/globals.css` (CSS variables feeding Tailwind 4's `@theme inline`); the logo lives in `src/components/logo.tsx` and `public/brand/`.

Pluto ships **one theme**: a dark, near-black "graphite" canvas with a single mint-emerald accent. There is no light mode — the landing page and the app are the same surface, so a figure looks identical wherever it appears.

---

## 1. Brand idea

Pluto is a travel companion, not a bank. It is **friendly, clear and trustworthy, with a little playfulness** — calm and confident, never gimmicky.

The name is a small planet far from the sun: things that feel distant and hard to read become legible when you bring them into view. That is the whole product promise applied to money in other currencies.

- **Voice**: plain, warm, human. Short sentences. Written for people reading in a second language. No idioms, no jargon, no invented statistics.
- Never: dark-green bank sterility, generic dollar signs, globes with arrows, bird silhouettes.

---

## 2. Logo

### Concept — "orbit that converts"

A solid planet wrapped by an orbit ring whose gap closes with an arrowhead. The ring reads two ways at once: an **orbit** (the planet, the trip) and an **exchange arrow** (currency converting) in one shape. The planet is drawn with `currentColor` so the mark sits correctly on any surface; the ring uses the mint accent.

### Files

| File | Use |
| :--- | :--- |
| `public/brand/pluto-mark.svg` | Standalone mark |
| `public/brand/pluto-mark-dark.svg` | Mark tuned for the graphite canvas |
| `public/brand/pluto-wordmark.svg` | Lockup with the wordmark |
| `public/brand/pluto-wordmark-dark.svg` | Lockup tuned for the graphite canvas |
| `src/app/icon.svg` | Favicon: near-black tile, emerald ring, pale-mint planet |
| `src/app/apple-icon.tsx` | Apple touch icon, generated as PNG |
| `src/app/opengraph-image.tsx` | 1200×630 social card with the emerald glow |
| `src/components/logo.tsx` | `PlutoMark`, `Logo`, `Wordmark`, `WordmarkLockup` |

The favicon variant drops the faint orbit line and thickens the ring so the shape survives at 16px.

### Clear space

Keep clear space of at least the planet's radius on all sides. Do not recolour the planet or the ring beyond the light/dark variants, and do not add gradients, shadows or outlines to the mark.

---

## 3. Colour

One dark theme. Neutrals are strictly blue-free, green-free greys; **one** bright mint-emerald carries key numbers, active states, primary buttons and the main chart line. A soft emerald glow sits behind hero cards and under the main chart.

### Graphite, accent and surfaces

| Token | Hex / value | Use |
| :--- | :--- | :--- |
| `--canvas` | `#0B0C0E` | Page background |
| `--surface` | `#131518` | Cards, header, footer |
| `--surface-muted` | `#1B1E22` | Raised inputs, inset panels, hover fills |
| `--ink` | `#F2F4F5` | Headings and body text |
| `--muted` | `#A4ABB2` | Secondary text |
| `--border` / `--border-strong` | `rgba(255,255,255,.07)` / `rgba(255,255,255,.14)` | Hairlines, dividers |
| `--primary` | `#34D399` | Primary actions, links, key numbers, chart line |
| `--primary-hover` / `--primary-active` | `#10B981` / `#059669` | States |
| `--primary-subtle` | `rgba(52,211,153,.12)` | Icon chips, active nav |
| `--on-primary` | `#05130D` | Text on a solid emerald surface |
| `--glow` / `--glow-strong` | `rgba(52,211,153,.22)` / `rgba(52,211,153,.34)` | Radial glow behind hero cards |

### Semantic

| Token | Value |
| :--- | :--- |
| `--danger` / `--danger-solid` | `#F87171` / `#B91C1C` |
| `--success` | `#34D399` (same as the accent) |
| `--warning` / `--gold` | `#FBBF24` |
| `--chart-secondary` | `#CBD5E1` — the quiet Second-currency line |

### Category palette

Six restrained, harmonious hues. They are the **only** colours a category may take; colour is always paired with the category name, never used alone to carry meaning.

| Token | Hex | Hue |
| :--- | :--- | :--- |
| `--cat-mint` | `#34D399` | Mint |
| `--cat-sky` | `#7DD3FC` | Sky |
| `--cat-amber` | `#FCD34D` | Amber |
| `--cat-rose` | `#FDA4AF` | Rose |
| `--cat-violet` | `#C4B5FD` | Violet |
| `--cat-slate` | `#94A3B8` | Slate |

The same six values are the source of truth in two places that must stay in step: `src/lib/category-palette.ts` (web, for inline values) and `src/modules/expenses/expense-defaults.ts` (server, for seed data and new-category defaults).

### Pills and badges

- **Spending down** is the good outcome: green (`--success`).
- **Spending up** is a normal comparison, not an error: neutral grey or soft amber (`--warning`). Never a warning-red.

### Contrast

Off-white ink on the near-black canvas is ≈ 17:1; secondary grey ≈ 8:1; emerald ≈ 10:1; dark ink on a solid emerald surface ≈ 9:1. Every pairing used for text meets WCAG AA.

---

## 4. The Pair rule

Every money value in the app is shown in the user's **Pair**: a **Base** and a **Second**, set once on `/expenses/settings` and switchable from any page header's segmented control.

- Both values are shown, e.g. `€493.79 · ₹49,500`. The Base is large; the Second sits beside or below it in smaller grey text.
- Money is **never** rewritten. An expense paid in a third currency keeps its recorded amount as a small `Paid $37.41` label.
- The Second is opt-in. With no second currency chosen, screens show a single value — the honest default for someone who never crosses borders.
- All money uses tabular figures so columns line up and digits do not jump.

---

## 5. Charts

Line charts only — no bars, no donuts.

- The Base is a solid mint line with a soft gradient fill; the Second is a thinner, quieter grey line on its own axis.
- Every chart offers a data-table alternative so it is readable by keyboard and screen reader.
- Charts stay readable at 360px: no horizontal scroll inside a card, fewer ticks, simplified tooltips.

---

## 6. Typography

| Role | Family | Notes |
| :--- | :--- | :--- |
| Display | **Space Grotesk** | Headings, the wordmark — geometric, confident. |
| Body & numbers | **Inter** | Legible at small sizes; money always uses `tabular-nums`. |
| Mono | **Geist Mono** | Technical values in the admin area (IDs, versions). |

Headings are off-white; body and secondary text step down through `--ink` and `--muted`. Balances and hero figures use a light weight at a large size.

---

## 7. Spacing, radii, motion

- **Spacing**: 4px base; cards use 20–24px padding, tight stacks 8–12px.
- **Radii**: cards `rounded-3xl` (24px), buttons and inputs `rounded-xl` (12px), pills and chips fully rounded.
- **Borders**: 1px hairlines at 6–8% white.
- **Motion**: limited to a chart draw-in, one hero number count-up and a gentle card fade-in. Everything honours `prefers-reduced-motion` (transitions collapse to ~0.01ms globally).

---

## 8. Accessibility

- WCAG AA contrast throughout; every interactive element has a visible focus ring (`--focus-ring`).
- Colour never carries meaning alone — a category swatch always sits next to its name.
- Charts expose their data as a table; empty states offer a next action rather than an empty grid.
