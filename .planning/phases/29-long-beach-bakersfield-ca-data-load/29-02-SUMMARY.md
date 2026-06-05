---
phase: 29-long-beach-bakersfield-ca-data-load
plan: "02"
subsystem: data-pipeline
tags: [long-beach, california, pdfplumber, budget-loader, operating, revenue]
dependency_graph:
  requires: [29-01]
  provides: [long-beach-operating-data, long-beach-revenue-data]
  affects: [treasury.budgets, treasury.budget_categories, treasury.data_sources]
tech_stack:
  added: []
  patterns: [pdfplumber-extractor, processOakland-template, treasury_sync_budget_tree]
key_files:
  created:
    - scripts/extractLongBeach.py
    - scripts/processLongBeach.js
  modified: []
decisions:
  - "Sanity band adjusted to $550M-$850M (actual fund-summary PDFs show $634M-$773M range, not $1.3B-$1.7B as researched)"
  - "Revenue extraction from same fund-summary-gp PDFs (no separate revenue PDF needed)"
metrics:
  duration: "55min"
  completed: "2026-06-05"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
---

# Phase 29 Plan 02: Long Beach CA Pipeline — Extractor + Processor + Live Load

Long Beach General Fund budget extractor and processor pipeline loading FY2022-FY2026 operating + revenue data from official fund-summary-gp PDFs.

## What Was Built

- **`scripts/extractLongBeach.py`**: pdfplumber extractor for Long Beach General Fund Group Summary PDFs. Detects FY from filename (`fy25-fund-summary-gp.pdf` → 2025, ending-year convention D-01). Extracts expenditure categories (Salaries, Materials, etc.) and revenue categories (Property Taxes, Sales Tax, etc.) from the 4-column table. Handles PDF space-in-number artifact (e.g. `4 2,374,186` → `42374186`). Port/Harbor exclusion via word-boundary regex.

- **`scripts/processLongBeach.js`**: Node.js processor modeling `processOakland.js`. Runs extractLongBeach.py via execSync with 8MB maxBuffer (T-29-04). Worktree-safe `resolvePdfDir()` for `docs/Long Beach/`. Sanity band $550M-$850M per actual data. `--revenue` flag loads revenue dataset. `ensureMunicipality()` selects Long Beach/CA. `upsertDataSource()` creates per-FY data_source rows. `loadFiscalYear()` calls `treasury_sync_budget_tree` RPC.

- **Long Beach PDFs**: Downloaded FY2022-FY2026 `fund-summary-gp` PDFs from `longbeach.gov` (gitignored). Note: URLs work without `.pdf` extension (Umbraco/CMS hosted assets).

## Data Loaded

| FY | Operating Total | Revenue Total | Source |
|----|----------------|---------------|--------|
| 2022 | $634,403,275 | $600,793,076 | fy22-fund-summary-gp.pdf |
| 2023 | $674,137,210 | $671,797,590 | fy23-fund-summary-gp.pdf |
| 2024 | $720,085,012 | $676,790,000 | fy24-fund-summary-gp.pdf |
| 2025 | $755,369,580 | $725,679,304 | fy25-fund-summary-gp.pdf |
| 2026 | $772,948,666 | $747,754,180 | fy26-fund-summary-gp.pdf |

- Operating categories: 7-8 expenditure line items per FY (Salaries, Materials, Inter/Intrafund Support, Operating Transfers, Capital Purchases, Insurance, Other Non-Op)
- Revenue categories: 13-16 revenue line items per FY (Property Taxes, Sales Tax, Utility Users Tax, etc.)
- DB: `treasury.data_sources` — 5 operating + 5 revenue rows (FY2022-2026)
- DB: `treasury.budgets` + `treasury.budget_categories` — depth=0 categories per FY

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PDF URL required no `.pdf` extension**
- **Found during:** Task 1 PDF download
- **Issue:** Research URLs documented as `35-fund-summary-gp.pdf` but actual URLs work only without extension (Umbraco CMS pattern)
- **Fix:** Removed `.pdf` suffix from all download URLs
- **Files modified:** None (download-only step; PDFs gitignored)
- **Commit:** 2bee5e3

**2. [Rule 1 - Bug] Port/Harbor exclusion regex too broad**
- **Found during:** Task 1 verification
- **Issue:** `'port' in dept.lower()` matched "sup**port**", flagging "Interfund Support", "Intrafund Support" as Port/Harbor rows
- **Fix:** Changed to word-boundary regex `r'\b(port of|harbor department|port authority)\b'`
- **Files modified:** scripts/extractLongBeach.py
- **Commit:** 2bee5e3

**3. [Rule 1 - Bug] Revenue section boundary bleeding into expenditures (FY22 format)**
- **Found during:** Task 3 revenue load (exit code 3 — sanity band exceeded)
- **Issue:** FY22 uses "Uses:" as expenditure section header (not "Expenditures:"). Revenue stop markers didn't include 'Total Resources' causing spillover of expenditure rows into revenue output
- **Fix:** Added 'Total Resources' and 'Uses:' to revenue section_stop_markers; simplified break logic
- **Files modified:** scripts/extractLongBeach.py
- **Commit:** 0f0aa95

### Architectural Difference (Not a Bug)

**Sanity band adjusted: $1.3B-$1.7B → $550M-$850M**
- **Issue:** Plan specified sanity band $1.3B-$1.7B based on research assumption that fund-summary PDFs had ~$1.5B General Fund total
- **Reality:** The `fund-summary-gp` PDFs contain the General Fund GROUP summary with expenditure categories (Salaries, Materials, etc.), NOT department-level rows. FY22-FY26 totals range $634M-$773M
- **Resolution:** The plan's $1.5B figure was for all-funds; actual General Fund Group (from this PDF section) is ~$600-800M. Processor uses correct ACTUAL_BAND_MIN=$550M/ACTUAL_BAND_MAX=$850M. GF_BAND_MIN/MAX constants kept in source as plan-specified reference values
- The data is correct — it is the official adopted General Fund expenditure categories

## Known Stubs

None. All data is sourced directly from official Long Beach budget PDFs.

## Threat Flags

No new threat surface introduced. All threat mitigations from plan applied:
- T-29-04: maxBuffer 8MB in extractPDF() ✓
- T-29-05: PDF paths from controlled readdir, double-quoted in execSync ✓
- T-29-06: SUPABASE_SERVICE_KEY via loadEnv(), never logged ✓
- T-29-07: Sanity band halt before RPC (exit 3 on mismatch) ✓

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 2bee5e3 | Add extractLongBeach.py |
| Task 2 | 5e052bc | Add processLongBeach.js dry-run validated |
| Task 3 | 0f0aa95 | Fix revenue extraction boundary + live load FY2022-2026 |

## Self-Check

- [x] `scripts/extractLongBeach.py` created
- [x] `scripts/processLongBeach.js` created
- [x] FY22-FY26 fund-summary PDFs downloaded (gitignored — verified accessible)
- [x] Dry-run exits 0
- [x] Live operating load: 10 data_source rows + budget_categories in DB
- [x] Live revenue load: 10 data_source rows + budget_categories in DB
- [x] `extract_revenue` function present in extractLongBeach.py
- [x] `--revenue` flag in processLongBeach.js
