# Phase 63 — SoCal County Cities Load + Linking — VERIFICATION

**Verified:** 2026-06-17 (inline goal-backward verification via read-only production DB probes)
**Result:** ✅ PASS — phase goal achieved, all 6 requirements satisfied.

## Phase Goal
Load operating + revenue history (FY2003–2024) for every city in the 6 remaining SoCal counties from the SCO ByTheNumbers feed, and link each city to its county node — using the hardened v2.2 pipeline with zero new code.

## Consolidated Evidence (production DB, schema `treasury`)

| County | Req | Cities linked | op+rev rows | SCO rows missing source_url | cities pop>0 |
|--------|-----|--------------|-------------|-----------------------------|--------------|
| Riverside County | SOCAL-01 | 28 | 1172 | 0 | 28/28 |
| San Bernardino County | SOCAL-02 | 24 | 1052 | 0 | 24/24 |
| San Diego County | SOCAL-03 | 18 | 790 | 0 | 18/18 |
| Ventura County | SOCAL-04 | 10 | 440 | 0 | 10/10 |
| Santa Barbara County | SOCAL-05 | 8 | 352 | 0 | 8/8 |
| Imperial County | SOCAL-06 | 7 | 300 | 0 | 7/7 |
| **TOTAL** | | **95** | **4106** | **0** | **95/95** |

## Must-Have Checks
- ✅ **Op+rev loaded FY2003–2024** for every SCO-reported city in all 6 counties (4106 rows; early years carry fewer cities per incorporation timeline).
- ✅ **Durably sourced (D-07):** every SCO-loaded row carries a `/d/` ByTheNumbers source_url + source_date 2026-06-17 — 0 SCO rows missing a URL in any county.
- ✅ **Per-year population:** all 95 linked cities have population > 0 (per-capita ready).
- ✅ **Never-overwrite (D-10):** Riverside city's custom General Fund Operating Budget (FY2023/2024) preserved; San Diego city's custom budget + FY2025 custom op/rev preserved; no different-source row overwritten.
- ✅ **County linking (D-04):** all 95 cities linked via `county_id`. Existing nodes reused (Riverside e4906055…, San Diego 9290f46e…); new nodes created (San Bernardino a91c968c…, Ventura, Santa Barbara, Imperial). 0 mislinked, 0 missing-from-DB.
- ✅ **$0 spend (D-09), production DB only (D-08), read-only verification.**

## Execution Notes / Deviations
- **Inline execution on the main working tree (D-05):** the loader requires the gitignored `.env` and writes to the shared production DB, so worktrees were not used. The initial `gsd-executor` subagent dispatch hit a session limit, after which the orchestrator completed all 6 plans inline.
- **SCO API instability:** `bythenumbers.sco.ca.gov` intermittently connect-timed-out (~1/3 success at times), and the loader aborts on any single failed fetch. Worked around by driving the **unchanged** loader one fiscal year at a time inside a shell retry loop (orchestration only — zero new code, D-03; per-FY `--fy` invocation is runbook-supported). All 22 fiscal years × 6 counties ultimately loaded clean.

## Conclusion
Phase 63 delivers exactly what it promised: 95 SoCal county cities with complete, durably-sourced op+rev history linked to their county nodes. Downstream phases (64 county-gov budgets, 65 salaries, 66 enrichment, 67 ACFR+UAT) can proceed.
