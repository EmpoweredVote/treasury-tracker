# 94-01 SPIKE — Sourcing the 50-State General Fund Rollout

**Phase:** 94 (SGFS-01) · **Date:** 2026-06-27 · **Author:** inline (Claude) · **Status:** recommendation → awaiting Chris lock (Task 2)

## Question
HOW do we source General Fund (GF) revenue + spending for ~50 state nodes, source-honestly (real `source_url` + `source_date`, no estimates, no false provenance), to replace the 47 unsourced round-number estimates + OH/VA false-sourced rows ([[project_state_node_unsourced_estimates]])? Uniform multi-state dataset vs per-state ACFR (the MN-proven path)?

Chris's call (CONTEXT D-94-01): **spike a uniform source first**; fall back to per-state ACFR only if no uniform source is faithful + granular enough.

## Candidates evaluated

### 1. NASBO State Expenditure Report (SER) — spending + NASBO Fiscal Survey of States — revenue
- **What it is:** National Assn. of State Budget Officers. Annual since 1987. Each SER edition covers 3 fiscal years (the FY2024 edition = actual FY2022, FY2023, estimated FY2024). Free public PDF on nasbo.org.
- **Evidence pulled (FY2024 SER, 101pp, text-extractable):**
  - Reports spending "by funding source" across **seven** functional categories: **Elementary & Secondary Education (K-12), Higher Education, Public Assistance, Medicaid, Corrections, Transportation, All Other** (verbatim, p.~3 intro).
  - Per-state dollar tables exist per program area: *Table 7 — El & Sec Education Expenditures, Fiscal 2022–2024*, *Table 12 — Higher Education*, etc. Each lists all 50 states with per-year columns **[General Funds | Federal Funds | Other State Funds | Bonds | Total]**. → The **General Funds column** per state per function is exactly what we need.
  - National GF-by-function FY2024: K-12 33.6%, "All Other" 29.9%, Medicaid 18.7%, Higher Ed, Corrections, Transportation 5.6%, Public Assistance 1.8% — confirms a usable 1-level by-function tree.
  - Minnesota appears in every program-area table (e.g. El/Sec Ed row present FY22–24).
- **Revenue side (Fiscal Survey of States):** reports GF revenue by source but **coarse** — effectively **sales tax / personal income tax / corporate income tax / all other** (~4 sources). Per-state GF revenue + balances, historical archive downloadable.

### 2. US Census Annual Survey of State Government Finances (ASSGF / ASFIN)
- **What it is:** Census. All 50 states, standardized revenue-by-source + expenditure-by-function, **machine-readable API** (`api.census.gov/data/timeseries/govsstatefin`) + CSV. Free, annual, deep multi-year.
- **Fatal flaw — basis:** Census reports **ALL governmental funds combined**, NOT the budgetary **General Fund**. It has no GF cut. Its totals run ~2–3× a state's GF and cannot sit beside MN's ACFR **General Fund** node without lying about what the number is. **Basis mismatch = disqualifying** for a node labeled "General Fund."

### 3. Per-state ACFR General Fund (fallback — the MN-proven path)
- **What it is:** Each state's Annual Comprehensive Financial Report, Governmental Funds Statement, **GENERAL FUND column** (GAAP, audited). This is exactly how MN FY2023–25 was loaded (`scripts/processMN.js` / `processMNRevenue.js`).
- Most granular (MN got **11 spending functions + 12 revenue sources**), most authoritative (audited GAAP actuals), and **identical basis to MN** (zero mixing).
- **Cost:** 50 unique ~200-page PDFs, each with a different layout / function vocabulary / page location; many need page-image extraction (MN itself deferred FY21/22 for this reason). Effort is ~linear in states — essentially a manual extraction per state-year.

## Evaluation matrix

| Criterion | NASBO (SER + Fiscal Survey) | Census ASSGF | Per-state ACFR |
|---|---|---|---|
| 50-state coverage | ✅ All 50 + DC + territories | ✅ All 50 | ✅ All 50 (each publishes one) |
| **Basis = General Fund?** | ✅ Yes — true budgetary GF (GF column) | ❌ **No — all-funds combined** | ✅ Yes — GAAP GF (same as MN) |
| Category granularity | ⚠️ Coarse: **7 spend / ~4 revenue** | ✅ Fine, standardized | ✅ Rich, state-specific (MN: 11/12) |
| Free + machine-readable | ⚠️ Free ✅; **PDF tables only** (no CSV/API) — text-extractable but messy (wrapped rows, blank cells, regional subtotals) | ✅ Free + API + CSV | ❌ Free ✅; 50 bespoke PDFs, hardest extraction |
| Multi-year depth | ✅ Since 1987 (3 yrs/edition; archive) | ✅ Deep | ✅ Per state's published history |
| MN-consistency | ⚠️ Different taxonomy + **budgetary-GF basis ≠ GAAP-GF** → MN must be re-done under NASBO to stay uniform, OR mixed-basis | ❌ N/A (wrong basis) | ✅ **Perfect** — MN already done this way, no re-do |
| Effort to all-50 | ✅ **Build-once, load-50** from 1–2 docs/yr | (n/a) | ❌ ~50× manual extraction |

## Honest gaps / risks
- **NASBO basis ≠ ACFR basis.** NASBO's "general fund" is a *budgetary* aggregate as states self-report to NASBO; MN's node is *GAAP* GF from the audited ACFR. They are close in magnitude but not identical and use different category names. Putting NASBO (49) beside ACFR-MN (1) is the **mixed-basis trap** flagged in v2.9 — unless we either (a) re-do MN under NASBO, or (b) accept mixed basis with explicit per-node basis labels.
- **NASBO revenue is thin** (~4 sources) → a sparse revenue icicle vs MN's 12. Still real + sourced, just coarse.
- **NASBO extraction is fragile** — PDF tables wrap across lines, suppress cells, and interleave regional subtotals. A parser must validate every state-year (GF + Fed + Other + Bonds ties to Total; functions tie to a control) or it will silently mis-map. Non-trivial but bounded (one parser, reused for 50).
- **Census is out** regardless of how good its API is — wrong basis for a "General Fund" node.

## RECOMMENDATION

**Source = NASBO** (State Expenditure Report for spending-by-function + Fiscal Survey of States for revenue-by-source) as the **uniform 50-state General Fund spine.** It is the only candidate that is simultaneously (a) true General Fund basis, (b) all-50-states uniform, (c) free + multi-year, and (d) build-once/load-50 — which is the entire reason Chris asked to spike a uniform source. Census is disqualified (all-funds basis). Per-state ACFR is the higher-fidelity fallback but costs ~50× the effort.

**MN-consistency (D-94-02) — recommended: re-do MN under NASBO** so all 50 nodes share ONE source, ONE basis, ONE 7-category taxonomy (maximally comparable + honest). MN's ACFR work is not wasted — it validated the pipeline and becomes a documented cross-check (NASBO MN vs ACFR MN should be close; the delta quantifies the basis gap). Keeping MN as an ACFR outlier is viable but reintroduces mixed basis.

**Accept the trade-offs:** coarser categories (7 spend / 4 revenue — fine for a 1-level icicle) and a fragile-but-bounded PDF parser with hard per-state validation.

**Fallback if Chris prioritizes fidelity over breadth:** generalize `processMN.js` into a per-state ACFR extractor and grind the states out ACFR-by-ACFR (richest data, perfect MN-consistency, far more effort). A hybrid (NASBO for breadth now, ACFR upgrades later for high-traffic states) is also open.

---

## LOCKED DECISION (Task 2 — Chris, 2026-06-27)

- **Source for 50-state rollout:** **Hybrid — NASBO now, ACFR later.** Load all ~50 state nodes from NASBO (SER spending + Fiscal Survey revenue) for breadth now; upgrade high-traffic states to per-state ACFR later. The loader built in Task 4 is the NASBO loader.
- **MN-consistency call:** **Keep Minnesota as the ACFR gold-standard outlier.** MN stays on its richer ACFR GAAP data (FY2023–25, `processMN.js`); the other 49 load from NASBO. MN is NOT re-done under NASBO.
- **Consequence — mixed basis is ACCEPTED, conditional on labeling.** Because MN (GAAP-GF, ACFR) sits beside the NASBO nodes (budgetary-GF), **every state node MUST carry an explicit per-node basis label + resolving source** so a viewer can always see which basis/source backs a given state. The cross-cutting policy (94-01-POLICY.md) locks this labeling contract. This is the deliberate mitigation of the v2.9 mixed-basis trap: not "one basis for all," but "every node self-declares its basis."
- **Confirmed by Chris:** ✅ 2026-06-27 (AskUserQuestion checkpoint).

## Sources
- NASBO State Expenditure Report — https://www.nasbo.org/reports-data/state-expenditure-report (FY2024 ed.: https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2024_SER/2024_State_Expenditure_Report_S.pdf)
- NASBO Fiscal Survey of States — https://www.nasbo.org/reports-data/fiscal-survey-of-states
- US Census Annual Survey of State Government Finances — https://www.census.gov/programs-surveys/state.html ; API https://www.census.gov/data/developers/data-sets/govsstatefin.html
- MN ACFR (gold-standard node) — scripts/processMN.js / processMNRevenue.js
