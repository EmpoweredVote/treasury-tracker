---
phase: 05-dallas-socrata-integration
plan: 02
subsystem: scripts
tags: [socrata, budget, loader, node, rpc, column-mapping]
requires: ["05-01"]
provides:
  - "scripts/bulkLoadBudget.js — generic Socrata budget loader driven by column_mapping"
affects: [05-03]
tech-stack:
  added: []
  patterns:
    - "Data-driven loader: all field names read from data_sources.column_mapping JSON"
    - "2-level category tree (Map<cat, Map<sub, items[]>>) sorted descending by amount"
    - "Zero-amount row filtering: drops rows where both approved and actual are 0"
key-files:
  created: [scripts/bulkLoadBudget.js]
  modified: []
key-decisions:
  - "treasury_sync_budget_tree RPC used (not treasury_sync_budget — does not exist in schema)"
  - "Fiscal year quoted as string in Socrata WHERE clause: bfy='2025' not bfy=2025"
  - "All Socrata amounts parsed via parseFloat() — API returns strings even for numeric fields"
  - "Default source filter: ['operating', 'revenue'] — excludes transactions dataset_type"
duration: 2min
completed: 2026-05-01
---

# Phase 5 Plan 02: Generic Socrata Budget Loader Summary

**Generic Node.js budget loader (254 lines) that reads field names entirely from data_sources.column_mapping, builds a 2-level category tree, and calls treasury_sync_budget_tree — zero city-specific logic in the script.**

## Performance

- Duration: ~2 minutes
- Started: 2026-05-01T22:15:36Z
- Completed: 2026-05-01T22:17:32Z
- Tasks: 1/1
- Files modified: 1 created

## Accomplishments

- Created `scripts/bulkLoadBudget.js` (254 lines)
- `--list` shows all Socrata budget sources (both Dallas + existing LA/WeHo sources)
- Dallas Operating Budget FY2025 dry-run: 1,062 rows, 887 kept, $4.38B total, 200 top-level categories
- Dallas Revenue Budget FY2025 dry-run: 853 rows, 658 kept, $4.13B total, 35 top-level categories
- No city-specific column names, no hardcoded municipality IDs, no Dallas-specific logic

## Task Commits

1. **Task 1: Create scripts/bulkLoadBudget.js** - `ea446b7`

## Files Created/Modified

- `scripts/bulkLoadBudget.js` — Generic Socrata budget loader: source discovery via treasury_list_source_ids, paginated Socrata fetch, 2-level tree builder from column_mapping keys, treasury_sync_budget_tree RPC call, CLI flags (--list, --source, --fy, --dry-run)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| treasury_sync_budget_tree (not treasury_sync_budget) | Confirmed in 05-01 summary: bare treasury_sync_budget does not exist in deployed schema |
| bfy quoted in WHERE: `bfy='2025'` | Socrata stores fiscal year as text; unquoted numeric comparison silently returns 0 rows |
| parseFloat() for all amount fields | Socrata JSON returns all values as strings; typeof check + parseFloat handles both string and numeric input |
| Drop rows where approved === 0 AND actual === 0 | Prevents inflated category counts from placeholder/empty rows; keeps rows that have actual spend even if budget was 0 |
| Default filter: `['operating', 'revenue']` | Distinguishes budget loader from transaction loader; prevents accidentally loading transaction datasets via wrong script |

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

Plan 05-03 (live load Dallas FY2025 + FY2026 + verify in app) can begin immediately. The loader is verified working via dry-run against both Dallas sources. The live load can be run with:

```
node scripts/bulkLoadBudget.js --source "Dallas" --fy 2025 --fy 2026
```

---
*Phase: 05-dallas-socrata-integration*
*Completed: 2026-05-01*
