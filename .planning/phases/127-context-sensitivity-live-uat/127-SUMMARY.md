---
phase: 127-context-sensitivity-live-uat
plan: "127"
subsystem: verification
tags: [uat, essentials-integration, tether-icon, live-verification, vitest, milestone-capstone]

# Dependency graph
requires:
  - phase: 125-essentials-coverage-contract
    provides: useEssentialsCoverage + fetchCoverage (the live cross-origin fetch verified here)
  - phase: 126-tethered-feature-icon-row
    provides: resolveFeatureIcons/buildEssentialsHref gate + FeatureIconRow (the behavior verified here)
provides:
  - scripts/essentials-live-smoke.mjs — offline-safe live-fetch smoke check (npm run smoke:essentials)
  - 127-UAT.md — live-app acceptance contract (matrix + D-127-04 checks + Chris VER-01 sign-off)
  - 127-VERIFICATION.md — status:passed (2/2 requirements)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Headless end-to-end verification: run the REAL resolver modules against the LIVE producer catalog + REAL DB entity records (no fixtures) to prove icon-or-absence + exact hrefs deterministically"
    - "Live-fetch smoke script decoupled from npm test/build (keeps offline vitest deterministic); asserts CORS access-control-allow-origin header server-side"
    - "Windows: use process.exitCode + natural drain, never process.exit(), to avoid the undici keep-alive teardown race that trips a libuv async.c assertion"

key-files:
  created:
    - scripts/essentials-live-smoke.mjs
    - .planning/phases/127-context-sensitivity-live-uat/127-UAT.md
    - .planning/phases/127-context-sensitivity-live-uat/127-VERIFICATION.md
  modified:
    - package.json (smoke:essentials script)
    - .planning/REQUIREMENTS.md (TETH-03, VER-01 marked done)

key-decisions:
  - "Verify-and-fix in-phase (D-127-03): zero defects surfaced, so no product source changed"
  - "Geoid-less covered place (Bloomington IN) shows NO icon and that is CORRECT, not a bug (D-127-01); no label-only fallback added this phase"
  - "Uncovered-city negative case Plano TX was FALSIFIED during planning (it IS covered) — replaced with Fresno CA (verified TT city + verified absent from coverage), a stronger case (uncovered city inside a covered state)"
  - "Federal 'United States' SHOWS the icon (the v2.16 headline reversal of the original 'no federal target')"

patterns-established:
  - "For a UAT/verify capstone, the UAT checklist + a live smoke script + the existing vitest suite together serve as the validation strategy (no separate VALIDATION.md needed)"

requirements-completed: [TETH-03, VER-01]

# Metrics
duration: single-session
completed: 2026-07-08
---

# Phase 127: Context-Sensitivity + Live UAT Summary

**Proved the Essentials tether is context-sensitive end-to-end (icon iff a real per-location link exists) and passed Chris's live-app UAT across every entity tier — the v2.16 capstone, zero defects.**

## Accomplishments
- **127-01 scaffolding:** `scripts/essentials-live-smoke.mjs` + `npm run smoke:essentials` — an offline-safe live-fetch check (11/11 PASS) asserting the live `coverage.json` is reachable, CORS-open (`access-control-allow-origin: *`), correctly shaped, and still carries the matrix anchor records; NOT wired into `npm test`/`build`. Authored `127-UAT.md`, the visual+behavioral acceptance contract (7-row matrix with exact expected hrefs, D-127-04 live checks, D-126-03 + narrow-viewport visual checks).
- **127-02 live UAT (Part A, executable):** ran the real resolver modules (`matchEntityToCoverage`→`resolveFeatureIcons`→`buildEssentialsHref`) against the **live** catalog and the **real TT DB entity records** for all 7 matrix rows — 7/7 produced the exact expected icon-or-absence + href, including the module-scope one-fetch cache. Bloomington IN confirmed covered-with-empty-geoids→no icon (D-127-01), distinct from Fresno CA uncovered→no icon (D-127-02).
- **127-02 live UAT (Part B, Chris):** browser-only dimensions confirmed live at treasurytracker.empowered.vote (graceful degrade, clean console, light/dark legibility, narrow-viewport clearance, one-fetch Network count, click-through). **VER-01 sign-off recorded 2026-07-08.**
- **Zero defects** → no in-phase fix loop, no product source modified; the Phase-126 T-126-01 guard remains intact.

## Task Commits
1. **Plans (127-01, 127-02):** `e4d3ede` (docs)
2. **127-01 scaffolding (smoke script + UAT checklist):** `29f1f3d` (feat)
3. **127-02-01 Part A results (7/7 headless):** `72005fd` (docs)
4. **127-02 Chris VER-01 sign-off:** `7d08125` (docs)
5. **Verification passed + requirements ticked:** (docs)

## Notable Correction
The CONTEXT.md uncovered-city candidate **Plano TX was falsified** during planning — it IS in Essentials coverage. Replaced with **Fresno CA** (verified in `treasury.municipalities` as `city`; verified absent from the 136 covered cities), a stronger negative case.

## Deviations from Plan
None beyond the planning-time candidate correction (Plano→Fresno) above. Zero product-code changes.

## Issues Encountered
- `process.exit()` in the smoke script raced undici's keep-alive socket teardown on Windows → libuv `async.c` assertion + bogus exit 127. Fixed by switching to `process.exitCode` + natural event-loop drain.

## User Setup Required
None. `npm run smoke:essentials` needs only network access to the live Essentials origin.

## Next Phase Readiness
v2.16 (Tethered Icons & Smart Banner) is complete — all three phases (125/126/127) shipped, all requirements satisfied. No blockers. Deferred (out of milestone scope): Compass/Read&Rank live resolvers, banner imagery, label-only fallback for geoid-less places.

---
*Phase: 127-context-sensitivity-live-uat*
*Completed: 2026-07-08*
