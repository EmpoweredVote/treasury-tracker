---
phase: 08-data-quality
plan: 03
subsystem: pdf-pipeline
tags: [pdf, haiku, claude, budget, extraction, plano, frisco, acfr]

# Dependency graph
requires:
  - phase: 08-01
    provides: Fixed bulkLoadPDF.js pipeline (max_tokens=8192, section_heading context, exit code 2 handling)
provides:
  - Frisco FY2026 re-extracted from PDF — 31 placeholder categories replaced with 1,416 real budget categories
  - Plano FY2019/FY2020/FY2022 re-extracted — pct_unknown dropped from 0.1% to 0.0% on all three years
  - Documented cost decision: Plano FY2023–2026 skipped (already 99.9% clean, ~$20 API cost not justified)
affects: [data-quality, treasury.budget_categories, 09-revenue-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sequential PDF runs (not parallel) to share rate limit and disk cache across years for same city"
    - "Dry-run validation before live load for any new city/PDF format"
    - "Exit code 2 accepted when flagged page is projection matrix (not operating budget data)"

key-files:
  created: []
  modified:
    - scripts/bulkLoadPDF.js
    - scripts/seedPDFDataSources.js

key-decisions:
  - "Plano FY2023–2026 skipped — already 99.9% clean (1 unknown row per year), ~$20 API cost not justified for unfunded nonprofit"
  - "Frisco PDF format compatible with ACFR prompt — dry-run confirmed before live load"
  - "Plano runs sequential to share rate limit and disk cache across fiscal years"
  - "FY2022 exit code 2 accepted — flagged page is projection matrix, not budget data; main data load succeeded"

patterns-established:
  - "Cost gating: marginal quality gains must justify API spend for unfunded nonprofit — document skipped runs explicitly"

# Metrics
duration: multi-session
completed: 2026-05-04
---

# Phase 8 Plan 03: Frisco/Plano PDF Re-Extraction Summary

**Re-extracted Frisco FY2026 (31 placeholder categories replaced with 1,416 real PDF budget categories) and Plano FY2019/FY2020/FY2022 through the fixed pipeline; FY2023–2026 skipped on cost grounds — data already 99.9% clean before re-extraction.**

## Performance

- **Duration:** Multi-session (pre-flight in prior run, live loads in current run)
- **Started:** 2026-05-04 (prior session)
- **Completed:** 2026-05-04
- **Tasks:** 2 of 3 completed (Task 3 human verification: user accepted partial completion)
- **Files modified:** 0 source files (DB-only changes; review log gitignored)

## Accomplishments

- Frisco FY2026 category count jumped from 31 (old XLSX-derived placeholder) to 1,416 real PDF-extracted budget categories
- Plano FY2019, FY2020, and FY2022 reduced from 0.1% unknown to 0.0% unknown after re-extraction
- Plano FY2023–2026 explicitly deferred with documented rationale — cost decision acknowledged and accepted by user
- FY2022 exit code 2 investigated and accepted: flagged page was a "Budget Assumption Matrix" (projection data), not operating budget; main load committed successfully

## Task Commits

No source file changes were made — all work was DB-only pipeline runs. No commits were created during execution.

The review log (`scripts/review_log.jsonl`) is gitignored per project convention.

## Pipeline Run Summaries

### Frisco FY2026 (completed in prior session)

| Metric | Value |
|--------|-------|
| Pages processed | 562 |
| Budget tables found | 264 |
| Rows loaded | 1,868 |
| Pages flagged | 0 |
| Exit code | 0 |
| Category count before | 31 (XLSX placeholder) |
| Category count after | 1,416 (real PDF data) |

### Plano FY2019

| Metric | Value |
|--------|-------|
| Pages processed | 482 |
| Budget tables found | 184 |
| Rows loaded | 1,397 |
| Pages flagged | 0 |
| Exit code | 0 |

### Plano FY2020

| Metric | Value |
|--------|-------|
| Pages processed | 470 |
| Budget tables found | 193 |
| Rows loaded | 1,697 |
| Pages flagged | 0 |
| Exit code | 0 |

### Plano FY2022

| Metric | Value |
|--------|-------|
| Pages processed | 478 |
| Budget tables found | 199 |
| Rows loaded | 1,512 |
| Pages flagged | 1 |
| Exit code | 2 |

**Exit code 2 explanation:** Page 102 flagged (confidence 45) — identified as "Budget Assumption Matrix" containing projection data, not actual budget allocations. Page 149 triggered a Haiku JSON parse error after 3 retries (haikuFatal=true); that single page's rows were skipped. Data committed successfully before exit. FY2022 pct_unknown dropped from 0.1% to 0.0%. Classification: **acceptable** — the flagged page is out-of-scope content, not a pipeline failure.

## Data Quality Audit: BEFORE vs AFTER

### BEFORE (prior to this plan's execution)

| City | FY | unknown_cats | total_cats | pct_unknown |
|------|----|-------------|------------|-------------|
| Frisco | 2026 | 0 | 1,416 | 0.0% (already loaded in prior session) |
| Plano | 2019 | 1 | 1,355 | 0.1% |
| Plano | 2020 | 1 | 927 | 0.1% |
| Plano | 2022 | 1 | 1,409 | 0.1% |
| Plano | 2023 | 1 | 1,338 | 0.1% |
| Plano | 2024 | 1 | 1,357 | 0.1% |
| Plano | 2025 | 1 | 1,310 | 0.1% |
| Plano | 2026 | 1 | 1,195 | 0.1% |

### AFTER (post re-extraction)

| City | FY | unknown_cats | total_cats | pct_unknown | Notes |
|------|----|-------------|------------|-------------|-------|
| Frisco | 2026 | 0 | 1,416 | 0.0% | |
| Plano | 2019 | 0 | 1,385 | 0.0% | Re-extracted |
| Plano | 2020 | 0 | 1,452 | 0.0% | Re-extracted |
| Plano | 2022 | 0 | 1,483 | 0.0% | Re-extracted |
| Plano | 2023 | 1 | 1,338 | 0.1% | Skipped — not re-extracted |
| Plano | 2024 | 1 | 1,357 | 0.1% | Skipped — not re-extracted |
| Plano | 2025 | 1 | 1,310 | 0.1% | Skipped — not re-extracted |
| Plano | 2026 | 1 | 1,195 | 0.1% | Skipped — not re-extracted |

## Skipped Years: Plano FY2023–2026

**Decision:** User approved skipping re-extraction of Plano FY2023, FY2024, FY2025, and FY2026.

**Rationale:**
- Each of these years had exactly 1 unknown row out of 1,195–1,338 total categories (0.1% unknown)
- Re-extraction cost was estimated at approximately $20 in Claude API calls (4 years × ~$5/year)
- Treasury Tracker is an unfunded nonprofit — marginal quality gain (0.1% → 0.0%) does not justify the spend
- The data is functionally correct for citizen-facing transparency purposes

**User checkpoint response:** "skip" — accepted partial completion. FY2019/2020/2022 and Frisco FY2026 considered sufficient for Phase 8 goals.

## Files Created/Modified

No source files modified. All changes were database-only (budget_categories rows replaced via `treasury_sync_budget_tree` RPC).

- `scripts/bulkLoadPDF.js` — used (not modified); fixed pipeline from 08-01
- `scripts/seedPDFDataSources.js` — used (not modified); Frisco data source seeded in 08-01

## Decisions Made

1. **Plano FY2023–2026 skipped** — Already 99.9% clean (1 unknown row per year out of 1,195–1,338). Re-extraction cost of ~$20 not justified for an unfunded nonprofit when marginal improvement is 0.1% → 0.0%.

2. **Frisco dry-run before live load** — Confirmed PDF format compatible with ACFR prompt before committing to full extraction. Dry-run passed (0 pages flagged, 562 pages processed cleanly).

3. **Sequential Plano runs** — Ran FY2019, FY2020, and FY2022 sequentially rather than in parallel to share Claude API rate limits and disk image cache, reducing both cost and I/O.

4. **FY2022 exit code 2 accepted** — Exit code 2 triggered by a "Budget Assumption Matrix" page (projection data, not operating budget) and one JSON parse failure on a dense page. Main data load completed successfully and committed before exit. Accepted as non-blocking.

## Deviations from Plan

None — plan executed as written except for the explicit user decision to skip Plano FY2023–2026. This was handled at the checkpoint (Task 3) per the plan's checkpoint protocol.

## Issues Encountered

- **Plano FY2022 Page 149 Haiku JSON parse failure:** After 3 retries, the page's rows were skipped (haikuFatal=true). This is existing expected behavior per the pipeline design — the page's content was lost but did not corrupt the load. pct_unknown still reached 0.0% for FY2022 overall.

## User Setup Required

None — no external service configuration required.

## Recommended Follow-up

1. **Plano FY2023–2026:** If unknown rows become a concern in future (e.g., a citizen reports incorrect department names), re-run individual years at ~$5/year per fiscal year. Currently only 1 row per year is affected. Low priority.

2. **Haiku extraction caching:** Consider caching Haiku JSON output per page (keyed by PDF SHA-256 + page number) so future re-runs do not re-call the API for already-processed pages. This would make re-extraction of the skipped Plano years essentially free on a second pass, eliminating the cost barrier entirely.

## Next Phase Readiness

- Phase 8 (Data Quality) complete — all planned re-extractions done or explicitly deferred
- Frisco and Plano operating budget data is now clean (0.0% unknown for loaded years)
- Plano FY2023–2026 remain at 0.1% unknown — documented and accepted
- Ready to proceed to Phase 9 (Revenue Completion)
- No blockers

---
*Phase: 08-data-quality*
*Completed: 2026-05-04*
