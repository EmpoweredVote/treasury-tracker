---
phase: 26-sacramento-ca-data-load
plan: "01"
subsystem: data-load
tags:
  - sacramento
  - california
  - csv-loader
  - budget-data
dependency_graph:
  requires:
    - "scripts/loadSacramentoCSV.js (pre-existing, Phase 26 context)"
    - "Sacramento municipality row (pre-existing, id=9722596e-1102-4aca-8758-c32fc0c1731d)"
    - "county_id FK set by Phase 25"
  provides:
    - "scripts/seedSacramentoCA.js — idempotent Sacramento seeder"
    - "Sacramento Operating Budget + Sacramento Revenue Budget data_sources rows in DB"
    - "Sacramento population = 536000 / population_year = 2024"
    - "14 operating FYs (2013–2026) in treasury.budgets"
    - "14 revenue FYs (2013–2026) in treasury.budgets"
  affects:
    - "treasury.municipalities (population updated)"
    - "treasury.data_sources (two rows upserted)"
    - "treasury.budgets (28 fiscal-year rows refreshed)"
    - "treasury.budget_categories (line items refreshed)"
tech_stack:
  added: []
  patterns:
    - "upsertDataSourceByName pattern from seedCaliforniaCities.js"
    - "treasury_list_source_ids RPC verification pattern"
    - "treasury_sync_budget_tree idempotent delete+reinsert"
key_files:
  created:
    - scripts/seedSacramentoCA.js
  modified: []
decisions:
  - "source_registry not accessible via service role PostgREST (permission denied) — logged as non-blocking WARNING per plan; loader tolerates null sourceRegistryId"
  - "county_id excluded from all seeder payloads — Phase 25 ownership preserved"
  - "Population updated from 535,787 to 536,000 (Census sub-est2024_06.csv SUMLEV=162 value)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-04T14:31:58Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 26 Plan 01: Sacramento CA Data Load Summary

Sacramento CA operating + revenue budget data loaded for FY2013–FY2026 via Open Budget Sacramento CSV loader; idempotent seeder created for population update and data_source bootstrapping.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scripts/seedSacramentoCA.js | 250c65a | scripts/seedSacramentoCA.js |
| 2 | Dry-run then live-run loadSacramentoCSV.js | (DB-only) | — |

## Data Load Results

### Operating Budget

| FY | Total Budget |
|----|-------------|
| 2013 | $1,342,149,366 |
| 2014 | $851,109,452 |
| 2015 | $828,593,876 |
| 2016 | $858,718,871 |
| 2017 | $906,979,132 |
| 2018 | $953,973,022 |
| 2019 | $1,002,190,752 |
| 2020 | $1,087,942,740 |
| 2021 | $1,162,061,128 |
| 2022 | $1,196,607,155 |
| 2023 | $1,317,432,474 |
| 2024 | $1,361,914,429 |
| 2025 | $1,463,120,733 |
| 2026 | **$1,537,138,014** |

**Latest operating FY (2026): $1,537,138,014 (~$1.54B) — within the $1.0B–$2.2B acceptance range.**

### Revenue Budget

| FY | Total Budget |
|----|-------------|
| 2013 | $774,522,141 |
| 2014 | $829,821,521 |
| 2015 | $847,094,957 |
| 2016 | $875,027,669 |
| 2017 | $929,769,582 |
| 2018 | $991,398,348 |
| 2019 | $1,050,885,508 |
| 2020 | $1,158,640,416 |
| 2021 | $1,144,866,842 |
| 2022 | $1,226,072,124 |
| 2023 | $1,376,224,796 |
| 2024 | $1,434,032,338 |
| 2025 | $1,515,522,014 |
| 2026 | $1,566,967,530 |

All 14 revenue FYs have total_budget > 0.

### Skipped / Empty FYs

None — all 14 operating and 14 revenue FY CSVs fetched successfully.

## DB Verification

```
SELECT dataset_type, COUNT(DISTINCT fiscal_year)
FROM treasury.budgets
WHERE municipality_id='9722596e-1102-4aca-8758-c32fc0c1731d'
GROUP BY dataset_type;

 dataset_type | count
--------------+-------
 operating    |    14
 revenue      |    14
```

- Latest operating total: $1,537,138,014 (FY2026) — in range
- Revenue FYs with total > 0: 14 of 14
- Population: 536,000 / population_year: 2024 (updated from 535,787)
- county_id: c813fdcc-758b-4a12-8518-d218f4842229 (Sacramento County — unchanged)

## source_registry Disposition

The `open-budget-sacramento` source_registry row could not be inserted or read:
- SELECT via `supabase.schema('treasury').from('source_registry')` returns `permission denied for table source_registry` (service role is denied by RLS policy)
- INSERT attempt not reached (SELECT fails first)
- Disposition: WARNING logged; attribution remains null; loader tolerates null `sourceRegistryId` — non-blocking per plan

This is consistent with Phase 24 findings: source_registry is not exposed via the default PostgREST schema.

## Deviations from Plan

### Auto-fixed Issues

None.

### Pre-existing State

The Sacramento data_source rows (`Sacramento Operating Budget`, `Sacramento Revenue Budget`) and budget data for FY2013–FY2026 were already present in the DB from a prior run of the loader (likely during development of `loadSacramentoCSV.js`). The seeder correctly detected and updated the existing rows (idempotent upsert). The live load ran `treasury_sync_budget_tree` (delete+reinsert) for all FYs, confirming data integrity.

## Known Stubs

None — all data is wired from the live Open Budget Sacramento CSV source.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced beyond the planned data load.

## Self-Check: PASSED

- scripts/seedSacramentoCA.js: FOUND (250c65a)
- Sacramento Operating Budget data_source: FOUND (d648f919)
- Sacramento Revenue Budget data_source: FOUND (8db408a8)
- Sacramento municipality population = 536000: VERIFIED
- Operating FY2013-FY2026: 14 rows VERIFIED
- Revenue FY2013-FY2026: 14 rows VERIFIED
- Latest operating FY2026 total $1,537,138,014 in range: VERIFIED
