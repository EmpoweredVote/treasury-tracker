---
phase: 31-anaheim-santa-ana-ca-data-load
plan: 03
subsystem: database
tags: [supabase, nodejs, python, pdfplumber, santa-ana, california, budget-extraction, general-fund]

# Dependency graph
requires:
  - phase: 31-01
    provides: Santa Ana municipality row and 4 canonical data_source rows
provides:
  - scripts/extractSantaAna.py — pdfplumber extractor for Santa Ana GF Expenditure Summary pages
  - scripts/processSantaAna.js — Node.js processor; $350M-$450M sanity band; treasury_sync_budget_tree loader
  - Santa Ana GF operating budget loaded for FY2023 (16 rows, $403,596,760), FY2024 (16 rows, $414,022,680), FY2025 (16 rows, $406,773,060), FY2026 (16 rows, $424,230,150)
  - Santa Ana GF revenue loaded for FY2023 (9 rows, $392,884,798), FY2024 (10 rows, $400,947,213), FY2025 (9 rows, $406,527,340), FY2026 (10 rows, $413,790,950)
  - docs/Santa Ana/ containing fy2023-adopted-budget.pdf through fy2026-adopted-budget.pdf
affects:
  - 31-04 (enrichCategories.js can now run for Santa Ana: city="Santa Ana", state=CA, year=2025/2026)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extractSantaAna.py: department-header + Subtotal row pattern; CONTINUATION_PATTERNS filter handles line-wrapped account-unit labels (ENHANCEMENT, MANAGEMENT, SERVICES)"
    - "FY2022-23 quirk: TOTAL GENERAL FUND EXPENDITURES appears before Interfund Transfers — not the final stop; only TOTAL GENERAL FUND USES terminates scanning"
    - "processSantaAna.js: maxBuffer 16MB; sanity band 350M-450M; resolvePdfDir() worktree-safe"
    - "Multi-pattern FY detection: fy2025-, fy25-26, fy2025-26, /2024/ path fallback"

key-files:
  created:
    - scripts/extractSantaAna.py
    - scripts/processSantaAna.js
  modified: []

key-decisions:
  - "Santa Ana GF Expenditure Summary pages are exclusively GF — no enterprise row filter at row level; fund filter operates at page-selection level (D-06)"
  - "Revenue extracted from 'City of Santa Ana General Fund Revenue Summary' pages (clean GF-only category totals) — not deferred"
  - "FY2022-23 PDF column headers say 'PROPOSED' for the 4th column despite filename saying 'Adopted-FINAL' — treated as adopted; total $403.6M matches RESEARCH.md ~$404M"
  - "CONTINUATION_PATTERNS regex handles 'ENHANCEMENT', 'MANAGEMENT', 'SERVICES', 'ENGINEERING', 'Enhancement' and page navigation text 'Return To Table Of Contents'"
  - "Band set to $350M-$450M; all 4 FYs confirmed within band before live load"

patterns-established:
  - "Department-header + Subtotal extraction pattern for Santa Ana GF Expenditure Summary (vs Anaheim's single GF-only page approach)"

requirements-completed: [DATA-09]

# Metrics
duration: 45min
completed: 2026-06-06
---

# Phase 31 Plan 03: Santa Ana CA Budget Extraction Summary

**Santa Ana General Fund operating loaded for FY2023-FY2026 (16 departments, $403M-$424M per FY); revenue loaded for all 4 FYs (9-10 categories); all confirmed idempotent; enterprise funds excluded at extraction time**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-06T02:30:00Z
- **Completed:** 2026-06-06T03:15:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Downloaded Santa Ana adopted budget PDFs: fy2023-adopted-budget.pdf (38MB), fy2024-adopted-budget.pdf (13MB), fy2025-adopted-budget.pdf (18MB), fy2026-adopted-budget.pdf (20MB) to docs/Santa Ana/
- Inspected PDF structure: identified "City of Santa Ana General Fund Expenditure Summary" pages with department-header + Subtotal row pattern as the GF extraction target
- Identified "City of Santa Ana General Fund Revenue Summary" pages as clean GF revenue source
- Wrote `scripts/extractSantaAna.py` adapting extractFresno.py with Santa Ana-specific page detection and department/subtotal extraction strategy
- Wrote `scripts/processSantaAna.js` adapting processFresno.js with $350M-$450M sanity band and 16MB maxBuffer
- Dry-run: FY2023=$403,596,760 (16 dept), FY2024=$414,022,680 (16 dept), FY2025=$406,773,060 (16 dept), FY2026=$424,230,150 (16 dept) — all within band
- Live-load: FY2023=16 rows, FY2024=16 rows, FY2025=16 rows, FY2026=16 rows — exits 0
- Idempotency confirmed: second run produced same 16 rows for each FY with same totals
- Revenue loaded: FY2023=9 rows ($392,884,798), FY2024=10 rows ($400,947,213), FY2025=9 rows ($406,527,340), FY2026=10 rows ($413,790,950)
- DATA-09 satisfied: Santa Ana GF operating + revenue loaded and visible in app

## Task Commits

1. **Task 1: Download Santa Ana PDFs + inspect General Fund section structure** — DB/files only (PDFs gitignored, no script commit)
2. **Task 2: Write extractSantaAna.py + processSantaAna.js; dry-run confirms GF totals within band** — `dd518fc` (feat)
3. **Task 3: Live-load Santa Ana GF operating + revenue** — DB-only (no file changes; load output captured in run log)

## Task 1: Structural Facts Documented

The four structural facts required for the extractor (per plan acceptance criteria):

1. **General Fund section label**: `"City of Santa Ana General Fund Expenditure Summary"` — multi-page section; department headers appear as standalone lines before their account-unit detail rows; each department section ends with a "Subtotal" row. The 4th numeric column of each Subtotal row is the current FY Adopted amount.
2. **Enterprise stop boundary**: Not needed — the GF Expenditure Summary pages are exclusively GF. Enterprise funds (Water, Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, Federal Clean Water Protection) appear only on separate fund pages. No fund filter required at row extraction level; the page-selection pattern (D-06) is sufficient.
3. **Adopted-amount column position**: 4th number column (`int_matches[3]`). Page format: `Acct. Unit | Dept | FY N-3 Actual | FY N-2 Actual | FY N-1 Adopted | FY N Adopted`
4. **Amount scale**: FULL DOLLARS (Police Department FY2024-25 Subtotal = $162,545,030 ≈ $163M; GF total = $406,773,060 ≈ $407M matches RESEARCH.md)

Revenue section: `"City of Santa Ana General Fund Revenue Summary"` pages — "Total <CATEGORY>" rows extracted. Categories: CHARGES FOR SERVICES, FINES, FRANCHISE FEES, INTERGOVERNMENTAL, LICENSES & PERMITS, MISCELLANEOUS, TAXES, TRANSFERS-IN, USE OF MONEY. Total GF Sources FY2024-25 = $406,527,340.

## Files Created/Modified

- `scripts/extractSantaAna.py` — pdfplumber extractor; department-header + Subtotal pattern; CONTINUATION_PATTERNS filter; multi-pattern FY detection; operating + revenue modes
- `scripts/processSantaAna.js` — Node.js processor; $350M-$450M band; 16MB maxBuffer; worktree-safe resolvePdfDir(); treasury_sync_budget_tree RPC

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Line-wrapped account-unit labels captured as department headers**
- **Found during:** Task 2 initial test
- **Issue:** Long account-unit names like `01114485 HOMELAND SECURITY & EMERGENCY\nMANAGEMENT` cause "MANAGEMENT" to appear on its own line. Similarly, `01110131 FIN/MGMT SVS-MUNICIPAL UTILITY\nSERVICES` causes "SERVICES" to appear as a standalone line. The extractor incorrectly treated these as department section headers, producing wrong labels ("MANAGEMENT" instead of "Police Department", "SERVICES" instead of "Finance Department").
- **Fix:** Added `CONTINUATION_PATTERNS` regex matching: ENHANCEMENT, MANAGEMENT, SERVICES, ENGINEERING, Enhancement, and similar words that appear as line-wrapped account-unit label continuations. Also added "Return To Table Of Contents" page footer skip pattern.
- **Files modified:** scripts/extractSantaAna.py
- **Commit:** dd518fc (included in Task 2 commit)

**2. [Rule 1 - Bug] FY2022-23 PDF: "TOTAL GENERAL FUND EXPENDITURES" incorrectly used as stop boundary**
- **Found during:** Task 2 testing all PDFs
- **Issue:** The FY2022-23 PDF (fy2023-adopted-budget.pdf) has an intermediate "TOTAL GENERAL FUND EXPENDITURES" line before the Interfund Transfers section, then "TOTAL GENERAL FUND USES" as the final total. Using "TOTAL GENERAL FUND" as the stop pattern caused the scan to stop at the intermediate total, missing Interfund Transfers ($35.9M) and producing a total of $367,706,270 instead of the correct $403,596,760.
- **Fix:** Changed stop logic: only "TOTAL GENERAL FUND USES" terminates the scan. "TOTAL GENERAL FUND EXPENDITURES" is skipped as an intermediate total (resets `pending_label` so Interfund can be captured next).
- **Files modified:** scripts/extractSantaAna.py
- **Commit:** dd518fc (included in Task 2 commit)

**3. [Rule 1 - Bug] Page break mid-department — "City of Santa Ana, California" page header captured as department label**
- **Found during:** Task 2 initial test
- **Issue:** FY2025 PDF pages 69-71 each begin with "City of Santa Ana, California Budget Overview & Highlights" as a page-level header. When the Library department's detail rows span page 69 and 70, the new page header on page 70 was captured as `pending_label`, overwriting the correct "Library" label.
- **Fix:** Added `CITY_HEADER` regex (`^City of Santa Ana`) to skip city/page headers before the label detection logic.
- **Files modified:** scripts/extractSantaAna.py
- **Commit:** dd518fc (included in Task 2 commit)

## Live Load Output (First Run)

```
Santa Ana GF Budget Loader [operating]
PDFs to process: 4
  Municipality: Santa Ana (2dc65052-aa62-4a3c-a5c0-eea78dfe9ad3)

  PDF: fy2023-adopted-budget.pdf [operating]
  FY2023 GF Operating — $403,596,760 total (16 departments)
    data_source: 1c244f3e-0118-4e7a-95b9-564470befca0
    Inserted: 16 rows

  PDF: fy2024-adopted-budget.pdf [operating]
  FY2024 GF Operating — $414,022,680 total (16 departments)
    data_source: 70d75628-0a6a-4e18-8138-6197d0f2645f
    Inserted: 16 rows

  PDF: fy2025-adopted-budget.pdf [operating]
  FY2025 GF Operating — $406,773,060 total (16 departments)
    data_source: 775a4c68-f085-4da3-a4ee-9c68aa8c382b
    Inserted: 16 rows

  PDF: fy2026-adopted-budget.pdf [operating]
  FY2026 GF Operating — $424,230,150 total (16 departments)
    data_source: abc27b32-4662-42a6-a38f-b842e7fcd405
    Inserted: 16 rows

Done.
```

**Idempotency (second run):** Same data_source IDs, same 16 rows each — exits 0.

## Revenue Load Output

```
Santa Ana GF Budget Loader [revenue]
PDFs to process: 4
  Municipality: Santa Ana (2dc65052-aa62-4a3c-a5c0-eea78dfe9ad3)

  PDF: fy2023-adopted-budget.pdf [revenue]
  FY2023 Revenue — $392,884,798 total (9 categories)
    Inserted: 9 rows

  PDF: fy2024-adopted-budget.pdf [revenue]
  FY2024 Revenue — $400,947,213 total (10 categories)
    Inserted: 10 rows

  PDF: fy2025-adopted-budget.pdf [revenue]
  FY2025 Revenue — $406,527,340 total (9 categories)
    Inserted: 9 rows

  PDF: fy2026-adopted-budget.pdf [revenue]
  FY2026 Revenue — $413,790,950 total (10 categories)
    Inserted: 10 rows

Done.
```

## Known Stubs

None — data is fully wired from PDF through extractor to DB.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. PDF extraction follows established D-06 pattern. All mitigations from threat model applied:
- T-31-08: Enterprise fund bleed — mitigated by page-selection filter (GF Expenditure Summary pages are exclusively GF)
- T-31-09: Amount scale — verified full dollars; GF total $406,773,060 confirms correct scale
- T-31-10: execSync buffer — raised to 16MB; Santa Ana FY2022-23 PDF JSON output fits within 16MB
- T-31-11: Command injection — PDF paths from controlled readdir; double-quoted
- T-31-12: Wrong document — confirmed Adopted GCS URLs; normalized fy-prefixed filenames; FY verified by totals matching RESEARCH.md
- T-31-13: SUPABASE_KEY logging — loadEnv() pattern; key never logged

## Self-Check: PASSED

- scripts/extractSantaAna.py: FOUND
- scripts/processSantaAna.js: FOUND
- .planning/phases/31-anaheim-santa-ana-ca-data-load/31-03-SUMMARY.md: FOUND
- Commit dd518fc (Task 2): FOUND
- JS syntax check: PASSED
- Python AST check: PASSED
- FY2025 GF total: $406,773,060 = EXACT MATCH to PDF TOTAL GENERAL FUND USES

---
*Phase: 31-anaheim-santa-ana-ca-data-load*
*Completed: 2026-06-06*
