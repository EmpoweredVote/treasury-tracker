---
phase: 32-state-entity-infrastructure
plan: 01
subsystem: database
tags: [postgres, migration, check-constraint, municipalities, entity-type]

requires: []
provides:
  - municipalities_entity_type_check CHECK constraint live in treasury.municipalities
  - entity_type = 'state' accepted by DB; invalid values rejected
affects:
  - 33-ca-state-budget-data (CA state row INSERT)
  - any future entity_type additions

tech-stack:
  added: []
  patterns:
    - "CHECK constraint pattern: ALTER TABLE ADD CONSTRAINT ... CHECK (entity_type IN (...))"

key-files:
  created:
    - supabase/migrations/20260606000000_add_state_entity_type.sql
  modified: []

key-decisions:
  - "Expanded CHECK constraint from 5 planned values to 11 — production table had municipality, special_district, school_district, conservancy, library, town beyond the planned set; constraint would fail on apply without them"

patterns-established:
  - "Always query actual entity_type distribution before writing a CHECK constraint — plan-time assumptions about data may be stale"

requirements-completed:
  - INFRA-01

duration: 10min
completed: 2026-06-06
---

# Phase 32-01: entity_type CHECK Constraint Migration Summary

**`municipalities_entity_type_check` CHECK constraint live in treasury.municipalities — entity_type='state' now accepted and all invalid values rejected by DB.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-06
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created and applied `supabase/migrations/20260606000000_add_state_entity_type.sql`
- `municipalities_entity_type_check` constraint is live in local Supabase instance
- Functional INSERT test with `entity_type='state'` passed; test row cleaned up
- All 509 existing municipality rows satisfy the constraint (no data disruption)

## Task Commits

1. **Task 1: Write and apply the entity_type CHECK constraint migration** - `06e45ab` (feat)

## Files Created/Modified
- `supabase/migrations/20260606000000_add_state_entity_type.sql` — CHECK constraint covering all 11 live entity_type values

## Decisions Made
None beyond the auto-fix described below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] Expanded CHECK constraint to cover all live entity_type values**
- **Found during:** Task 1 — migration apply failed with "check constraint violated by some row"
- **Issue:** Production table has 10 distinct entity_type values; plan specified only 5 (`city`, `county`, `township`, `nonprofit`, `state`). The other 6 (`municipality`, `special_district`, `school_district`, `conservancy`, `library`, `town`) are present in real data and would violate the constraint as written.
- **Fix:** Queried `SELECT entity_type, COUNT(*) FROM treasury.municipalities GROUP BY entity_type` to discover all live values; rewrote constraint to include all 11 values.
- **Files modified:** `supabase/migrations/20260606000000_add_state_entity_type.sql`
- **Verification:** `pg_constraint` query returns the constraint with all 11 values; migration applied successfully; INSERT with `entity_type='state'` returns a row.
- **Committed in:** `06e45ab` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking — constraint would not apply without the fix)
**Impact on plan:** No scope creep. Primary goal (accepting 'state', rejecting invalid values) fully achieved. The expanded constraint is strictly more correct — it now reflects actual live data.

## Issues Encountered
None beyond the auto-fix above.

## Next Phase Readiness
- INFRA-01 satisfied: treasury.municipalities enforces entity_type values and accepts 'state'
- Phase 33 CA state row INSERT will succeed against the constraint
- Note: 6 additional entity_type values (`municipality`, `special_district`, `school_district`, `conservancy`, `library`, `town`) are live in DB but not in TypeScript union — future phases may want to align them

---
*Phase: 32-state-entity-infrastructure*
*Completed: 2026-06-06*
