---
phase: 81-towns-virginia-data-model-linking
plan: 02
subsystem: database
tags: [virginia, va, apa, county-linking, state-node, supabase, seeder]

# Dependency graph
requires:
  - phase: 81-01
    provides: "34 VA town municipalities (entity_type='town') loaded with county_id FK available"
  - phase: 80-city-county-loads
    provides: "93 VA county municipalities (entity_type='county') in DB; Warren County absent (documented source gap)"
provides:
  - "Virginia state navigation node (entity_type='state', name='Virginia', state='VA', population=8,631,393 from 2020 Census)"
  - "33 VA town municipalities have county_id set to their parent county (4 towns skipped: 3 absent from DB, 1 whose county is missing)"
  - "data/vaTownCounties.json: authored + sourced 37-entry town→county map with _meta source attribution"
  - "scripts/seedVirginiaDataModel.js: idempotent seeder for Virginia state node + town county_id linking"
affects:
  - 81-03-nav-ui
  - 82-enrichment-parity
  - 83-verification-source-chain-audit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Set-if-different idempotency for county_id linking: read current value, skip UPDATE when already equal"
    - "Authored + sourced JSON lookup file pattern (mirrors federal-enrichment.json, ev-goal.json): _meta.source, _meta.retrieved; file un-excluded from .gitignore"

key-files:
  created:
    - "data/vaTownCounties.json"
    - "scripts/seedVirginiaDataModel.js"
  modified:
    - ".gitignore"

key-decisions:
  - "Virginia state node already existed with pre-v2.7 General Fund budget data (10 rows) — seeder uses treasury_ensure_municipality idempotently; does not add or remove any datasets; the pre-existing data is out of scope for this plan"
  - "Warren County is absent from Phase 80 load (93/95 counties loaded) — Front Royal is skipped/warned in the seeder; will link automatically on a future re-run when Warren County loads"
  - "3 absent towns (Big Stone Gap, Clifton Forge, Vinton) have map entries in vaTownCounties.json so they will auto-link on the first re-run after they load"
  - "Towns spanning multiple counties use their primary/seat county per D-06 (no split towns in the 37-town set)"

# Metrics
duration: 30min
completed: 2026-06-23
---

# Phase 81 Plan 02: Virginia Data Model — State Node + Town County Linking Summary

**Authored a sourced 37-entry town→county map (Census 2020 Geographic Relationship Files) and an idempotent seeder that ensures the Virginia state navigation node and links 33 of 34 loaded towns to their parent county via county_id**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-23T03:45:00Z
- **Completed:** 2026-06-23T04:15:00Z
- **Tasks:** 2
- **Files created/modified:** 3

## Accomplishments

- Created `data/vaTownCounties.json` — sourced 37-entry map keyed by bare town name → county display name; source: U.S. Census Bureau 2020 Census Geographic Relationship Files (place-to-county for Virginia); `_meta.source`, `_meta.retrieved`, `_meta.note` present; un-excluded in `.gitignore` (same pattern as federal-enrichment.json and ev-goal.json)
- Created `scripts/seedVirginiaDataModel.js` — ESM seeder with `--dry-run` support:
  - Step 1: ensures Virginia state node via `treasury_ensure_municipality` (entity_type='state', population=8,631,393 from 2020 Census)
  - Steps 2-3: resolves county + town municipality IDs from DB
  - Step 4: sets county_id on each town only when it differs from current value (set-if-different idempotency)
  - Warns and skips towns not in DB; warns and skips towns whose county is missing; never touches cities or counties
- Dry-run: all 33 linkable towns resolve correctly; 4 skip messages printed (3 absent towns, 1 missing county)
- Live run: 33 towns linked; idempotent re-run: 0 writes, 33 "already set"
- Verified: Vienna → Fairfax County, Leesburg → Loudoun County, Front Royal → NULL (Warren County absent), Alexandria city → NULL, Fairfax County → NULL

## Task Commits

1. **Task 1: Author the sourced town→county map** — `0aa194b` (feat)
2. **Task 2: Idempotent seeder — Virginia state node + town county_id linking** — `55e78fe` (feat)

## Files Created/Modified

- `data/vaTownCounties.json` — 37-entry town→county map with _meta source attribution (U.S. Census 2020 Geographic Relationship Files)
- `scripts/seedVirginiaDataModel.js` — idempotent seeder: Virginia state node + town county_id linking from vaTownCounties.json
- `.gitignore` — un-exclude data/vaTownCounties.json (mirrors pattern for other tracked data/ files)

## Decisions Made

- **Pre-existing Virginia state node with budget data:** The Virginia state node (`c9b21975-bcc2-41d8-9dd8-fd9dcde32506`) already existed with 10 prior-phase General Fund budget rows (data_source='Virginia General Fund Operating/Revenue', FY2022-FY2026). `treasury_ensure_municipality` returns it idempotently. The seeder adds no datasets; CONTEXT D-08's "no budget datasets" applies to what this seeder creates (nothing), not to pre-existing data out of scope. The node serves as a navigation hub regardless.
- **Warren County absent from DB:** 93 of 95 expected VA counties loaded (Phase 80 loaded 127/133 localities; 2 counties are documented source gaps). Front Royal (Warren County seat) is skipped in the seeder with a warning. The vaTownCounties.json map has the correct entry so a future re-run after Warren County loads will link it automatically.
- **37 map entries including 3 absent towns:** Big Stone Gap, Clifton Forge, Vinton are absent from all published APA XLSX years (documented Phase 81-01 source gaps) and are not in the DB. Their entries are included in the map so a future re-run picks them up automatically.

## Deviations from Plan

### Pre-existing Virginia State Node with Budget Data

**Rule 1 (observation only, no fix)** — The Virginia state node already existed with 10 pre-v2.7 General Fund budget rows (data_source='Virginia General Fund Operating Budget/Revenue', FY2022-FY2026, source_url=null). The plan's CONTEXT D-08 says the APA source has no VA state-level budget, and the seeder's truth statement says "no budget datasets." The pre-existing data is from a different source loaded before v2.7 began. The seeder correctly leaves this data untouched (no conflict with the never-overwrite guard since the seeder doesn't write budget rows at all). Documented here — no fix attempted.

### Warren County Absent from Phase 80 Load (Expected)

The Phase 80 load produced 93 VA counties (not 95). Warren County is one of the 2 documented absent counties. Front Royal is the only impacted town in this plan. The seeder's skip-and-warn behavior handles this correctly per plan spec.

## Live Verification Results

| Check | Result |
|-------|--------|
| Virginia state node exists (entity_type='state') | id=c9b21975-bcc2-41d8-9dd8-fd9dcde32506 |
| VA towns with county_id set | 33 of 34 loaded towns |
| Vienna → Fairfax County | PASS |
| Leesburg → Loudoun County | PASS |
| Front Royal county_id | NULL (Warren County absent from DB — expected) |
| Alexandria (city) county_id | NULL (standalone independent city — correct) |
| Fairfax County county_id | NULL (county is a top-level node — correct) |
| Idempotent re-run | 0 writes, 33 "already set" — PASS |
| --dry-run zero writes | PASS |

## Known Stubs

None.

## Threat Flags

None — this plan only writes to `treasury.municipalities.county_id` (existing column) and reads/ensures a state node via a proven RPC. No new network endpoints, auth paths, or schema changes.

## Self-Check

- `data/vaTownCounties.json` — confirmed created with 37 keys and _meta
- `scripts/seedVirginiaDataModel.js` — confirmed created (263 lines)
- `.gitignore` — confirmed modified (vaTownCounties.json un-excluded)
- Commit `0aa194b` — present in git log
- Commit `55e78fe` — present in git log
- Live: 33 VA towns with county_id, Vienna → Fairfax County, Leesburg → Loudoun County confirmed

## Self-Check: PASSED
