# Phase 134 — Banner Info-Row + CTC Tether

**Milestone:** v2.19 Banner Info-Row + CTC Tether
**Status:** in progress
**Type:** frontend (no data load, no DB change)

## Goal

Adopt Essentials' `SectionBanner` info-row format on the TT hero banner: a
left-anchored **population stat** with the deep-link **feature chips** to its
right — Essentials, then a new **Civic Trivia Championship (CTC)** chip. This is
the reciprocal of Essentials Phases 187–189 and an extension of TT v2.16
(Tethered Icons).

Approved via visual mockup: layout = left-anchored group above the bottom-left
title; label text = `POPULATION`; real brand symbols for both chips.

## Context

- TT already resolves an Essentials `CoverageRecord` (`useEssentialsCoverage`)
  and renders one Essentials chip via `resolveFeatureIcons` + `FeatureIconRow`
  (currently bottom-right, no population).
- Reciprocal source of truth: `essentials/src/lib/trivia.js` +
  `featureIcons.js` + `SectionBanner.jsx` (population scrim + chip row).
- CTC catalog: Essentials fetches `/trivia/collections` from the shared
  ev-accounts-api proxy; TT reaches the same base via `auth.ts` (`AUTH_BASE`).
- Assets already staged: `public/trivia-symbol-{light,dark}.svg` (real CTC
  brand kit). Navy chip needs the **bright** variant → `trivia-symbol-dark.svg`
  (documented inversion vs. other products' `-light`, because the brand kit's
  `-dark` = artwork for dark backgrounds).

## Tasks (atomic commits)

- **134-01** `triviaCoverage.ts` — CTC coverage seam mirroring
  `essentialsCoverage.ts`: `fetchTriviaCollections()` (module-cached, never
  throws → `[]`), `toCollectionSlug`, `matchEntityToTrivia` (city slug
  `<name>-<state>`, state by `localeName`, federal by tier; other tiers → null),
  `TriviaRecord`, `useTriviaCoverage` hook. `TRIVIA_URL` env-gated. + unit tests.
- **134-02** `featureIcons.ts` — add `buildTriviaHref` (URLSearchParams only,
  T-126-01 safe) + `resolveTriviaIcon(record)` → CTC `FeatureIcon`
  (`iconSrc:/trivia-symbol-dark.svg`). `resolveFeatureIcons` (essentials) left
  unchanged so existing tests stay green. `FeatureIconRow` img gets
  `object-contain` so the tall trophy isn't squished.
- **134-03** `App.tsx` — add `useTriviaCoverage`, compose
  `[...resolveFeatureIcons(essentials), triviaIcon?]`; restructure the hero
  banner into the info-row layout (population scrim + chips, top-left; title
  bottom-left). Population: `federalDenominators.population` for federal, else
  `selectedEntity.population`; hidden when 0 or nonprofit.

## Verification / UAT

- `tsc -b` clean; `vitest run` green (new trivia tests + unchanged suites).
- Dev server: LA shows POPULATION + Essentials + CTC (when a collection
  matches); a place with no CTC collection shows Essentials only; nonprofit /
  pop-absent hides the stat box; both light and dark mode legible.
- Graceful degrade: catalog fetch failure → no CTC chip, banner still paints.

## Notes / follow-ups

- CTC catalog fetch uses the ev-accounts-api proxy (credentials included). If
  that endpoint is auth-gated, the CTC chip only shows for signed-in users;
  degrades cleanly otherwise. Follow-up: expose a public CTC catalog (parity
  with Essentials' public `/coverage.json`) if we want it for anonymous users.
