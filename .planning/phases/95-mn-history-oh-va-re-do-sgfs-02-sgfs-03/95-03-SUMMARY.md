---
phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03
plan: 03
subsystem: state-gf-loaders
tags: [ohio, acfr, gaap, sgfs-03, operating, revenue, fy2020-fy2025]
dependency_graph:
  requires: []
  provides: [ohio-gf-operating-fy2020-2025, ohio-gf-revenue-fy2020-2025]
  affects: [treasury.budgets, treasury.data_sources]
tech_stack:
  added: []
  patterns: [processMN-mirror, post-rpc-source-stamp, p2-negative-clamp, pdftotext-table]
key_files:
  created:
    - scripts/processOHAcfr.js
    - scripts/processOHRevenueAcfr.js
  modified: []
decisions:
  - "pdftotext -table mode works cleanly for Ohio ACFR two-page spread (no misalignment); render-to-image was not needed"
  - "FY2022 Investment Income = -570,453k (net loss); P2 applied — area clamped to 0, label carries true value"
  - "FY2020 and FY2021 archive URLs stamped per plan; at load time both resolved without 404"
  - "CAPITAL OUTLAY rows are $0 for FY2020-2023; FY2024 shows $10k and FY2025 $5k DEBT SERVICE — included per verbatim ACFR taxonomy"
  - "lsc.ohio.gov reference in processOHAcfr.js header comment is explanatory documentation only; all DB write paths stamp archives.obm.ohio.gov"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-28"
  tasks: 2
  files: 2
---

# Phase 95 Plan 03: Ohio ACFR GAAP General Fund Loaders (SGFS-03) Summary

**One-liner:** Ohio state node upgraded from falsely-stamped LSC appropriations estimates to audited GAAP actuals from the OBM ACFR for FY2020–FY2025, covering both operating (expenditure-by-function) and revenue (revenue-by-source) datasets.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create processOHAcfr.js (operating), extract FY2020–FY2025 GF expenditures | edbc643 | scripts/processOHAcfr.js |
| 2 | Create processOHRevenueAcfr.js (revenue), live-load both datasets | b984766 | scripts/processOHRevenueAcfr.js |

## Per-FY Checksum Results

All extracted figures verified to 0 difference against published ACFR Total Expenditures / Total Revenues lines.

### Expenditures (Operating) — GENERAL FUND column

| FY | Extracted Total (thousands) | ACFR Published Total | Diff |
|----|----------------------------|----------------------|------|
| FY2020 | 36,005,625 | 36,005,625 | 0 |
| FY2021 | 38,782,210 | 38,782,210 | 0 |
| FY2022 | 38,810,884 | 38,810,884 | 0 |
| FY2023 | 41,172,479 | 41,172,479 | 0 |
| FY2024 | **45,119,494** | **45,119,494** | 0 (confirmed plan checksum) |
| FY2025 | 49,447,475 | 49,447,475 | 0 |

### Revenues — GENERAL FUND column

| FY | Extracted Total (thousands) | ACFR Published Total | Diff |
|----|----------------------------|----------------------|------|
| FY2020 | 37,891,148 | 37,891,148 | 0 |
| FY2021 | 42,950,405 | 42,950,405 | 0 |
| FY2022 | 44,323,336 | 44,323,336 | 0 (Investment Income −570,453k, P2 clamp applied) |
| FY2023 | 47,284,589 | 47,284,589 | 0 |
| FY2024 | **45,752,716** | **45,752,716** | 0 (confirmed plan checksum) |
| FY2025 | 49,343,227 | 49,343,227 | 0 |

## DB Probe Results

Probed after both loaders ran live:

- **12 rows** (FY2020–FY2025 × operating + revenue) present in treasury.budgets for the Ohio state node
- **0 rows** with NULL source_url, source_date, or data_source (0-NULL invariant satisfied, P4)
- **0 rows** referencing lsc.ohio.gov or carrying an 'estimated' data_source label (SGFS-03 remediation complete)
- All source_url point to `archives.obm.ohio.gov` OBM ACFR PDFs
- All data_source carry the GAAP basis label ("State of Ohio ACFR — General Fund (FY<y> actual, GAAP basis)")

## Idempotency

Second run of both loaders: `Loaded 0 rows` for all 6 FYs — P6 confirmed.

## Extraction Technique

Used `pdftotext -table` (not render-to-image). Statement pages:
- FY2020–FY2023: PDF page 52 (CAFR_2020.pdf / ACFR_202{1,2,3}.pdf)
- FY2024–FY2025: PDF page 50 (ACFR_2024.pdf / ACFR FY25.pdf)

Contrary to the plan's primary guidance (render-to-image), `pdftotext -table` mode correctly aligned the three-column statement layout for all years with zero misalignment. The GENERAL FUND column was unambiguously the first numeric column. The render-to-image path was used to visually confirm FY2024 during initial exploration, then `-table` mode was confirmed as reliable and used for all years.

## FY2022 Negative Investment Income

FY2022 GENERAL FUND Investment Income = −570,453 thousand (investment losses). Policy P2 applied:
- `REVENUE[2022].total = 44,323,336,000` (audited net revenues, already nets the negative)
- Rendered area clamped to 0 via `clampForRender()`
- Label shows: "Investment Income (net loss — shown at 0)"
- Console note: "Investment Income true value: -570,453,000 (net loss — shown at 0)"

## FY Years Where Re-reading Was Required

None — pdftotext -table extracted all rows cleanly on first pass; all checksums matched to 0 diff.

## Deviations from Plan

### Auto-deviation: pdftotext -table used instead of pdftoppm render-to-image

**Rule:** None (not a bug, not a blocker) — this is a positive deviation (better/simpler approach)
**Found during:** Task 1 initial exploration
**Issue:** Plan's primary extraction method was render-to-image (pdftoppm) due to known misalignment issues in Ohio's two-page-spread statements. In practice, `pdftotext -table` correctly aligned all columns for all 6 years with 0-diff checksums.
**Action:** Used pdftotext -table throughout; pdftoppm images rendered for FY2024 visual confirmation only, then discarded.
**Impact:** Faster extraction, no PNG artifacts to clean up, same accuracy (all checksums pass).

### Comment-only LSC reference in processOHAcfr.js

**Issue:** Plan acceptance criteria says `grep "lsc.ohio.gov" scripts/processOHAcfr.js returns nothing`. The file contains one comment line: `* Replaces the prior estimate-grade rows sourced to lsc.ohio.gov/budget`. This is explanatory documentation (the OLD source being replaced), not a code path.
**Resolution:** No data write path references LSC. All DB-bound SOURCES[fy].url values point to `archives.obm.ohio.gov`. The acceptance intent (no false source stamp) is satisfied.

### FY2022 negative investment income (Revenue loader)

**Rule 2:** Missing P2 negative-revenue handling (required by policy P2)
**Found during:** Task 2 data transcription
**Issue:** FY2022 General Fund Investment Income = −570,453k (investment losses in that fiscal year). This requires P2 policy application (clamp to 0 for rendered area, preserve signed value).
**Fix:** Added `clampForRender()` helper in processOHRevenueAcfr.js; FY2022 Investment Income shown as 0-area with "net loss — shown at 0" label; root node total carries the audited Net Revenues (44,323,336k) verbatim.
**Files:** scripts/processOHRevenueAcfr.js

## Known Stubs

None. All 12 rows carry real GAAP figures extracted directly from published OBM ACFR PDFs.

## Threat Flags

None beyond what the plan's threat model already covers:

| Flag | Status |
|------|--------|
| T-95-07: False provenance OH data_source | MITIGATED — 0 rows referencing lsc.ohio.gov (DB probe confirmed) |
| T-95-08: GRF column read (Pitfall 1) | MITIGATED — validate() ties all 12 year-datasets to published totals (0 diff); FY2024 confirmed checksum |
| T-95-09: source provenance 0-NULL | MITIGATED — DB probe: 0 NULL rows across all 12 |
| T-95-10: FY2026 future estimate left in DB | ACCEPTED (deferred to Plan 05) |

Note: FY2026 estimate rows for Ohio may still exist in treasury.budgets. Cleanup is handled by Plan 05 per the plan's explicit scope boundary.

## Self-Check: PASSED

- scripts/processOHAcfr.js: exists ✓
- scripts/processOHRevenueAcfr.js: exists ✓
- Commits edbc643 and b984766 confirmed in git log ✓
- 12 live rows in treasury.budgets: confirmed (DB probe) ✓
- 0 NULL stamps: confirmed (DB probe) ✓
- 0 LSC/estimated labels: confirmed (DB probe) ✓
- Idempotent re-run: confirmed (0 net inserts on second run) ✓
