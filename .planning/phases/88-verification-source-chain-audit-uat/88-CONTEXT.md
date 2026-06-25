# Phase 88 — Verification + Source-Chain Audit + UAT — Context

**Phase goal:** Ohio's figures are proven correct against published records and signed off live. The v2.8 milestone closeout.
**Requirements:** OHVER-01 (ACFR/SOA_Gov reconciliation + full-cohort source-chain audit), OHVER-02 (live-app UAT + Chris sign-off). **UI:** no.
**Depends on:** Phases 84–87 (incl. the Phase 86 county gap-closure).

Mirrors the proven VA Phase 83 / Utah Phase 73 closeout shape — executed inline ($0, no subagents per [[feedback_no_research_subagents]]). Three deliverables across 3 plans:
- **88-01 (OHVER-01 part A):** ACFR reconciliation — Columbus (city) + Franklin County (county), basis-matched, documented/explained tolerance, using the workbook's `SOA_Gov` full-accrual Statement of Activities as a built-in cross-check.
- **88-02 (OHVER-01 part B):** full-cohort source-chain durability audit (0 NULL/fragile/residue) + an independent re-derivation of a sample of category amounts/totals (the Phase 86 county near-miss lesson) + the two approved in-phase fixes.
- **88-03 (OHVER-02):** guided live-app UAT (Columbus + Franklin County) with Chris's blocking sign-off.

## What's verified going in (independent DB probes, 2026-06-25)

- **Cohort:** 253 OH cities (4,880 budget rows) + 88 counties (1,736 rows) + 51 universal enrichment rows + the "Ohio" state node. Cities + counties: **0 NULL source_url / source_date / data_source**.
- **The one source-chain gap:** the 10 pre-existing "Ohio" state-node **General Fund** rows (data_source "Ohio General Fund Operating Budget" / "Ohio General Fund Revenue", from the all-50-states load via `scripts/seedOHState.js` / `processOH.js` / `processOHRevenue.js`) have **NULL source_url + NULL source_date** — the exact analog of VA's state-node NULLs (VA D-83-04). Chris approved fixing these in-phase (Q 2026-06-25).
- Columbus FY2024 (city) + Franklin County FY2024 (county) both have correct op+rev with text labels + totals (Franklin rev $1,811,422,000 / op $1,913,193,000, re-verified in the 86 gap-closure).

## Implementation Decisions

- **D-88-01 (sample — LOCKED, Chris 2026-06-25):** Columbus (city) + Franklin County (county) for both ACFR recon (88-01) and live UAT (88-03). Minimal OHVER set ("a city + a county government").
- **D-88-02 (basis + cross-check):** The AOS `SOREACIFB_TotalGov` figures are governmental-funds (GAAP or CASH/MOD). Reconcile to each entity's **published ACFR** within a documented, **explained** tolerance — NOT penny-exact (Utah/VA precedent ~±3–5%, deltas attributable to known basis differences: fund-level vs government-wide full-accrual, enterprise funds excluded). ADDITIONALLY use the workbook's own **`SOA_Gov`** tab (full-accrual Statement of Activities) as a BUILT-IN cross-check — it sits in the same workbook, so it isolates "did we read the governmental-funds statement correctly" from "does the entity's full-accrual total differ by basis".
- **D-88-03 (durability bar):** ohioauditor.gov per-FY+basis file URLs (in `scripts/ohioAosDatasets.json` + `ohioAosCountyDatasets.json`) are the durable, citizen-openable source. The audit confirms every loaded AOS row carries a non-NULL, resolving source_url + the canonical data_source + source_date, with no fragile/orphan/residue rows.
- **D-88-04 (in-phase fix #1 — Chris-approved):** stamp the 10 "Ohio" state-node General Fund NULL `source_url` + `source_date` rows with the Ohio state budget source (Ohio Office of Budget and Management, https://obm.ohio.gov / budget.ohio.gov — confirm the exact URL recorded/intended by `seedOHState.js`/`processOH.js`; use the canonical OBM operating-budget page). After the fix the full OH cohort is literally 0-NULL source_url.
- **D-88-05 (in-phase fix #2 — Chris-approved):** backfill **Ironton** population (sole pure-MOD city, currently population=0 → per-capita doesn't render; F-1). Set its `municipalities.population` from a sourced U.S. Census figure (2020 decennial / latest ACS); idempotent set-if-different. (Check whether any other OH entity has population=0 and fix the same way if trivially sourced; otherwise document.)
- **D-88-06 (independent re-derivation — the Phase 86 lesson, [[project_ohio_aos_county_vs_city_layout]]):** the source-chain audit must NOT trust loader self-report. For the sample entities (+ a few random others, incl. ≥1 county and ≥1 CASH/MOD entity), independently re-derive a handful of category amounts AND the dataset totals straight from the workbook and compare to the stored DB values — to catch any remaining label/column/row mismapping like the county defect.
- **D-88-07 (UAT format):** Chris drives the live app at treasurytracker.empowered.vote ([[feedback_app_url]]); the agent records pass/fail + sign-off at a BLOCKING checkpoint. Produce `88-UAT-CHECKLIST.md` (mirror VA 83-03). Inform-tier/unauthenticated read access is full ([[feedback_inform_tier_access]]).
- **D-88-08 (DB target):** production only (kxsdzaojfaibhuzmclfq); reads via mcp__supabase-local ([[feedback_supabase_migration_mcp]]); use `total_budget`/`hierarchy` columns ([[reference_treasury_budgets_probe_columns]]); the two approved writes (D-88-04/05) applied + re-verified, everything else read-only.

## Out of scope / deferred
- The county "Charges For Services" duplicate-column display quirk — `total_budget` (col 16) authoritative; documented in [[project_ohio_aos_county_vs_city_layout]], not a load defect. Note in the audit, defer any display-dedup to a future UI pass.
- Milestone retrospective + archive → `/gsd-complete-milestone` after 88 closes.

## Anchors
- Precedent: `.planning/milestones/v2.7-phases/83-verification-source-chain-audit-uat/` (83-CONTEXT, 83-01/02/03-SUMMARY, 83-03-UAT-CHECKLIST); `.planning/milestones/v2.5-phases/73-utah-...`.
- `scripts/ohioAosDatasets.json` + `scripts/ohioAosCountyDatasets.json` (source_url provenance); `scripts/seedOHState.js` (state-node source); `scripts/loadOhioAOS.js` (re-derivation helpers: detectLayout/buildRevenueTree/buildExpenditureTree).
- Memory: [[project_ohio_aos_county_vs_city_layout]], [[reference_treasury_budgets_probe_columns]], [[feedback_supabase_migration_mcp]], [[feedback_app_url]].
