---
phase: 126-tethered-feature-icon-row
plan: "126"
subsystem: ui
tags: [react, typescript, floating-ui, tether-icon, essentials, vitest]

# Dependency graph
requires:
  - phase: 125-essentials-coverage-contract
    provides: useEssentialsCoverage hook + CoverageRecord type + ESSENTIALS_URL (the resolved-entity seam this phase consumes)
provides:
  - src/utils/featureIcons.ts — pure product registry + resolver (buildEssentialsHref, PRODUCT_REGISTRY, resolveFeatureIcons)
  - src/components/FeatureIconRow.tsx — FeatureIconChip/FeatureIconRow (navy chip + @floating-ui tooltip + external link)
  - App.tsx wiring: featureIcons computed + rendered bottom-right above the Wikimedia credit
  - 6 product icon SVGs staged in public/ (essentials/compass/readrank × light/dark)
affects: [127-context-sensitivity-live-uat]

# Tech tracking
tech-stack:
  added: ["@floating-ui/react@0.27.19"]
  patterns:
    - "Generic fixed-order product registry with per-product resolve(record) => FeatureIcon | null, reserved non-rendering slots for future products"
    - "Every external href built via URL + URLSearchParams (never string-concatenated from untrusted catalog values)"
    - "Same-origin-path guard on an untrusted absolute target before resolving it against a known base origin"

key-files:
  created:
    - src/utils/featureIcons.ts
    - src/utils/featureIcons.test.ts
    - src/components/FeatureIconRow.tsx
    - public/essentials-symbol-light.svg (+ dark, + compass/readrank light+dark)
    - .planning/phases/126-tethered-feature-icon-row/126-VERIFICATION.md
  modified:
    - src/App.tsx (featureIcons compute + render)
    - package.json / package-lock.json (@floating-ui/react)

key-decisions:
  - "Registry mirrors Essentials' featureIcons.js fixed order [essentials, compass, readrank]; only essentials has a live resolve(), compass/readrank always resolve to null (documented reserved slots, no placeholder icons)"
  - "Icon row always uses the -light SVG symbol on a semi-transparent navy chip in both TT themes — no light/dark branching on the symbol itself (D-126-03)"
  - "A covered city/county with no geoid (geoids: []) resolves to null (no icon) in this phase, per D-126-06 — flagged for Phase 127 UAT to revisit a label-only fallback"
  - "Suppressed a react-hooks/refs (eslint-plugin-react-hooks v7 compiler rule) false positive on @floating-ui/react's refs.setFloating ref-callback setter with a scoped, documented eslint-disable-line"

patterns-established:
  - "Pure, unit-testable resolver modules (no React/fetch) consumed by a thin presentational component — mirrors the Phase 125 essentialsCoverage.ts / useEssentialsCoverage split"

requirements-completed: [ICON-01, ICON-02, ICON-03, ICON-04, TETH-01, TETH-02]

# Metrics
duration: 16min
completed: 2026-07-08
---

# Phase 126: Tethered Feature-Icon Row Summary

**Bottom-right hero-banner icon row deep-linking the current entity into Essentials via a fixed-order product registry (essentials live, compass/readrank reserved), built with @floating-ui/react tooltips and URL/URLSearchParams-only href construction.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-08T00:17:14-07:00 (session start)
- **Completed:** 2026-07-08T00:33:03-07:00
- **Tasks:** 5/5 completed
- **Files modified:** 12 (6 new SVGs, 3 new TS/TSX files, package.json/package-lock.json, App.tsx)

## Accomplishments
- Product registry (`src/utils/featureIcons.ts`) resolves the already-matched `CoverageRecord` from Phase 125 into a tier-correct Essentials deep-link (city/county/state/federal), building every href via `URL`/`URLSearchParams` only — never string concatenation.
- `FeatureIconChip`/`FeatureIconRow` (`src/components/FeatureIconRow.tsx`) port Essentials' `SectionBanner.jsx` chip to TT/TS: circular semi-transparent navy chip, `@floating-ui/react` hover+keyboard-focus tooltip, external link with `aria-label`/`rel="noopener noreferrer"`.
- Wired into `App.tsx`'s hero banner, bottom-right, positioned above the existing Wikimedia credit with zero changes to banner imagery/gradient/title/credit.
- 11 new vitest assertions (22 total across the Phase 125+126 suite) prove per-tier href construction, the geoid-less/null→`[]` render gate, the fixed reserved-slot registry order, and the T-126-01 hostile-absolute-target same-origin-path guard.

## Task Commits

1. **Task 126-01: icon assets + @floating-ui/react** - `1769cc6` (feat)
2. **Task 126-02: product registry + resolver** - `fc6bbb5` (feat)
3. **Task 126-03: FeatureIconRow/FeatureIconChip components** - `de7ad4d` (feat)
4. **Task 126-04: wire into App.tsx hero banner** - `e2f115e` (feat)
5. **Task 126-05: verify** - `41f38a8` (fix + test), `3ea5e41` (docs)

## Files Created/Modified
- `src/utils/featureIcons.ts` - Pure product registry + `buildEssentialsHref`/`resolveFeatureIcons`
- `src/utils/featureIcons.test.ts` - Fixture-backed vitest suite (11 assertions)
- `src/components/FeatureIconRow.tsx` - `FeatureIconChip` + `FeatureIconRow`
- `src/App.tsx` - Computes `featureIcons`, renders `<FeatureIconRow>` bottom-right above credit
- `public/essentials-symbol-{light,dark}.svg`, `public/compass-symbol-{light,dark}.svg`, `public/readrank-symbol-{light,dark}.svg` - Icon assets
- `package.json` / `package-lock.json` - `@floating-ui/react` dependency
- `.planning/phases/126-tethered-feature-icon-row/126-VERIFICATION.md` - Gate results

## Decisions Made
- Reserved-slot registry pattern from Essentials adopted verbatim: compass/readrank present in `PRODUCT_REGISTRY` with `resolve()` hard-coded to return `null`, rather than omitted from the array — reserves row position with zero future layout change (D-126-04).
- Icon row's positioning container (`absolute bottom-6 right-2 z-10`) is only rendered when `featureIcons.length > 0`, avoiding an empty wrapper div on uncovered/federal entities (ICON-03).
- `FeatureIconRow` itself also independently returns `null` for an empty array, so the render gate is defense-in-depth at both the App.tsx call site and the component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Suppressed a react-hooks/refs false positive on @floating-ui/react's ref-callback setter**
- **Found during:** Task 126-05 (lint-delta verification)
- **Issue:** `eslint-plugin-react-hooks@7.0.1`'s compiler-based `react-hooks/refs` rule flagged `ref={refs.setFloating}` inside the `FloatingPortal` subtree of `FeatureIconChip` as "Cannot access ref value during render." `refs.setFloating` is a stable ref-callback *setter* returned by `@floating-ui/react`'s `useFloating()` — not a mutable `.current` read — so this is a false positive from the rule's structural type inference (it did not flag the sibling `ref={refs.setReference}` on the reference `<a>`, confirming the inconsistency). Left unfixed, this new file would have contributed a new lint error, violating the plan's zero-new-errors gate.
- **Fix:** Added a scoped `// eslint-disable-line react-hooks/refs` with an explanatory comment on the one flagged line. Verified deterministic (0 errors across 3 repeated `npx eslint` runs) after the fix; confirmed the sibling `ref={refs.setReference}` needed no suppression (an eslint-disable there was flagged "unused directive" and removed).
- **Files modified:** `src/components/FeatureIconRow.tsx`
- **Verification:** `npx eslint src/components/FeatureIconRow.tsx src/utils/featureIcons.ts src/utils/featureIcons.test.ts` → 0 problems (3 consecutive runs); full `npm run lint` → 15 problems (13 errors, 2 warnings), identical to the Phase 125 baseline.
- **Committed in:** `41f38a8`

---

**Total deviations:** 1 auto-fixed (Rule 1 — lint false-positive suppression)
**Impact on plan:** No scope creep; the fix is a scoped, documented suppression of a known tooling false positive, not a behavioral change.

## Issues Encountered
None beyond the lint deviation above.

## User Setup Required
None - no external service configuration required. `@floating-ui/react` is a plain npm dependency, already installed and resolving cleanly (`npm ls @floating-ui/react`).

## Next Phase Readiness
- Phase 127 (context-sensitivity + live UAT, TETH-03/VER-01) can proceed directly: the render-time null-resolver gate is proven deterministically here via fixture-backed vitest; Phase 127 owns the live-app, end-to-end proof (uncovered city → no icon; federal → icon; Chris sign-off).
- The Essentials producer (`coverage.json`, CORS, federal browse route) is already confirmed live as of Phase 125's close, so Phase 127 can smoke-test against production immediately.
- No blockers.

---
*Phase: 126-tethered-feature-icon-row*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created files verified present on disk; all task commit hashes
(1769cc6, fc6bbb5, de7ad4d, e2f115e, 41f38a8, 3ea5e41, d88a655) verified
present in `git log --oneline --all`.
