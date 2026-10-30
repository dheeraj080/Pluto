# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user:** a student funded in one currency who spends in another, often with money arriving from home. Their job when opening Pluto Web is to track a semester-style budget and answer "how much is left before the next transfer?" — across currencies, without a spreadsheet.

**Other audiences (confirmed in README/brand.md):** expats reconciling a salary and a whole life across two currencies; travellers moving across several currencies who want one honest total in the money back home.

## Product Purpose

Pluto Web is the public website, admin dashboard, and expense tracker for the Pluto Android application. It makes multi-currency expense tracking possible for people who are not served by sterile bank aesthetics: live ECB rates, category and budget management, monthly budget-vs-actual, spending charts with drill-through, CSV export, Google Sign-In, account deletion (Google Play data-deletion flow), and a role-gated operator panel for users, backups, storage, sessions, and rate snapshots.

## Positioning

A travel companion, not a bank. Warm, low-pressure money tracking across currencies; calm and confident, never gimmicky. The name is a small planet far from the sun: things that feel distant and hard to read become legible when you bring them into view — applied to money in other currencies.

## Operating Context

- Companion repository to `pluto-server` (NestJS API, default `http://localhost:3000/v1`).
- Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4; deployed on Vercel (root directory `apps/web`) or as a Docker standalone image.
- Public routes (`/`, `/login`, `/privacy`, `/terms`, `/support`, `/status`, `/delete-account`) are statically prerendered and SEO-friendly.
- Signed-in surfaces (`/expenses/*`) require Google Sign-In; admin surfaces (`/admin/*`) require `ADMIN_EMAILS` role and are gated by `GET /v1/admin/stats`.
- Amounts can be entered in any supported currency; reports convert to a chosen base currency (`?base=` → `localStorage` (`pluto.baseCurrency`) → server `EXCHANGE_RATE_BASE_CURRENCY` default).
- Legal pages (`/privacy`, `/terms`, `/support`) are drafts derived from the API's actual data flows and flagged `DRAFT` in source — counsel review required before launch.

## Capabilities and Constraints

**Capabilities:** multi-currency expense CRUD, categories (create/rename/recolour/delete), budgets with budget-vs-actual, reports (monthly spending trend, day-of-week pattern, category breakdown with click-through and CSV export), CSV export of expenses, Google Sign-In (web), session refresh with single-flight token rotation, status dashboard (health + rates), admin user/backup/storage/session/rate management, error boundaries with Next 16 `retry()`, crawl policy via `robots.ts`/`sitemap.ts`, security headers (nosniff, X-Frame-Options DENY, referrer policy, restrictive Permissions-Policy, HSTS, X-Robots-Tag noindex on signed-in surfaces).

**Constraints:** Next.js 16.4.2, React 19.3.0, Tailwind CSS 4; API client unwraps `{ success, data, timestamp }` envelope; refresh token in `localStorage`, access token in memory; charts use recharts (only non-Next/React runtime dependency); money always uses `tabular-nums`; base currency read through `useSyncExternalStore` to avoid hydration mismatch; CSP intentionally not set in `next.config.ts` (Next injects inline bootstrap scripts — correct CSP belongs at the edge/reverse proxy); standalone output disabled on Vercel (`output: "standalone"` only when `VERCEL` is unset).

**Terminology:** "orbit that converts" logo concept; currency chips as tints (no flag images); base currency; scheduler locks; rate snapshot.

**Undecided:** none.

## Brand Commitments

**Name:** Pluto. **Voice:** plain, warm, human. Short sentences. Written for people reading in a second language. No idioms, no jargon, no invented statistics.

**Never:** dark-green bank sterility, generic dollar signs, globes with arrows, bird silhouettes.

**Visual system (implemented in code):** off-white canvas (`#FBF5EC`), deep indigo (`#2C2E7E`) for text and primary actions, sunrise-coral (`#E85C33`) accent for highlights; dark mode is deep ink-navy (`#0E1020`), not black. Typography: Bricolage Grotesque (display/headlines), Inter (body & numbers, `tabular-nums` for money), Geist Mono (technical values in admin). Logo: "orbit that converts" — solid planet wrapped by an orbit ring whose gap closes with an arrowhead; planet in `currentColor`, ring in mint accent; light/dark variants only, no gradients/shadows/outlines. Currency tints as chips (`--tint-*`) so EUR/USD/JPY stay distinct without flag images.

**Assets:** `public/brand/` (pluto-mark, pluto-wordmark, favicon SVGs, light/dark variants), `src/components/logo.tsx` (`PlutoMark`, `Logo`, `Wordmark`, `WordmarkLockup`), `src/app/icon.svg` favicon, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx`.

## Evidence on Hand

- README.md — route inventory, architecture notes, local development, deployment, launch checklist (placeholders: `support@pluto.app`, governing law in `/terms` §11, Play Store URL in `src/app/(public)/page.tsx`).
- docs/brand.md — full brand sheet with colour, typography, spacing, radii, motion, and audience rationale; all implemented in `src/app/globals.css` (CSS variables + Tailwind 4 `@theme inline`).
- Source code in `src/app`, `src/components`, `src/lib` — incumbent visual implementation is authority for any refinement.

## Product Principles

1. **Clarity over sterility:** financial data is treated honestly, not hidden behind bank aesthetics; warm palette and plain language lower pressure for nervous first-time users.
2. **One honest number:** across currencies, reports convert to a chosen base currency and degrade gracefully (native per-currency figures still render when no rate snapshot is available).
3. **Glanceable distinction:** currency chips make "which currency is this?" a glance; no flag images.
4. **Privacy as a feature, not fine print:** legal pages derived from actual data flows; account deletion is a first-class flow (Google Play data-deletion URL).
5. **Respect the reader:** short sentences, no idioms/jargon/invented statistics; written for people reading in a second language.

## Accessibility & Inclusion

WCAG AA contrast targets (indigo on white ≈ 11:1, white on indigo ≈ 11:1; coral text uses `--accent-strong` ≈ 4.9:1 on canvas; muted text ≈ 5.4:1). All motion honours `prefers-reduced-motion` (transitions collapse to ~0.01ms globally). Dark mode follows `prefers-color-scheme`. Body text and numbers use Inter for legibility at small sizes; money uses tabular figures. No product-specific requirement beyond WCAG AA was established.
