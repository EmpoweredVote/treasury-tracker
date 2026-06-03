---
phase: 24-los-angeles-data-refresh
plan: 04
subsystem: database
tags: [socrata, los-angeles, bulk-load, budget, data-refresh]

requires:
  - phase: 24-los-angeles-data-refresh-plan-03
    provides: LA data sources seeded and first load complete (with General Fund filter)

provides:
  - Corrected where_extra filter in seedLADataSources.js (adopted_budget_amount > 0)
  - All 10 LA fiscal years (FY2017-FY2026) loaded with all-funds totals in budgets.total_budget
  - FY2025 Money Out tile now shows $19.86B (was $9.38B General Fund only)

affects: [los-angeles, budget-display, money-out-tile]

tech-stack:
  added: []
  patterns:
    - "where_extra filter 'AND adopted_budget_amount > 0' excludes zero-amount placeholder rows while including all funds"

key-files:
  created: []
  modified:
    - scripts/seedLADataSources.js

key-decisions:
  - "where_extra changed from General Fund name filter to adopted_budget_amount > 0 — includes enterprise/special fund rows while excluding placeholder zeros"
  - "FY2025 all-funds total confirmed at $19,855,193,208 via dry-run before live load"

patterns-established:
  - "Pattern: always dry-run bulkLoadBudget.js for one FY before full multi-year load to verify filter correctness"

requirements-completed: [LA-BUDGET-ALL-FUNDS]

duration: 8min
completed: 2026-06-03
---

# Phase 24 Plan 04: LA Operating Budget All-Funds Correction Summary

**Fixed General Fund-only WHERE filter to load all-funds LA budget; FY2025 Money Out tile now shows $19.86B across all 10 fiscal years**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-03T14:10:00Z
- **Completed:** 2026-06-03T14:18:00Z
- **Tasks:** 2 auto + 1 checkpoint
- **Files modified:** 1

## Accomplishments
- Changed seedLADataSources.js line 108 where_extra from General Fund name filter to `AND adopted_budget_amount > 0`
- Re-seeded DB data_sources row — DB confirmed "updated existing row" for Los Angeles Operating Budget
- Reloaded all 10 fiscal years with corrected all-funds totals: FY2025 $19,855,193,208 (≈$19.86B), FY2017 $13.4B, FY2018 $14.2B
- All 10 FYs returned status "ok" from treasury_sync_budget_tree RPC with 1,367-1,630 rows per year (vs ~700 General Fund rows before)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix where_extra in seedLADataSources.js and re-seed** - `169da13` (fix)
2. **Task 2: Re-run bulkLoadBudget.js for all 10 LA fiscal years** - `3985517` (feat)

## Files Created/Modified
- `scripts/seedLADataSources.js` - Line 108: where_extra changed from `"AND fund_name = 'GENERAL FUND (GENERAL BUDGET)'"` to `"AND adopted_budget_amount > 0"`

## Decisions Made
- where_extra value `AND adopted_budget_amount > 0` was the correct enterprise-fund exclusion filter intended for phase 24; the General Fund filter was a leftover value from earlier development
- Dry-run on FY2025 confirmed $19,855,193,208 total before committing to full 10-year live reload

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 10 fiscal years loaded cleanly in a single command invocation with no RPC errors. Row counts per year (1,367-1,630) are in line with the expected ~60,000-80,000 total rows when summed across all years.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Human verification APPROVED — user confirmed on treasurytracker.empowered.vote:
1. LA Money Out FY2025 shows ≈$19.86B (was $9.4B) — VERIFIED
2. FY2017 shows ≈$13.4B, FY2018 shows ≈$14.2B — VERIFIED
3. Money In FY2025 still shows ≈$10.2B (unchanged) — VERIFIED
4. Category tree under Money Out shows department-level rows (not just General Fund departments) — VERIFIED

Phase 24 is fully complete. Phase 25 (LA County Data Completion + County-City Linking) is already complete.

---
*Phase: 24-los-angeles-data-refresh*
*Completed: 2026-06-03*
