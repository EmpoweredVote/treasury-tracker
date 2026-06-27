# Phase 88 — Verification + Source-Chain Audit + UAT — Verification

**Verdict: PASS** (1 documented, accepted limitation — non-blocking)
**Method:** Independent DB read-back (mcp__supabase-local) + workbook re-derivation + live-app UAT with Chris sign-off.
**Date:** 2026-06-26

## OHVER-01 — PASS

**Part A — ACFR / SOA_Gov reconciliation (88-01):** Columbus + Franklin County FY2024 reconciled. Layer 1 (stored DB vs the loaded `SOREACIFB_TotalGov` tab) = **$0 delta, exact**, for both — the definitive loader-correctness proof. Layer 2 (vs the workbook's `SOA_Gov` full-accrual statement, the built-in cross-check) deltas all explained by GASB-34 governmental-funds → government-wide basis differences (capital outlay + principal excluded; depreciation/pension added), within ~±5% / arithmetically reconciled. Entity ACFR sites are Akamai-blocked, so `SOA_Gov` (compiled from the same ACFR submissions) served as the ACFR-equivalent cross-check. No load defects.

**Part B — full-cohort source-chain audit + independent re-derivation (88-02):**
- 6,626 OH budget rows audited: after the in-phase state-node fix, **0 NULL** source_url / source_date / data_source across the ENTIRE OH cohort; 0 duplicate / orphan / residue; 0 numeric-garbage category labels (33,273 scanned); enrichment rows intact; sampled source_urls resolve.
- **Independent re-derivation** (the Phase 86 lesson, [[project_ohio_aos_county_vs_city_layout]]): 5 entities (Columbus GAAP city, Franklin + Cuyahoga GAAP counties, Ironton MOD city, Port Clinton CASH city) — totals + sample category amounts recomputed from the workbooks, **0 mismatches**.
- **In-phase fixes (Chris-approved):** (1) 10 state-node General Fund NULL rows stamped (Ohio LSC budget source) → cohort literally 0-NULL; (2) **4** population=0 entities backfilled from 2020 Census (Ironton 10,653, Darke, Jackson, Perry) → 0 zero-population OH entities. Both idempotent.
- Minor durability note: the state-node `source_url` (`lsc.ohio.gov/budget/` — the canonical Ohio operating-budget source) has a TLS cert-chain quirk that sandbox clients reject (browsers generally OK); affects only the 10 pre-existing state-node rows, not any v2.8 AOS row.

## OHVER-02 — PASS (with accepted limitation)

Live-app UAT (88-03): Columbus (city) + Franklin County (county) driven by Chris at treasurytracker.empowered.vote. Category bars render with $ + Phase-87 plain-language enrichment. **Chris signed off 2026-06-26**, accepting one documented limitation:

- **Flat-data icicle limitation (accepted, future-UI follow-up):** Ohio's free AOS source is flat (single-level, no sub-categories — confirmed: Columbus operating = 9 depth-0 nodes, 0 children), so the icicle has no drill-down, and clicking a no-children category currently dims to an empty state. The data is correct + complete; this is an inherent property of the chosen free source (the milestone explicitly accepted "flatter than CA/Utah's nested feeds"). A small UX fix (click → show enrichment description) was offered and deferred.

## Findings carried forward / deferred
- **Flat-source icicle UX** (OHVER-02 limitation above) — future UI pass.
- **State-node source_url cert-chain quirk** — optional swap to an alternate Ohio gov budget URL if it warns in-browser.
- **County "Charges For Services" duplicate column** — display-side; `total_budget` authoritative.

## Milestone status
v2.8 Ohio Local Government Expansion: Phases 84–88 complete + verified. Ready for `/gsd-complete-milestone`.
