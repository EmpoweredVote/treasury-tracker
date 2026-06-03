---
phase: 23-or-all-funds-consistency-requirements-extraction-portland-gr
plan: 02
subsystem: database
tags: [pdfplumber, python, nodejs, supabase, portland, all-funds-requirements]

# Dependency graph
requires:
  - phase: 17-portland-or-budget-load
    provides: extractPortland.py (extract_budget, extract_revenue, parse_money, detect_fiscal_year) and processPortland.js loader patterns
  - phase: 23-or-all-funds-consistency-requirements-extraction-portland-gr
    provides: Plan 01 context (research, patterns confirming Vol 1 location, D-07)
provides:
  - extract_requirements() in extractPortland.py — table-based, multi-page extraction from Vol 1 All Funds page
  - processPortland.js --requirements mode routing to vol1 with all_funds_requirements dataset_type
  - Portland all_funds_requirements budget rows in DB for FY2022-FY2026
  - data_sources rows for Portland all_funds_requirements FY2022-FY2026
affects:
  - 23-03 (Gresham requirements load — parallel wave)
  - 23-04 (frontend display of all_funds_requirements total for Portland)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_detect_fy_allfunds(): pick last FY match from multi-column header row to get Adopted year"
    - "Section gating via 'Total NET Budget' boundary (not section header names) — handles both FY2022-24 empty-string headers and FY2026 'Requirements' compound headers"
    - "Reconciliation fallback: if line-item sum differs >1% from published Total Requirements, capture Total Requirements row directly as single category"
    - "buildCategoryTree() covers both revenue (resources_total field) and requirements (adopted_amount field) rows"

key-files:
  created: []
  modified:
    - scripts/extractPortland.py
    - scripts/processPortland.js

key-decisions:
  - "Fallback to single 'Total Requirements' row when line items miss Ending Fund Balance — FY2022/23/25/26 all use fallback; FY2024 reconciles within 0.45%"
  - "Store gross Total Requirements figure (not NET after intracity transfers) per planner lock — consistent with Gresham/Troutdale approach"
  - "requirements mode uses vol1 suffix (same as operating) — D-07 verified: All Funds page is in Vol 1, not Vol 2"
  - "buildCategoryTree() replaces buildRevenueTree() as shared builder supporting adopted_amount and resources_total fields"

patterns-established:
  - "_detect_fy_allfunds(): use last regex match from FY column header row (Adopted = rightmost)"
  - "Section gate: track 'past_resources_net_budget' flag on Total NET Budget row — works across all Portland FY formats"
  - "Reconciliation fallback: capture Total Requirements row as single node when sum diverges >1%"

requirements-completed: []

# Metrics
duration: 23min
completed: 2026-06-02
---

# Phase 23 Plan 02: Portland All Funds Requirements Extraction Summary

**table-based extract_requirements() from Vol 1 All Funds page with multi-page continuation and reconciliation fallback, loading Portland all_funds_requirements for FY2022-FY2026 ($5.9B-$8.6B)**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-06-02T03:00:26Z
- **Completed:** 2026-06-02T03:23:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `extract_requirements()` to `scripts/extractPortland.py` using `page.extract_tables()` with section gating via `Total NET Budget` boundary, multi-page continuation for FY2026 (pages 116-117), FY detection using last match from multi-column header row, and reconciliation fallback to capture `Total Requirements` row directly when line-item sum diverges >1%
- Extended `scripts/processPortland.js` with `--requirements` flag, vol1 routing (same as operating, D-07 verified), `buildCategoryTree()` supporting both `adopted_amount` and `resources_total` fields, and `all_funds_requirements` dataset labeling
- Live-loaded Portland all_funds_requirements for all 5 FYs: FY2022 $5,887,491,065 / FY2023 $6,803,423,249 / FY2024 $7,084,434,718 / FY2025 $8,281,926,518 / FY2026 $8,641,210,277; idempotency confirmed

## Task Commits

1. **Task 1: Add table-based, multi-page extract_requirements() to extractPortland.py** - `2d6cbb0` (feat)
2. **Task 2: Add --requirements mode (vol1 routing) to processPortland.js and live-load FY2022-2026** - `4ff21dc` (feat)

## Files Created/Modified

- `scripts/extractPortland.py` - Added `PORTLAND_REQUIREMENTS_SKIP`, `_detect_fy_allfunds()`, `extract_requirements()` with section gating and reconciliation fallback; extended `--mode` choices to include `requirements`
- `scripts/processPortland.js` - Added `--requirements` flag, `requirements` key to `PDF_URLS`, renamed `buildRevenueTree` to `buildCategoryTree`, extended `processPDF` with `isRequirements` flag and `all_funds_requirements` dataset type, extended `upsertDataSource` label

## Decisions Made

- **Reconciliation fallback:** FY2022/23/25/26 use fallback (Ending Fund Balance not in line items causes >1% gap). FY2024 reconciles within 0.45% (line items returned). All stored totals match published Total Requirements values.
- **Section gating approach:** Used `Total NET Budget` boundary row instead of named `Requirements` section header — handles both older format (FY2022-24: empty-string section headers) and newer format (FY2026: compound `Requirements\nBureau Expenditures` headers).
- **FY detection fix:** The All Funds page header lists multiple FY columns (Actuals, Revised, Proposed, Adopted). Added `_detect_fy_allfunds()` to return the LAST FY match (rightmost = Adopted year), fixing the bug where `detect_fiscal_year()` returned the first Actuals year.
- **buildCategoryTree():** Consolidated revenue tree builder to support both `resources_total` (Vol 2 revenue rows) and `adopted_amount` (requirements rows) via `r.adopted_amount ?? r.resources_total ?? 0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FY detection returned wrong year for All Funds page**
- **Found during:** Task 1 (initial extraction test)
- **Issue:** `detect_fiscal_year()` returned the first FY match from the multi-column header row ("FY 2022-23 FY 2023-24 FY 2024-25 FY 2025-26 FY 2025-26"), which was the first Actuals year (2023), not the Adopted year (2026).
- **Fix:** Added `_detect_fy_allfunds()` helper that finds all FY matches and returns the last one (rightmost = Adopted column).
- **Files modified:** scripts/extractPortland.py
- **Verification:** FY2026 PDF now returns `fiscal_year: 2026` correctly.
- **Committed in:** 2d6cbb0 (Task 1 commit)

**2. [Rule 1 - Bug] Resources section rows included before Requirements section gating**
- **Found during:** Task 1 (first extraction attempt included Taxes, Licenses, etc.)
- **Issue:** Initial implementation searched for a named `'Requirements'` section header row to enable the gate. FY2022-24 PDFs use empty-string section headers (no named `'Requirements'` row), so the gate never activated and Resources rows were captured.
- **Fix:** Switched to `past_resources_net_budget` flag triggered on the `Total NET Budget` row, which reliably separates the Resources and Requirements sections across all FY formats.
- **Files modified:** scripts/extractPortland.py
- **Verification:** All 5 FYs now return only expenditure category rows (no revenue rows).
- **Committed in:** 2d6cbb0 (Task 1 commit)

**3. [Rule 1 - Bug] Reconciliation fallback for Ending Fund Balance gap**
- **Found during:** Task 1 (reconciliation check showed >1% diff for FY2022/23/25/26)
- **Issue:** `Ending Fund Balance` (part of Total Requirements) is in `PORTLAND_REQUIREMENTS_SKIP` and excluded from line items. The gap = Ending Fund Balance value. For most FYs this exceeds 1% threshold.
- **Fix:** Implemented reconciliation fallback per plan: capture `Total Requirements` row directly as single category when sum diverges >1%. `total_requirements_value` is captured from the table during iteration even though the row is normally skipped.
- **Files modified:** scripts/extractPortland.py
- **Verification:** FY2026 returns $8,641,210,277 (exact match); FY2024 returns 8 line items (0.45% reconciles).
- **Committed in:** 2d6cbb0 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs)
**Impact on plan:** All three fixes were necessary for correct extraction. No scope creep. The reconciliation fallback was explicitly specified as the fallback path in the plan.

## Issues Encountered

- FY2022 and FY2023 PDF All Funds tables use empty-string section headers (no named section rows), requiring the `Total NET Budget` boundary approach instead of header-name matching. Documented as established pattern.

## Known Stubs

None — all data flows from real PDF extraction to DB. No placeholder or hardcoded values.

## Threat Flags

No new network endpoints, auth paths, or trust boundary changes. PDF paths come from controlled `docs/Portland/` readdir (not user input). `--mode requirements` value is a fixed string from this script's parseArgs, not user input.

## Next Phase Readiness

- Portland `all_funds_requirements` data is in DB for FY2022-FY2026, ready for frontend display in Plan 04
- `data_sources` rows with `dataset_type='all_funds_requirements'` are present — `available_datasets` API will surface them
- Operating and revenue rows are untouched — no regression risk
- Plans 03 (Gresham requirements) executing in parallel wave 1

## Self-Check: PASSED

- scripts/extractPortland.py — FOUND
- scripts/processPortland.js — FOUND
- 23-02-SUMMARY.md — FOUND
- Commit 2d6cbb0 (Task 1) — FOUND
- Commit 4ff21dc (Task 2) — FOUND
- extract_requirements() — FOUND
- PORTLAND_REQUIREMENTS_SKIP — FOUND
- found_data_page — FOUND
- all_funds_requirements — FOUND
- All Funds Requirements label — FOUND
- requirements: in parseArgs — FOUND

---
*Phase: 23-or-all-funds-consistency-requirements-extraction-portland-gr*
*Completed: 2026-06-02*
