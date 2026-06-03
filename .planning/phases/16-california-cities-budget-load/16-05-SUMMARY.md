---
phase: 16-california-cities-budget-load
plan: 05
subsystem: data-pipeline, enrichment
tags: [enrichment, california, san-francisco, san-diego, los-angeles, category-descriptions, enrichCategories]

# Dependency graph
requires:
  - phase: 16-04
    provides: "8 new CA budget rows (SF op+rev FY2025/FY2026, SD op+rev FY2025, LA rev FY2025/FY2026) with populated category trees"
  - phase: 15-los-angeles-socrata-budget-load-enrichment
    provides: "LA Operating enrichment baseline (~70 rows, Phase 15-03) — name_key deduplication caused LA Revenue enrichment to be a no-op"
  - phase: 14
    provides: "enrichCategories.js script with idempotent --city/--state invocation and municipality_id scoping"
provides:
  - "Plain-language descriptions for all SF top-level categories: 53 enrichment rows (municipality_id=a98fa397, FY2025+FY2026 operating+revenue covered)"
  - "Plain-language descriptions for all SD top-level categories: 61 enrichment rows (municipality_id=1ee32637, FY2025 only — FY2026 absent in source CSV)"
  - "LA Revenue enrichment: no-op — all LA revenue department names matched existing Phase 15-03 enrichment via name_key deduplication (70 rows preserved)"
  - "Phase 16 COMPLETE — 3 California cities (SF, SD, LA) fully loaded with operating + revenue + enrichment"
affects:
  - frontend (category description display for SF, SD, LA revenue)
  - per-capita display for CA cities (SF: 827,526 pop; SD: 1,404,452 pop; LA: 3,878,704 pop — all 2024 Census)
  - next expansion phase (Long Beach, San Jose, Sacramento, Portland, Seattle, NYC)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LA enrichment no-op via name_key deduplication: enrichCategories.js reuses descriptions when department_name matches an existing enrichment name_key — LA Revenue department names overlap 100% with LA Operating names from Phase 15-03"
    - "FY2026 follow-up not needed: SF and SD department vocabularies are stable across fiscal years; default --year 2025 invocation covers both FY2025 and FY2026 top-level categories"
    - "Dry-run before live-run protocol confirmed: all 3 cities dry-run passed before any API spend"

key-files:
  created: []
  modified: []

key-decisions:
  - "LA Revenue enrichment was a no-op — enrichCategories.js name_key deduplication matched all LA revenue department names to existing Phase 15-03 enrichment rows; 0 new API calls; total rows for LA remains 70"
  - "SD enrichment covers FY2025 only — SD FY2026 confirmed absent in source CSV (empty budget_cycle field); SD enrichment scope naturally limited to FY2025"
  - "No --year 2026 follow-up needed — Step E query confirmed 0 unenriched depth-0 categories for any CA city/fiscal_year combination after the FY2025 default runs"
  - "Total Phase 16 enrichment API cost ~$0.43 — well under the $5 project threshold (RESEARCH.md estimate was $0.19-$0.27; actual ~60% higher due to more distinct category names than estimated)"

patterns-established:
  - "name_key deduplication in enrichCategories.js prevents redundant API calls when same department name appears in multiple dataset_types for the same municipality"

# Metrics
duration: ~30min
completed: 2026-05-22
---

# Phase 16 Plan 05: CA Cities Enrichment + Human Verification Summary

**SF (53 rows) and SD (61 rows) enrichment complete; LA Revenue was a no-op via name_key dedup from Phase 15-03; all 3 cities human-verified at treasurytracker.empowered.vote with descriptions, dollar amounts, and per-capita display — Phase 16 and v1.4 milestone COMPLETE**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-22 (execution start)
- **Completed:** 2026-05-22
- **Tasks:** 3 of 3 (Task 1: dry-run; Task 2: live enrichment + DB verification; Task 3: human-verify checkpoint)
- **Files modified:** 0 (no source file changes — invokes existing scripts, writes to DB)

## Accomplishments

- SF enrichment complete: 53 rows in treasury.category_enrichment with municipality_id=a98fa397, null_count=0, blank_desc=0 — covers FY2025+FY2026 operating+revenue top-level categories
- SD enrichment complete: 61 rows with municipality_id=1ee32637, null_count=0, blank_desc=0 — covers FY2025 operating+revenue top-level categories (FY2026 absent in source CSV)
- LA Revenue enrichment was a confirmed no-op: all LA revenue department_name values matched existing Phase 15-03 enrichment rows via name_key deduplication; 70 existing rows preserved and re-confirmed correct
- Idempotency verified: SF re-run produced 0 duplicate rows (Query 2 returned 0 rows)
- Bleed checks passed: Queries 3 and 4 both returned 0 rows — no cross-city contamination between CA cities and TX cities
- No FY2026 follow-up runs needed: Step E confirmed 0 unenriched depth-0 categories across all 3 cities × fiscal years
- Total Phase 16 enrichment API cost: ~$0.43 (well under the $5 project threshold)
- Human verification approved at treasurytracker.empowered.vote

## Task Commits

This plan modifies no source files. No per-task commits generated.

**Plan metadata:** (docs commit at plan completion)

## Files Created/Modified

None — this plan is pure script execution + DB writes + verification.

## Enrichment Counts per City

| City | Municipality ID | Enrichment Rows | null_count | blank_desc | FYs Covered | Notes |
|------|----------------|-----------------|------------|------------|-------------|-------|
| San Francisco | a98fa397-e459-4a9b-b37c-214d6af275b6 | 53 | 0 | 0 | FY2025 + FY2026 | Operating + Revenue depth-0 |
| San Diego | 1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2 | 61 | 0 | 0 | FY2025 only | FY2026 absent in source CSV |
| Los Angeles | 391bf791-1c1f-424f-a7a5-1b698c79093f | 70 (no-op) | 0 | 0 | FY2025 + FY2026 | Phase 15-03 baseline preserved |

**Total Phase 16 enrichment API cost: ~$0.43**

## Dry-Run Results (Task 1)

All 3 dry-runs passed before any API spend:

| City | Municipality ID | Reported | Result |
|------|----------------|----------|--------|
| San Francisco | a98fa397-e459-4a9b-b37c-214d6af275b6 | Correct UUID, positive target count | PASS |
| San Diego | 1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2 | Correct UUID, positive target count | PASS |
| Los Angeles | 391bf791-1c1f-424f-a7a5-1b698c79093f | Correct UUID, 0 new categories (no-op) | PASS |

No NULL municipality_id reported. No scoping warnings. Estimated cost well under $1. LA dry-run correctly reported 0 new categories — Task 2 Step C (LA live enrichment) was skipped as a no-op.

## DB Verification Queries (Task 2)

**Query 1 — Enrichment rows per CA city:**
- SF: total=53, null_count=0, blank_desc=0, min_desc_length>0 — PASS
- SD: total=61, null_count=0, blank_desc=0, min_desc_length>0 — PASS
- LA: total=70 (Phase 15-03 baseline), null_count=0, blank_desc=0 — PASS

**Query 2 — Idempotency (SF re-run):** 0 duplicate category_ids — PASS

**Query 3 — CA→TX bleed check:** 0 rows — PASS (no SF/SD/LA descriptions reference Dallas, Plano, Frisco, McKinney, Allen TX, Garland, Wylie, Murphy, Princeton, Richardson, Prosper, Celina, Sachse, Bloomington, or Indiana)

**Query 4 — TX→CA reverse bleed check:** 0 rows — PASS (no TX/LA descriptions reference San Francisco or San Diego)

**Step E — FY2026 unenriched check:** 0 rows across all 3 cities × 2 fiscal years — no --year 2026 follow-up runs needed

## FY2026 Follow-Up Status

No --year 2026 runs were needed. The default `--year 2025` invocation in enrichCategories.js covers all depth-0 categories for both fiscal years because SF and SD use stable department vocabularies across FY2025 and FY2026.

## LA Enrichment No-Op Explanation

When `enrichCategories.js` is run against LA with the new Revenue budgets loaded, it computes a `name_key` (normalized department name) for each depth-0 category in the new revenue budget rows. It then checks `treasury.category_enrichment` for existing rows with the same `municipality_id` + `name_key` combination. All LA revenue department_name values (e.g., "Police", "Fire", "Public Works") matched existing Phase 15-03 operating enrichment rows via name_key lookup — so 0 new API calls were made and 0 new rows were inserted. The 70 existing LA enrichment rows from Phase 15-03 already cover the revenue categories by name.

## Human Verification (Task 3)

**Status: APPROVED** at treasurytracker.empowered.vote on 2026-05-22.

Verified:
- San Francisco and San Diego appear in the city picker alongside LA and TX cities
- SF FY2025 operating total renders in the ~$15.9B range with descriptions on top-level departments (FIR, POL, MTA, PUC, REC)
- SF FY2025 revenue total renders in the ~$15.9B range (balanced budget confirmed)
- SF FY2026 operating spot-check passed
- SD FY2025 operating renders with descriptions on top-level dept_name categories
- SD FY2025 revenue renders with descriptions on revenue-source categories
- SD FY2026 correctly absent (not shown as a selectable year or renders cleanly)
- LA FY2025 operating baseline still renders ($19.8B) — no Phase 15 regression
- LA FY2025 revenue now renders alongside operating (~$10.2B) — Phase 16 Revenue load confirmed in UI
- Per-capita displays for SF (~$19,200/resident at $15.9B ÷ 827,526), SD, and LA all labeled "Based on 2024 Census estimate"
- Dark mode: descriptions readable on SF and SD pages
- Cross-city bleed spot-check: Dallas, SF, SD descriptions for same-named departments are distinct and city-appropriate
- TX city regression check: Plano/McKinney still render normally; LA Operating $19.8B FY2025 confirmed

## Decisions Made

- **LA Revenue enrichment was skipped as a no-op:** The enrichCategories.js name_key deduplication correctly identified that all LA revenue department names were already covered by Phase 15-03 enrichment. 0 new API calls. Total LA rows remains 70.
- **SD enrichment covers FY2025 only:** SD FY2026 is absent from the source CSV (empty budget_cycle field, confirmed in Plan 16-02 + 16-04). Enrichment is naturally scoped to FY2025 — no corrective action needed.
- **No --year 2026 follow-up:** Step E query confirmed 0 unenriched depth-0 categories for any CA city/fiscal_year after default FY2025 runs. Department vocabulary is stable across fiscal years for SF and SD.
- **Actual API cost ~$0.43 vs $0.19-0.27 estimate:** ~60% higher than RESEARCH.md estimate; still well under $1 and the $5 project threshold. Variance due to more distinct top-level category names than estimated.

## Deviations from Plan

None — plan executed exactly as written. The LA enrichment no-op was anticipated by the plan (Task 1 LA dry-run decision logic: "if LA dry-run reports 0 new categories, Step C can be SKIPPED entirely"). The skip was correctly triggered and documented.

## Issues Encountered

None — all scripts exited 0, all queries returned expected results on first execution.

## Next Phase Readiness

**Phase 16 is COMPLETE.** v1.4 Geographic Expansion milestone is complete.

3 California cities are now fully loaded in Treasury Tracker:
- **San Francisco, CA** — Operating + Revenue FY2025/FY2026, per-capita (pop 827,526, 2024), enrichment complete
- **San Diego, CA** — Operating + Revenue FY2025, per-capita (pop 1,404,452, 2024), enrichment complete
- **Los Angeles, CA** — Operating FY2025/FY2026 (Phase 15) + Revenue FY2025/FY2026 (Phase 16), per-capita (pop 3,878,704, 2024), enrichment complete

**Suggested next expansion options:**
- Long Beach, CA — next-largest CA city; likely has Socrata portal; completes Southern California quartet
- San Jose, CA — 4th-largest CA city; similar Socrata infrastructure to SF/SD
- Sacramento, CA — state capital; Socrata likely; adds political context
- Portland, OR or Seattle, WA — first Pacific Northwest cities; proves pipeline beyond CA
- NYC — largest US city; has open data portal but complex multi-agency structure

**Deferred per RESEARCH.md:**
- Berkeley, CA — small city, data quality concerns
- Fremont, CA — limited open data availability

**No blockers for next phase start.**

---
*Phase: 16-california-cities-budget-load*
*Completed: 2026-05-22*
