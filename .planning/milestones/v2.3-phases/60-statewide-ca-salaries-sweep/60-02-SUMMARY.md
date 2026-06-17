---
phase: 60-statewide-ca-salaries-sweep
plan: "60-02"
subsystem: database
tags: [gcc, salaries, sweep, never-overwrite, statewide]

requires:
  - phase: 60-statewide-ca-salaries-sweep
    provides: sweepCASalaries.js + confirmed GCC coverage (Plan 60-01)
provides:
  - GCC salaries FY2009-2024 loaded for all 98 non-OC CA cities (dataset_type='salaries')
  - Per-run coverage results JSON (60-02-sweep-results.json)
affects: [60-03]

tech-stack:
  added: []
  patterns:
    - "Never-overwrite guard for salaries (pre-skip existing rows from a different data_source)"

key-files:
  created:
    - .planning/phases/60-statewide-ca-salaries-sweep/60-02-sweep-results.json
    - .planning/phases/60-statewide-ca-salaries-sweep/60-02-SUMMARY.md
  modified:
    - scripts/sweepCASalaries.js

key-decisions:
  - "Added a never-overwrite guard to sweepCASalaries.js after discovering treasury_sync_city_budget has none — preserves Los Angeles FY2017-2024 'LA City Payroll' while GCC fills FY2009-2016"

patterns-established:
  - "Salary sweep never-overwrite = pre-load existing salaries rows, skip (muni,year) from a different source"

requirements-completed: [SAL-04, SAL-05]

duration: ~25min
completed: 2026-06-16
---

# Phase 60 / Plan 60-02: the statewide non-OC CA salaries sweep

**Loaded CA Government Compensation salaries FY2009–2024 for all 98 non-OC CA cities (88 LA County + 10 other-county) in 16 download-once passes, with a never-overwrite guard that preserved Los Angeles's curated payroll data — 0 gaps, 0 failures, 2.5M source records processed.**

## Performance
- **Duration:** ~25 min (16 GCC ZIP downloads + ~1,440 RPC writes)
- **Completed:** 2026-06-16
- **Tasks:** 3/3
- **Files modified:** 1 (`scripts/sweepCASalaries.js` — never-overwrite guard); 1 artifact (results JSON)

## Accomplishments
- **All 98 non-OC CA cities now carry GCC salaries** reaching **FY2009** (avg 16 years each). Non-OC CA cities with salaries rose **1 → 98**; the **OC control stayed 34** (untouched).
- **Covered 98 / Gap 0** in the swept range; **0 RPC errors, 0 download failures**; 16 ZIPs downloaded once each (not ~1,500); 2,522,352 GCC records processed.
- **Never-overwrite held:** Los Angeles FY2017–2026 `LA City Payroll` rows preserved (8 in-range skips), while GCC filled LA FY2009–2016. Sampled Glendale: FY2009–2024, GCC source label.
- Per-run coverage results JSON preserved at `60-02-sweep-results.json` for Plan 60-03.

## Task Commits
1. **60-02-01 baseline** — non-OC CA with salaries = 1 (LA, 'LA City Payroll' FY2017–2026); OC control = 34.
2. **60-02-02 real sweep** — `node scripts/sweepCASalaries.js --start-year 2009 --end-year 2024`; never-overwrite guard fix committed `018d0eb` (fix).
3. **60-02-03 post-sweep verify** — 98 covered, LA preserved, OC untouched, Glendale reaches FY2009.

**Plan metadata:** this SUMMARY (docs).

## Files Created/Modified
- `scripts/sweepCASalaries.js` — added the never-overwrite guard (commit `018d0eb`).
- `.planning/phases/.../60-02-sweep-results.json` — per-run coverage artifact.

## Decisions Made
- See deviation below — the never-overwrite guard was a necessary correctness fix.

## Deviations from Plan
**Necessary correctness fix (caught at baseline):** The plan/research assumed the salary write path was never-overwrite. Inspecting `treasury_sync_city_budget` showed it has NO source-aware guard — it deletes+replaces the tree for any existing `(muni, fy, 'salaries')` row and leaves the old `data_source` stale. Left as-is, sweeping Los Angeles would have clobbered its FY2017–2024 `LA City Payroll` data with GCC data under a stale label. I added a pre-sync never-overwrite guard to `sweepCASalaries.js` (skip any `(muni, year)` already present from a different source) — committed `018d0eb` — and verified LA 2017 skips while LA 2009 imports. This is why 60-02 modified `scripts/sweepCASalaries.js` (its frontmatter `files_modified` was empty). Scope unchanged; the fix makes the must_have "Los Angeles's pre-existing salaries preserved" actually hold.

## Issues Encountered
- The missing never-overwrite guard (above). No transient download/RPC failures this run (cached 2009/2024 ZIPs from 60-01's dry-run helped).

## Next Phase Readiness
- **60-03** can reconcile a sample city (e.g. Glendale or Los Angeles) and document coverage from the results JSON + DB (98 cities, FY2009 floor, 0 gaps).

---
*Phase: 60-statewide-ca-salaries-sweep*
*Completed: 2026-06-16*
