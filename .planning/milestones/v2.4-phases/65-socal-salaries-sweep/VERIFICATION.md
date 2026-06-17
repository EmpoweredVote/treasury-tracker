# Phase 65 — SoCal Salaries Sweep — VERIFICATION

**Verified:** 2026-06-17 (inline goal-backward verification via read-only production DB probes + independent GCC re-aggregation)
**Result:** ✅ PASS — phase goal achieved, SAL-07 satisfied.

## Phase Goal
All newly-loaded SoCal cities (the 95-city Phase 63 cohort across the 6 SoCal counties) carry CA Government Compensation salary data (FY2009–2024), reconciled on a sample — via `sweepCASalaries.js` with zero new code, on the production DB (local salary state is stale).

## Success-Criteria Checks (from ROADMAP)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Source coverage confirmed against GCC before any sweep writes | ✅ Production target hard-asserted (`SUPABASE_URL` = kxsdzaojfaibhuzmclfq); dry-ran all 6 counties → cohort = 95, per-city/year coverage + gaps read before writing |
| 2 | Salaries 2009–2024 loaded with never-overwrite guard | ✅ 1,510 city-year rows written (additive `salaries` only; op/rev untouched); 0 different-source overwrites; Riverside/San Diego city GCC rows refreshed |
| 3 | Sample latest-year total comp reconciles to GCC at ~$0 delta | ✅ 4 cities at EXACTLY $0 (Riverside $378,222,887; San Bernardino $142,134,736; Oxnard $204,573,470; El Centro $27,502,367), via independent re-aggregation of the official GCC export (separate code path) |
| 4 | Per-city coverage + gaps documented; dataset viewable | ✅ 95/95 cities covered, 87/95 full 16-yr; 10 city-year gaps documented (GCC source gaps + late incorporation); renders by construction (DatasetTabs.tsx) |

## Consolidated Evidence (production DB, schema `treasury`)

| County | cities | with salaries | full 16-yr | salaries rows |
|--------|--------|---------------|-----------|---------------|
| Riverside | 28 | 28 | 25 | 444 |
| San Bernardino | 24 | 24 | 22 | 381 |
| San Diego | 18 | 18 | 17 | 287 |
| Ventura | 10 | 10 | 10 | 160 |
| Santa Barbara | 8 | 8 | 7 | 127 |
| Imperial | 7 | 7 | 6 | 111 |
| **TOTAL** | **95** | **95** | **87** | **1,510** |

## Execution Notes / Deviations
- **Production-only enforced (D-04):** the salary sweep target was hard-asserted to the production project before any write (local Supabase salary state is stale per the standing project memo).
- **Source = GCC** (`gcc.sco.ca.gov`), a different host than ByTheNumbers — reliable here (0 download failures); 16 ZIPs cached once and shared across the 6 per-county runs.
- **Additive + never-overwrite:** wrote `dataset_type='salaries'` only; operating/revenue rows untouched; same-source (GCC) pre-existing rows refreshed idempotently.
- **Verify-probe column fix:** initial probes referenced non-existent columns (`total`, `row_count`); the budgets total column is `total_budget`. Corrected — the underlying data was correct throughout (reconciliation is exactly $0).
- **No build/test gate:** zero source code changed (DB rows + docs only).

## Conclusion
Phase 65 delivers exactly what it promised: GCC salaries (FY2009–2024) for all 95 SoCal cities, additive and never-overwrite, reconciled to the official source at $0 delta, with coverage and gaps documented. SAL-07 satisfied. Downstream phases (66 enrichment, 67 ACFR + UAT) can proceed.
