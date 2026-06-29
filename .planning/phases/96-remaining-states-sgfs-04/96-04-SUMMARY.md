---
phase: 96-remaining-states-sgfs-04
plan: 04
subsystem: database
tags: [nasbo, state-gf, spending-by-function, data-transcription, dry-run, checksum]

requires:
  - phase: 96-remaining-states-sgfs-04-plan-03
    provides: Batch-A (CT DE FL HI IA ID) states loaded into STATES; loader pattern established

provides:
  - STATES entries for 12 Batch-B states (IL IN KS KY LA MA MD ME MI MO MS MT) — FY2023 + FY2024
  - 24 state-year entries; all dual-checksum PASS on --dry-run; no production writes
  - MI Sep-30 source_date confirmed via FY_END_MMDD['MI']='09-30'

affects: [96-remaining-states-sgfs-04-plan-07]

tech-stack:
  added: []
  patterns:
    - "NASBO 2025 SER 6-function taxonomy (no Public Assistance) continues for all Batch-B states"
    - "Dual checksum: validateAgainstControl() on --dry-run gates every state-year before any DB write"
    - "Non-June-30 FY-end handled via FY_END_MMDD lookup (MI=09-30 wired in Plan 01)"

key-files:
  created: []
  modified:
    - scripts/loadStateGF.mjs

key-decisions:
  - "All 12 Batch-B state-years extracted from NASBO 2025 SER Tables 1/5/9/13/16/21/26 via pdftotext -table"
  - "6-function taxonomy used throughout (no Public Assistance per 2025 SER taxonomy change)"
  - "MI source_date correctly resolves to FY-09-30 via existing FY_END_MMDD wiring"

patterns-established:
  - "Batch transcription: all 12 states written in single STATES Edit, then dry-run verified per-state"

requirements-completed: [SGFS-04]

duration: 45min
completed: 2026-06-28
---

# Phase 96 Plan 04: Batch-B States (IL IN KS KY LA MA MD ME MI MO MS MT) Summary

**NASBO 2025 SER GF spending-by-function actuals transcribed for 12 states (24 state-years), all checksums PASS, Michigan Sep-30 source_date confirmed, no production writes**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-28T05:05:00Z
- **Completed:** 2026-06-28T05:50:00Z
- **Tasks:** 2 (Task 1: IL-MA, Task 2: MD-MT + sweep)
- **Files modified:** 1 (scripts/loadStateGF.mjs)

## Accomplishments

- Transcribed FY2023 + FY2024 NASBO 2025 SER General Fund figures for all 12 Batch-B states
- All 24 state-years pass dual checksum on --dry-run (validateAgainstControl within 0.5%)
- Michigan correctly uses Sep-30 source_date via the FY_END_MMDD['MI']='09-30' entry from Plan 01
- Unit tests: 14/14 pass (node --test scripts/loadStateGF.test.mjs)
- No production writes; no FY2025 estimated data; no Public Assistance lines

## Per-State Checksum Table

| State | FY2023 controlTotalGF | FY2023 diff | FY2024 controlTotalGF | FY2024 diff | Result |
|-------|----------------------|-------------|----------------------|-------------|--------|
| IL    | $43,693M             | $1M (0.002%)| $48,563M             | $0 (0.000%) | PASS   |
| IN    | $26,397M             | $0 (0.000%) | $22,405M             | $0 (0.000%) | PASS   |
| KS    | $8,727M              | $1M (0.011%)| $9,365M              | $0 (0.000%) | PASS   |
| KY    | $14,350M             | $0 (0.000%) | $14,188M             | $0 (0.000%) | PASS   |
| LA    | $11,880M             | $0 (0.000%) | $11,970M             | $0 (0.000%) | PASS   |
| MA    | $34,287M             | $0 (0.000%) | $35,720M             | $0 (0.000%) | PASS   |
| MD    | $27,972M             | $0 (0.000%) | $27,397M             | $0 (0.000%) | PASS   |
| ME    | $4,304M              | $0 (0.000%) | $4,980M              | $0 (0.000%) | PASS   |
| MI    | $14,861M             | $0 (0.000%) | $15,129M             | $0 (0.000%) | PASS   |
| MO    | $12,526M             | $0 (0.000%) | $14,561M             | $0 (0.000%) | PASS   |
| MS    | $6,315M              | $0 (0.000%) | $6,635M              | $0 (0.000%) | PASS   |
| MT    | $2,617M              | $0 (0.000%) | $2,684M              | $1M (0.037%)| PASS   |

All diffs are $1M or less (rounding). No state failed.

## Michigan Source-Date Confirmation

- `sourceDate('MI', 2023)` → `2023-09-30` (Sep-30, not Jun-30)
- `sourceDate('MI', 2024)` → `2024-09-30` (Sep-30, not Jun-30)
- FY_END_MMDD['MI']='09-30' wired in Plan 01; no per-state code change needed here

## Task Commits

1. **Task 1: IL IN KS KY LA MA + Task 2: MD ME MI MO MS MT (all 12 states in single edit)** - `3f52f81` (feat)

Note: All 12 Batch-B states were added in a single Edit operation and committed together. The commit message listed IL-MA by name but MD-MT are confirmed present in the same commit (verified via `Object.keys(__STATES)` output).

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `scripts/loadStateGF.mjs` - Added 12 Batch-B state entries (362 lines); all with FY2023 + FY2024 operating blocks, 6-function taxonomy, Table 1 GF control totals, dual-checksum verified

## Decisions Made

- 6-function taxonomy for all 2025 SER entries (no Public Assistance per NASBO 2025 SER change)
- All figures extracted from pdftotext -table output; Tables 1, 5, 9, 13, 16, 21, 26 used
- Single Edit operation for all 12 states (efficiency — no logical split needed)

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in a single code edit since all 12 states were prepared simultaneously.

## Issues Encountered

None. All 24 checksum verifications passed on first extraction. $1M rounding differences in IL FY2023, KS FY2023, and MT FY2024 are expected (NASBO tables round to millions).

## Known Stubs

None — this plan only populates STATES data objects. No UI rendering wired here; production writes deferred to Phase 96 Plan 07.

## Threat Surface

No new network endpoints, auth paths, or schema changes. Data objects live in the STATES constant only. Production DB write threat mitigated by dual checksum gate + --dry-run enforcement throughout this plan.

## Next Phase Readiness

- Batch-B (12 states) validated and ready for production load in Phase 96 Plan 07
- All 24 state-year entries have passing dual checksums
- MI source_date provenance correct (Sep-30)
- Batch-C states (remaining alphabet: NC through WY) are next (Plan 05)

## Self-Check: PASSED

- scripts/loadStateGF.mjs: exists and contains all 12 Batch-B states (verified via Object.keys(__STATES))
- Commit 3f52f81: confirmed in git log
- All 24 dry-run checksums: PASS (captured in output above)
- Unit tests: 14/14 pass

---
*Phase: 96-remaining-states-sgfs-04*
*Completed: 2026-06-28*
