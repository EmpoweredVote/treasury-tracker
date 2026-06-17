---
phase: 64-socal-county-government-budgets
plan: "64-01"
subsystem: database
tags: [socal, county-government, sco, bythenumbers, county-budget, fy2003-2024, all-governmental-funds, per-capita]
dependency_graph:
  requires:
    - phase: 57
      provides: loadCountyBudget.js reusable county-gov loader (uctr-c2j8 / emxv-k8xv)
    - phase: 63
      provides: per-FY retry pattern for the flaky SCO host; the 6 SoCal county entities
  provides: [six-socal-county-gov-op-rev-history, county-pages-no-longer-directory-only]
  affects: [Phase-65-salaries, Phase-66-enrichment, Phase-67-acfr-uat]
tech_stack:
  added: []
  patterns: [db-probe-verification, dry-run-canary-gate, never-overwrite-guard, per-fy-retry-loop, canary-fy-first-for-population]
key_files:
  created:
    - .planning/phases/64-socal-county-government-budgets/64-01-SUMMARY.md
  modified: []
key_decisions:
  - "Dry-run canary (D-05): all 6 county entities resolved with feed population present (Riverside 2,442,378 ... Imperial 182,881) before any write"
  - "Live load: FY2024 canary first (locks current population), then FY2003-2023 backfill; 22/22 years clean for all 6, 0 failures, 0 No-data gaps, 0 never-overwrite skips"
  - "Each county: 22 operating + 22 revenue rows (FY2003-2024), all-governmental-funds basis"
  - "Source attribution (D-07): every row carries /d/uctr-c2j8 or /d/emxv-k8xv source_url + source_date 2026-06-17; NULL source_url = 0 across all 6"
  - "Population (D-04): from the SCO county feed, per-year; stored population = current FY2024 value (loaded first) so per-capita renders; all 6 population > 0"
  - "Never-overwrite (D-08): city rows untouched — the county-gov load targets only the entity_type='county' row"
  - "D-09/D-10: production Treasury DB only, $0 spend (free SCO source, no AI)"
requirements-completed: [CGB-01]
duration: "~20min (SCO retries via background load)"
completed: "2026-06-17"
---

# Phase 64 Plan 01: Six SoCal County-Government Budgets Summary

**CGB-01 (SoCal six) satisfied: Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, and Imperial county governments each have operating + revenue loaded for FY2003–2024 (all-governmental-funds basis, every row durably /d/-sourced, per-year feed population), so each county page renders icicle/summary + per-capita instead of directory-only.**

## Performance

- **Duration:** ~20 min (background per-FY load; SCO cooperated — no gap-fill needed)
- **Completed:** 2026-06-17
- **Tasks:** 3/3 (dry-run canary → live load FY2024-first + backfill → verify)
- **Files modified:** 0 source files (DB rows + this SUMMARY only)

## Accomplishments

### Task 1 — Dry-run canary FY2024 (no writes)
For all 6 counties, `loadCountyBudget.js --county "<X>" --fy 2024 --dry-run` resolved the existing county entity (no "not found"), returned FY2024 rows, and reported per-year feed `estimated_population` (Riverside 2,442,378; San Bernardino 2,181,433; San Diego 3,291,101; Ventura 823,863; Santa Barbara 443,623; Imperial 182,881) with non-zero operating + revenue totals — confirming the population-from-feed assumption (D-04) before any live write.

### Task 2 — Live load FY2024-first + backfill FY2003–2023
For each county, the FY2024 canary was loaded for real first (locking the current population), then FY2003–2023 backfilled one fiscal year at a time inside a per-FY retry loop (SCO flakiness mitigation, D-06). **22/22 years loaded clean for all 6 counties — 0 failures, 0 "No data found" gaps, 0 never-overwrite skips.** Sample FY2024 totals (all-governmental-funds): Riverside op $7.58B / rev $7.64B; San Diego op $7.48B / rev $7.62B; Ventura op $3.01B / rev $3.17B; Imperial op $586M / rev $595M.

### Task 3 — Verify (read-only)
Production probe (schema `treasury`, service key):

| County | op rows | rev rows | NULL source_url | population | FY range |
|--------|---------|----------|-----------------|------------|----------|
| Riverside County | 22 | 22 | 0 | 2,442,378 | 2003–2024 |
| San Bernardino County | 22 | 22 | 0 | 2,181,433 | 2003–2024 |
| San Diego County | 22 | 22 | 0 | 3,291,101 | 2003–2024 |
| Ventura County | 22 | 22 | 0 | 823,863 | 2003–2024 |
| Santa Barbara County | 22 | 22 | 0 | 443,623 | 2003–2024 |
| Imperial County | 22 | 22 | 0 | 182,881 | 2003–2024 |

Ventura FY2024 op/rev ($3,010,778,369 / $3,174,363,315) matched the Task 1 canary figures exactly. Probe exited 0.

## Verification

| Must-have | Result |
|-----------|--------|
| County-gov op+rev FY2003–2024, all-funds basis, durably /d/-sourced + per-year pop | ✅ 6×(22 op + 22 rev), NULL source_url=0 |
| Each county population > 0 (FY2024 loaded first) → per-capita renders | ✅ all 6 pop>0 (current values) |
| Pages render icicle/summary + per-capita (no longer directory-only); city rows untouched | ✅ county-gov load targets entity_type='county' only |
| Read-only verification, production DB, $0 | ✅ |

## Deviations

None functionally. Per-FY retry orchestration for the flaky SCO feed (loader unchanged — orchestration only, D-06; `files_modified` stays `[]`). Executed inline on the main working tree (D-11; subagent dispatch hit a session limit during Phase 63, same pattern continued). SCO cooperated this run — no gap-fill pass needed.

## CGB-01 (SoCal six) — SATISFIED

The 6 SoCal county governments are loaded (op+rev, FY2003–2024, all-governmental-funds, durably sourced, per-year population) and verified read-only; pages render icicle/summary + per-capita. Alameda + Sacramento complete CGB-01 in 64-02.
