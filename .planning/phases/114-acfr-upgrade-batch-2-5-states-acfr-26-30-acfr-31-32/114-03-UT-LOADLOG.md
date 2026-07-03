# 114-03 Utah ACFR Load Log

**State:** Utah (UT) — state node `740cffee-3111-44c0-9473-a77acb6c42f8`
**Requirements:** ACFR-28, ACFR-31, ACFR-32
**Source:** State of Utah Division of Finance Annual Comprehensive Financial Report (ACFR), Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances, **General Fund column** (GAAP basis, thousands).

## Load Disposition

### FYs loaded

**All 7 requested FYs loaded with zero honest holes: FY2019–FY2025.** Both `operating` (spending-by-function) and `revenue` (revenue-by-source) datasets loaded for every year.

| FY | Rev tie | Exp tie | Operating total (loaded, dollars) | Revenue total (loaded, dollars) | Source PDF |
|----|---------|---------|-----------------------------------|----------------------------------|------------|
| 2019 | $0 diff | $0 diff | 7,386,308,000 | 6,509,587,000 | `2019-ACFR.pdf` |
| 2020 | $0 diff | $0 diff | 8,079,513,000 | 7,321,072,000 | `2020-ACFR.pdf` |
| 2021 | $0 diff | $0 diff | 9,647,977,000 | 9,299,461,000 | `2021-ACFR.pdf` |
| 2022 | $0 diff | $0 diff | 10,729,051,000 | 10,798,468,000 | `2022-ACFR.pdf` |
| 2023 | $0 diff | $0 diff | 11,769,561,000 | 11,239,243,000 | `2023-ACFR.pdf` |
| 2024 | $0 diff | $0 diff | 12,493,247,000 | 11,209,884,000 | `FY24-ACFR-Final.pdf` |
| 2025 | $0 diff | $0 diff | 12,924,757,000 | 11,404,950,000 | `FY25-ACFR-FINAL-reduced-size.pdf` |

Bookends independently confirmed against 112-BATCH2-SOURCES.md: FY2025 GF Total revenues = $11,404,950K (loaded $11,404,950,000); FY2019 GF Total revenues = $6,509,587K (loaded $6,509,587,000). Both exact.

### FYs skipped

None. Pre-FY2019 years (`{YY}UTCAFR.pdf` era, FY2006–FY2016, plus an older NXT document-gateway) are historically real but 404 live on the WordPress-migrated `finance.utah.gov` today — excluded per D-06 (non-durable URL), not chased, per the locked recon scope. No in-window FY was dropped.

### GF-alone scope decision (ACFR-31)

**Decision: load the printed General Fund column ALONE — not a GF+Income Tax Fund composite.** This resolves the load-phase flag left open by 112-BATCH2-SOURCES.md Section 4.

- **Pre-load NASBO baseline** (recorded before any write): FY2023 operating $11,682,000,000; FY2024 operating $13,674,000,000; both `data_source_id=null`; zero revenue rows; zero `data_sources` rows for UT.
- **Loaded ACFR GF totals**: FY2023 operating $11,769,561,000 (~1.01× NASBO — near-parity, unlike FY2024); FY2024 operating $12,493,247,000 (**~0.91× NASBO** — narrower). FY2025 GF revenue $11,404,950,000 vs. the most recent NASBO FY2024 GF operating figure $13,674,000,000 = **~0.83×**, matching the recon-pinned ratio exactly.
- **Driver**: Utah's income tax revenue is constitutionally earmarked (Utah Constitution Article XIII, broadened by the 2020 ballot measure Amendment G) into a legally separate major fund column — labeled "Education" in FY2019, renamed "Income Tax" by FY2025 (a fund-rename tracking the amendment's broadened earmark scope, not a data anomaly). NASBO's survey-reported "General Fund" concept for Utah appears to fold this earmarked fund together with the true GAAP General Fund; the ACFR statement legally keeps them in separate major-fund columns.
- **Rationale for GF-alone**: the phase's tie standard ("every loaded FY ties to its printed GF column total") and the cohort-wide uniform mold (every ACFR state in this milestone loads the printed GF column of the same statement, nothing else) both point at the printed column. A synthetic GF+Income-Tax-Fund composite is a total no statement prints and would break the tie-to-printed-total invariant that every other cohort state satisfies. The drop from the NASBO figure is honest and GAAP-correct — not a data regression.
- **Column-position note**: the GF column was extracted by POSITION (1st, right-anchored to the "Total revenues"/"Total expenditures" row), never by matching the 2nd column's header text. A naive header-string match would have broken silently across the Education→Income Tax rename.

### NASBO-replacement confirmation

Pre-load, UT had exactly 2 NASBO operating rows (FY2023 $11,682,000,000, FY2024 $13,674,000,000, `data_source` = "NASBO State Expenditure Report…"). Post-load DB query confirms:
- **0 rows** remain with a "NASBO" label on the UT node.
- **Exactly one operating row per (UT, fy)** across all 7 loaded years (no duplicates) — the RPC's `(muni, fy, 'operating')` key overwrote the NASBO row for FY2023/FY2024 in place; FY2019/2020/2021/2022/2025 were net-new.
- All 7 operating + 7 revenue rows carry the GAAP-basis label `"Utah State ACFR — General Fund (FY{fy} actual, GAAP basis)"` / `"…General Fund Revenue…"`.

### Idempotency + 0-residue re-run

Re-ran `node scripts/processUTAcfr.js --fy 2024` and `node scripts/processUTRevenueAcfr.js --fy 2024` live a second time. Result: **0 net change** — FY2024 operating remained exactly $12,493,247,000 and revenue exactly $11,209,884,000 after the re-run (values compared byte-for-byte pre/post via a direct DB query). `treasury.data_sources` query for `dataset_id LIKE 'ut-acfr-%'` returns **0 rows** both before Task 2's first load and after the idempotency re-run — the ephemeral create/RPC/delete lifecycle (WR-05/LOAD-01) leaves zero residue.

### Municipal-untouched check

Pre-load baseline: 15 UT rows with `entity_type != 'state'` (the v2.5 Transparent-Utah municipal cohort). Post-load (and post idempotency re-run) query: **still exactly 15 rows**, same names — Davis County, Layton, Lehi, Ogden, Orem, Provo, Salt Lake City, Salt Lake County, Sandy, St. George, Utah County, Washington County, Weber County, West Jordan, West Valley City. Loader scoping (`name='Utah' + state='UT' + entity_type='state'`, asserted against `EXPECTED_MUNI_ID`) confirmed correct — the state-node-only writes never touched the municipal rows.

### Cohort-untouched spot-check

Sampled 3 existing ACFR-cohort nodes (Indiana, South Carolina, Kentucky — all loaded earlier in this same milestone) and one un-upgraded NASBO-only state (Wyoming): all show their pre-existing latest-FY figures unchanged by the UT load — IN FY2025 op $19,123,203,000/rev $23,203,835,000, SC FY2025 op $20,323,239,000/rev $20,731,521,000, KY FY2025 op $14,495,976,000/rev $15,541,675,000, WY FY2024 op $1,654,000,000 still carrying its NASBO label. No cross-state write leakage.

### Money In auto-enable

UT now has 7 `dataset_type='revenue'` rows (FY2019–FY2025) — Money In auto-enables data-driven on the UT node, no frontend change required.

### Negative-line / P2 clamp record (ACFR-32)

Every year's "Investment Income" / "Investment Income (Loss)" line was scanned. **FY2022 is negative: −$4,304K** (a real GAAP fair-value/loss line). All other years are positive (FY2019 +$43,630K, FY2020 +$35,148K, FY2021 +$27,415K, FY2023 +$286,414K, FY2024 +$376,965K, FY2025 +$270,301K). Live-confirmed the P2 clamp fires on FY2022: `clampForRender` renders the category at $0 with the label `"Investment Income (Loss) (net refund/loss — shown at 0; actual -4,304,000)"`; the root/parent total carries the printed (signed) GF total unaffected. No loaded year shows a negative GF Total.

## Summary

Utah is fully live on State-ACFR GAAP: GF revenue-by-source + GAAP spending-by-function across the complete FY2019–FY2025 durable window, every FY GAAP-basis-labelled and per-year sourced, NASBO replaced in place with zero duplicates, the GF-alone scope decision recorded with the ~0.83×–0.91× narrower-than-NASBO divergence and the constitutional Amendment-G earmark driver, the P2 clamp proven live on FY2022, idempotent never-overwrite with 0 `data_sources` residue confirmed via a live re-run, Money In auto-enabled, and both the existing ACFR cohort and the 15 UT v2.5 municipal rows confirmed untouched.
