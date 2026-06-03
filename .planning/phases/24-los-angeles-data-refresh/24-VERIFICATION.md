---
phase: 24-los-angeles-data-refresh
verified: 2026-06-03T18:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 24: Los Angeles Data Refresh — Verification Report

**Phase Goal:** Fix LA revenue and budget data quality issues — correct FY2025 revenue total (~$10.2B, not $44.6B), load all-funds operating budget for 10 fiscal years (FY2017–FY2026), and improve plain-language summaries using enrichment data.
**Verified:** 2026-06-03T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LA FY2025 revenue displays ~$10.2B (approved revenue_budget), not $44.6B | VERIFIED | `seedCaliforniaCities.js` line 246: `actual_amount_column: null`; commit cb9eb8b; 24-01-SUMMARY confirms DB total $10,223,013,861; UAT Test 1 passed |
| 2 | LA FY2026 revenue displays ~$10.1B (approved revenue_budget) | VERIFIED | Same null column_mapping; 24-01-SUMMARY confirms DB total $10,108,092,148; UAT Test 2 passed |
| 3 | No enterprise-fund actual collections (LADWP/Airports/Harbor) bleed into revenue total | VERIFIED | `actual_amount_column: null` prevents loader from reading `revenue_collected`; all budget_categories `actual_amount` fields are 0 post-reload |
| 4 | LA operating FY2017–FY2026 all-funds totals in budgets.total_budget | VERIFIED | `seedLADataSources.js` line 108: `where_extra: "AND adopted_budget_amount > 0"`, `fiscal_years: [2017..2026]`; commit 169da13; 24-02-SUMMARY table shows all 10 FY rows loaded (1,367–1,630 rows/year) |
| 5 | LA Money Out FY2025 shows ~$19.86B (all-funds operating), not $9.4B | VERIFIED | Commit 169da13 (24-04 gap-closure); 24-04-SUMMARY: FY2025 $19,855,193,208; human verification APPROVED on treasurytracker.empowered.vote per 24-04-SUMMARY "Next Phase Readiness" section |
| 6 | FY2017–FY2020 have department-level category trees (~48–58 depth-0 departments) | VERIFIED | 24-02-SUMMARY table: FY2017 48, FY2018 50, FY2019 50, FY2020 50 depth-0 categories; UAT Test 4 passed |
| 7 | PlainLanguageSummary surfaces the 2-3 sentence enrichment.description for the top category, guarded against duplication | VERIFIED | `PlainLanguageSummary.tsx` lines 253–258: `topCategories[0]?.enrichment?.description && description !== shortDescription` guard with italic prose paragraph; commit 35e0503; UAT Test 5 passed; human-verified in live app per 24-03-SUMMARY |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/seedCaliforniaCities.js` | LA_REVENUE with `actual_amount_column: null` | VERIFIED | Line 246 confirmed; commit cb9eb8b; no other factory functions modified |
| `scripts/seedLADataSources.js` | `where_extra: "AND adopted_budget_amount > 0"` + `fiscal_years: [2017..2026]` | VERIFIED | Line 108 confirmed; line 110 confirmed; commit 169da13 (gap-closure over 20b4763) |
| `src/components/dashboard/PlainLanguageSummary.tsx` | Guarded `enrichment.description` paragraph | VERIFIED | Lines 253–258; optional-chain guard + `!== shortDescription` guard; commit 35e0503 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `seedCaliforniaCities.js` LA_REVENUE `actual_amount_column: null` | `treasury.data_sources` column_mapping JSONB | seeder upsert `.update()` | VERIFIED | Seeder uses name-based lookup; 24-01-SUMMARY confirms "updated existing municipality row" and correct DB state |
| `treasury.data_sources` LA Revenue `column_mapping` | `treasury.budget_categories` (no actuals) | `bulkLoadBudget.js` reading config + `treasury_sync_budget_tree` clear-and-rebuild | VERIFIED | Null `actual_amount_column` prevents loader from reading `revenue_collected`; FY2025/FY2026 reloaded clean |
| `seedLADataSources.js` LA_DATA_SOURCE `where_extra` | `treasury.data_sources` id=01c50191 column_mapping | seeder upsert `.update()` | VERIFIED | Line 108 `"AND adopted_budget_amount > 0"`; commit 169da13 confirms seeder updated existing row |
| `treasury.data_sources` column_mapping `where_extra` | `budgets.total_budget` | `bulkLoadBudget.js` → `treasury_sync_budget_tree` RPC | VERIFIED | 24-04-SUMMARY: FY2025 total $19,855,193,208 written to DB; all 10 FY rows updated |
| `BudgetCategory.enrichment.description` (categories API) | `PlainLanguageSummary` topCategories[0] prose paragraph | optional-chaining guard + `description !== shortDescription` | VERIFIED | PlainLanguageSummary.tsx lines 253–258; API confirmed: all 54 LA FY2025 categories return distinct `description` field |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PlainLanguageSummary.tsx` | `topCategories[0].enrichment.description` | Categories API response (props passed from parent) | Yes — 54 LA enrichment rows in DB from Phase 15; API confirmed returning distinct `description` field | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| `actual_amount_column: null` in `seedCaliforniaCities.js` LA_REVENUE | `grep -n "actual_amount_column"` confirms line 246: `actual_amount_column: null` | PASS |
| `where_extra: "AND adopted_budget_amount > 0"` in `seedLADataSources.js` | line 108 confirmed; `fiscal_years` array line 110 = `[2017..2026]` | PASS |
| Description guard in `PlainLanguageSummary.tsx` | Lines 253–254: `topCategories[0]?.enrichment?.description && description !== topCategories[0].enrichment.shortDescription` | PASS |
| All 3 commits exist in git history | cb9eb8b (revenue fix), 35e0503 (description prose), 169da13 (gap-closure filter fix) | PASS |
| Human UAT 24-UAT.md: 4/5 tests passed, gap #3 closed by plan 24-04, money-out FY2025 human-verified | 24-UAT.md shows Tests 1, 2, 4, 5 PASS; gap #3 root cause identified; 24-04-SUMMARY records human approval of $19.86B on live site | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist for this phase; phase is a data-load + UI fix, not a CLI tool or migration with formal probe contract.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LA-BUDGET-ALL-FUNDS | 24-04-PLAN.md | LA operating budget reflects all-funds totals (not General Fund only) for all 10 FY | SATISFIED | `where_extra: "AND adopted_budget_amount > 0"` replaces General Fund filter; FY2025 = $19.86B; 24-04-SUMMARY `requirements-completed: [LA-BUDGET-ALL-FUNDS]` |

No other formal requirement IDs appear in plans 24-01, 24-02, or 24-03 (all declare `requirements: []`). The plan's requirement list is complete.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `scripts/seedLADataSources.js` | No anti-patterns — no TBD/FIXME/XXX/placeholder markers; no empty returns | Clean | None |
| `scripts/seedCaliforniaCities.js` | No anti-patterns in LA_REVENUE factory | Clean | None |
| `src/components/dashboard/PlainLanguageSummary.tsx` | No anti-patterns — description paragraph is a real render, not a stub | Clean | None |

---

### Deviations from Plan (Informational)

Two architectural findings from 24-02 execution are noted here because the plan's acceptance criteria could not be fully met at the DB level. These are not gaps — they are documented as tech debt in the v1.5 milestone audit:

1. **`treasury_sync_budget_tree` does not write `actual_amount` to `budget_categories`:** The plan expected FY2021-2024 actuals to be stored in `budget_categories.actual_amount`. In fact, the RPC never persists this field. Enterprise-fund actuals never existed in the DB — the `where_extra` filter is correctly placed preventatively. The `hasActualData` path in App.tsx will not fire for LA data loaded via this RPC.

2. **`treasury_sync_budget_tree` does not repair `data_source_id` on existing rows:** The orphaned FK 1973cbe0 was not repaired; `data_source_id` is cosmetic and no query path depends on it. No functional impact.

Both deviations were disclosed in 24-02-SUMMARY and recorded as `DEFERRED` in the DB State table. They do not affect the phase goal, which is about data accuracy and UI quality, not internal FK bookkeeping.

---

### Human Verification

Human verification was completed by the user during phase execution:

1. **Plan 24-03 checkpoint (enrichment description prose):** Approved in live app — user confirmed the 2-3 sentence description paragraph appeared under the top operating category for LA FY2025, was not a duplicate of shortDescription, and was hidden for cities/years where description is absent. Documented in 24-03-SUMMARY Task 2.

2. **Plan 24-04 checkpoint (Money Out FY2025 = $19.86B):** Approved on treasurytracker.empowered.vote — user confirmed:
   - LA Money Out FY2025 shows ~$19.86B (was $9.4B)
   - FY2017 shows ~$13.4B, FY2018 shows ~$14.2B
   - Money In FY2025 still shows ~$10.2B (unchanged)
   - Category tree under Money Out shows department-level rows (not just General Fund departments)
   Documented in 24-04-SUMMARY "Next Phase Readiness" section.

No outstanding human verification items remain.

---

### Gaps Summary

No gaps. All 7 must-have truths are verified in the codebase with commit-level and human-UAT-level evidence. The one UAT issue (gap #3 — Money Out showing $9.4B) was root-caused, addressed by gap-closure plan 24-04, and human-verified as resolved on the live site.

---

_Verified: 2026-06-03T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
