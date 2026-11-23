---
version: 1
slug: "src-app-public-page-tsx"
primary_target: "src/app/(public)/page.tsx"
related_targets: []
---

# Public landing page

- Scope: `src/app/(public)/page.tsx` and its route-scoped styling. Shared header and footer are restyled only through the landing route's scope.
- Visitor mode: Persuade.
- Audience and job: students funded in one currency and spending in another; they need to know what a foreign price means in the money they think in.
- Action: two co-primary, equal-weight actions — start on the web (Google sign-in at `/login`) and get the Android app (Google Play). Neither is a secondary link.
- Proof and content: a live fold demonstration with an illustrative ECB-based rate, a dated sample figure labelled as illustrative, plain product facts, and no invented testimonials or statistics.
- Constraints: preserve product truth and voice; no phone mockup in the first viewport; no live-mode script or `impeccable-live` markers; code-led build; respect the running dev server on port 3001.
- Unresolved: real Play Store URL is derived from the Android `applicationId` (`com.pluto.app`); replace with the final store URL at launch if it differs.

## Direction contract

THESIS: Pluto's landing page is a folded page from a traveller's notebook: the foreign price is written on the outer margin, and folding it reveals the home-currency figure with the rate in the crease. It refuses the fintech arrangement of headline, device mockup and equal feature cards.

OWN-WORLD: Warm uncoated paper (#f2eee3), deep ink (#1c2b33), rule blue (#3e6478), one vermilion fold tab (#c54a2c), and a pale crease shadow (#d8d1c2). Ruled lines, folio numbers, margin notes, a stitched gutter, tabular numerals. Display: locally self-hosted Barlow Condensed; body system UI; Geist Mono for rates and folios. Night-desk variant uses ink navy with paper-coloured type and the same vermilion. No gradients, no glows, no rounded card shells.

STORY: The visitor recognises a price they cannot read at home, folds the margin, sees the converted figure and the sample ECB rate that produced it, reads how Pluto keeps both numbers honest, then chooses the web app or the Android app as two equal actions.

FIRST VIEWPORT: A large paper spread owns the fold. On the left, the headline "The same price, in your money." and a short plain-language explanation, with two equal plaques beneath: "Start on the web" to /login and "Get the Android app" to Google Play. On the right, a full-scale spread: left leaf "München · EUR" with "€38.20", a crease carrying "1 EUR = ₹90.00 · SAMPLE ECB RATE", right folded margin revealing "Home · INR" with "₹3,438.00". Preset amounts and a slider under the spread change the local figure and unfold the home figure once. No phone mockup.

FORM: Folded notebook / paper-map margin — pinned by the user's words: "1 — Folded Margin", "new world, co-primary web + Android actions, full rewrite", and "no phone mockup in first viewport"; seed: none (pinned).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
