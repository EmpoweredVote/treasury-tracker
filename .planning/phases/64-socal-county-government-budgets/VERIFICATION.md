# Phase 64 — SoCal County-Government Budgets — VERIFICATION

**Verified:** 2026-06-17 (inline goal-backward verification via read-only production DB probes)
**Result:** ✅ PASS — phase goal achieved, CGB-01 satisfied across all 8 counties.

## Phase Goal
Each of the 6 SoCal county governments + the 2 directory-only counties already in the DB (Alameda, Sacramento) shows its own operating + revenue budget (FY2003–2024) — county pages render icicle/summary + per-capita instead of directory-only. Loaded via `loadCountyBudget.js` (county datasets `uctr-c2j8` / `emxv-k8xv`) with zero new code.

## Consolidated Evidence (production DB, schema `treasury`)

| County | Plan | op rows | rev rows | NULL source_url | population | FY range |
|--------|------|---------|----------|-----------------|------------|----------|
| Riverside County | 64-01 | 22 | 22 | 0 | 2,442,378 | 2003–2024 |
| San Bernardino County | 64-01 | 22 | 22 | 0 | 2,181,433 | 2003–2024 |
| San Diego County | 64-01 | 22 | 22 | 0 | 3,291,101 | 2003–2024 |
| Ventura County | 64-01 | 22 | 22 | 0 | 823,863 | 2003–2024 |
| Santa Barbara County | 64-01 | 22 | 22 | 0 | 443,623 | 2003–2024 |
| Imperial County | 64-01 | 22 | 22 | 0 | 182,881 | 2003–2024 |
| Alameda County | 64-02 | 22 | 22 | 0 | 1,641,869 | 2003–2024 |
| Sacramento County | 64-02 | 22 | 22 | 0 | 1,578,938 | 2003–2024 |
| **TOTAL** | | **176** | **176** | **0** | all > 0 | **352 rows** |

## Success-Criteria Checks (from ROADMAP)
- ✅ **County-gov op+rev FY2003–2024 loaded** via `loadCountyBudget.js` for the 6 SoCal counties + Alameda + Sacramento — all-governmental-funds basis (documented; SCO county totals are all-funds per the Phase 56 finding). Each county has the full 22 operating + 22 revenue years.
- ✅ **Durable source attribution + per-year population:** every one of the 352 rows carries a `/d/uctr-c2j8` or `/d/emxv-k8xv` ByTheNumbers page source_url (NULL source_url = 0); per-year population came from the SCO county feed; each entity's stored population > 0 (FY2024 canary loaded first to lock a current per-capita denominator).
- ✅ **Pages render icicle/summary + per-capita (no longer directory-only):** each county entity now has op+rev budget trees + population. **City rows untouched** — the county-gov load writes only to the `entity_type='county'` row.

## Execution Notes / Deviations
- **Inline execution on the main working tree (D-11):** the loader needs the gitignored `.env` and writes to the shared production DB, so worktrees were not used (same constraint as Phase 63).
- **Canary-first ordering (D-04):** `backfillPopulation` is first-non-zero-wins, so FY2024 was loaded first for every county to lock a current population for per-capita.
- **SCO API instability (D-06):** drove the unchanged `loadCountyBudget.js` one fiscal year at a time inside a shell retry loop ([[project_sco_api_flaky_per_fy_retry]]) — orchestration only, zero new code (`files_modified: []`). The feed cooperated this run; all 8 counties × 22 years loaded clean with no gap-fill pass needed.
- **No build/test gate:** this phase wrote zero source code (DB rows + SUMMARYs only).

## Conclusion
Phase 64 delivers exactly what it promised: 8 county governments (the 6 SoCal counties + Alameda + Sacramento) with complete FY2003–2024 operating + revenue history, all-governmental-funds basis, durably sourced, with per-capita populations — their pages are no longer directory-only. CGB-01 satisfied. Downstream phases (65 salaries, 66 enrichment, 67 ACFR+UAT) can proceed.
