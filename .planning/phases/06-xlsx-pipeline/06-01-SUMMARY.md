---
phase: 06-xlsx-pipeline
plan: 01
subsystem: loaders
tags: [exceljs, xlsx, sha256, dedup, treasury_sync_transactions]
requires:
  - phase: 05-dallas-socrata
    provides: bulkLoadTransactions.js pattern to mirror
provides:
  - scripts/bulkLoadXLSX.js generic XLSX download + parse + dedup + load pipeline
  - exceljs@4.4.0 dependency
affects: [06-02, 06-03]
tech-stack:
  added: [exceljs@4.4.0]
  patterns: [XLSX loader convention, SHA-256 full-row dedup, 500-row RPC batching]
key-files:
  created: [scripts/bulkLoadXLSX.js]
  modified: [package.json]
key-decisions:
  - "exceljs over xlsx (SheetJS): xlsx@0.18.5 has unfixed CVEs on npm (CVE-2023-30533)"
  - "Full-row SHA-256 hash as source_row_id for XLSX dedup — sorted keys before stringify"
  - "500-row RPC batches to treasury_sync_transactions"
  - "Fail-fast on missing fiscal_year / download_url / column_mapping config"
  - "5% parse error threshold: abort entire load if exceeded"
  - "ExcelJS row.values.slice(1) — ExcelJS is 1-indexed, index 0 is always null"
duration: 5min
completed: 2026-05-01
---

# Phase 6 Plan 01: Build Generic XLSX Loader Summary

**Generic XLSX download-parse-dedup-load pipeline using ExcelJS with SHA-256 full-row hashing and 500-row RPC batching.**

## Performance
- Duration: 5 minutes
- Tasks: 3
- Files modified: 2

## Accomplishments
- Installed `exceljs@^4.4.0` under `dependencies` (NOT devDependencies); confirmed no HIGH/CRITICAL npm audit findings; xlsx/SheetJS is not installed
- Created `scripts/bulkLoadXLSX.js` (334 lines) as a fully functional XLSX loader
- `downloadXLSX`: async fetch with `redirect:'follow'`, fail-fast on non-200 HTTP status, content-type warning
- `parseXLSX`: ExcelJS workbook load, `row.values.slice(1)` for 1-indexed ExcelJS arrays, blank-row auto-skip, header-duplicate-row auto-skip, Date-to-ISO conversion, rich-text cell flattening
- `hashRow`: deterministic SHA-256 via `Object.keys(obj).sort()` before `JSON.stringify` — cross-run dedup
- `parseAmount`: strips `$`, commas, handles `(123)` → `-123` parenthetical negatives
- `buildBatch`: produces compact `{a,d,dt,pm,inv,f,ec,dept,prog,vn,lk,rid}` objects; `rid` = full-row SHA-256
- `syncSource`: fail-fast config validation, optional `--force-reload` delete, 5% parse error abort threshold, `--dry-run` preview, 500-row RPC batching, live progress counter, exact summary line format
- `main()`: `--list`, `--source`, `--dry-run`, `--force-reload` CLI flags; handles zero XLSX sources gracefully; `--list` verified clean with no sources yet

## Task Commits
1. **Task 1** - `c3cbf24` (chore) — install exceljs and scaffold bulkLoadXLSX.js skeleton
2. **Task 2** - `edb3ae6` (feat) — implement download, parse, hashRow, buildBatch helpers
3. **Task 3** - `c4ff004` (feat) — implement syncSource and CLI main
**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `scripts/bulkLoadXLSX.js` — Generic XLSX loader, 334 lines, fully implemented
- `package.json` — Added `exceljs@^4.4.0` under dependencies

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| exceljs over xlsx/SheetJS | SheetJS (xlsx) has CVE-2023-30533 — unfixed critical vulnerability on npm |
| SHA-256 full-row hash as rid | No reliable unique ID column in XLSX files; hash of all columns is deterministic dedup |
| Sort keys before JSON.stringify | Key insertion order varies by source; sorted keys ensure same hash across re-downloads |
| 500-row RPC batch size | Balances payload size against round-trip overhead; mirrors bulkLoadTransactions pattern |
| Fail-fast on missing fiscal_year | XLSX uses one data_sources row per FY; missing fiscal_year = misconfigured row, not a default |
| 5% parse error threshold | Graceful tolerance for minor data issues; >5% signals a mapping error, not just noise |
| ExcelJS row.values.slice(1) | ExcelJS uses 1-indexed row.values; index 0 is always null — must slice to get actual values |
| No city-specific branches | dataset_type (transactions/salaries) handled via column_mapping alone — no hardcoded logic |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. `npm audit` returned 4 MODERATE findings (anthropic SDK, postcss, uuid transitive via exceljs) — no HIGH/CRITICAL. None block operation.

## Next Phase Readiness
- `scripts/bulkLoadXLSX.js` is ready for Plan 06-02, which will configure `data_sources` rows with `api_type='xlsx_download'` and run the loader against real city XLSX files

---
*Phase: 06-xlsx-pipeline*
*Completed: 2026-05-01*
