---
phase: 24-los-angeles-data-refresh
plan: 01
subsystem: database
tags: [supabase, socrata, los-angeles, revenue, column_mapping, bulkLoadBudget]

# Dependency graph
requires:
  - phase: 16-california-cities-budget-load
    provides: LA Revenue Budget data_source row (vvm4-a2zu) and seedCaliforniaCities.js seeder
  - phase: 15-los-angeles-socrata-budget-load-enrichment
    provides: treasury_sync_budget_tree clear-and-rebuild semantics confirmed
provides:
  - LA Revenue FY2025/FY2026 reloaded with approved revenue_budget only (~$10.2B/$10.1B)
  - LA Revenue data_source column_mapping has actual_amount_column=null (no enterprise-fund bleed)
affects: [los-angeles, revenue, money-in-tab, california-cities]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "actual_amount_column: null in column_mapping prevents loader from reading actuals column; UI falls back to approved total_budget"

key-files:
  created: []
  modified:
    - scripts/seedCaliforniaCities.js

key-decisions:
  - "Set actual_amount_column: null (not a fund-name filter) — preserves approved $10.2B all-funds revenue_budget scope rather than narrowing to general fund ($9.7B)"
  - "Re-run bulkLoadBudget.js after seeder to clear existing revenue_collected actuals via clear-and-rebuild semantics"

patterns-established:
  - "Column_mapping null pattern: actual_amount_column: null disables actual loading for a data source; proven for SD_OPERATING, now also LA_REVENUE"

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-06-02
---

# Phase 24 Plan 01: LA Revenue Data Refresh Summary

**LA FY2025 revenue corrected from $44.6B to $10.2B by nulling actual_amount_column in seedCaliforniaCities.js LA_REVENUE() and reloading both fiscal years via bulkLoadBudget.js**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-02T18:25:00Z
- **Completed:** 2026-06-02T18:41:26Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Identified and fixed the root cause: `actual_amount_column: 'revenue_collected'` in LA_REVENUE() was causing the loader to sum all-funds actual collections (~$44.6B) including LADWP ($17.2B), Airports ($4.0B), and Harbor ($0.9B) enterprise funds
- Changed `actual_amount_column` from `'revenue_collected'` to `null` in `scripts/seedCaliforniaCities.js` and re-seeded — DB now has `actual_amount_column=null` for Los Angeles Revenue Budget data_source
- Reloaded FY2025 ($10,223,013,861 = ~$10.2B) and FY2026 ($10,108,092,148 = ~$10.1B) revenue category trees — both in the $9.5B–$11B acceptance range; all category `actual_amount` fields are 0 (no enterprise-fund bleed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Set LA_REVENUE actual_amount_column to null and re-seed** - `cb9eb8b` (fix)
2. **Task 2: Reload LA Revenue FY2025 + FY2026 without actuals and verify total** - no source file changes (DB-only loader execution)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `scripts/seedCaliforniaCities.js` — Changed `actual_amount_column: 'revenue_collected'` to `actual_amount_column: null` in `LA_REVENUE()` factory function (line 246)

## Decisions Made
- Chose to null out `actual_amount_column` rather than filter by `fund_name='GENERAL FUND'` — nulling preserves the approved $10.2B all-funds scope that was human-verified at Phase 16 completion; general-fund filter would show $9.7B and create apples-to-oranges comparison with the operating budget (which also uses all funds)
- No AI API calls — zero enrichment spend; existing 70 LA enrichment rows already cover revenue departments

## Deviations from Plan

None — plan executed exactly as written.

Minor observation: The LA Revenue Budget data_source ID in the DB (`993fdef9-9270-4d71-9a8c-b1a4dfaf9c39`) differs from the ID cited in the plan's acceptance criteria (`ea3c8f7e-0ab0-4a79-9f2b-9b7093d5bb55`). The seeder correctly uses name-based lookup (`upsertDataSourceByName`), so the actual DB ID doesn't matter for the fix — the correct row was updated regardless. The plan's ID reference was from an earlier research snapshot.

## Issues Encountered
- `dotenv` not available as a top-level Node module in the worktree (no `node_modules/`); DB verification was done by running scripts from the main repo (`C:/treasury-tracker`) where `node_modules/` is present. No impact on outcomes.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- LA Revenue FY2025/FY2026 now display correct approved revenue totals (~$10.2B / ~$10.1B) with no enterprise-fund inflation
- Ready for Phase 24 Plans 02+ (LA Operating actuals fix + historical backfill)
- No blockers

---
*Phase: 24-los-angeles-data-refresh*
*Completed: 2026-06-02*
