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
- **Task 4 — State-node fix (deviation, Chris-approved):** the 10 state-node General Fund rows were **unsourced round-number estimates** (~$15.5B/yr), not real data. Per Chris's decision, **replaced with real State-of-MN FY2024 ACFR GAAP actuals** (operating $33,534,701,000 / revenue $34,562,737,000, sums verified) via rewritten `processMN.js`/`processMNRevenue.js` with source stamping. Deleted 8 placeholder rows; full MN cohort now **0-NULL source across all entity types**. Idempotent.

## Deviations
- **State-node data was estimates, not just missing-source** (the plan inherited the OH/VA assumption). Halted, flagged to Chris (no-unsourced-data ground rule), Chris chose "replace with real MMB figures" → loaded real FY2024 State-ACFR actuals.
- **FY scope reduced to FY2024** (Chris: "load FY2024 now, defer FY22/23"). The full FY2022/FY2023 State ACFR PDFs weren't fetchable via CLI; the user-provided EOS FBA is budgetary/forecast basis (not ACFR-compatible), so not used. FY2022/FY2023 to be added from their full State ACFRs when available.

## Key files
- `scripts/processMN.js`, `scripts/processMNRevenue.js` (rewritten — real FY2024 State-ACFR actuals + source stamp)
- `.planning/phases/93-.../93-02-AUDIT.md` (the full audit + re-derivation + icicle + state-node record)

## Self-Check: PASSED
- v2.9 OSA city/county cohort fully verified (audit clean + re-derivation exact + icicle confirmed).
- State-node unsourced placeholders replaced with real sourced actuals; cohort 0-NULL.
- MNVER-01 part B satisfied. UAT (MNVER-02) = 93-03.
