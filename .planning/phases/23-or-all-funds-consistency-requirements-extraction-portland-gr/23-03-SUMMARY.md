---
phase: 23-or-all-funds-consistency-requirements-extraction-portland-gr
plan: 03
subsystem: database
tags: [python, pdfplumber, supabase, budget-extraction, troutdale, or-cities]

# Dependency graph
requires:
  - phase: 22-troutdale-or-budget-load
    provides: Troutdale municipality seeded, operating + revenue pipeline (extractTroutdale.py + processTroutdale.js)
provides:
  - extract_requirements() in extractTroutdale.py — section-gate flip REQUIREMENTS->RESOURCES on All Funds Combined page
  - --requirements mode in processTroutdale.js — loads all_funds_requirements dataset type
  - Troutdale all_funds_requirements DB rows for FY2019-FY2026 (8 fiscal years, 7 categories each)
  - DB migration 20260602031258 — expands data_sources_dataset_type_check to include all_funds_requirements
affects: [23-04, frontend-display, plan-language-summary, dataset-tabs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extract_requirements() mirrors extract_revenue() with RESOURCES->REQUIREMENTS gate flip — now used for all 3 OR cities"
    - "all_funds_requirements dataset_type loaded via treasury_sync_budget_tree RPC same as revenue/operating"
    - "DB check constraint expansion via supabase migration repair + db push pattern"

key-files:
  created:
    - supabase/migrations/20260602031258_add_all_funds_requirements_dataset_type.sql
  modified:
    - scripts/extractTroutdale.py
    - scripts/processTroutdale.js

key-decisions:
  - "DB check constraint 'data_sources_dataset_type_check' must be explicitly expanded to include 'all_funds_requirements' before any data can be inserted — required a migration"
  - "Migration applied via supabase CLI repair + db push (not MCP tools — Docker unavailable on this machine); migration file tracked in supabase/migrations/"
  - "Troutdale extract_requirements() uses skip-set approach (TOTAL REQUIREMENTS + RESERVE FOR FUTURE EXPENDITURE) vs Gresham's whitelist — both work because Troutdale Requirements section only contains the 7 expenditure categories plus the 2 skipped rows"
  - "SANITY_MAX already gated on mode === 'operating' — requirements totals (~$81M) exceed the $30M operating cap but the guard was correct as-written"

patterns-established:
  - "extract_requirements() pattern: same page guard as extract_revenue(), flip in_resources->in_requirements gate, skip sum row + $0 row"
  - "processTroutdale.js requirements mode: buildRevenueTree() reused since {category, adopted_amount} shape is identical"

requirements-completed: []

# Metrics
duration: 45min
completed: 2026-06-02
---

# Phase 23 Plan 03: Troutdale All Funds Requirements Extraction Summary

**Troutdale all_funds_requirements extracted from All Funds Combined PDF pages and loaded to DB for FY2019-FY2026 (8 years, 7 categories, FY2026 total $81.18M) via section-gate flip of extract_revenue()**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-02T03:00Z
- **Completed:** 2026-06-02T03:45Z
- **Tasks:** 2
- **Files modified:** 3 (extractTroutdale.py, processTroutdale.js, migration SQL)

## Accomplishments

- Added `extract_requirements()` to `extractTroutdale.py` — near-exact mirror of `extract_revenue()` with the section gate flipped from `RESOURCES` to `REQUIREMENTS`; returns 7 expenditure categories (PERSONNEL SERVICES, MATERIALS & SERVICES, CAPITAL OUTLAY, DEBT SERVICE, TRANSFERS TO OTHER FUNDS, CONTINGENCY, UNAPPROPRIATED) skipping the $0 RESERVE FOR FUTURE EXPENDITURE row and the TOTAL REQUIREMENTS sum row
- Added `--requirements` mode to `processTroutdale.js` with `datasetType='all_funds_requirements'`; reuses `buildRevenueTree()` since `{category, adopted_amount}` shape is identical to revenue rows; SANITY_MAX correctly skips non-operating modes without change
- Applied DB migration to expand `data_sources_dataset_type_check` constraint to include `'all_funds_requirements'` — required for all 3 OR city loaders in Phase 23
- Live-loaded FY2019-FY2026 (8 fiscal years): FY2019=$44,892,732, FY2020=$50,476,759, FY2021=$53,615,534, FY2022=$60,018,803, FY2023=$67,045,462, FY2024=$78,846,457, FY2025=$73,915,316, FY2026=$81,181,238
- Verified idempotency: re-running live load reuses same data_source IDs, delete-before-insert produces 7 rows per FY

## Task Commits

Each task was committed atomically:

1. **Task 1: Add extract_requirements() to extractTroutdale.py** - `407a335` (feat)
2. **Task 2: Add --requirements mode to processTroutdale.js and live-load FY2019-FY2026** - `7f521aa` (feat)

## Files Created/Modified

- `scripts/extractTroutdale.py` — added `extract_requirements()` function (107 lines); extended `--mode` argparse choices to include `'requirements'`; `'requirements'` dispatches to new function
- `scripts/processTroutdale.js` — added `requirements: boolean` to parseArgs; `mode` derivation extended; `extractPDF` pushes `--mode requirements`; `processPDF` sets `isRequirements`, `datasetType='all_funds_requirements'`, `typeLabel='All Funds Requirements'`; `buildRevenueTree` reused for requirements; `upsertDataSource` label extended
- `supabase/migrations/20260602031258_add_all_funds_requirements_dataset_type.sql` — DB migration to drop+recreate `data_sources_dataset_type_check` constraint with `all_funds_requirements` added

## Decisions Made

- **DB constraint expansion required:** The `data_sources_dataset_type_check` CHECK constraint on `treasury.data_sources` blocked inserts with `dataset_type='all_funds_requirements'`. This was a blocking issue (Rule 3). Fixed via Supabase migration — `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` pattern that is idempotent and expands to `('operating', 'revenue', 'salaries', 'transactions', 'all_funds_requirements')`.
- **Migration delivery method:** MCP `mcp__supabase-local` tools were not available (Docker Desktop unavailable on this Windows machine). Used `supabase CLI` (`migration repair` + `db push`) which connected to the remote project `kxsdzaojfaibhuzmclfq` and applied the migration successfully.
- **Skip-set vs whitelist for extract_requirements():** Chose skip-set approach (skip TOTAL REQUIREMENTS + RESERVE FOR FUTURE EXPENDITURE) rather than whitelist. This is viable for Troutdale because the REQUIREMENTS section only has 7 category rows + 2 rows to skip — no department rows like Gresham. The skip-set is simpler and matches the RESEARCH.md specification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DB check constraint rejected all_funds_requirements dataset_type**
- **Found during:** Task 2 (live load attempt)
- **Issue:** `data_sources_dataset_type_check` constraint only allowed `('operating', 'revenue', 'salaries', 'transactions')` — inserting `all_funds_requirements` rows caused constraint violation on every fiscal year
- **Fix:** Created Supabase migration `20260602031258_add_all_funds_requirements_dataset_type.sql` that drops and recreates the constraint with `all_funds_requirements` added; applied via `supabase migration repair` + `supabase db push`
- **Files modified:** `supabase/migrations/20260602031258_add_all_funds_requirements_dataset_type.sql` (new file)
- **Verification:** Test insert with `dataset_type='all_funds_requirements'` succeeded; live load ran to completion inserting all 56 rows (8 FYs x 7 categories)
- **Committed in:** `7f521aa` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — DB constraint)
**Impact on plan:** The constraint expansion was a required prerequisite for all Plan 01/02/03 loaders in Phase 23. No scope creep — the migration is minimal and purpose-specific.

## Issues Encountered

- **supabase db push with empty migration file:** The `supabase migration new` command created the migration file in the main repo, but the Write tool was scoped to the worktree — the initial push sent an empty SQL file (no-op). Repaired via `supabase migration repair --status reverted` then re-pushed with correct content. Migration applied on second push.
- **processTroutdale.js NODE resolution:** Running `node scripts/processTroutdale.js` from `cd /c/treasury-tracker` used the main repo script (without requirements mode). Used absolute path `node /c/treasury-tracker/.claude/worktrees/.../scripts/processTroutdale.js` to invoke the worktree's modified script for dry-run and live load.

## User Setup Required

None - no external service configuration required beyond the DB migration (already applied).

## Known Stubs

None — all data is live from the PDFs and loaded to the DB.

## Threat Flags

None — no new network endpoints or auth paths introduced. Script path handling uses controlled `docs/Troutdale/` readdir with `spawnSync` args array (T-22-01/T-23-03 security comment applies).

## Self-Check

Files exist:
- `scripts/extractTroutdale.py` — FOUND (contains `def extract_requirements`)
- `scripts/processTroutdale.js` — FOUND (contains `all_funds_requirements`)
- `supabase/migrations/20260602031258_add_all_funds_requirements_dataset_type.sql` — FOUND

Commits exist:
- `407a335` — feat(23-03): add extract_requirements() to extractTroutdale.py — FOUND
- `7f521aa` — feat(23-03): add --requirements mode to processTroutdale.js; live-load FY2019-FY2026 — FOUND

DB verification:
- 8 `treasury.data_sources` rows with `dataset_type='all_funds_requirements'` for Troutdale FY2019-FY2026 — CONFIRMED
- 8 `treasury.budgets` rows with correct totals — CONFIRMED (FY2026 $81,181,238 within $1 of expected)

## Self-Check: PASSED

## Next Phase Readiness

- Troutdale `all_funds_requirements` data is loaded and ready for Plan 04 frontend changes
- The DB migration (constraint expansion) also enables Plans 01 and 02 (Gresham and Portland) to load their `all_funds_requirements` data — this was a shared blocker resolved here
- Operating/revenue Troutdale rows are untouched (separate `dataset_type` isolation confirmed)

---
*Phase: 23-or-all-funds-consistency-requirements-extraction-portland-gr*
*Completed: 2026-06-02*
