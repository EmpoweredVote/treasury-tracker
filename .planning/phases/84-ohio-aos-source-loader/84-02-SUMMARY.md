---
phase: 84-ohio-aos-source-loader
plan: "02"
subsystem: data-loader
tags: [ohio, aos, xlsx, exceljs, manifest, gaap, cash, mod, basis, dry-run, source-url]
dependency_graph:
  requires: [scripts/loadOhioAOS.js, _oh-recon/City_2024_GAAP_Summarized.XLSX]
  provides: [scripts/ohioAosDatasets.json, scripts/loadOhioAOS.js (CASH/MOD support + resolveSourceUrl)]
  affects: []
tech_stack:
  added: []
  patterns: [basis-aware-layout-detection, manifest-driven-source-url, multi-format-xlsx-parse]
key_files:
  created:
    - scripts/ohioAosDatasets.json
  modified:
    - scripts/loadOhioAOS.js
decisions:
  - "CASH/MOD workbooks use SORDACIFB_TotalGov sheet (not SOREACIFB_TotalGov); detectLayout() auto-detects by sheet name presence"
  - "CASH/MOD layout has different row offsets: header row 6 (not 7), data row 7 (not 8), entity col 2 (not 1), county col 4 (not 2)"
  - "OI_Demographics offsets also differ per basis: GAAP header row 4/data row 5/entity col 1; CASH/MOD header row 3/data row 4/entity col 2"
  - "resolveSourceUrl(fiscalYear, basis) provides synchronous manifest lookup for Phase 85 bulk loader (D-05)"
  - "All 30 FY*basis combinations resolve (FY2016-2025 * GAAP/CASH/MOD); floor = 2016; pre-2016 .XLS files documented as out of scope"
  - "CASH disbursements label Police as Security Of Persons And Property Police (longer label) — preserved verbatim as the citizen-facing leaf node"
metrics:
  duration: "~30 minutes"
  completed: "2026-06-25"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements: [OHSRC-02]
---

# Phase 84 Plan 02: Ohio AOS Proof + FY*Basis Manifest Summary

**One-liner:** De-risk gate passed (Columbus FY2024 GAAP $2.166B revenue) + CASH fallback proven (Kenton FY2024) + committed 30-entry FY2016-2025 * GAAP/CASH/MOD manifest with auto-resolved source_url per (FY, basis).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Prove loader — Columbus FY2024 GAAP (de-risk gate) + CASH fallback path | 4a4498b | scripts/loadOhioAOS.js |
| 2 | Discover FY*basis range + write committed manifest + wire resolveSourceUrl | cd4737f | scripts/ohioAosDatasets.json, scripts/loadOhioAOS.js |

## Verification

### GAAP de-risk gate (Columbus FY2024)

- Revenue total: $2,166,549,000 (target $2.166B, delta 0.025%) ✓
- Income Taxes: $1,144,941,000 (target $1.145B, delta 0.004%) ✓
- Police: $810,082,000 (target $810M, delta 0.01%) ✓
- Population: 913,985 ✓
- Basis: GAAP ✓
- Source URL auto-resolved: `https://ohioauditor.gov/.../City_2024_GAAP_Summarized.XLSX` ✓
- Zero DB writes (dry-run) ✓

### Second GAAP city (Cincinnati FY2024)

- Revenue: $1,008,324,000, Operating: $1,004,641,000 (both finite non-zero) ✓
- Population: 311,097 (non-zero) ✓
- Flat tree: 10 revenue sources, 13 expenditure functions ✓

### CASH fallback path (Kenton FY2024)

- Revenue: $8,360,100, Operating: $8,076,514 (finite non-zero) ✓
- Population: 7,802 (present) ✓
- Basis: CASH ✓
- Flat tree: 10 revenue sources, 9 expenditure functions ✓
- Zero DB writes (dry-run) ✓

### FY*basis manifest

- `scripts/ohioAosDatasets.json` valid JSON, 30 entries ✓
- FY2024 GAAP entry present with URL ending `.XLSX` ✓
- Floor = 2016 documented ✓
- CASH + MOD entries present for all 10 years ✓
- All 30 URLs probed HTTP 200 with non-trivial content-length ✓
- All entries have fiscal_year, basis, url fields ✓

### resolveSourceUrl() wiring

- `resolveSourceUrl(2024, 'GAAP')` returns the FY2024 GAAP URL ✓
- CLI auto-resolves source_url when `--source-url` not provided ✓
- 16/16 unit tests pass after all refactoring ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CASH/MOD workbooks use a different sheet name and layout from GAAP**
- **Found during:** Task 1 — downloading `City_2024_CASH_Summarized.XLSX` and inspecting it
- **Issue:** The CASH/MOD workbooks use `SORDACIFB_TotalGov` (not `SOREACIFB_TotalGov`) as the financial sheet name. Column offsets also differ: header row 6 (GAAP: 7), entity col 2 (GAAP: 1), county col 4 (GAAP: 2), receipt sources in cols 5-17 (GAAP: 3-15), disbursements in cols 19-36 (GAAP: 17-34). `OI_Demographics` also has different row offsets in CASH/MOD workbooks. Without this fix, `buildRevenueTree` / `buildExpenditureTree` / `cityPopulation` / `cityCounty` would all fail on CASH/MOD workbooks.
- **Fix:** Added `detectLayout(workbook)` which inspects which sheet name is present and returns the correct layout descriptor. All tree builders and population/county lookups now use layout-aware row/column constants. Existing GAAP behavior is preserved byte-for-byte (16/16 tests still pass).
- **Files modified:** scripts/loadOhioAOS.js
- **Commit:** 4a4498b

## Known Stubs

None — all exported functions are fully implemented. The `resolveSourceUrl()` function reads the committed manifest directly; no placeholder data paths.

## Threat Flags

None — no new network endpoints, auth paths, schema changes, or trust boundaries introduced. The manifest file is static JSON committed to the repo; `resolveSourceUrl()` reads it synchronously from disk.

## Self-Check: PASSED

- `scripts/ohioAosDatasets.json` exists ✓
- `scripts/loadOhioAOS.js` exists ✓
- Commit 4a4498b in git log ✓
- Commit cd4737f in git log ✓
- 16/16 unit tests pass ✓
- Columbus FY2024 GAAP: revenue $2,166,549,000, Income Taxes $1,144,941,000, Police $810,082,000, pop 913,985 ✓
- Kenton FY2024 CASH: revenue $8,360,100, operating $8,076,514, pop 7,802 ✓
- Manifest: 30 entries, floor=2016, all entries have fiscal_year+basis+url ✓
