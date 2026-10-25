# Hallmark Anti-Pattern Audit: ./apps/web

## Ranked Punch List of Anti-Patterns to Fix

### P1 — Uppercase Tracking on Labels, Captions, Table Heads, Tags & Nav (Hallmark Rule #9)
**Severity**: Critical — Pervasive across entire codebase  
**Frequency**: 51 occurrences  
**Location**: Throughout `src/components/`, `src/app/`, and `src/app/(public)/`  
**Description**: The codebase extensively uses `uppercase` and `tracking-wider`/`tracking-widest`/`tracking-widest` for labels, captions, table heads, tags, and navigation links. This creates an "eyebrow" effect that the hallmark rules explicitly forbid.  
**Current pattern**: `uppercase tracking-wider text-muted`, `font-medium uppercase tracking-wider text-muted`, `text-xs font-medium uppercase tracking-wider text-muted`, etc.  
**Required fix**: Labels, captions, table heads, tags and nav links must use the body face (or theme's label face), a step smaller, sentence case or lower case, **untracked**.  
**Example fix**:
```tsx
// Before:
<h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Title</h2>

// After:
<h2 className="text-xs font-semibold text-ink">Title</h2>
```

---

### P2 — Font Family Not Through CSS Tokens (Hallmark Rule #1)
**Severity**: Critical  
**Frequency**: 2 violations (brand SVG files)  
**Location**: `public/brand/pluto-wordmark.svg`, `public/brand/pluto-wordmark-dark.svg`  
**Description**: The brand wordmark SVGs use literal `font-family` declarations instead of going through the CSS token variable `--font-landing-sans`.  
**Current**: `font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif`  
**Required**: All font families must go through a `:root`-declared token or theme block.  
**Fix**: Reference the existing token `var(--font-landing-sans)` or create one if missing. The app already defines `--font-landing-sans: var(--font-plus-jakarta-sans)` in `globals.css` `@theme inline`, so the SVGs should use `font-family: var(--font-landing-sans)`.

---

### P3 — `100vw` in calc Expressions (Hallmark Rule #4)
**Severity**: High  
**Frequency**: 3 occurrences  
**Location**: 
- `src/components/dialog.tsx:60` — `w-[calc(100vw-2rem)]`
- `src/components/pill.tsx:121` — `max-w-[calc(100vw-2rem)]`
- `src/app/expenses/reports/range-control.tsx:230` — `max-w-[calc(100vw-2rem)]`  
**Description**: Pure `100vw` is forbidden by the hallmark rules. While these use `calc(100vw-2rem)`, the hallmark floor does not distinguish — `100vw` in any form is a violation.  
**Required fix**: Replace with a fixed pixel value or a responsive calculation that doesn't reference `100vw` directly.  
**Example fix**:
```tsx
// Before:
className="max-w-[calc(100vw-2rem)]"

// After:
className="max-w-[calc(100%-2rem)]"  <!-- or use a fixed width -->
```

---

### P4 — Italic Word Inside Roman Heading (Hallmark Rule #3)
**Severity**: High  
**Frequency**: 1 occurrence  
**Location**: `src/app/landing/problem.tsx:41`  
**Description**: A single italic word inside a otherwise roman (upright) heading text.  
**Current**: `<div className="text-base sm:text-xl font-medium text-muted italic">&ldquo;But how much did I actually spend?&rdquo;</div>`  
**Required fix**: Remove the `italic` class or rephrase so no italic word exists inside roman text.  
**Fix**: 
```tsx
// Before:
<div className="text-base sm:text-xl font-medium text-muted italic">&ldquo;But how much did I actually spend?&rdquo;</div>

// After:
<div className="text-base sm:text-xl font-medium text-muted">&ldquo;But how much did I actually spend?&rdquo;</div>
```

---

### P5 — Missing `overflow-x: clip` on `html` and `body` (Hallmark Rule #4)
**Severity**: Medium  
**Frequency**: 1 violation  
**Location**: `src/app/globals.css` — the `html` and `body` rules  
**Description**: The hallmark explicitly requires `overflow-x: clip` on both `html` and `body`. The current CSS has `scroll-behavior: smooth` on `html` but no `overflow-x: clip`.  
**Required fix**: Add `overflow-x: clip` to both `html` and `body` in the base CSS.  
**Fix**:
```css
html {
  scroll-behavior: smooth;
  overflow-x: clip;
}

body {
  /* existing styles */
  overflow-x: clip;
}
```

---

### P6 — `transition-colors` Used Pervasively (Related to Rule #2)
**Severity**: Low — technically compliant but worth noting  
**Frequency**: 36 occurrences of `transition-colors duration-150`  
**Description**: While `transition: all` is not used (good), `transition-colors duration-150` appears throughout the codebase on buttons, inputs, badges, segmented controls, tabs, and form controls. The hallmark rule #2 says "Never `transition: all`." Using `transition-colors` is specific and thus compliant, but the sheer volume means any future change could accidentally reintroduce `transition: all`.  
**Recommendation**: Keep as-is since `transition-colors` only animates color properties, not `width`/`height`/`top`/`left`. No immediate fix needed.

---

### Summary of Compliance Status

| Hallmark Rule | Status | Notes |
|---|---|---|
| **Rule #1**: Colors/fonts through tokens | ⚠️ Partial | Brand SVGs use literal `font-family` |
| **Rule #2**: Never `transition: all` | ✅ Compliant | Only `transition-colors` used |
| **Rule #3**: No italic in roman heading | ⚠️ 1 violation | `landing/problem.tsx` |
| **Rule #4**: `overflow-x: clip` on html/body | ⚠️ Missing | Add to base CSS |
| **Rule #4**: Never `100vw` | ⚠️ 3 calc violations | Replace with alternatives |
| **Rule #5**: Grid tracks `minmax(0, 1fr)` | ✅ Compliant | Not observed violating |
| **Rule #6**: `:focus-visible` appears instantly | ✅ Compliant | No transition on focus-visible |
| **Rule #7**: `prefers-reduced-motion` fallback | ✅ Compliant | Charts and CSS both respect it |
| **Rule #8**: No invented metrics/testimonials | ✅ Compliant | Not present |
| **Rule #9**: No tracked caps/small caps on labels | ❌ Critical | 51 occurrences of `upperware` |
| **Rule #10**: No middle-dot meta strings | ✅ Compliant | Not observed |
| **Rule #11**: No purple-to-blue gradient/card-in-card/emoji/hand-drawn | ✅ Compliant | System uses mint-emerald only |
| **Rule #12**: Hero text visible at 1280×800 | ✅ Compliant | Not a hero-type screen extensively |
| **Rule #13**: ≤80 words per screen | ✅ Compliant | Not observed violating |
| **Rule #14**: Centered container, growing gutters at 1920 | ✅ Compliant | Tailwind max-w handles this |
| **Rule #15**: CSS first line = stamp/critique/waivers | N/A | Not a CSS-gen project |
| **Rule #16**: `sloplint.mjs` cleanup | N/A | Different tooling |

---

## Recommended Fix Order

1. **P1**: Remove `uppercase` and `tracking-*` from all 51 locations — this is the most far-reaching violation
2. **P2**: Fix brand SVG `font-family` to use `var(--font-landing-sans)` token
3. **P3**: Replace `calc(100vw-2rem)` in 3 locations with non-`100vw` alternatives
4. **P4**: Remove `italic` from the heading in `landing/problem.tsx`
5. **P5**: Add `overflow-x: clip` to `html` and `body` in `globals.css`



