---
phase: 30-fresno-riverside-ca-data-load
plan: 03
subsystem: database
tags: [python, pdfplumber, supabase, riverside, california, budget, pdf-extraction, biennial]

# Dependency graph
requires:
  - phase: 30-01
    provides: Riverside municipality row (id=c17b6fbe) and data_source rows seeded in DB
  - phase: 30-02
    provides: Fresno pipeline established (patterns for Plan 03)
provides:
  - scripts/extractRiverside.py -- pdfplumber extractor for Riverside biennial adopted budget PDFs,
    department-level extraction from "Budget Summary by Fund" / "Budget Summary by Expenditure
    Category" pages, "101 - General Fund" row per department, extraction-time enterprise fund
    exclusion, $- zero handling, prior-biennial column detection
  - scripts/processRiverside.js -- Node.js processor with $280M-$450M sanity band (corrected
    from plan's incorrect $1.1B-$1.8B), per-FY grouping loop, resolvePdfDir() worktree-safe
    helper, treasury_sync_budget_tree RPC loader, skips unreadable 2018-20 PDF
  - Riverside General Fund operating budget rows in DB: FY2023-FY2026 (4 fiscal years from
    2 biennial PDFs; 16-18 departments each; totals $325.9M-$390.5M per FY)
affects:
  - 30-04 (enrichment for Riverside operating categories)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Riverside PDF extraction from "Budget Summary by Fund" / "Budget Summary by
      Expenditure Category" pages -- department-level extraction, NOT Oakland-style
      Fund Summary table with FD_ codes
    - GF line pattern: "101 - General Fund $ X $ X $ X $ X(FY1) $ X(FY2) [notes]"
    - Columns 4+5 are the two adopted FY amounts in biennial PDFs
    - Prior-biennial column detection: if table header FYs < expected biennial FYs, skip
    - $- zero handling in parse_money() for departments that did not exist in prior years
    - Curly apostrophe normalization in department headers (e.g. CITY ATTORNEY'S OFFICE)

key-files:
  created:
    - scripts/extractRiverside.py
    - scripts/processRiverside.js
  modified: []

key-decisions:
  - "Sanity band corrected to $280M-$450M from plan's $1.1B-$1.8B -- plan cited ~$1.45B/FY
     for Riverside GF but that was the CITYWIDE all-funds total. Actual General Fund 101
     totals are $325M-$391M/FY (gross dept subtotals, slightly higher than the net GF of
     $311M-$361M from the fund balance summary due to internal charge offsets)"
  - "PDF table structure is department-per-section (NOT Oakland's fund summary table with
     FD_ codes). Each department has its own 'Budget Summary by Fund' page showing the
     101 GF row with 5 columns (3 actuals + 2 adopted FYs)"
  - "2018-20 PDF skipped at extraction time -- heavy CID font encoding makes most pages
     unreadable by pdfplumber. 2022-24 and 2024-26 PDFs are clean and used."
  - "Marketing and Communications Department: skipped for FY2025/26 -- this new department's
     Budget Summary by Fund shows prior-biennial columns (FY2019/20-FY2023/24), not the
     current adopted years. No current biennial summary table available in the PDF."
  - "Revenue deferred per D-07: Riverside budget PDFs have no department-level GF revenue
     summary section. Operating-only ship is acceptable per plan."
  - "Non-Classified FY2026 amount = $9,183,200 (Water GFT Offset -- an accounting entry
     that offsets general fund transfers to the water enterprise fund). Included as-is."

patterns-established:
  - "Riverside biennial PDF: target 'Budget Summary by Fund' pages per department; extract
     '101 - General Fund' row; take columns 4+5 as adopted FY1 and FY2 amounts"
  - "FY detection from filename: fy2024-26 -> FY2025 + FY2026 (start_year+1, end_year)"
  - "Prior-biennial column guard: detect FY header line with 4+ FY patterns; if last two
     FYs are less than expected biennial FYs, skip that page"

requirements-completed: [DATA-06]

# Metrics
duration: 64min
completed: 2026-06-05
---

# Phase 30 Plan 03: Riverside PDF Pipeline Summary

**Riverside General Fund operating budget (FY2023-FY2026, 4 fiscal years from 2 biennial PDFs, $326M-$391M per FY) loaded into DB via pdfplumber extractor + Node.js processor pipeline; revenue deferred per D-07**

## Performance

- **Duration:** ~64 min
- **Started:** 2026-06-05T21:07:15Z
- **Completed:** 2026-06-05T22:11:40Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- docs/Riverside/ already contained 3 biennial PDFs (fy2018-20, fy2022-24, fy2024-26)
- Inspected PDF structure: Riverside uses department-per-section layout (NOT Oakland's
  Fund Summary table), each dept has "Budget Summary by Fund" with "101 - General Fund"
  row, 5 columns (3 actuals + 2 adopted FYs)
- extractRiverside.py written: scans dept sections, extracts "101 - General Fund" rows,
  handles $- zero format, curly apostrophe normalization, prior-biennial column detection
  (Marketing Dept edge case), enterprise fund skip logs
- processRiverside.js written: $280M-$450M sanity band (corrected), resolvePdfDir()
  worktree-safe helper, skips unreadable 2018-20 PDF, per-FY grouping, RPC loader
- 4 fiscal years (FY2023-FY2026) loaded from 2 biennial PDFs (fy2022-24 and fy2024-26)
- Load is idempotent: second run shows same "Inserted: N rows" (delete+reinsert via RPC)
- Revenue load deferred: Riverside PDFs have no department-level GF revenue section

## Task Commits

1. **Task 1: Download/inspect PDFs** -- no commit (PDFs pre-existed; structural findings documented)
2. **Tasks 1+2: Write extractRiverside.py + processRiverside.js, dry-run confirms 4 FYs** - `1028d8a` (feat)
3. **Task 3: Live-load** -- no new files to commit (DB-only changes; documented in SUMMARY)

## Files Created/Modified

- `scripts/extractRiverside.py` -- pdfplumber extractor for Riverside biennial PDFs;
  department-level "Budget Summary by Fund" extraction; 101-GF row; prior-biennial guard;
  $- zero handling; extraction-time enterprise fund exclusion; full dollars
- `scripts/processRiverside.js` -- Node.js processor; $280M-$450M sanity band;
  resolvePdfDir() worktree-safe; treasury_sync_budget_tree RPC; revenue deferred per D-07

## Task 1 Findings: PDF Structure

| Property | Value |
|----------|-------|
| PDF layout | Department-per-section (NOT Oakland's fund summary FD_ table) |
| Table type | "Budget Summary by Fund" per department |
| GF identifier | "101 - General Fund" (not FD_ code) |
| Column order | FY(n-2) Actual, FY(n-1) Actual, FY(n) Actual, FY1 Adopted, FY2 Adopted |
| Amount scale | FULL DOLLARS (Police FY2025 = $119,236,751 -- verified) |
| Adopted years | Columns 4+5 in table (e.g. FY2024/25 and FY2025/26 for fy2024-26 PDF) |
| FY naming | FY XXXX/YY stored as (XXXX+1) -- FY2024/25 = fiscal year 2025 |
| 2018-20 PDF | CID-encoded -- unreadable; skipped |

**Confirmed City of Riverside (not County):** GF totals $326M-$391M/FY vs county ~billions.

## Extracted Totals by Fiscal Year

| FY | Departments | Total (gross GF depts) | Within $280M-$450M Band | Source PDF |
|----|-------------|----------------------|------------------------|------------|
| 2023 | 16 | $325,943,262 | Yes | fy2022-24 |
| 2024 | 16 | $331,770,828 | Yes | fy2022-24 |
| 2025 | 18 | $378,706,489 | Yes | fy2024-26 |
| 2026 | 18 | $390,501,211 | Yes | fy2024-26 |

Note: Gross GF department totals from "Budget Summary by Fund" per-dept pages.
Net GF total (citywide Fund Balance Summary) is lower: FY2024/25=$361.2M, FY2025/26=$371.8M.
Difference (~$17M) is due to operating transfer accounting entries that net out citywide.

## Revenue Status

**Deferred per D-07.** Riverside's biennial budget PDFs present data per department.
No department-level GF revenue section exists in the standard "Budget Summary by Fund"
format. The "Revenue Overview" section (pages 87-106) shows revenue by source across
all funds, not extractable via the department-section scanner pattern.

## Decisions Made

- Sanity band corrected to $280M-$450M (see Deviations #1)
- 2018-20 PDF skipped (CID encoding incompatibility)
- Marketing and Communications Dept: prior-biennial column guard correctly excludes
  their historical-only budget table; FY2025/26 data not available in summary format
- Revenue deferred per D-07

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Data] Sanity band corrected from $1.1B-$1.8B to $280M-$450M**
- **Found during:** Task 1 (PDF structure inspection)
- **Issue:** The plan cited "~$1.45B/FY" for Riverside General Fund and set the sanity
  band to $1,100,000,000-$1,800,000,000. Actual inspection of fund balance summary pages
  shows: 101 - General Fund = $361,227,227 (FY2024/25) and $371,805,699 (FY2025/26).
  The $1.45B figure was the CITYWIDE all-funds total ($1,457,109,296 for FY2024/25).
  Using the plan's band would halt on every FY (all $325M-$391M, far below $1.1B).
- **Fix:** Updated constants to RIVERSIDE_BAND_MIN=280_000_000, RIVERSIDE_BAND_MAX=450_000_000.
  Original plan values preserved in comment for traceability.
- **Files modified:** scripts/processRiverside.js
- **Verification:** All 4 FYs pass the band check; dry-run exits 0
- **Committed in:** 1028d8a

**2. [Rule 1 - Architecture] Extraction approach is department-per-section, NOT Oakland-style FD_ Fund Summary**
- **Found during:** Task 1 (PDF structure inspection)
- **Issue:** Plan assumed Riverside uses Oakland's "Fund Summary" table with FD_1010 codes.
  Actual Riverside PDF has each department in its own section with "Budget Summary by Fund"
  table. No Oakland-style "FUND SUMMARY" section with FD_ codes exists.
- **Fix:** Rewrote extractRiverside.py to scan department sections for "Budget Summary by
  Fund" pages and extract "101 - General Fund" rows per department.
- **Impact:** Still produces correct biennial per-FY output (D-03 met). Fund filter
  implemented differently but equally effective (D-05/D-06 met): enterprise fund depts
  like Public Utilities have no "101 - General Fund" line in their budget summaries.
- **Files modified:** scripts/extractRiverside.py
- **Committed in:** 1028d8a

**3. [Rule 1 - Bug] $- zero-dollar format not handled in parse_money()**
- **Found during:** Task 2 (testing extractRiverside.py)
- **Issue:** Housing & Human Services shows "101 - General Fund $ - $ - $ - $ 2,732,858
  $ 2,949,050" -- the $- format for years when the dept did not exist was not handled.
- **Fix:** Added $- and $ - to zero-return cases; updated extract_gf_amounts() to match
  dash-as-zero tokens with pattern \$\s*(-|\([\d,]+\)|[\d,]+).
- **Files modified:** scripts/extractRiverside.py
- **Committed in:** 1028d8a

**4. [Rule 1 - Bug] Marketing Dept prior-biennial column guard needed**
- **Found during:** Task 2 (testing extractRiverside.py)
- **Issue:** Marketing (new dept in FY2022/23) has Budget Summary with prior-biennial
  columns (FY2019/20-FY2023/24), not current FY2024/25-FY2025/26. Without guard, columns
  4+5 would be labeled as FY2025/2026 incorrectly.
- **Fix:** Added detect_column_fys_from_header() that reads the dedicated FY header line
  (4+ FY patterns). If last two detected FYs < expected biennial FYs, skip the page.
- **Files modified:** scripts/extractRiverside.py
- **Committed in:** 1028d8a

---

**Total deviations:** 4 auto-fixed (1 incorrect data expectation + 1 different architecture
approach + 2 Rule 1 extraction bugs)

## Issues Encountered

- Riverside PDF structure fundamentally different from Oakland (no FD_ fund summary table)
- 2018-20 PDF unreadable due to CID font encoding -- only 2 of 3 PDFs usable
- Marketing Dept prior-biennial edge case (new dept created in FY2022/23)
- Housing & Human Services historical zero format ($-) in new dept rows

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- Riverside General Fund operating FY2023-FY2026 loaded and visible in app
- Plan 04 (enrichment) can proceed for Riverside operating categories
- No blockers

## Known Stubs

None -- all 4 fiscal years extracted from real PDF data. No placeholder values.

## Threat Flags

None -- no new network endpoints, auth paths, or trust boundary changes. Threat mitigations
from T-30-07 through T-30-11 all implemented:
- T-30-07: Enterprise fund bleed prevented by extraction-time GF filter (enterprise dept
  sections lack "101 - General Fund" line) + $280M-$450M sanity band halt
- T-30-08: Duplicate FY rows prevented by per-dept deduplication in extractor and
  per-FY grouping in processor (RPC delete+reinsert is idempotent)
- T-30-09: Confirmed City of Riverside (pop 324K, GF ~$326M-$391M), not Riverside County
- T-30-10: maxBuffer 8MB cap on execSync
- T-30-11: PDF path from readdirSync(pdfDir) controlled directory, double-quoted

## Self-Check

Files created:
- scripts/extractRiverside.py: EXISTS (verified in worktree)
- scripts/processRiverside.js: EXISTS (verified in worktree)
- .planning/phases/30-fresno-riverside-ca-data-load/30-03-SUMMARY.md: THIS FILE

Commits:
- 1028d8a: feat(30-03): write extractRiverside.py + processRiverside.js (verified)

DB inserts:
- FY2023: 16 rows inserted (data_source b9b286b6)
- FY2024: 16 rows inserted (data_source f8e8534a)
- FY2025: 18 rows inserted (data_source e1fe1100)
- FY2026: 18 rows inserted (data_source 339f3abb)
- Idempotency: second run inserts same row counts (confirmed)

## Self-Check: PASSED

---
*Phase: 30-fresno-riverside-ca-data-load*
*Completed: 2026-06-05*
