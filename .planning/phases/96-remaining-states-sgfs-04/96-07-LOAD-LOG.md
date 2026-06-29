# Phase 96 — Wave 5 Live Load Log (SGFS-04)

**Run:** 2026-06-28 | **Source:** 2025 NASBO State Expenditure Report (actual FY2023, FY2024)

## What ran (in order)
1. Final full-cohort dry-run gate → **94 state-FY tie:PASS** (hard gate before any write).
2. `cleanupStateEstimates.mjs --confirm` → **deleted 375 rows** (234 unsourced revenue + 141 out-of-window operating FY2022/2025/2026) across 47 states (46 cohort + Georgia).
3. `loadStateGF.mjs` (live) → **94 state-FY loaded** (46 cohort × FY2023+FY2024 + GA FY2023 idempotent + GA FY2024 new), each source-stamped via post-RPC UPDATE.
4. Idempotency: re-run cleanup → 0 deletes; loader re-run upserts same rows by (muni,fy,dataset) key.

## DB probe results (live, via supabase-local execute_sql)
| Probe | Expected | Actual |
|-------|----------|--------|
| Cohort revenue rows | 0 | **0** ✓ (D-96-03 resolved — no unsourced "Money In" displayed) |
| Cohort operating rows outside FY2023/2024 | 0 | **0** ✓ |
| Cohort operating rows FY2023+FY2024 | 94 (47×2) | **94** ✓ |
| Distinct states with operating | 47 | **47** ✓ (46 + GA) |
| NULL provenance (source_url/date/data_source) | 0 | **0** ✓ (P4) |

## Fiscal-year-end source_dates (non-June-30 states)
AL 2023/2024-**09-30** ✓ · MI -**09-30** ✓ · TX -**08-31** ✓ · NY -**03-31** ✓ · CA/GA -06-30 ✓

## Source cross-check (loaded totals vs NASBO Table 1 General Fund, $B)
AL 13.764/13.511 · CA 195.189/205.671 · GA 29.266/34.594 · MI 14.861/15.129 · NY 84.474/91.070 · TX 45.367/50.512 — all match the PDF-verified GENERAL FUND column (not Total/Federal/FY2025-estimate). GA FY2023 = 29.266 matches the Phase-94 load exactly.

## Untouched (verified intact)
MN (FY2008–2025 op+rev), OH (FY2020–2025 op+rev), VA (FY2022–2025 op+rev) — real ACFR rows including their **revenue** rows, correctly NOT deleted by the cohort cleanup.

## Deviation from plan (Chris-approved 2026-06-28)
**Georgia included in the cleanup cohort** (plan defined cohort as the 46, excluding GA). Pre-write probe found GA still carried unsourced revenue (FY2022–2026) + out-of-window operating (FY2022/2025/2026) estimates — Phase 94 had loaded only GA operating FY2023. Including GA removed those (FY-IN-(2022,2025,2026) predicate preserved GA's real FY2023 + FY2024), so **no cohort state displays unsourced data**. Cleanup count rose 367→375.

## Residual deferrals (documented, not silent — per D-96-01/03 + P5)
- **Revenue-by-source remains deferred** for the whole cohort. NASBO has no per-state revenue, so cohort revenue estimate rows were **deleted, not replaced** — nothing unsourced is displayed; revenue data awaits a future per-state ACFR upgrade (the OH/VA path). SGFS-04's "revenue-by-source" clause is therefore satisfied as *deferred*, not delivered this phase.
- **FY2022 gap acknowledged.** FY2022 actuals exist in the 2024 SER but are out of the 2025-SER window (D-96-02). FY2022 estimate rows were deleted, leaving **no row rather than an estimate** (honest per P5). Backfill is a future option.
- **No state was unsourceable** (D-96-04 removal path unused) — all 46 + GA loaded cleanly.
