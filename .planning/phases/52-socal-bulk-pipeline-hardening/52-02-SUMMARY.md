---
phase: 52-socal-bulk-pipeline-hardening
plan: "52-02"
subsystem: infra

# Dependency graph
requires:
  - phase: 52-01
    provides: treasury_sync_city_budget p_source_url/p_source_date params + budgets.source_url/source_date columns
provides:
  - "Hardened bulkLoadStateController.js: any-county, durably sourced, population-persisting, collision-safe (never overwrites other-source data)"
affects: [52-04, phase-53-orange-county]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only collision pre-pass classifies cities before any write (works in dry-run)"
    - "Durable dataset PAGE url (/d/<id>) as source_url, fetch date as source_date"

key-files:
  modified:
    - scripts/bulkLoadStateController.js

key-decisions:
  - "Collision = existing budget for (muni, fy, dataset) whose data_source differs from this run's 'CA State Controller - <label>'. The loader's own prior rows are treated as refreshable (not skipped); other sources (Socrata/LA custom/Anaheim/Santa Ana) are preserved."
  - "source_url uses the durable ByTheNumbers dataset page (https://bythenumbers.sco.ca.gov/d/<id>), never the /resource/*.json API endpoint (D-02)."
  - "fetchDate computed once per run (new Date()), overridable via --source-date; never called inside the per-city loop."
  - "Population backfill guarded with .or('population.is.null,population.eq.0') so a non-zero population is never reset to 0; only writes when the feed provides a value."

patterns-established:
  - "One-command any-county load: --county \"<Name>\" with sourced, population-aware, non-destructive imports."

requirements-completed: [PIPE-01, PIPE-02, PIPE-03]

# Metrics
duration: ~18min
completed: 2026-06-14
---

# Phase 52-02: Reusable, sourced, collision-safe county loader Summary

**bulkLoadStateController.js now loads any CA county with durable source_url/source_date, persists feed population, and refuses to overwrite cities already loaded from another source — all proven by dry-run.**

## Performance
- **Duration:** ~18 min
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- **Source attribution (task 1):** `DATASETS` entries carry a durable `pageUrl` (`https://bythenumbers.sco.ca.gov/d/ju3w-4gxp` / `/d/rrtv-rsj9`); the RPC call passes `p_source_url`/`p_source_date`. `fetchDate` is computed once and overridable via `--source-date` (defaults to today).
- **Population (task 2):** feed `estimated_population` flows to `treasury_ensure_municipality` on create; a guarded update backfills existing cities with 0/NULL population (and sets `population_year`) without ever lowering a non-zero value.
- **Collision policy (task 3):** a read-only pre-pass classifies each city before any write; cities whose `(fy, dataset)` budget came from a different source are SKIPPED + logged, with an end-of-pass count. The skip decision happens before any `treasury_sync_city_budget` call, so no overwrite can occur — and it surfaces in dry-run.

## Task Commits
1. **52-02-01/02/03: source attribution + population + collision policy** — `d3005a0` (feat)

## Files Created/Modified
- `scripts/bulkLoadStateController.js` — hardened loader (DATASETS pageUrl, importCityData signature `(…, ds, fetchDate)` passing source params, population backfill, collision pre-pass + dry-run-aware reporting).

## Decisions Made
See frontmatter key-decisions.

## Deviations from Plan
None functionally. Implementation note: the collision check was implemented as a read-only **pre-pass** over all cities (not inline inside `importCityData`) specifically so SKIP lines appear in `--dry-run` (an explicit acceptance criterion) and so no `ensure_municipality` write happens for skipped cities.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- The mechanism is proven by dry-run (LA County FY2023 → SKIP Los Angeles, Socrata preserved, 87 would import; FY2020 → 0 skipped). Real source_url/source_date/population writes are exercised when Phase 53 loads Orange County.
- 52-04 documents the runbook + runs the non-OC dry-run proof.

---
*Phase: 52-socal-bulk-pipeline-hardening*
*Completed: 2026-06-14*
