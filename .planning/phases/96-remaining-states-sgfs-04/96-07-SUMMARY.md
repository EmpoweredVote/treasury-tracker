# 96-07 Summary — Live cleanup + cohort load + verify (SGFS-04)

**Status:** Complete (2026-06-28)

## What was done
The only production-writing plan of Phase 96. Ran the Wave 0 cleanup live, loaded the full NASBO 2025-SER operating cohort, and verified against the live DB.

- **Deleted 375 unsourced rows** (234 revenue + 141 out-of-window operating FY2022/2025/2026) across 47 states (46 cohort + Georgia).
- **Loaded 94 operating state-years** (46 cohort + GA, FY2023 + FY2024) from the 2025 NASBO SER, 6-function taxonomy, GAAP-budgetary-basis label, 0-NULL source-stamped to the SER PDF.
- All 5 DB probes pass (0 revenue, 0 out-of-window operating, 94 in-window, 47 states, 0 NULL provenance). FY-ends correct for AL/MI/TX/NY. Idempotent.

## Key files
- `scripts/loadStateGF.mjs` — STATES populated for all 46 cohort + GA (Plans 03–06); live-loaded here.
- `scripts/cleanupStateEstimates.mjs` — cohort+GA cleanup (run live with --confirm).
- `.planning/phases/96-remaining-states-sgfs-04/96-07-LOAD-LOG.md` — full probe results + deferrals.

## Deviation
Georgia added to the cleanup cohort (Chris-approved) — Phase 94 left GA's unsourced revenue + out-of-window operating estimates; including GA leaves no cohort state displaying unsourced data. See LOAD-LOG.

## Deferred (documented)
Revenue-by-source (deleted, not replaced — future ACFR upgrade); FY2022 backfill; both honest per P5/D-96-01/03. Cohort-wide audit + UAT = Phase 97 (SGFS-05).

## Self-Check: PASSED
