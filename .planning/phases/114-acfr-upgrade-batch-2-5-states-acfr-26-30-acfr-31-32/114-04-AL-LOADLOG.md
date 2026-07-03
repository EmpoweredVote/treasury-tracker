# 114-04 Alabama ACFR Load Log

**State:** Alabama (AL) — state node `bc953061-98de-43ad-878a-c6564bf75dbc`
**Requirements:** ACFR-29, ACFR-31, ACFR-32
**Source:** State of Alabama Comptroller's Office Annual Comprehensive Financial Report (ACFR)/Comprehensive Annual Financial Report (CAFR), Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances, **General Fund column** (GAAP basis, thousands).

## Load Disposition

### FYs loaded

**All 24 requested FYs loaded with zero honest holes: FY2002–FY2025.** Both `operating` (spending-by-function) and `revenue` (revenue-by-source) datasets loaded for every year. Every year tied to $0 diff on BOTH the revenue and expenditure printed General Fund totals on the FIRST extraction pass — the cleanest extraction run of the v2.14 tranche so far (no OCR defects, no wrapped labels, no font issues, no era-boundary ambiguity).

| FY | Rev tie | Exp tie | Operating total (loaded, dollars) | Revenue total (loaded, dollars) |
|----|---------|---------|-----------------------------------|----------------------------------|
| 2002 | $0 diff | $0 diff | 1,044,708,000 | 1,094,623,000 |
| 2003 | $0 diff | $0 diff | 1,078,341,000 | 1,117,171,000 |
| 2004 | $0 diff | $0 diff | 1,083,346,000 | 1,170,522,000 |
| 2005 | $0 diff | $0 diff | 1,247,764,000 | 1,292,117,000 |
| 2006 | $0 diff | $0 diff | 1,409,195,000 | 1,465,052,000 |
| 2007 | $0 diff | $0 diff | 1,456,734,000 | 1,466,968,000 |
| 2008 | $0 diff | $0 diff | 1,615,484,000 | 1,548,046,000 |
| 2009 | $0 diff | $0 diff | 1,475,848,000 | 1,383,735,000 |
| 2010 | $0 diff | $0 diff | 1,256,598,000 | 1,233,189,000 |
| 2011 | $0 diff | $0 diff | 1,322,266,000 | 1,257,565,000 |
| 2012 | $0 diff | $0 diff | 1,490,146,000 | 1,310,652,000 |
| 2013 | $0 diff | $0 diff | 1,353,122,000 | 1,405,981,000 |
| 2014 | $0 diff | $0 diff | 1,419,006,000 | 1,416,050,000 |
| 2015 | $0 diff | $0 diff | 1,460,109,000 | 1,460,576,000 |
| 2016 | $0 diff | $0 diff | 1,477,001,000 | 1,684,229,000 |
| 2017 | $0 diff | $0 diff | 1,529,420,000 | 1,769,555,000 |
| 2018 | $0 diff | $0 diff | 1,465,292,000 | 1,775,997,000 |
| 2019 | $0 diff | $0 diff | 1,657,112,000 | 1,938,768,000 |
| 2020 | $0 diff | $0 diff | 1,663,070,000 | 2,090,839,000 |
| 2021 | $0 diff | $0 diff | 1,736,724,000 | 2,344,449,000 |
| 2022 | $0 diff | $0 diff | 1,781,795,000 | 2,616,214,000 |
| 2023 | $0 diff | $0 diff | 2,055,968,000 | 3,060,733,000 |
| 2024 | $0 diff | $0 diff | 2,291,921,000 | 3,262,681,000 |
| 2025 | $0 diff | $0 diff | 2,597,406,000 | 3,399,417,000 |

Bookends confirmed exactly against both 112-RECON.md and this plan's source_facts: FY2024 GF Total revenues = $3,262,681K (loaded $3,262,681,000), FY2024 GF Total expenditures = $2,291,921K (loaded $2,291,921,000); FY2002 GF Total revenues = $1,094,623K (loaded $1,094,623,000), FY2002 GF Total expenditures = $1,044,708K (loaded $1,044,708,000). All four exact.

### FYs skipped

None. AL's live archive (`comptroller.alabama.gov/acfr-2/`) resolved a direct PDF URL for every year FY2000–FY2025 from a single landing-page fetch; FY2000/FY2001 were intentionally excluded per the locked FY2002 pre-GASB-34 boundary (D-12), not because of any extraction failure — both files are in fact live and downloadable, just outside this tranche's scope. No in-window FY (2002–2025) was dropped.

### GF-alone scope decision (ACFR-31)

**Decision: load the printed General Fund column ALONE — not a synthetic GF+Education Trust Fund composite.** This resolves the load-phase flag left open by 112-RECON.md Section 2.

- **Pre-load NASBO baseline** (recorded before any write, via direct DB query): FY2023 operating $13,764,000,000; FY2024 operating $13,511,000,000; both `data_source_id=null`; zero revenue rows; zero `data_sources` rows for AL — exactly matching the 112-RECON.md Section 5 baseline.
- **Loaded ACFR GF totals**: FY2024 GF Total revenues $3,262,681,000 vs. NASBO FY2024 operating $13,511,000,000 = **~0.242× (~0.24×)** — the NARROWEST divergence in the entire v2.14 tranche, and (with Utah) one of only two states where the ACFR figure undershoots NASBO rather than exceeds it via federal-passthrough consolidation.
- **Driver**: Alabama's constitution mandates a dual-budget system — the General Fund finances non-education state government while the Education Trust Fund ($10,779,442K FY2024, per 112-RECON.md) is kept as a legally separate major fund column in the same Governmental Funds statement. **GF + ETF = $3,262,681K + $10,779,442K = $14,042,123K ≈ 1.04× NASBO's $13,511,000K** — strong corroborating evidence that NASBO's survey-reported "General Fund" concept for Alabama combines both funds, while the ACFR statement legally keeps them separate.
- **Rationale for GF-alone**: the phase's tie standard ("every loaded FY ties to its printed GF column total") and the cohort-wide uniform mold (every ACFR state in this milestone loads the printed GF column of the same statement, nothing else — the same rule applied to UT's ACFR-31 precedent) both point at the printed column. A synthetic GF+ETF composite is a total no statement prints and would break the tie-to-printed-total invariant every other cohort state satisfies. The drop from ~$13.5B (NASBO) to ~$2.3B (GAAP GF expenditures) is honest and GAAP-correct — not a data regression.
- **Column-position note**: GF is column 1 in every loaded year, but the major-fund lineup to its right shifts by era (FY2002: General Fund | Education Trust Fund | Alabama Trust Fund | Medicaid Fund | Public Road and Bridge Fund | Public Welfare Trust Fund | Nonmajor | Total; FY2024: General Fund | Education Trust Fund | Alabama Trust Fund | Medicaid Fund | Public Welfare Trust Fund | ARPA Coronavirus State Fiscal Recovery Fund | Nonmajor | Total). Extracted by POSITION (first numeric token, anchored to the "Total revenues"/"Total expenditures" row), never by column-header text matching — a naive header match would have broken across the era lineup shifts. No Education Trust Fund (or any other non-GF major-fund) amount was summed into any stored total, confirmed by inspecting every year's extracted category list (6 revenue categories / 11–12 expenditure categories per year, all GF-specific line-item names: Taxes, Licenses/Permits/Fees, Fines/Forfeits/Court Settlements, Investment Income, Federal Grants and Reimbursements, Other Revenues on the revenue side; Health, Protection of Persons and Property, General Government, Social Services, etc. on the expenditure side).

### September 30 FY-end (D-03, MI precedent)

Alabama's fiscal year runs October 1 – September 30 — the only non-June-30 state in this tranche (matching Michigan's Phase-109 precedent exactly). Every loaded row (all 48) stamps `source_date = {fy}-09-30` and `fiscal_year_start_month = 10` — confirmed via direct DB query: 0 rows with a source_date not ending in `-09-30`, 0 rows with `fiscal_year_start_month != 10`. The `fiscal_year_start_month` field is stamped on BOTH the ephemeral `data_sources` payload (for the RPC's propagation, migration `20260613120000`) and belt-and-suspenders on the direct post-RPC `budgets` UPDATE.

### NASBO-replacement confirmation

Pre-load, AL had exactly 2 NASBO operating rows (FY2023 $13,764,000,000, FY2024 $13,511,000,000, `data_source` = "NASBO State Expenditure Report…", `source_url` pointing at the NASBO SER PDF). Post-load DB query confirms:
- **0 rows** remain with a "NASBO" label anywhere on the AL node.
- **Exactly one operating row per (AL, fy)** across all 24 loaded years (no duplicates) — the RPC's `(muni, fy, 'operating')` key overwrote the NASBO row for FY2023/FY2024 in place (same row `id`s: `fec2a877-…` FY2023 and `86cf3f11-…` FY2024 persisted through the upgrade); FY2002–2022 and FY2025 were net-new.
- All 24 operating + 24 revenue rows carry the GAAP-basis label `"Alabama State ACFR — General Fund (FY{fy} actual, GAAP basis)"` / `"…General Fund Revenue…"`, with non-null `source_url` and `source_date` on every row.

### Idempotency + 0-residue re-run

Re-ran `node scripts/processALAcfr.js --fy 2024` and `node scripts/processALRevenueAcfr.js --fy 2024` live a second time. Result: **0 net change** — FY2024 operating remained exactly $2,291,921,000 and revenue exactly $3,262,681,000 after the re-run (confirmed via a direct DB query comparing row counts/totals pre- and post-re-run: still 48 total rows, same values). `treasury.data_sources` query for `dataset_id LIKE 'al-acfr-%'` returns **0 rows** after the full load AND after the idempotency re-run — the ephemeral create/RPC/delete lifecycle (WR-05/LOAD-01) leaves zero residue.

### Cohort-untouched spot-check

Sampled 3 existing ACFR-cohort nodes loaded earlier in this same milestone (South Carolina, Kentucky, Utah) and one un-upgraded NASBO-only state (Wyoming): South Carolina still shows 48 budget rows (24 FY × 2 datasets, matching its 114-01 load), Kentucky still shows 47 rows (23 FY × 2 datasets, matching its 114-02 load with the FY2023 honest hole), Utah still shows 14 rows (7 FY × 2 datasets, matching its 114-03 load) — all unchanged by the AL load. Wyoming (NASBO-only) still shows 2 rows carrying its original "NASBO State Expenditure Report" label — no cross-state write leakage.

### Money In auto-enable

AL now has 24 `dataset_type='revenue'` rows (FY2002–FY2025) — Money In auto-enables data-driven on the AL node, no frontend change required.

### Negative-line / P2 clamp record (ACFR-32)

A full-cohort scan (not just the two bookend years) of every loaded year's revenue AND expenditure category values found **zero negative GF lines across all 24 years** — every revenue category (Taxes, Licenses/Permits/Fees, Fines/Forfeits/Court Settlements, Investment Income, Other Revenues) and every expenditure category (Health, Protection of Persons and Property, General Government, Social Services, Natural Resources and Recreation, Economic Development and Regulation, Education and Cultural Resources, Debt Service — Principal/Interest, Distributions to Local Governments, Transportation, Capital Outlay) is positive in every year loaded. The `clampForRender` P2-clamp path stays wired per ACFR-32 as the tranche-standard safety net, but was never exercised for Alabama — a genuinely clean state, unlike UT (FY2022 Investment Income Loss) or CO (FY2024 TABOR).

## Summary

Alabama is fully live on State-ACFR GAAP: GF revenue-by-source + GAAP spending-by-function across the complete FY2002–FY2025 window (24 years, zero honest holes — the cleanest extraction in the tranche), every FY GAAP-basis-labelled and per-year sourced with correct Sep-30 fiscal-year-end stamping (D-03/MI precedent), NASBO replaced in place with zero duplicates, the GF-alone scope decision recorded with the ~0.24× narrower-than-NASBO divergence and the constitutional dual-budget (GF vs. Education Trust Fund) driver plus the GF+ETF≈1.04× corroboration, the P2 clamp path confirmed wired-but-unexercised (no negative lines found), idempotent never-overwrite with 0 `data_sources` residue confirmed via a live re-run, Money In auto-enabled, and both the existing ACFR cohort (SC/KY/UT) and a NASBO-only sample state (WY) confirmed untouched.
