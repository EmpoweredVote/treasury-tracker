# Phase 97 — Plan 02: Cohort-Wide Source-Chain Audit (SGFS-05)

**Run:** 2026-06-29 | **DB:** production `kxsdzaojfaibhuzmclfq` (read-only probes via mcp__supabase-local) | **Scope:** all 50 state nodes (`entity_type='state'`)

## Cohort structure

| Source | Dataset | Rows | States |
|--------|---------|------|--------|
| NASBO | operating | 94 | 47 (46 cohort + GA) |
| ACFR | operating | 28 | 3 (MN/OH/VA) |
| ACFR | revenue | 28 | 3 (MN/OH/VA) |

**= 50 states total** (47 NASBO operating-only + MN/OH/VA op+rev). Matches the Phases 94–96 intended cohort exactly.

## Task 1 — source-chain probes (read-only)

| Probe | Expected | Actual |
|-------|----------|--------|
| NULL source_url/source_date/data_source | 0 | **0** ✓ |
| NASBO operating rows outside FY2023/FY2024 | 0 | **0** ✓ |
| NASBO revenue rows (deleted 96-07) | 0 | **0** ✓ |
| NASBO in-window operating rows | 94 | **94** ✓ |
| Distinct NASBO states | 47 | **47** ✓ |
| Duplicate (municipality, fy, dataset) | 0 | **0** ✓ |
| Orphan budgets / orphan budget_categories | 0 | **0 / 0** ✓ |
| Rows missing a basis label | 0 | **0** ✓ |

## Task 2 — basis-label honesty + negative-category edge

- **Basis labels (mixed-basis shown, not hidden):** every NASBO row carries `NASBO State Expenditure Report — General Fund (FY<y> actual, budgetary basis)`; every MN/OH/VA row carries `State of <X> ACFR — General Fund [Revenue] (FY<y> actual, GAAP basis)`. 0 rows missing a basis label. The cohort is mixed-basis **by design and labelled**.
- **Numeric-garbage category labels:** 0 (regex `^-?[0-9.,]+$` over all depth-1 names).
- **Negative-category edge (P2 / D-96-08):** **exercised and handled correctly.** No depth-1 amount is stored negative (probe = 0), but the rule *did fire* for three ACFR **revenue** investment-income categories in FY2022 (a down market): MN, OH, VA each had a negative General Fund investment income that the loader clamped to display-value 0 while preserving the true magnitude in the category label (`… (net loss — shown at 0)`). The parent total correctly reflects the net (lower) revenue. This is the honest negative-handling guardrail in action, not a defect (see integrity note below).

## Children-vs-parent integrity probe (depth-1 Σ vs depth-0 total; flag |Δ| ≥ $1M)

12 rows flagged; classified:

**A. Acceptable NASBO $M-rounding artifacts (7) — no action.** Oregon FY2023 (−$1M), Montana FY2024 (+$1M), Illinois FY2023 (−$1M), Wisconsin FY2023 (+$1M), Oregon FY2024 (+$1M), Kansas FY2023 (+$1M), California FY2024 (−$1M). All exactly ±$1M (0.00x%) — inherent in NASBO's $-millions rounding of the All-Other residual.

**B. Negative-investment clamp (3) — correct by design, no action.** MN FY2022 revenue (children +$350M), OH FY2022 revenue (+$570M), VA FY2022 revenue (+$498M). In each case an investment-income category is clamped to 0 (labelled "net loss — shown at 0"); children-clamped-to-0 sum above the (correct, lower) parent by exactly the investment loss. Honest per [[project_federal_tracker_ground_rules]].

**C. Minor historical-extraction variance (1) — documented follow-up, not in-phase.** MN FY2008 operating: children $16,077,757K < parent $16,086,550K by **$8.79M (0.055%)** — ~$8.8M of GF expenditure uncategorized in the oldest backloaded year (Phase 95). Deep history / low traffic; correcting needs FY2008 ACFR re-extraction. Recorded as a follow-up, below tolerance for an in-phase fix.

**D. REAL DEFECT — Finding F-97-01 (Georgia FY2023 operating). → in-phase fix proposed.**
- Stored Medicaid GF = **$3,398M**; the **2025 SER** (the source the GA FY2023 rows are stamped with) reads **$3,390M**. The "All Other" residual ($6,611M) was already computed 2025-consistently, so Medicaid is the lone stale cell (carried over from the 2024-SER pilot value, loadStateGF.mjs:92). Result: depth-1 children sum to **$29,274M**, $8M over the depth-0 parent **$29,266M** (0.027%). Parent total is correct (ties SER Table 1).
- Caught by 97-01 independent re-derivation (the Phase 86 lesson); invisible to loader self-report. GA FY2024 ties exactly (Medicaid 5,318) — defect is FY2023-only.

## D-97-03 — operating-only revenue presentation (verify clean / fix if broken)

**PASS — no fix needed.** Frontend render path inspected:
- `availableDatasetTypes` (src/App.tsx:177-185) derives the dataset list from the entity's actual `available_datasets` for the selected FY → an operating-only NASBO node returns `['operating']` only.
- `DatasetTabs` (src/components/datasets/DatasetTabs.tsx:96,110) renders the "Money In" card **disabled/greyed (opacity-40, `cursor-not-allowed`, not clickable, no number)** when `revenue` is absent — a clean "no data" affordance, NOT an empty or broken revenue view.
- MN/OH/VA (which have revenue) render the "Money In" card enabled and populated.
- Minor robustness note (not blocking, follow-up candidate): a hand-crafted `?dataset=revenue` URL on an operating-only node would set `activeDataset='revenue'` with `revenueData=null`; normal navigation never reaches this (default is operating; the card is disabled). Confirm clean in live UAT (97-03).

## SGFS-05 cohort-audit verdict

**PASS (criterion 1 met), with one in-phase fix proposed (F-97-01) and one documented follow-up (MN FY2008 op).**
- All 50 state nodes are real + sourced: 0 unsourced / 0 round-number-estimate / 0 NULL-provenance / 0 out-of-window / 0 duplicate / 0 orphan / 0 numeric-garbage; mixed basis labelled; negative-income edge handled honestly.
- The only true integrity defect is F-97-01 (GA FY2023 Medicaid +$8M), a single-cell idempotent fix proposed at the checkpoint below.

## Task 3 — checkpoint outcome + F-97-01 fix (Chris-approved 2026-06-29)

**Chris approved the in-phase fix (D-97-04).** Applied:
1. **Loader (source of truth):** `scripts/loadStateGF.mjs` GA FY2023 Medicaid `3_398_000_000 → 3_390_000_000`; corrected the now-stale "byte-unchanged 2024 SER" comment to record the F-97-01 alignment to the 2025 SER (the stamped source).
2. **DB (targeted UPDATE, not a re-sync):** updated the single GA FY2023 operating Medicaid `budget_categories` row 3,398,000,000 → 3,390,000,000 (1 row affected).

**Re-verification:**
- GA FY2023 operating: depth-1 children now sum to **$29,266,000,000 = parent total** (was $29,274M). ✓
- **Idempotent:** re-running the UPDATE predicate matches **0 rows**; loader value now equals the DB value. ✓
- Cohort integrity re-probe: GA no longer appears. The only remaining children≠parent rows are the classified-acceptable set (3 negative-investment clamps + MN FY2008 op follow-up + 7 NASBO ±$1M rounding). ✓

**Documented follow-up (not fixed in-phase, per D-97-04 "anything larger = follow-up"):**
- MN FY2008 operating children < parent by $8.79M (0.055%) — needs FY2008 ACFR re-extraction; deep history / low traffic.
- Minor frontend robustness: a hand-crafted `?dataset=revenue` URL on an operating-only node (normal navigation never reaches it).

**Final SGFS-05 cohort-audit verdict: PASS.** All 50 state nodes real + sourced + residue-free; mixed basis labelled; negative-income edge honest; F-97-01 fixed (children=parent, idempotent); D-97-03 operating-only revenue view confirmed clean.
