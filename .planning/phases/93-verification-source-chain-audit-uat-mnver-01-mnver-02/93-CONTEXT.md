# Phase 93 — Verification + Source-Chain Audit + UAT — Context

**Phase goal:** Minnesota's figures are proven correct against published records and signed off live. The v2.9 milestone closeout.
**Requirements:** MNVER-01 (ACFR reconciliation + full-cohort source-chain audit + independent re-derivation + icicle-render confirmation), MNVER-02 (live-app UAT + Chris sign-off). **UI:** no (verification only).
**Depends on:** Phases 89–92 (source+loader, city loads, county loads+linking, enrichment parity).

Mirrors the proven Ohio Phase 88 / VA Phase 83 / Utah Phase 73 closeout shape — executed inline ($0, no subagents per [[feedback_no_research_subagents]]). Three deliverables across 3 plans:
- **93-01 (MNVER-01 part A):** ACFR reconciliation — Minneapolis (city) + Hennepin County (county), basis-matched, documented/explained tolerance.
- **93-02 (MNVER-01 part B):** full-cohort source-chain durability audit (0 NULL/fragile/residue) + independent re-derivation of ≥5 entities straight from the OSA workbooks (the Phase 86 county near-miss lesson) + **the icicle drill-down structural confirmation** (the MN source resolves the Ohio flat-source limitation) + the one approved in-phase fix (state-node source stamp).
- **93-03 (MNVER-02):** guided live-app UAT (Minneapolis + Hennepin County + the Minnesota state node) with Chris's blocking sign-off.

## What's verified going in (independent DB probes, 2026-06-27)

- **Cohort:** 858 MN cities (20,414 budget rows) + 87 counties (1,380 rows) + 136 universal enrichment rows (Phase 92, verified) + the "Minnesota" state node (10 rows). Cities + counties: **0 NULL source_url / source_date / data_source**.
- **The one source-chain gap:** the 10 "Minnesota" state-node rows — 5 operating (`data_source` "Minnesota General Fund Operating Budget", FY2022–2026) + 5 revenue ("Minnesota General Fund Revenue", FY2022–2026) — have **NULL source_url + NULL source_date** (`data_source` is set). Loaded by the all-50-states load (`scripts/processMN.js` / `scripts/processMNRevenue.js`). The exact analog of the Ohio (D-88-04) and VA state-node NULLs. **Chris approved fixing in-phase (Q 2026-06-27).**
- **No population gap:** 0 MN cities/counties with budgets have population=0 (unlike Ohio's Ironton) — `refreshMNPopulations.js` covered the cohort. No population fix needed.
- **Icicle drill-down confirmed structurally:** Minneapolis FY2023 has real depth 0/1/2 budget_categories (operating 8/17/3, revenue 8/16/14) — the 2-level trees the MN OSA source provides (resolving the Ohio AOS flat-source limitation, [[project_flat_source_icicle_limitation]]). The live render is confirmed in UAT (93-03).
- **Anchors render-ready:** Minneapolis (city, pop 433,633, op+rev FY data to 2023) → `county_id` Hennepin County (county, pop 1,289,645, op+rev to FY2021); linkage confirmed.

## Implementation Decisions

- **D-93-01 (sample — LOCKED, Chris 2026-06-27):** Minneapolis (city) + Hennepin County (county) for both ACFR recon (93-01) and live UAT (93-03); the Minnesota state node added to UAT (MNVER-02 requires city + county + state node). The canonical RCV example in REQUIREMENTS.
- **D-93-02 (reconciliation FY — Claude's discretion):** reconcile each entity to its own latest stored FY that has a published ACFR — **Minneapolis FY2023**, **Hennepin County FY2021** (city data reaches FY2023, county FY2021). Per-entity-latest is basis-matched (compare each stored FY to that entity's same-FY published ACFR).
- **D-93-03 (basis + cross-check):** The MN OSA City/County Finances Report is the **official state compilation of each entity's own annual financial report** (governmental-funds, GAAP or Cash per `GAAPInd` — see `scripts/mnCityBasis.json`). So stored totals should track the entity's published ACFR governmental-funds statement closely. Reconcile within a documented, **explained** tolerance — NOT penny-exact (Utah/VA/OH precedent ~±3–5%, deltas attributable to known basis differences: all-governmental-funds vs general-fund-only, enterprise funds excluded, reporting timing). Unlike Ohio's AOS workbook there is **no in-workbook full-accrual SOA_Gov cross-check tab** — the cross-references are (a) the OSA stored figure and (b) the entity's published ACFR; note any third in-report subtotal if the OSA sheet exposes one.
- **D-93-04 (durability bar):** `scripts/mnOsaDatasets.json` holds the per-FY `osa.state.mn.us` `cired_YY_data.xlsx` file URLs — the durable, citizen-openable source. The audit confirms every loaded MN row carries a non-NULL, resolving source_url + the canonical data_source + source_date, with no fragile/orphan/residue rows.
- **D-93-05 (in-phase fix — Chris-approved):** stamp the 10 "Minnesota" state-node General Fund NULL `source_url` + `source_date` rows with the MN state-budget source (Minnesota Management & Budget, mn.gov/mmb — confirm/record the exact URL intended by `processMN.js`/`processMNRevenue.js`; use the canonical MMB budget page). Update the loader so it's reproducible + idempotent, then apply. After the fix the full MN cohort is literally 0-NULL source_url.
- **D-93-06 (independent re-derivation — the Phase 86 lesson, [[project_ohio_aos_county_vs_city_layout]]):** the source-chain audit must NOT trust loader self-report. For the sample entities (+ ≥3 random others, incl. ≥1 county and ≥1 CASH-basis entity), independently re-derive a handful of category amounts AND the dataset totals straight from the OSA workbooks (via the `loadMNOSA.js` parse/tree-build helpers) and compare to the stored DB values — catches any label/column/row mismapping.
- **D-93-07 (icicle render — the MN differentiator):** confirm (structurally in 93-02, live in 93-03) that the 2-level icicle drill-down renders — clicking a depth-0 node expands its depth-1/2 children. This is the explicit MNVER-01 check that the MN source resolves the Ohio flat-source limitation ([[project_flat_source_icicle_limitation]]).
- **D-93-08 (UAT format):** Chris drives the live app at treasurytracker.empowered.vote ([[feedback_app_url]]); the agent records pass/fail + sign-off at a BLOCKING checkpoint. Produce `93-UAT-CHECKLIST.md` (mirror Ohio 88-03 / VA 83-03). Inform-tier/unauthenticated read access is full ([[feedback_inform_tier_access]]).
- **D-93-09 (DB target):** production only (kxsdzaojfaibhuzmclfq); reads via mcp__supabase-local ([[feedback_supabase_migration_mcp]]); use `total_budget`/`hierarchy` columns ([[reference_treasury_budgets_probe_columns]]); the one approved write (D-93-05) applied + re-verified, everything else read-only.

## Out of scope / deferred
- Salaries (`Employee Data` sheet), enterprise funds, historical pre-XLSX FYs, towns — all deferred at v2.9 scoping (MNSAL-01/MNENT-01/MNHIST-01/MNTWN-01 in REQUIREMENTS body, not this milestone).
- Milestone retrospective + archive → `/gsd-complete-milestone` after 93 closes.

## Anchors
- Precedent: `.planning/milestones/v2.8-phases/88-verification-source-chain-audit-uat/` (88-CONTEXT, 88-01-RECON, 88-02-AUDIT, 88-UAT-CHECKLIST, 88-0{1,2,3}-SUMMARY); `.planning/milestones/v2.7-phases/83-verification-source-chain-audit-uat/`.
- `scripts/mnOsaDatasets.json` (source_url provenance); `scripts/mnCityBasis.json` (GAAP/Cash basis); `scripts/loadMNOSA.js` + `loadMNOSABatch.js` (re-derivation helpers); `scripts/processMN.js` / `scripts/processMNRevenue.js` (state-node source); `scripts/linkMNCitiesToCounties.js` (linkage); `scripts/mnCityResidual.json` / `mnCountyResidual.json` (no-phantom record).
- Memory: [[project_flat_source_icicle_limitation]], [[reference_minnesota_osa_finances_report]], [[project_ohio_aos_county_vs_city_layout]], [[reference_treasury_budgets_probe_columns]], [[feedback_supabase_migration_mcp]], [[feedback_app_url]], [[feedback_inform_tier_access]].
