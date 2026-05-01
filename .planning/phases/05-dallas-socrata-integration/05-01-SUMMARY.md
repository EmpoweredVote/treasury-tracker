---
phase: 05-dallas-socrata-integration
plan: 01
subsystem: database
tags: [supabase, socrata, data-sources, dallas]
requires: []
provides:
  - "Dallas data_sources rows seeded (operating + revenue)"
affects: [05-02, 05-03]
tech-stack:
  added: []
  patterns: ["idempotent select-then-insert/update by name (no unique constraint on name in DB)"]
key-files:
  created: [scripts/seedDallasDataSources.js]
  modified: []
key-decisions:
  - "Used select-by-name then insert/update instead of .upsert(onConflict: 'name') — no unique constraint on data_sources.name exists in the DB; primary key (id) is the only unique constraint"
  - "supabase.schema('treasury').from('data_sources') with select/insert/update — same treasury schema access pattern as seedCollinCountyMunicipalities.js"
duration: 4min
completed: 2026-05-01
---

# Phase 5 Plan 01: Dallas data_sources Seeder Summary

**Created two idempotent treasury.data_sources rows (operating + revenue) for Dallas Socrata budget loading, seeded with correct column_mapping, dataset_id, fiscal_years, and municipality_id.**

## Performance

- Duration: ~4 minutes
- Started: 2026-05-01T22:07:44Z
- Completed: 2026-05-01T22:11:41Z
- Tasks: 1/1
- Files modified: 1 created

## Accomplishments

- Created `scripts/seedDallasDataSources.js` (174 lines)
- Inserted 'Dallas Operating Budget' row (id: 443a5578-568c-4684-8d47-43ef5f10e773, dataset e2fs-y4nb)
- Inserted 'Dallas Revenue Budget' row (id: 493449a0-d4fd-43aa-b989-71f758edf2e6, dataset rtn4-pmj9)
- Both rows linked to Dallas municipality_id `17ce5baf-277d-41c9-a3f6-2e44f9def106`
- Both rows declare `fiscal_years: [2025, 2026]`
- Verified via `treasury_list_source_ids` RPC — returns exactly 2 Dallas budget rows
- Idempotency confirmed: second run updated existing rows in-place with identical DB state

## Task Commits

1. **Task 1: Create scripts/seedDallasDataSources.js** - `df3a8f7`

## Files Created/Modified

- `scripts/seedDallasDataSources.js` - Node.js seeder that idempotently upserts both Dallas data_sources rows and verifies via treasury_list_source_ids RPC

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| select-then-insert/update idempotency | `treasury.data_sources` has no unique constraint on `name` — only the primary key `id` is unique. The plan specified `onConflict: 'name'` but Postgres rejected it. Implemented equivalent idempotency via: (1) SELECT by name, (2) UPDATE if found, INSERT if not. |
| supabase.schema('treasury').from('data_sources') | Direct table access via schema() method, same pattern as seedCollinCountyMunicipalities.js |
| No treasury_sync_budget or treasury_sync_budget_tree calls | Seeder only writes data_sources rows; budget loading is deferred to Plan 05-02 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ON CONFLICT (name) constraint does not exist**

- **Found during:** Task 1 execution — `.upsert(src, { onConflict: 'name' })` returned `"there is no unique or exclusion constraint matching the ON CONFLICT specification"`
- **Issue:** The plan specified `onConflict: 'name'` but `treasury.data_sources` has no unique index on `name`. Explored `(municipality_id, name)` and `(municipality_id, dataset_id)` combinations — none exist. Only `id` (primary key) is unique.
- **Fix:** Replaced `.upsert()` with a select-first-then-insert/update pattern: query by `name`, then UPDATE if found or INSERT if not. Achieves identical idempotent semantics.
- **Files modified:** `scripts/seedDallasDataSources.js`
- **Commit:** df3a8f7

## Issues Encountered

- No `.env.local` file present; `SUPABASE_SERVICE_ROLE_KEY` was available as a shell env var and picked up automatically via `process.env.SUPABASE_SERVICE_ROLE_KEY`.

## Next Phase Readiness

Plan 05-02 (bulkLoadBudget.js) can now begin — both Dallas data_sources rows are seeded and discoverable via `treasury_list_source_ids`. The loader can select by `api_type='socrata'` and `dataset_type IN ('operating','revenue')` to find the Dallas rows.

---
*Phase: 05-dallas-socrata-integration*
*Completed: 2026-05-01*
