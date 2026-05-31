---
phase: 17-portland-or-budget-load
plan: 01
subsystem: database
tags: [pdfplumber, supabase, portland, oregon, pdf-pipeline, municipality-seeder]

# Dependency graph
requires:
  - phase: 16-california-cities
    provides: seedCaliforniaCities.js pattern for municipality + data_source upsert
  - phase: 17-portland-or-budget-load
    provides: 17-RESEARCH.md PDF URLs, population, and api_type guidance
provides:
  - Portland, OR municipality row (id=2abac6c2-78b0-466a-98d1-6cd38e19a411, population 635749)
  - Portland Operating Budget data_source row (api_type=pdf_download, fiscal_years=[2025,2026])
  - docs/Portland/ with FY2025-26 (6.39MB) and FY2024-25 (5.07MB) Adopted Budget Vol 1 PDFs
  - Confirmed pdfplumber 0.11.9 available (Python 3.14.3)
  - PDF structure findings: Appropriation Schedule pages 118-122 has clean Bureau + fund rows
  - OR: 'Oregon' added to EntitySwitcher.tsx STATE_LABELS (city picker shows full state name)
affects:
  - 17-02 (extractPortland.py — needs PDF structure findings from this plan)
  - 17-03 (processPortland.js — needs municipality FK from this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pdf_download api_type for PDF-sourced data (confirmed from DB, matches Fremont)"
    - "docs/<City>/ gitignored PDF storage (per .gitignore line 35)"
    - "seedPortlandOregon.js: single-municipality seeder adapted from seedCaliforniaCities.js"

key-files:
  created:
    - scripts/seedPortlandOregon.js
    - scripts/_inspect-portland-temp.py
  modified:
    - src/components/EntitySwitcher.tsx

key-decisions:
  - "FY2025-26 PDF URL corrected from RESEARCH: CMS path changed to /budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download"
  - "api_type='pdf_download' confirmed via SELECT DISTINCT query — matches Fremont sources"
  - "Added TX: 'Texas' to worktree EntitySwitcher.tsx (TX commit 4b26866 not in worktree baseline)"
  - "Appropriation Schedule (pages 118-122) identified as primary source for Plan 02 extractor"

patterns-established:
  - "Portland PDF amounts are in full dollars (not thousands) — no multiply-by-1000 needed"
  - "Portland fiscal year FY2025-26 maps to fiscal_year=2026 (ending year convention)"

requirements-completed: []

# Metrics
duration: ~65min
completed: 2026-05-31
---

# Phase 17 Plan 01: Portland OR Foundation Summary

**Portland municipality seeded (id 2abac6c2, pop 635,749), two Adopted Budget PDFs downloaded, pdfplumber confirmed, Appropriation Schedule table structure documented for Plan 02 extractor, and Oregon added to city picker**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-05-31T17:00:00Z
- **Completed:** 2026-05-31T17:06:28Z
- **Tasks:** 2
- **Files modified:** 3 (seedPortlandOregon.js, _inspect-portland-temp.py, EntitySwitcher.tsx)

## Accomplishments

- Python 3.14.3 and pdfplumber 0.11.9 confirmed available; no installation needed
- FY2025-26 (6.39 MB) and FY2024-25 (5.07 MB) Adopted Budget Vol 1 PDFs downloaded to docs/Portland/ — both validated as %PDF with correct sizes
- Portland, OR municipality row inserted (id=2abac6c2-78b0-466a-98d1-6cd38e19a411, population=635749, population_year=2024)
- Portland Operating Budget data_source row inserted (api_type=pdf_download, fiscal_years=[2025,2026])
- Seeder verified idempotent: second run shows "updated existing" not duplicate rows
- OR: 'Oregon' added to EntitySwitcher.tsx STATE_LABELS so Portland shows "Oregon" in city picker

## PDF Structure Findings

**Source:** FY 2025-26 Adopted Budget Volume 1 (565 pages total)

### Key Pages for Plan 02 Extractor

| Pages | Table Name | Columns | Rows/Structure |
|-------|-----------|---------|----------------|
| 118-122 | Appropriation Schedule - FY 2025-26 | Bureau name, Fund, Program Expenses, Interfund Transfers, Cash Debt Service, Total Appropriation | ~35 rows per page; Bureau header rows + fund sub-rows + Bureau Subtotal |
| 125-129 | Summary of Bureau Expenses by Fund | Bureau, Fund, Personnel, External Material & Services, Internal Material & Services, Capital Outlay, Total Bureau Expenses | Same structure; 5 numeric columns |
| 136-142 | Total Resources and Requirements by Fiscal Year | Bureau Subtotal rows with 5 columns: Actuals FY2022-23, FY2023-24, Revised FY2024-25, Proposed FY2025-26, **Adopted FY2025-26** | Best for year-over-year comparison |
| 150-156 | Operating and Capital Budget | Bureau, Fund, Revised FY2024-25 Operating/Capital/Total, Adopted FY2025-26 Operating/Capital/Total | 6 numeric columns; Bureau Subtotal rows |

### extract_tables() Assessment

**CLEAN — extract_tables() yields usable rows.** The Appropriation Schedule (pages 118-122) produces well-structured tables with:
- Bureau header rows: `[BureauName, '', '', '', '']` (blank numeric cols = header)
- Fund sub-rows: `[FundName, amount, amount, amount, amount]` (all 5 columns populated)
- Bureau Subtotal rows: `['BureauName Subtotal', amount, amount, amount, amount]`

Sample rows from page 118 (Appropriation Schedule):
```
Bureau of Emergency Communications Subtotal | 37,208,701 | 0 | 1,821,650 | 363,873 | 39,394,224
Bureau of Environmental Services Subtotal   | 491,591,550 | 305,330,947 | 478,476,858 | 149,954,403 | 1,425,353,758
Bureau of Fleet & Facilities Subtotal       | 179,075,219 | 88,982,623 | 4,444,949 | 16,397,150 | 288,899,941
Bureau of Human Resources Subtotal          | 205,970,826 | 12,363,041 | 504,356 | 57,780 | 218,896,003
```

### Recommended Extraction Strategy for Plan 02

Use the **Appropriation Schedule** (pages 118-122, "Table 2" header) as the primary source:
- Column 0: Bureau/Fund name
- Column 4: Total Appropriation (the most complete budget figure)
- Bureau Subtotal rows have the bureau-level adopted total
- Fund sub-rows enable fund-level breakdown

**Detection logic:** Look for pages containing "Appropriation Schedule - FY 2025-26" OR "Table 2" header text. Collect all pages of this multi-page table. Filter for "Subtotal" rows to get bureau-level totals.

**Amount format:** All amounts are in full dollars (no thousands multiplier needed). Amounts contain commas and spaces (e.g., "37,208,701") — strip non-numeric characters to parse.

**Fiscal year mapping:** FY 2025-26 → `fiscal_year = 2026`; FY 2024-25 → `fiscal_year = 2025`.

**Bureaus found in FY2025-26 Appropriation Schedule (sample):**
- Bureau of Emergency Communications: $39.4M
- Bureau of Environmental Services: $1.425B (includes sewer system funds)
- Bureau of Fleet & Facilities: $288.9M
- Bureau of Human Resources: $218.9M
- Bureau of Planning & Sustainability: $838.5M
- Bureau of Technology Services: $146.4M
- City Administrator: (multi-page continuation)
- Portland Bureau of Transportation, Portland Parks & Recreation, Water Bureau, etc.

### Notes on Text Parsing Alternative

If extract_tables() proves unreliable for any pages, the alternative is text-line parsing using `page.extract_text()`. The text output is clean and contains bureau names followed by amounts on the same line for Subtotal rows.

### FY2024-25 PDF Structure

Same structure as FY2025-26 (confirmed: both are machine-generated with same formatting). Page numbers will differ slightly due to content volume. Use same page keyword detection approach.

## Task Commits

1. **Task 1: Verify toolchain, download PDFs, capture pdfplumber structure** - `fc74c80` (chore)
2. **Task 2: Seed Portland municipality + data source, add Oregon to STATE_LABELS** - `f9ce827` (feat)

## Files Created/Modified

- `scripts/seedPortlandOregon.js` — Idempotent Portland municipality + operating data_source seeder (adapted from seedCaliforniaCities.js)
- `scripts/_inspect-portland-temp.py` — Temporary PDF inspection script; safe to delete after Plan 02
- `src/components/EntitySwitcher.tsx` — Added `TX: 'Texas'` and `OR: 'Oregon'` to STATE_LABELS map

## Decisions Made

1. **FY2025-26 PDF URL corrected:** RESEARCH had the wrong URL (returned 404). Correct URL found by fetching the adopted budget page directly. Recorded working URL in seeder and SUMMARY.
2. **api_type confirmed as 'pdf_download':** Queried `SELECT DISTINCT api_type` from DB. Values found: `indiana_gateway`, `ma-dls`, `pdf_download`, `socrata`, `xlsx_download`. Portland uses `pdf_download` matching Fremont.
3. **Added TX: 'Texas' alongside OR: 'Oregon':** The worktree was created before commit `4b26866` (TX STATE_LABELS fix landed on main after worktree branch point). Added TX to ensure worktree branch is correct when merged.
4. **Appropriation Schedule identified as primary extractor source:** Pages 118-122 have cleanest table structure for bureau-level totals. Plan 02 extractor should target "Appropriation Schedule - FY 2025-26" page keyword.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FY2025-26 PDF URL corrected from RESEARCH**
- **Found during:** Task 1 (PDF download step)
- **Issue:** RESEARCH-documented URL returned HTTP 404. Portland's CMS changed the path slug between when research was written and execution.
- **Fix:** Fetched the adopted budget page directly (`/budget/2025-2026-budget/development/adopted`), found the corrected URL: `/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download`
- **Files modified:** scripts/seedPortlandOregon.js (uses corrected URL as base_url)
- **Verification:** HTTP 200, 6.39 MB, Content-Type: application/pdf
- **Committed in:** fc74c80, f9ce827

**2. [Rule 2 - Missing Critical] Added TX: 'Texas' to EntitySwitcher.tsx alongside OR**
- **Found during:** Task 2 (reading EntitySwitcher.tsx in worktree)
- **Issue:** Worktree baseline was branched before commit 4b26866 added TX: 'Texas'. The worktree only had IN and CA. Adding only OR would leave TX broken when merged.
- **Fix:** Added both TX: 'Texas' and OR: 'Oregon' to STATE_LABELS.
- **Files modified:** src/components/EntitySwitcher.tsx
- **Committed in:** f9ce827

---

**Total deviations:** 2 auto-fixed (1 bug fix — URL, 1 missing critical — TX state label)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- Portland PDF URL for FY2025-26 changed from RESEARCH (RESEARCH Pitfall 2 warning materialized). Resolved by fetching the adopted budget page and extracting the current download link.
- The `docs/` directory is gitignored (`.gitignore` line 35), so PDF files cannot be committed. This matches the Fremont pattern (`docs/Fremont/` is also gitignored). PDFs are local-only artifacts.

## Known Stubs

None. The seeder is functional and wired to the real Supabase database. The inspection script is a temporary tool (clearly labeled "TEMPORARY"), not a production stub.

## Threat Flags

None. No new security surface area introduced. Portland.gov PDFs downloaded via public HTTPS (T-17-01: %PDF magic bytes verified). SUPABASE_SERVICE_KEY read from environment only (T-17-02: no hardcoding).

## Next Phase Readiness

- Plan 02 (extractPortland.py) can now be written deterministically:
  - Target: Appropriation Schedule pages (detected by "Appropriation Schedule - FY 2025-26" text)
  - Bureau Subtotal rows provide bureau-level adopted totals
  - extract_tables() yields clean rows — no text-line parsing fallback needed
  - Amounts in full dollars, fiscal_year = ending year integer
- Plan 03 (processPortland.js) requires Portland municipality FK — now available (id=2abac6c2-78b0-466a-98d1-6cd38e19a411)
- docs/Portland/ contains both PDFs locally for Plan 02 development

---
*Phase: 17-portland-or-budget-load*
*Completed: 2026-05-31*
