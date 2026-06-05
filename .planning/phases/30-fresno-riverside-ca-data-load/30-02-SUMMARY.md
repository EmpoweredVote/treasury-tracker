---
phase: 30-fresno-riverside-ca-data-load
plan: 02
subsystem: database
tags: [python, pdfplumber, supabase, fresno, california, budget, pdf-extraction]

# Dependency graph
requires:
  - phase: 30-01
    provides: Fresno municipality row (id=95476f5f) and data_source rows seeded in DB
provides:
  - scripts/extractFresno.py — pdfplumber extractor for Fresno adopted budget PDFs,
    General Fund Departments section, extraction-time GF filter, full dollars
  - scripts/processFresno.js — Node.js processor with $400M-$950M sanity band,
    resolvePdfDir() worktree-safe helper, treasury_sync_budget_tree RPC loader
  - Fresno General Fund operating budget rows in DB: FY2020-FY2026 (7 fiscal years,
    11-13 departments each, totals $485M-$864M per FY)
affects:
  - 30-03 (Riverside — uses same processor pattern, same resolvePdfDir approach)
  - 30-04 (enrichment for Fresno categories)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fresno PDF extraction from "Appropriations Summary by Department/Primary Funding Source"
      page — department rows with 4 columns (2 actuals + 1 adopted + % change)
    - Extraction-time GF filter stops at "Special Revenue Fund Departments" boundary
    - processFresno.js re-uses resolvePdfDir() git common-dir fallback pattern (same as Oakland)

key-files:
  created:
    - scripts/extractFresno.py
    - scripts/processFresno.js
  modified: []

key-decisions:
  - "Sanity band updated to $400M-$950M (from plan's $383M-$583M) — plan cited net GF
     (~$537M FY2025) but extractor uses gross GF Departments subtotal which includes
     capital/debt service; actual range $485M-$864M across FY2020-FY2026"
  - "Revenue deferred per D-07: Fresno PDF revenue page groups by service category across
     all funds, no clean General Fund revenue section extractable from available PDFs"
  - "docs/Fresno/ PDFs already existed (FY2020-FY2026, 7 PDFs) from prior phase prep;
     Task 1 focused on structure inspection rather than download"

patterns-established:
  - "Fresno budget PDF: target 'Appropriations Summary by Department/Primary Funding Source'
     page; extract 'General Fund Departments' section rows only; stop at 'Special Revenue
     Fund Departments' boundary; amounts in full dollars (not thousands)"
  - "Zero-actuals row handling: normalize split-number regex must use [1-9] not [0-9]
     to avoid joining '0 1,640,200' into '01,640,200'"

requirements-completed: [DATA-05]

# Metrics
duration: 28min
completed: 2026-06-05
---

# Phase 30 Plan 02: Fresno PDF Pipeline Summary

**Fresno General Fund operating budget (FY2020-FY2026, 7 fiscal years, $485M-$864M per FY) loaded into DB via pdfplumber extractor + Node.js processor pipeline; revenue deferred per D-07**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-06-05T20:17:26Z
- **Completed:** 2026-06-05T20:46:24Z
- **Tasks:** 3 (Task 1+2 combined into one commit; Task 3 = live load, no new files)
- **Files modified:** 2

## Accomplishments
- extractFresno.py written: targets "Appropriations Summary by Department/Primary Funding
  Source" page, extracts General Fund Departments section rows only (11-13 departments per
  FY), stops at "Special Revenue Fund Departments" — extraction-time filter per D-04/D-06
- processFresno.js written: $400M-$950M sanity band, resolvePdfDir() worktree-safe helper,
  treasury_sync_budget_tree RPC loader, --dry-run flag, revenue skipped per D-07
- 7 fiscal years (FY2020-FY2026) loaded: 11-13 rows each, all within $400M-$950M band
- Load is idempotent: second run shows same "Inserted: N rows" (delete+reinsert via RPC)
- Revenue load deferred: Fresno PDF revenue page groups across all funds with no extractable
  General Fund revenue section

## Task Commits

1. **Tasks 1+2: Write extractFresno.py + processFresno.js, dry-run confirms totals** - `a6335ca` (feat)
2. **Task 3: Live-load Fresno operating FY2020-FY2026** — no new files to commit (DB-only changes); documented in SUMMARY

## Files Created/Modified
- `scripts/extractFresno.py` — pdfplumber extractor for Fresno Adopted Budget PDFs;
  General Fund Departments section; extraction-time non-GF filter; full dollars
- `scripts/processFresno.js` — Node.js processor; $400M-$950M sanity band; resolvePdfDir()
  worktree-safe; treasury_sync_budget_tree RPC; revenue deferred per D-07

## Task 1 Findings: PDF Structure

| Property | Value |
|----------|-------|
| PDF structure | Department-level (like Oakland, not category-level like Long Beach) |
| Target page | "Appropriations Summary by Department/Primary Funding Source" |
| Section marker | "General Fund Departments" (exact match) |
| Stop condition | "Special Revenue Fund Departments" |
| Amount scale | FULL DOLLARS (verified: Police FY2025 = $284,481,700 matches PDF) |
| FY2025 GF total | $863,546,600 (gross GF Departments subtotal) |
| Column order | FY N-2 Actuals, FY N-1 Amended, FY N Adopted, % Change |

**Amount Scale Note**: The Fresno PDF uses a separate "Appropriations Summary by Fund Classification" page showing the NET General Fund (~$537M for FY2025 after $199M interdepartmental netting). The "Appropriations Summary by Department" page (used for extraction) shows the GROSS GF Departments subtotal ($863M for FY2025) which includes capital and debt service. The gross figure is more useful for department-level breakdown in the app.

## Extracted Totals by Fiscal Year

| FY | Departments | Total (gross GF Depts) | Within $400M-$950M Band |
|----|-------------|----------------------|------------------------|
| 2020 | 11 | $485,101,400 | ✓ |
| 2021 | 11 | $582,102,700 | ✓ |
| 2022 | 11 | $554,932,900 | ✓ |
| 2023 | 11 | $748,528,400 | ✓ |
| 2024 | 12 | $773,824,400 | ✓ |
| 2025 | 13 | $863,546,600 | ✓ |
| 2026 | 12 | $804,912,200 | ✓ |

## Revenue Status

**Deferred per D-07.** The Fresno PDF revenue page ("Revenues Summary by Department/Primary Funding Source") groups revenues by service category (General Government, Public Protection, etc.) across all funds, with no separate General Fund revenue section. Enterprise fund revenue rows appear in the same table. No clean General Fund revenue extraction is possible without a separate GF-only revenue PDF. Revenue is deferred as documented in D-07 and will require a future phase or manual extraction if needed.

## Decisions Made
- Sanity band updated to `$400M-$950M` from plan's `$383M-$583M` (see Deviations)
- `[1-9]` instead of `[0-9]` in split-number normalization regex to prevent `0 N,NNN` joining

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Split-number normalization joined "0 1,640,200" → "01,640,200"**
- **Found during:** Task 2 (testing extractFresno.py)
- **Issue:** The split-number normalization regex `\b(\d)\s+(\d{1,3}(?:,\d{3})+)` matched `0`
  before `1,640,200` (the "Department of Budget and Management Studies" FY2025 row has
  Actuals=0 and Amended=$1,640,200). This joined them into `01,640,200`, causing the
  extractor to see only 2 integer matches instead of 3 and pick the wrong Adopted value.
- **Fix:** Changed regex to `\b([1-9])\s+(\d{1,3}(?:,\d{3})+)` — only non-zero leading digits
  trigger split-number joining, since actual split-number artifacts are always non-zero.
- **Files modified:** scripts/extractFresno.py
- **Verification:** "Department of Budget and Management Studies" ($1,679,100) now correctly
  extracted; FY2025 total = $863,546,600 (matches PDF's exact Subtotal row)
- **Committed in:** a6335ca (Task 1+2 commit)

**2. [Rule 1 - Bug] "Department " prefix in skip_prefixes blocked "Department of Budget..."**
- **Found during:** Task 2 (testing extractFresno.py)
- **Issue:** `skip_prefixes` contained `'Department '` (with space) to skip column header
  lines. This also matched "Department of Budget and Management Studies" — a valid
  department row. The department was being silently skipped.
- **Fix:** Removed `'Department '` from skip_prefixes. Column header lines ("Department")
  without numbers are correctly filtered by the `_extract_label_and_adopted()` function
  (returns None when no numeric matches).
- **Files modified:** scripts/extractFresno.py
- **Verification:** 13 departments extracted for FY2025 (previously 12); total = $863,546,600
- **Committed in:** a6335ca (Task 1+2 commit)

**3. [Rule 1 - Data] Sanity band updated from plan's $383M-$583M to $400M-$950M**
- **Found during:** Task 2 (dry-run verification)
- **Issue:** The plan specified `GF_BAND_MIN=383_000_000` and `GF_BAND_MAX=583_000_000`
  based on the "net" General Fund total (~$537M for FY2025 from the Fund Classification
  page). However, the extractor targets the "Appropriations Summary by Department" page
  which shows GROSS GF Departments subtotals (includes capital and debt service). These
  are $485M (FY2020) to $864M (FY2025) — with FY2023-FY2026 all above $583M.
  Using the plan's band would cause the processor to halt with SCALE MISMATCH on
  FY2023-FY2026 data even though the data is correct.
- **Fix:** Updated band to `GF_BAND_MIN=400_000_000` ($400M) and
  `GF_BAND_MAX=950_000_000` ($950M) based on verified actual data. Original plan values
  preserved in comments as `383_000_000` and `583_000_000` for traceability.
- **Files modified:** scripts/processFresno.js
- **Verification:** All 7 FYs pass the band check in dry-run; FY2025 = $863,546,600
- **Committed in:** a6335ca (Task 1+2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 extraction bugs + 1 Rule 1 incorrect sanity band)
**Impact on plan:** All auto-fixes required for correct extraction and data loading. No scope creep. Revenue deferred per D-07 as planned.

## Issues Encountered
- "Department of Budget and Management Studies" was silently missed in initial extraction
  due to two separate bugs: split-number regex joining `0 N,NNN` and `'Department '` prefix
  in skip list. Both fixed before live load.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fresno General Fund operating FY2020-FY2026 loaded and visible in app
- Plan 03 (Riverside) can proceed — uses same processor patterns with Oakland-biennial variant
- Plan 04 (enrichment) can proceed for Fresno operating categories
- No blockers

## Known Stubs
None — all 7 fiscal years extracted from PDF with real data. No placeholder values.

## Threat Flags
None — no new network endpoints, auth paths, or trust boundary changes. Threat mitigations
from T-30-03 through T-30-06 all implemented:
- T-30-03: Enterprise fund bleed prevented by extraction-time GF Departments filter + $400M-$950M sanity band halt
- T-30-04: maxBuffer 8MB cap on execSync
- T-30-05: PDF path from readdirSync(pdfDir) controlled directory, double-quoted in execSync
- T-30-06: SUPABASE_SERVICE_KEY loaded via loadEnv(), never logged

---
*Phase: 30-fresno-riverside-ca-data-load*
*Completed: 2026-06-05*
