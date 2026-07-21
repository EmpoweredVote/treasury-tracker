---
phase: 134-banner-info-row-ctc
plan: "134-01"
subsystem: ui
tags: [react, typescript, banner, essentials, ctc, trivia, tether, vitest]

# Dependency graph
requires:
  - phase: 126-tethered-feature-icon-row
    provides: FeatureIconRow + resolveFeatureIcons + essentialsCoverage seam (extended here)
provides:
  - src/utils/triviaCoverage.ts — CTC coverage fetch/cache/match seam (mirror of essentialsCoverage.ts) + useTriviaCoverage hook
  - src/utils/featureIcons.ts — buildTriviaHref + resolveTriviaIcon (CTC chip, URLSearchParams-only)
  - src/components/FeatureIconRow.tsx — object-contain so the tall CTC trophy isn't squished
  - src/App.tsx — hero banner info-row layout (population scrim + Essentials/CTC chips, top-left above title)
  - public/trivia-symbol-{light,dark}.svg — real CTC brand trophy assets (navy chip uses -dark bright variant)
affects: []

# Tech tracking
tech-stack:
  patterns:
    - "Per-product coverage seam: fetch-once/cache/never-throw, tier-aligned loose matcher, plain-data return (URL built downstream via URLSearchParams)"
    - "Fixed display order essentials -> trivia; CTC resolved from a separate source and composed after the Essentials chip"

key-files:
  created:
    - src/utils/triviaCoverage.ts
    - src/utils/triviaCoverage.test.ts
    - public/trivia-symbol-light.svg
    - public/trivia-symbol-dark.svg
  modified:
    - src/utils/featureIcons.ts (buildTriviaHref + resolveTriviaIcon)
    - src/components/FeatureIconRow.tsx (object-contain)
    - src/App.tsx (banner info-row layout + useTriviaCoverage + population)

key-decisions:
  - "Adopted Essentials SectionBanner info-row (approved via mockup): left-anchored POPULATION scrim + feature chips above the bottom-left title"
  - "CTC chip gated per location by a matching CTC collection (city slug <name>-<state>, state by localeName, federal by tier); degrades to no-chip when the /trivia/collections proxy is unavailable"
  - "Navy chip uses trivia-symbol-dark.svg (bright, dark-bg brand variant) — inverse suffix from other products' -light, documented in featureIcons.ts"
  - "resolveFeatureIcons (Essentials) left unchanged so its tests stay green; CTC composed separately in App.tsx"

one_liner: "Hero banner adopts the Essentials population + feature-chip info-row and adds a per-location Civic Trivia Championship (CTC) tether chip via a new triviaCoverage seam; real CTC brand trophy staged; tsc clean + 35/35 tests; committed and deployed."
---

# Phase 134-01 Summary — Banner Info-Row + CTC Tether

Restructured the Treasury Tracker hero banner into Essentials' `SectionBanner`
info-row format and added a Civic Trivia Championship (CTC) tether chip.

## What was built

- **`triviaCoverage.ts`** — CTC coverage seam mirroring `essentialsCoverage.ts`:
  session-cached `fetchTriviaCollections()` (never throws → `[]`),
  `toCollectionSlug`, `matchEntityToTrivia` (city slug `<name>-<state>`, state by
  `localeName`, federal by tier; other tiers → null), `useTriviaCoverage` hook.
- **`featureIcons.ts`** — `buildTriviaHref` (URLSearchParams-only, T-126-01 safe)
  + `resolveTriviaIcon`. `resolveFeatureIcons` unchanged (tests stay green).
- **`FeatureIconRow.tsx`** — `object-contain` on the chip img (tall trophy).
- **`App.tsx`** — `useTriviaCoverage`, composed `[essentials, trivia]` icons,
  and the info-row layout (POPULATION scrim + chips, top-left above the title;
  population from the federal denominator for federal, else `entity.population`;
  hidden for nonprofits / when 0).
- **Assets** — real CTC brand trophy staged as `public/trivia-symbol-{light,dark}.svg`.

## Verification

- `tsc -b` clean; `vitest` 35/35 (12 new CTC matcher tests); production build OK.
- Committed 8985d8d / 11c80d0 / 4b052fd; pushed; deployed (live bundle `index-CNkPhEAJ.js`).

## Pending (next)

- Verification + live UAT (population correctness per tier; CTC gating against
  the live `/trivia/collections` proxy). Follow-up: expose a public CTC catalog
  if the proxy is auth-gated (so anonymous visitors also see the CTC chip).
