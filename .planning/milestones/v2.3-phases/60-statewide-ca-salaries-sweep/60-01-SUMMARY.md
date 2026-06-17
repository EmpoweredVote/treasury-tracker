---
phase: 60-statewide-ca-salaries-sweep
plan: "60-01"
subsystem: database
tags: [gcc, salaries, sweep, spike-gate, dry-run, ca-state-controller]

requires:
  - phase: 55
    provides: GCC spike findings (CSV indices, fetch-via-curl, no-names model), loadCASalaries.js helpers
  - phase: 55
    provides: sweepOCSalaries.js download-once-per-year pattern
provides:
  - scripts/sweepCASalaries.js (download-once GCC sweep for the non-OC CA cohort, dry-run capable)
  - Confirmed GCC source coverage for the 98 non-OC CA cities (spike gate, SC#1)
affects: [60-02, 60-03]

tech-stack:
  added: []
  patterns:
    - "Non-OC cohort selected in JS (county_id !== OC id) so NULL-county cities (San Francisco) are kept"

key-files:
  created:
    - scripts/sweepCASalaries.js
    - .planning/phases/60-statewide-ca-salaries-sweep/60-01-SUMMARY.md
  modified: []

key-decisions:
  - "Coverage probe (task 01) + dry-run gate (task 03) executed via a single sweepCASalaries.js --dry-run pass over 2024+2009 — avoids a throwaway probe script (deviation, recorded below)"
  - "GCC covers all 98 cohort cities in both boundary years (2009, 2024) with zero gaps"

patterns-established:
  - "Before/after salaries-count probe proves a --dry-run performed zero writes"

requirements-completed: [SAL-04]

duration: ~10min
completed: 2026-06-16
---

# Phase 60 / Plan 60-01: spike gate + sweep wrapper

**Confirmed GCC source coverage for all 98 non-OC CA cities (spike gate) and shipped scripts/sweepCASalaries.js — a download-once GCC sweep that generalizes the proven OC sweep, dry-run-verified to resolve the right cohort and write nothing.**

## Performance
- **Duration:** ~10 min
- **Completed:** 2026-06-16
- **Tasks:** 3/3
- **Files modified:** 1 created (`scripts/sweepCASalaries.js`)

## Accomplishments
- **Spike gate (SC#1) PASSED:** a read-only dry-run over the 2024 and 2009 GCC City ZIPs confirmed **all 98 non-OC CA cities are covered in both boundary years (0 gaps)**, at city-scale: the 10 other-county cities (Berkeley 2,753 / Fresno 5,596 / Oakland 6,163 / Riverside 3,041 / Sacramento 5,932 / San Diego 14,570 / San Francisco 41,812 / San Jose 8,829 / Bakersfield 2,306 / Fremont 1,676 records in 2024), Los Angeles (61,065), and the LA County sample (Glendale, Pasadena, Santa Monica, Burbank, Torrance). Dry-run totals are city-scale (Fresno $512M, LA $9.1B, SF $6.6B).
- **`scripts/sweepCASalaries.js` shipped:** mirrors `sweepOCSalaries.js` verbatim except cohort selection — reads CA `entity_type='city'`, excludes Orange County **in JS** (`county_id !== OC id`) so NULL-county San Francisco is kept; optional `--county "<Name>"`; `--dry-run`. CSV indices, Total-Comp formula, `treasury_sync_city_budget('salaries')` write, never-overwrite, and the results JSON are reused unchanged. `sweepOCSalaries.js` untouched.
- **Dry-run gate (SC#1) PASSED:** the dry-run resolved exactly **98 cities** (no OC, no counties) and performed **zero writes** — salaries coverage was 38 cities / 569 rows immediately before AND after.

## Task Commits
1. **60-01-01 coverage probe** — (executed jointly with task 03; see deviation) confirmed GCC coverage for the cohort, read-only.
2. **60-01-02 author sweepCASalaries.js** — `c2bbcdd` (feat).
3. **60-01-03 dry-run gate** — 98-city resolution + zero-writes proven.

**Plan metadata:** this SUMMARY (docs).

## Files Created/Modified
- `scripts/sweepCASalaries.js` — new download-once non-OC CA GCC salary sweep.

## Decisions Made
- The probe and the dry-run gate share one mechanism (sweepCASalaries.js --dry-run), so they were executed together over 2024+2009.

## Deviations from Plan
**Execution-order optimization (not a scope change):** Plan task order is probe (01) → author (02) → dry-run gate (03). Because the coverage probe and the dry-run gate are the same download-once logic, I authored sweepCASalaries.js first, then ran one `--dry-run` pass over 2024+2009 that served BOTH the probe (per-city records + city-scale totals for the cohort) and the gate (98-city resolution + before/after zero-writes proof). All three tasks' acceptance criteria are met.

## Issues Encountered
None.

## Next Phase Readiness
- **60-02** can run the real sweep with confidence — coverage confirmed, tool dry-run-verified, never-overwrite in place.

---
*Phase: 60-statewide-ca-salaries-sweep*
*Completed: 2026-06-16*
