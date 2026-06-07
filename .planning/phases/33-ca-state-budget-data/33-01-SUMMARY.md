---
phase: 33-ca-state-budget-data
plan: "01"
subsystem: data
tags: [california, state, seeder, municipality, data_source, xlsx]
dependency_graph:
  requires: [phase-32-state-entity-infrastructure]
  provides: [ca-state-municipality-row, ca-lao-gf-operating-data-source, historical-expenditures-xlsx]
  affects: [scripts/processCA.js, scripts/extractCA.py, scripts/enrichCategories.js]
tech_stack:
  added: []
  patterns: [upsertMunicipality, upsertDataSourceByName, treasury_list_source_ids-verification]
key_files:
  created:
    - scripts/seedCAState.js
    - docs/California/Historical_Expenditures.xlsx (local only, gitignored)
  modified: []
decisions:
  - "fiscal_years: [2022,2023,2024,2025,2026] on single canonical data_source row (Sacramento pattern, not per-FY)"
  - "docs/ is gitignored per project convention; Excel download confirmed locally only, not committed"
metrics:
  duration: "15 minutes"
  completed: "2026-06-07"
  tasks_completed: 2
  files_committed: 1
---

# Phase 33 Plan 01: CA State Municipality Seed + LAO Excel Download Summary

**One-liner:** California seeded as state entity (entity_type='state', 39.5M pop) with LAO xlsx_download data_source and 5.4 MB Excel file downloaded locally.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create docs/California/ and download LAO Excel | (no git artifact — docs/ gitignored) | docs/California/Historical_Expenditures.xlsx (local) |
| 2 | Write and run seedCAState.js | 485fb22 | scripts/seedCAState.js |

## Verification Results

### Task 1: LAO Excel Download
- File downloaded from https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx
- Size: 5,682,780 bytes (5.4 MB) — exceeds 1 MB acceptance criterion
- openpyxl verification: `OK: ['Pivot Table', 'Pivot Table Data']` — 'Pivot Table Data' sheet confirmed present
- HTTP 200 response from LAO.ca.gov

### Task 2: seedCAState.js
- First run: `(inserted new municipality row)`, `(inserted new row)`, exits 0
- Second run (idempotency): `(updated existing municipality row e1007bf5-...)`, `(updated existing row e47a4cb5-...)`, exits 0
- RPC verification: `OK: California General Fund Operating Budget (api_type=xlsx_download, type=operating)`

### DB State (confirmed)
- municipality row: id=e1007bf5-bac9-4b1c-878e-f6834885f850, name=California, state=CA, entity_type=state, population=39500000, population_year=2024
- data_source row: id=e47a4cb5-d69f-4cf5-be10-ada8505296e3, name=California General Fund Operating Budget, api_type=xlsx_download, dataset_id=ca-lao-gf-operating, fiscal_years=[2022,2023,2024,2025,2026]

## Success Criteria Check

- [x] California municipality row in DB: entity_type='state', population=39500000, state='CA'
- [x] Data source row in DB: name='California General Fund Operating Budget', api_type='xlsx_download', dataset_id='ca-lao-gf-operating'
- [x] docs/California/Historical_Expenditures.xlsx present and openpyxl-readable ('Pivot Table Data' sheet confirmed)
- [x] seedCAState.js is idempotent (run twice, exits 0 both times with "updated existing" messages)

## Deviations from Plan

### No Behavioral Deviations

Plan executed exactly as written. One environment observation:

**[Note] docs/ gitignore:** The project gitignores the entire `docs/` directory (per `.gitignore` line 35: `docs/`). This is intentional project convention — large PDF/Excel data files are local-only. The Excel file exists at `docs/California/Historical_Expenditures.xlsx` locally in the worktree. No git commit was made for Task 1 (nothing trackable produced). This matches the pattern for all prior city docs directories (docs/Anaheim/, docs/Bakersfield/, etc.) which also have no git history.

## Known Stubs

None. Both DB rows are fully populated with correct data. Wave 2 (processCA.js + extractCA.py) depends on the data_source ID confirmed above.

## Threat Flags

No new threat surface introduced. SUPABASE_SERVICE_KEY loaded from .env (never logged). LAO.ca.gov is official California government domain (no auth required). The Phase 32 CHECK constraint for entity_type='state' was verified active before this plan ran.

## Self-Check: PASSED

- scripts/seedCAState.js: FOUND
- docs/California/Historical_Expenditures.xlsx: FOUND (local, gitignored)
- 33-01-SUMMARY.md: FOUND
- Commit 485fb22: FOUND
