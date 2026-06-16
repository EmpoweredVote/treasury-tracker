---
phase: 52-socal-bulk-pipeline-hardening
plan: "52-03"
subsystem: infra

# Dependency graph
requires: []
provides:
  - "scripts/seedCountyLinks.js — generic, idempotent, collision-safe county seed + city-link helper for any CA county"
affects: [52-04, phase-54-orange-county-linking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One reusable parameterized seed/link script instead of per-county scripts"

key-files:
  created:
    - scripts/seedCountyLinks.js

key-decisions:
  - "County membership derived from the SCO ByTheNumbers `county` field (ju3w-4gxp $group=entity_name) — same source as the loader, so the linked set matches what bulkLoadStateController.js imports."
  - "Link only where county_id IS NULL or already equals this county; never repoint a city linked elsewhere unless --force (D-06 collision-safety extended to linking)."
  - "Cities in the SCO set but not yet a municipality are reported 'not yet in DB — load budget first' rather than created (linking != loading)."

patterns-established:
  - "Generic county helper: --county/--state/--dry-run/--force; idempotent county reuse via treasury_ensure_municipality."

requirements-completed: [PIPE-01]

# Metrics
duration: ~12min
completed: 2026-06-14
---

# Phase 52-03: Generic county seed + link helper Summary

**scripts/seedCountyLinks.js seeds a county entity and links its member cities by county_id for any CA county in one command, with SCO-derived membership, idempotent county reuse, and collision-safe linking.**

## Performance
- **Duration:** ~12 min
- **Tasks:** 1
- **Files modified:** 1 created

## Accomplishments
- Parameterized helper (`--county`, `--state` default CA, `--dry-run`, `--force`) replacing the hard-coded `seedLACountyLinks.js`.
- County entity ensured via `treasury_ensure_municipality(... 'county' ...)`, reused if present (no duplicates).
- Member city set derived from the SCO `county` field (Socrata `ju3w-4gxp`, `$group=entity_name`) — identical source to the loader.
- Collision-safe linking: sets `county_id` only where NULL or already this county; reports linked-elsewhere as skipped (repoint only with `--force`); reports SCO cities not yet in the DB.

## Task Commits
1. **52-03-01: generic county seed + link helper** — `6d0d41c` (feat)

## Files Created/Modified
- `scripts/seedCountyLinks.js` — generic county seed + link helper.

## Decisions Made
See frontmatter key-decisions.

## Deviations from Plan
None — plan executed as written. (Used `.schema('treasury').from('municipalities')` for the link writes and the `treasury_ensure_municipality` RPC for county creation, matching `seedLACountyLinks.js` / `bulkLoadStateController.js` conventions.)

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- 52-04 can reference `seedCountyLinks.js --county "<Name>"` in the runbook and run its `--dry-run`.
- Verified dry-runs: Los Angeles (county reused, 88 cities already linked → idempotent, 0 new), Ventura (would-create county, 10 cities reported not-yet-in-DB), confirmed no writes (Ventura County row count = 0, LA links unchanged at 88).

---
*Phase: 52-socal-bulk-pipeline-hardening*
*Completed: 2026-06-14*
