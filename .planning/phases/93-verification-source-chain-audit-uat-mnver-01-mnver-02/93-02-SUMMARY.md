---
phase: 93-verification-source-chain-audit-uat-mnver-01-mnver-02
plan: 02
status: complete
completed: 2026-06-27
requirements: [MNVER-01]
---

# 93-02 Summary — Source-Chain Audit + Re-derivation + Icicle + State-Node Fix (MNVER-01 part B)

## Result — PASS
Full record in `93-02-AUDIT.md`.

- **Task 1 — Full-cohort source-chain audit (read-only):** city + county cohort (858 cities / 20,414 rows + 87 counties / 1,380 rows + 136 enrichment rows) is **0 NULL / 0 fragile / 0 residue** — 0 duplicates, 0 orphans, 0 numeric-garbage labels, enrichment complete. 20 distinct OSA source URLs all present in `mnOsaDatasets.json`; 5 spot-probed live (HTTP 206).
- **Task 2 — Independent re-derivation (Phase 86 lesson):** re-derived totals + PropertyTaxes leaf straight from the raw OSA workbooks for 5 entities (Minneapolis, Ada [CASH], Afton, Hennepin Co, Ramsey Co) — **exact match to the dollar**, 0 mismatches. Loader column/row mapping verified correct.
- **Task 3 — Icicle drill-down:** across 21,794 MN city+county budgets, **100%** have depth-1 and **99.8%** depth-2 children — 2-level drill-down is the cohort norm, resolving the Ohio flat-source limitation.
- **Task 4 — State-node fix (deviation, Chris-approved):** the 10 state-node General Fund rows were **unsourced round-number estimates** (~$15.5B/yr), not real data. Per Chris's decision, **replaced with a real 3-year State-of-MN ACFR GAAP-actuals series (FY2023–FY2025)** via rewritten `processMN.js`/`processMNRevenue.js` (per-FY source map + stamp): FY2023 op $26.65B/rev $33.47B, FY2024 op $33.53B/rev $34.56B, FY2025 op $35.11B/rev $35.48B (all sums verified to the published GAAP totals). Deleted 8 placeholder rows; full MN cohort now **0-NULL source across all entity types**. Idempotent.

## Deviations
- **State-node data was estimates, not just missing-source** (the plan inherited the OH/VA assumption). Halted, flagged to Chris (no-unsourced-data ground rule), Chris chose "replace with real MMB figures" → loaded real State-ACFR GAAP actuals.
- **Basis trap:** the State ACFRs carry both a GAAP and a budgetary-basis General Fund statement; used the GAAP GENERAL column throughout (caught an early budgetary mis-read for FY21-23).
- **FY scope = FY2023–FY2025** (3 clean recent GAAP years; the user provided the full ACFR set). **FY2021 + FY2022 deferred** — expenditure tables need page-image extraction and FY2022 has a negative investment line. EOS FBA not used (budgetary basis).

## Key files
- `scripts/processMN.js`, `scripts/processMNRevenue.js` (rewritten — real FY2024 State-ACFR actuals + source stamp)
- `.planning/phases/93-.../93-02-AUDIT.md` (the full audit + re-derivation + icicle + state-node record)

## Self-Check: PASSED
- v2.9 OSA city/county cohort fully verified (audit clean + re-derivation exact + icicle confirmed).
- State-node unsourced placeholders replaced with real sourced actuals; cohort 0-NULL.
- MNVER-01 part B satisfied. UAT (MNVER-02) = 93-03.
