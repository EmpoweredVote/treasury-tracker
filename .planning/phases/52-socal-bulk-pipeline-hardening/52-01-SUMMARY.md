---
phase: 52-socal-bulk-pipeline-hardening
plan: "52-01"
subsystem: database

# Dependency graph
requires:
  - phase: 49-historical-federal-data-backfill
    provides: additive DEFAULT-NULL RPC-edit pattern; federal source_url/source_date always-sourced convention
provides:
  - "treasury.budgets.source_url + source_date columns (nullable, durable source attribution)"
  - "treasury_sync_city_budget(...,p_source_url,p_source_date) — 9-arg single definition, backward compatible"
affects: [52-02, 52-04, phase-53-orange-county, city-source-chip-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "City budgets now carry source_url/source_date like federal operating/revenue budgets"

key-files:
  created:
    - supabase/migrations/20260614_city_budget_source_attribution.sql
  modified:
    - (live) treasury.budgets
    - (live) public.treasury_sync_city_budget

key-decisions:
  - "Store durable source on treasury.budgets (source_url/source_date) instead of the plan's named treasury.data_sources — the latter is unreachable (budgets.data_source_id FKs to source_registry) and unread by the UI. Approved by Chris 2026-06-14."
  - "COALESCE(param, existing) on the UPDATE so a NULL source param never clobbers an existing value; existing 7-arg callers stay no-ops on the new columns."
  - "Dropped the redundant 7-arg overload created by the arity change to prevent PostgREST named-arg ambiguity (PGRST203)."

patterns-established:
  - "Always-sourced city write path: pipeline-loaded rows persist a durable page URL + fetch date."

requirements-completed: [PIPE-02]

# Metrics
duration: ~25min (incl. schema investigation + prod incident interruption)
completed: 2026-06-14
---

# Phase 52-01: City-budget source attribution primitive Summary

**treasury.budgets gains nullable source_url/source_date columns and treasury_sync_city_budget gains two trailing optional params, so the hardened pipeline can persist a durable source URL + fetch date for every city figure — matching the federal always-sourced bar.**

## Performance

- **Duration:** ~25 min (included live-schema investigation and a mid-task production-build incident handled out of band)
- **Tasks:** 2 (author migration; human-checkpoint apply + probe)
- **Files modified:** 1 migration file + 2 live DB objects

## Accomplishments
- Added `source_url text` + `source_date date` (both nullable, default NULL) to `treasury.budgets`, with comments matching the federal always-sourced convention.
- Extended `public.treasury_sync_city_budget` with trailing `p_source_url text DEFAULT NULL`, `p_source_date date DEFAULT NULL`, written via `COALESCE(param, existing)`.
- Removed the redundant 7-arg overload so exactly one (9-arg) definition remains.
- Applied to production via `mcp__supabase-local__apply_migration` after an explicit GO checkpoint; verified no regression on existing data.

## Task Commits
1. **52-01-01/02: migration (columns + RPC + drop old overload)** — `0131efd` (feat)

## Files Created/Modified
- `supabase/migrations/20260614_city_budget_source_attribution.sql` — additive columns + CREATE OR REPLACE RPC + DROP of the 7-arg overload.
- `(live) treasury.budgets` — two nullable columns added.
- `(live) public.treasury_sync_city_budget` — single 9-arg definition.

## Decisions Made
See key-decisions in frontmatter. Core: the plan's literal target (`treasury.data_sources.base_url`/`last_synced_at`) is structurally unreachable — `budgets.data_source_id` FKs to `source_registry`, the RPC never touched `data_sources`, and the citizen-facing city source is the free-text `budgets.data_source`. Chris approved storing the durable source on `treasury.budgets` (mirroring federal `operating_budgets`/`revenue_budgets`).

## Deviations from Plan

**1. Storage target changed (data_sources → budgets columns)**
- **Issue:** Plan must-haves named `treasury.data_sources.base_url`/`last_synced_at` and assumed the RPC already had data_sources upsert/link logic. Live schema has neither; the FK that would link a budget to a source points at `source_registry`, not `data_sources`.
- **Fix:** Added `source_url`/`source_date` to `treasury.budgets` and wrote them from the RPC — same column names/semantics as the federal always-sourced tables. Downstream 52-02 already speaks in `p_source_url`/`p_source_date`, so its contract is unaffected.
- **Approval:** Explicit user GO (design + apply), 2026-06-14.

**2. Dropped the old 7-arg overload (not in plan)**
- **Issue:** Adding params changes arity, so CREATE OR REPLACE created a 2nd overload; a 7-named-arg PostgREST call would be ambiguous (PGRST203) and could break the live `bulkLoadStateController.js` caller.
- **Fix:** `DROP FUNCTION IF EXISTS` the 7-arg signature; the 9-arg version covers all old call shapes via DEFAULTs.

## Issues Encountered
- Mid-execution, a production Render build failure was reported and prioritized: Tailwind v4 was scanning the whole repo and crashed on a Windows path in a committed planning doc (`\feedba` → invalid code point). Fixed separately (`6653238`, scope Tailwind to `src/`) and pushed. Phase work resumed afterward with no half-applied state.

## User Setup Required
None.

## Next Phase Readiness
- 52-02 can now thread `p_source_url`/`p_source_date` through the RPC. The single 9-arg definition is the only one; positional and named callers resolve unambiguously.
- **Follow-up (out of scope here):** the city source chip UI (`src/data/dataLoader.ts` reads only the free-text `budget.data_source`) does not yet surface `source_url`/`source_date`. Surfacing them for cities is a future frontend task.

---
*Phase: 52-socal-bulk-pipeline-hardening*
*Completed: 2026-06-14*
