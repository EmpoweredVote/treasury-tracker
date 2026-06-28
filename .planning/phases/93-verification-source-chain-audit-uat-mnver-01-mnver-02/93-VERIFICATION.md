---
status: passed
phase: 93-verification-source-chain-audit-uat-mnver-01-mnver-02
requirements: [MNVER-01, MNVER-02]
verified: 2026-06-27
method: inline (no subagents, per feedback_no_research_subagents)
---

# Phase 93 Verification — Minnesota Verification + Source-Chain Audit + UAT

**Goal:** Minnesota's figures are proven correct against published records and signed off live (v2.9 closeout). **Verdict: PASS.**

## MNVER-01 — ACFR reconciliation + source-chain audit + re-derivation + icicle — PASS
- **ACFR reconciliation (93-01):** Hennepin County FY2021 stored vs published ACFR within **0.07%** (near-exact); Minneapolis FY2023 +15% **explained** (OSA "city" entity consolidates the Park & Recreation Board + OSA functional taxonomy; 1:1-mapping functions match to the dollar). Deltas attributable to known differences, not load defects.
- **Full-cohort source-chain audit (93-02):** 858 cities (20,414 rows) + 87 counties (1,380 rows) + 136 universal enrichment rows = **0 NULL / 0 fragile / 0 residue / 0 duplicate / 0 orphan / 0 numeric-garbage**; 20 OSA source URLs all manifest-managed + live (HTTP 206).
- **Independent re-derivation (93-02):** 5 entities (incl. 1 CASH-basis city + 2 counties) re-derived straight from the raw OSA workbooks — **exact to the dollar**, 0 mismatches (Phase 86 mismapping mode verified absent).
- **Icicle drill-down (93-02):** 100% of MN budgets have depth-1, 99.8% depth-2 — 2-level drill-down is the cohort norm (resolves the Ohio flat-source limitation); confirmed live in UAT.
- **State-node honesty (93-02, deviation):** the 10 unsourced round-number ESTIMATE General Fund rows were replaced with real **State of Minnesota ACFR GAAP actuals (FY2023–2025)**, each stamped to its own ACFR; full MN cohort now 0-NULL source across all entity types.

## MNVER-02 — Live-app UAT + Chris sign-off — PASS
- 17/17 UAT items passed (Minneapolis + Hennepin County + Minnesota state node); Chris explicit all-pass sign-off 2026-06-27 (`93-UAT-CHECKLIST.md`).

## Notes / follow-ups (out of scope for v2.9)
- **State-node estimate problem is cohort-wide:** discovery found 47 states with unsourced estimate GF data + OH & VA with estimates falsely stamped with a source_url. Chartered as new milestone **v2.10 "State General Fund Sourcing"** ([[project_state_node_unsourced_estimates]]).
- **MN state history** FY2021/2022 + deeper deferred to v2.10 (negative-revenue-year handling + older-ACFR format drift).
- Salaries / enterprise funds / towns / historical pre-XLSX FYs — deferred at v2.9 scoping.

**All v2.9 Minnesota requirements (MNSRC, MNCITY, MNCO, MNLINK, MNENR, MNVER) are now Complete.**
