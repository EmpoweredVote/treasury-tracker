---
phase: 06-xlsx-pipeline
plan: 02
subsystem: loaders
tags: [xlsx_download, data_sources, seeder, mckinney, frisco, plano]
requires:
  - phase: 06-xlsx-pipeline plan 01
    provides: bulkLoadXLSX.js loader (updated with local file + header_row support)
provides:
  - scripts/seedXLSXDataSources.js idempotent seeder for all XLSX data_sources rows
  - 18 treasury.data_sources rows seeded
  - 06-02-NOTES.md investigation notes
affects: [06-03]
tech-stack:
  added: []
  patterns: [XLSX seeder mirrors seedDallasDataSources.js idempotent select-by-name pattern]
key-files:
  created: [scripts/seedXLSXDataSources.js, .planning/phases/06-xlsx-pipeline/06-02-NOTES.md]
  modified: [scripts/bulkLoadXLSX.js]
key-decisions:
  - "Plano uses manual export — file:// path in base_url; column_mapping TBD until user inspects file"
  - "McKinney payroll employee names are redacted; employee_number used as vendor_column"
  - "Frisco headers at row 5 — added header_row support to parseXLSX"
  - "Local file support added to downloadXLSX for Plano manual workflow"
  - "dataset_id='fyYYYY' required to satisfy unique(muni,api_type,dataset_id,dataset_type) constraint"
  - "XLSX sources store URL in base_url and fiscal year in fiscal_years array (not download_url/fiscal_year)"
duration: ~45min
completed: 2026-05-01
---

# Phase 6 Plan 02: XLSX Source Investigation + Seeder Summary

**Seeded 18 treasury.data_sources xlsx_download rows (McKinney check FY22-25, McKinney payroll FY22-25, Frisco check FY18-26, Plano placeholder) with header_row and local-file support added to loader**

## Performance
- Duration: ~45min
- Tasks: 3 (investigation + decision checkpoint + seeder build/run)
- Files modified: 3

## Accomplishments
- Investigated Plano (no static URL — dynamic ASP.NET portal), McKinney, Frisco XLSX sources
- Discovered Frisco headers at row 5 — added header_row support to bulkLoadXLSX.js
- Added local file:// support to loader for Plano manual export workflow
- Fixed loader to normalize fiscal_years (array) and base_url from actual DB schema
- Built and ran idempotent seeder — 18 xlsx_download rows in treasury.data_sources
- Verified idempotency: re-run shows all 18 rows as "updated existing row"
- Verified: `node scripts/bulkLoadXLSX.js --list` shows 18 XLSX sources with correct FY

## Task Commits
1. **Task 1: Investigation notes** — `c338dc4` (docs)
2. **Fix: local file + header_row in loader** — `c70bb95` (fix)
3. **Fix: normalize fiscal_years/base_url schema fields** — `c571eb9` (fix)
4. **Task 3: Seeder built and run** — `53df28e` (feat)

**Plan metadata:** `[docs commit hash]` (docs)

## Files Created/Modified
- `.planning/phases/06-xlsx-pipeline/06-02-NOTES.md` — Investigation findings
- `scripts/bulkLoadXLSX.js` — Added local file + header_row support; normalized fiscal_years/base_url
- `scripts/seedXLSXDataSources.js` — Idempotent seeder (18 rows)

## DB State
- treasury.data_sources xlsx_download rows: 18 total
  - McKinney Check Register: 4 rows (FY22-FY25, dataset_type=transactions)
  - McKinney Payroll Register: 4 rows (FY22-FY25, dataset_type=salaries)
  - Frisco Check Register: 9 rows (FY18-FY26, dataset_type=transactions)
  - Plano Check Register: 1 placeholder row (FY25, file:// path, column_mapping TBD)

## Decisions Made
- Plano deferred to manual export (no static URL exists on dynamic portal)
- McKinney payroll uses employee_number as vendor_column (names redacted)
- Frisco needs header_row:5 in column_mapping (4 title rows above headers)
- Added local file support to loader (deviation fix) to support manual-export-plano workflow
- dataset_id='fyYYYY' used for all XLSX sources (required by unique constraint)
- Download URL stored in base_url column; fiscal year in fiscal_years array (schema normalization)

## Deviations from Plan
### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Added header_row support to parseXLSX**
- Found during: Task 3 investigation (Task 1 actually)
- Issue: Frisco XLSX has 4 title rows before headers at row 5
- Fix: Added cm parameter to parseXLSX; headerRow = cm.header_row || 1; skip rows before header row
- Files modified: scripts/bulkLoadXLSX.js
- Commit: c70bb95

**2. [Rule 3 — Blocking] Added local file support to downloadXLSX**
- Found during: Task 3 (triggered by user decision: manual-export-plano)
- Issue: Plano has no static download URL; user must manually export and place file locally
- Fix: Handle file:// URLs and plain local paths in downloadXLSX via readFileSync
- Files modified: scripts/bulkLoadXLSX.js
- Commit: c70bb95

**3. [Rule 1 — Bug] Fixed schema field name mismatch in loader and seeder**
- Found during: Step C (seeder run failed with "Could not find 'download_url' column")
- Issue: Loader used ds.fiscal_year/ds.download_url but schema has fiscal_years (array) and base_url
- Fix: Seeder uses base_url and fiscal_years:[YYYY]; loader normalizes to local vars
- Files modified: scripts/bulkLoadXLSX.js, scripts/seedXLSXDataSources.js
- Commit: c571eb9

**4. [Rule 1 — Bug] Added dataset_id='fyYYYY' to satisfy unique constraint**
- Found during: Step C (second seeder row failed with duplicate key on idx_data_sources_unique_dataset)
- Issue: Constraint is unique(municipality_id, api_type, COALESCE(dataset_id,''), dataset_type) — all XLSX rows for same city+type collapsed to same key when dataset_id is null
- Fix: Set dataset_id='fyYYYY' per row; cleaned up partial insert before re-running
- Files modified: scripts/seedXLSXDataSources.js
- Commit: 53df28e

## Issues Encountered
None beyond the four deviations above (all auto-fixed).

## Next Phase Readiness
- McKinney + Frisco are ready to live-load in Plan 06-03
- Plano: user must download XLSX from checkregister.plano.gov, place at `C:/Users/Chris/Downloads/plano_checkregister_fy25.xlsx`, then inspect headers and update the Plano row's column_mapping before loading

---
*Phase: 06-xlsx-pipeline*
*Completed: 2026-05-01*
