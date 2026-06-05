---
phase: 28-oakland-san-jose-ca-data-load
plan: 02
subsystem: database
tags: [python, pdfplumber, nodejs, esmodule, california, oakland, gpf, bulk-load, pdf-extraction]

# Dependency graph
requires:
  - phase: 28-01
    provides: Oakland municipality row (id=aa7c409d-82a7-4f7b-8f5e-4efe76507bd2), canonical data_source rows
provides:
  - Oakland GPF operating budget loaded for FY2024 ($834M) and FY2025 ($807M midcycle)
  - scripts/extractOakland.py (pdfplumber Fund Summary section extractor)
  - scripts/processOakland.js (multi-PDF orchestrator + treasury_sync_budget_tree loader)
  - docs/Oakland/ directory with 2 downloaded adopted budget PDFs
affects: [28-03, 28-04, treasury_sync_budget_tree, budget_categories, budgets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fund Summary FD_1010 section parsing -- more reliable than per-dept OpenGov chart pages"
    - "Oakland biennial PDF: Summary Table By Fund section has authoritative FD_1010 (GPF) amounts by dept"
    - "GPF band sanity check $700M-$900M halts before live load on scale mismatch (T-28-07)"
    - "Midcycle PDF: single FY column (FY24-25 Midcycle Adopted Total) used as authoritative amount"
    - "worktree-safe resolvePdfDir() via git rev-parse --git-common-dir"

key-files:
  created:
    - scripts/extractOakland.py
    - scripts/processOakland.js
    - docs/Oakland/fy2023-25-adopted-budget.pdf (downloaded, 40MB)
    - docs/Oakland/fy2024-25-midcycle-adopted-budget.pdf (downloaded, 49MB)
  modified: []

key-decisions:
  - "Fund Summary FD_1010 section approach chosen over per-dept OpenGov chart pages -- avoids cross-page table artifact where Library page showed Fire's fund table data"
  - "Oakland amounts in FULL DOLLARS (not thousands) -- FY2024 GPF total ~$834M confirms scale"
  - "FY2025 from midcycle ($807M) overwrites FY2025 from biennial ($847M) -- midcycle is more authoritative"
  - "Revenue deferred per D-05 -- GPF revenue section exists in PDF (pages 148-149) but requires additional extraction work; operating-only load does not block the phase"
  - "FY2021-23 and FY2025-27 PDFs not available -- both returned HTTP 404 from S3 bucket"

requirements-completed: [DATA-02]

# Metrics
duration: 96min
completed: 2026-06-05
---

# Phase 28 Plan 02: Oakland Extraction + Load Pipeline Summary

**pdfplumber extraction of Oakland GPF department amounts from Fund Summary section; loaded FY2024 ($834M) and FY2025 ($807M midcycle) operating budgets via treasury_sync_budget_tree; revenue deferred per D-05**

## Performance

- **Duration:** ~96 min
- **Started:** 2026-06-05T00:36:02Z
- **Completed:** 2026-06-05T02:12:42Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files created:** 2 scripts + 2 PDFs downloaded

## Accomplishments

### PDF Downloads
- Downloaded Oakland FY2023-25 Adopted Policy Budget from S3 (40MB): `fy2023-25-adopted-budget.pdf`
- Downloaded Oakland FY2024-25 Midcycle Adopted Policy Budget from S3 (49MB): `fy2024-25-midcycle-adopted-budget.pdf`
- FY2021-23 and FY2025-27 PDFs returned HTTP 404 (Pitfall 1 and 6 confirmed)

### PDF Structure Discovery
The Oakland Adopted Policy Budget PDFs use an OpenGov portal screenshot format where:
- Each department has "Expenditures By Fund" chart pages with fund table data embedded in single large text cells
- The fund table data CAN leak from one department's section onto adjacent department pages (cross-page artifact)
- The reliable extraction approach is the **"Summary Table By Fund"** section (appears ~page 240 of FY2023-25, ~page 274 of FY2024-25)

### Summary Table By Fund Section (FD_1010)
- Found on pages 240-241 of FY2023-25 PDF and pages 274-275 of FY2024-25 midcycle PDF
- "General Funds FD_1010" = Oakland General Purpose Fund
- Column headers: "FY23-24 Biennial" and "FY24-25 Biennial" (biennial PDF), or "FY24-25 Midcycle Adopted Total" (midcycle)
- 26 departments in FY2023-25 biennial, 27 in FY2024-25 midcycle

### Amount Scale
- **FULL DOLLARS** (not thousands) -- confirmed by comparison with known totals
- FY2024: $834,121,344 GPF total (vs. expected ~$800M-$850M band) ✅
- FY2025 biennial: $846,524,612 GPF total ✅
- FY2025 midcycle: $807,428,508 GPF total (midcycle amendment, more authoritative) ✅

### Data Loaded
- FY2024: 26 departments, total=$834,121,344 (from FY2023-25 biennial PDF)
- FY2025: 27 departments, total=$807,428,508 (from FY2024-25 midcycle PDF, overwrites biennial)
- Fund label: "General Purpose Fund" on all rows (D-06 invariant satisfied)

### GPF vs. $2.1B Requirement Discrepancy (Open Question 1 Resolution)
The DATA-02 requirement states "~$2.1B/year range." However:
- Oakland's all-funds total is ~$2.1B/year
- Oakland's **General Purpose Fund** (FD_1010) is ~$800M-$850M/year
- D-06 locks the load to GPF data only ("General Purpose Fund", not all-funds)
- The $2.1B figure in the requirement refers to all-funds context; GPF-only is the correct scope
- **Conclusion:** GPF totals of $807M-$847M are correct for GPF-only scope. The requirement $2.1B refers to all-funds.

### Revenue Status (D-05)
The Oakland PDFs contain a "GENERAL PURPOSE FUND REVENUE" section (pages 148-149 of FY2023-25 PDF) with GPF revenue by category (Property Tax, Sales Tax, Business License Tax, etc.). Total GPF revenue matches expenditures (balanced budget: $834M in FY23-24, $847M in FY24-25).

Revenue extraction was NOT implemented in this plan because:
1. The revenue table uses the same embedded OpenGov chart format as expenditures
2. Revenue categories are embedded in large single text cells requiring additional extraction logic
3. D-05 explicitly permits deferring revenue if extraction is not clean

**Revenue is deferred to a future plan.** This does not block DATA-02 (operating budget visible in app).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Download PDFs + write extractOakland.py | 8ea5ffb | scripts/extractOakland.py |
| 2 | Write processOakland.js + dry-run | e269369 | scripts/processOakland.js |
| Checkpoint | Live load + DB verification | (no new files) | DB: treasury.budgets, treasury.budget_categories |

## Dry-Run Results

| PDF | FY | Total GPF | In Band? |
|-----|----|-----------|---------|
| fy2023-25-adopted-budget.pdf | 2024 | $834,121,344 | YES ($700M-$900M) |
| fy2023-25-adopted-budget.pdf | 2025 | $846,524,612 | YES |
| fy2024-25-midcycle-adopted-budget.pdf | 2025 | $807,428,508 | YES |

## DB Verification Results

Confirmed via `treasury.budgets` and `treasury.budget_categories` queries:

1. Oakland operating rows exist for **FY2024** ($834M) and **FY2025** ($807M) — 2 distinct fiscal years ✅
2. All line items have `fund="General Purpose Fund"` (D-06 invariant) ✅
3. Totals in expected GPF band ($700M-$900M) ✅
4. Revenue: NOT loaded (deferred per D-05) — no FY of revenue data exists in DB ✅

## Deviations from Plan

### Auto-discovered deviation: OpenGov chart page cross-contamination

**Found during:** Task 1 (PDF inspection)

**Issue:** Oakland PDF uses per-department OpenGov chart pages where the fund table data leaks across page boundaries. The Library department's "Expenditures By Fund" page showed Fire's fund amounts ($199M) because the Fire fund table PDF object spans the physical page break.

**Fix:** Instead of parsing per-department chart pages (the initial approach), switched to parsing the authoritative **"Summary Table By Fund"** section which has clean, non-overlapping FD_1010 rows for all departments in one section.

**Files modified:** `scripts/extractOakland.py` (redesigned approach mid-implementation)

### Auto-discovered: Midcycle PDF performance issue

**Found during:** Task 1 testing

**Issue:** The 49MB midcycle PDF (711 pages) took >5 minutes to process when scanning all pages linearly.

**Fix:** Implemented `find_fund_summary_page()` fast-path that locates the Fund Summary section before scanning the full document. Reduces scan to ~15 pages instead of 711.

## Deferred Items

1. **Oakland GPF Revenue extraction** — Revenue section exists in the PDFs (pages 148-149 of FY2023-25) but requires additional parser for OpenGov embedded chart format. Deferred per D-05.
2. **FY2021-23 adopted budget** — Not available at expected S3 URL (HTTP 404). Older biennials on a different URL scheme (Pitfall 1 confirmed).
3. **FY2025-27 adopted budget** — Not yet published at expected URL (HTTP 404). Budget was adopted June 2025; adopted PDF not yet available at standard URL pattern (Pitfall 6 confirmed).

## Known Stubs

None — all loaded data is from actual Oakland adopted budget PDFs. No placeholders or mock data.

## Threat Flags

None — no new network endpoints or auth paths introduced. All threat mitigations implemented:
- T-28-04: maxBuffer 8MB in execSync ✅
- T-28-05: PDF path from controlled readdir, double-quoted ✅
- T-28-06: SUPABASE_SERVICE_KEY read via loadEnv(), never logged ✅
- T-28-07: GPF band sanity check ($700M-$900M) halts before live load ✅

## Self-Check: PASSED

- [x] scripts/extractOakland.py exists at correct path
- [x] scripts/processOakland.js exists at correct path
- [x] Commits 8ea5ffb and e269369 exist in git log
- [x] Oakland FY2024 operating budget in DB: $834,121,344
- [x] Oakland FY2025 operating budget in DB: $807,428,508
- [x] Both totals in GPF band ($700M-$900M)
- [x] Fund label = "General Purpose Fund" in budget_categories

---
*Phase: 28-oakland-san-jose-ca-data-load*
*Completed: 2026-06-05*
