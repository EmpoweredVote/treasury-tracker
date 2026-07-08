---
phase: 125-essentials-coverage-contract
plan: "125"
subsystem: frontend
tags: [react, typescript, vitest, essentials-integration, coverage-contract]

# Dependency graph
requires: []
provides:
  - "src/utils/essentialsCoverage.ts — fetchCoverage (cached, never-throws), normalizePlace, matchEntityToCoverage, useEssentialsCoverage"
  - "data-essentials-coverage seam on App.tsx hero banner (covered|none)"
  - "Fixture-backed vitest suite proving tier-aligned + state-scoped matching"
affects: [126-tethered-feature-icon-row, 127-context-sensitivity-live-uat]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns:
    - "Module-level cached-Promise fetch (mirrors wikiImage.ts) — resolve once per session, never throw, cache the null outcome too"
    - "Entity→coverage matching ported verbatim from Essentials' coverage.js normalizePlace + a trailing-County/-, ST suffix strip, mirroring Essentials' treasury.js state-scoped disambiguation"

key-files:
  created:
    - src/utils/essentialsCoverage.ts
    - src/utils/essentialsCoverage.test.ts
    - src/utils/__fixtures__/coverage.sample.json
    - vitest.config.ts
    - .env.example
    - .planning/phases/125-essentials-coverage-contract/CROSS-REPO-DEFERRALS.md
    - .planning/phases/125-essentials-coverage-contract/deferred-items.md
  modified:
    - src/App.tsx
    - package.json

key-decisions:
  - "Federal target byte-for-byte confirmed by the essentials repo: /results?browse_federal_officials=1&browse_label=United+States — used verbatim in the fixture and asserted in the test suite"
  - "Both county-label forms Essentials emits ('Washington County, OR' suffixed vs 'Washington County' UT bare) round-trip through one strip()+normalizePlace() pipeline and disambiguate purely on state equality — no per-label special-casing needed"
  - "Wrote the cross-repo deferral note as RESOLVED (not 'pending post-deploy') because a live curl smoke test during Task 125-04 confirmed both Essentials deliverables (coverage.json+CORS, federal browse route) are already live on production"

patterns-established:
  - "essentialsCoverage.ts is the reciprocal of Essentials' treasury.js — same shape (URL env var, cached fetch, pure matcher, never-throws), copied not imported (no shared package cross-repo)"

requirements-completed: [COV-02, COV-03, COV-04]

# Metrics
duration: 25min
completed: 2026-07-08
---

# Phase 125 Plan 125: TT-side Essentials coverage contract Summary

**Fetch-once/cache/never-throw Essentials coverage loader + tier-aligned, state-scoped, loose-matching resolver (`essentialsCoverage.ts`), proven by a 14-assertion fixture-backed vitest suite and wired into `App.tsx` as a real `data-essentials-coverage` DOM seam for Phase 126.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-07T23:15:00-07:00 (approx.)
- **Completed:** 2026-07-07T23:39:08-07:00
- **Tasks:** 4/4 completed
- **Files modified:** 9 (6 created, 2 modified, 1 lockfile)

## Accomplishments
- `src/utils/essentialsCoverage.ts`: module-cached `fetchCoverage` (never throws — returns `null` on network error/non-OK/bad-shape), ported `normalizePlace`, tier-aligned `matchEntityToCoverage` (federal/state/county/city, state-scoped, strips trailing "County" and ", ST"), and the `useEssentialsCoverage` React hook consumption seam.
- 14/14 vitest assertions passing over a committed fixture matching the agreed 1b contract shape — including the two real county-label forms ("Washington County, OR" vs bare "Washington County" UT) resolving to their own state's GEOID with zero cross-state collision, and the federal entity resolving to the confirmed-live `browse_federal_officials` target.
- `App.tsx` now calls `useEssentialsCoverage(selectedEntity)` and renders a real, testable `data-essentials-coverage="covered"|"none"` attribute on the hero banner — no icon yet (Phase 126).
- Live-verified (not just fixture-verified): a real cross-origin curl against `https://essentials.empowered.vote/coverage.json` during Task 125-04 confirmed 200/CORS/shape/federal-record match the fixture exactly, upgrading the plan's "verify post-deploy" scope note to resolved.

## Task Commits

Each task was committed atomically:

1. **Task 125-01: essentialsCoverage.ts loader/matcher** - `4e4ccc9` (feat)
2. **Task 125-02: vitest harness + fixture + test suite** - `c4b00b3` (test)
3. **Task 125-03: App.tsx seam wiring** - `82902b3` (feat)
4. **Task 125-04: verification + cross-repo deferrals** - `d1d1372` (docs)

## Files Created/Modified
- `src/utils/essentialsCoverage.ts` - fetch/cache/matcher/hook (the reciprocal of Essentials' treasury.js)
- `src/utils/essentialsCoverage.test.ts` - 14 vitest assertions (tier alignment, loose matching, state-scoping, never-throws fetch)
- `src/utils/__fixtures__/coverage.sample.json` - committed fixture in the agreed 1b contract shape
- `vitest.config.ts` - node environment, `src/**/*.test.ts` include
- `.env.example` - new file; documents `VITE_ESSENTIALS_URL`
- `src/App.tsx` - `useEssentialsCoverage` call + `data-essentials-coverage` attribute on the hero banner div
- `package.json` / `package-lock.json` - added `vitest` devDependency + `"test": "vitest run"` script
- `.planning/phases/125-essentials-coverage-contract/CROSS-REPO-DEFERRALS.md` - resolves the plan's scope-note deferral (both Essentials deliverables confirmed live)
- `.planning/phases/125-essentials-coverage-contract/deferred-items.md` - records pre-existing, unrelated lint failures found during verification

## Decisions Made
- Federal target string used verbatim as confirmed byte-for-byte by the essentials repo (`+`-encoded space), matching what's now live in production.
- `strip()` (trailing " County" / ", ST") + `normalizePlace()` is applied identically to both the entity name and the catalog label before comparison, so no per-state or per-label special-casing was needed to handle the "Washington County, OR" vs "Washington County" (bare, UT) case — state equality alone disambiguates.
- Cross-repo deferral note upgraded from "pending" to "RESOLVED" after a live smoke test proved both Essentials-side deliverables (coverage.json+CORS, federal browse route) are already live on production, ahead of what the plan anticipated.

## Deviations from Plan

### Auto-fixed Issues

None required — no bugs, missing critical functionality, or blocking issues surfaced during implementation.

### Discovered, not fixed (out of scope)

**1. [Scope boundary] Pre-existing `npm run lint` failures unrelated to this plan**
- **Found during:** Task 125-04 verification
- **Issue:** `npm run lint` exits 1 with 13 errors + 2 warnings, all in files/lines this plan did not touch: `src/App.tsx` lines 389/457/484/524/699 (pre-existing `useEffect` bodies calling `setState` synchronously — flagged by `eslint-plugin-react-hooks` v7's `react-hooks/set-state-in-effect` rule, already pinned in the lockfile before this plan started), `src/components/BudgetTree.tsx:118`, `src/components/dashboard/BudgetSearch.tsx:75`, and `src/data/dataLoader.ts` (5x `@typescript-eslint/no-explicit-any`).
- **Verification this plan didn't cause it:** lockfile diff shows `eslint-plugin-react-hooks` resolved to `7.0.1` unchanged before/after this plan's `npm install -D vitest`; `git diff` of `src/App.tsx` for this plan touches only 3 locations (import, hook call, `data-essentials-coverage` attribute), none of which are the flagged lines; `npx eslint` scoped to only this plan's new files (`essentialsCoverage.ts`, `essentialsCoverage.test.ts`, `vitest.config.ts`) returns zero errors.
- **Disposition:** Not fixed (scope boundary — pre-existing, unrelated). Documented in `deferred-items.md` for a future cleanup phase. `npx tsc -b`, `npx vitest run`, and `npm run build` all exit 0 for this plan.

---

**Total deviations:** 0 auto-fixed; 1 discovered-and-deferred (pre-existing, out of scope).
**Impact on plan:** None on this plan's own correctness. `npm run lint` as a whole-repo command does not exit 0, but that failure predates and is unrelated to this plan's changes — a caveat worth flagging to whoever next runs a repo-wide lint gate.

## Issues Encountered
None beyond the pre-existing lint state noted above.

## User Setup Required
None - no external service configuration required. `VITE_ESSENTIALS_URL` defaults to the correct production origin (`https://essentials.empowered.vote`) if unset; `.env.example` documents the override for local dev.

## Next Phase Readiness

Phase 126 (Tethered Feature-Icon Row) can now:
- Call `useEssentialsCoverage(selectedEntity)` in `App.tsx` (already wired) to get a `CoverageRecord | null`.
- Render the Essentials icon when the seam attribute is `"covered"`, building any href via `URLSearchParams` from `record.geoids` / `record.stateAbbrev` / `record.target` per the T-125-01 threat-model note in the resolver's return-type doc comment (no href/DOM built in this plan).
- Trust that the live catalog now includes `federal` (confirmed live), so the federal tether icon can ship in Phase 126/127 per the D-05 scope-change — no "hold dark" workaround needed.

No blockers. The one open item (pre-existing lint failures) is unrelated to this plan and is documented for separate cleanup.

---
*Phase: 125-essentials-coverage-contract*
*Completed: 2026-07-08*
