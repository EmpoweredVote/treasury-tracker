# 114-01 — South Carolina ACFR Load Disposition

**Phase:** 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
**Plan:** 114-01
**State:** South Carolina (SC), node `f0024b19-1b89-4bdf-af47-d2e28c21278f`
**Requirements:** ACFR-26, ACFR-31, ACFR-32
**Method:** `pdftotext -table` on official cg.sc.gov ACFR/CAFR PDFs + `_acfr-work/extract_gf.py` + `_acfr-work/gen_state.py`. $0 spend, no paid APIs.

---

## Load Disposition

### FYs loaded

**All 24 fiscal years FY2002–FY2025 loaded, both `operating` (GF spend-by-function) and `revenue` (GF revenue-by-source).** Zero honest holes — every year enumerated in the recon source table downloaded cleanly (real `%PDF` magic bytes, all well above 500KB) and tied exactly ($0 diff) to the printed General Fund column "Total revenues" / "Total expenditures" on the first `pdftotext -table` extraction pass. No FY was omitted, retried, or required manual re-transcription.

| FY | Operating (GAAP GF spend) | Revenue (GAAP GF revenue) | Source file |
|----|---------------------------|----------------------------|-------------|
| 2002 | $5,455,224,000 | $5,763,261,000 | `SC FY 2002 CAFR.pdf` |
| 2003 | $5,287,968,000 | $5,846,869,000 | `SC FY 2003 CAFR.pdf` |
| 2004 | $5,347,427,000 | $6,130,682,000 | `SC FY 2004 CAFR.pdf` |
| 2005 | $5,425,918,000 | $6,672,504,000 | `SC FY 2005 CAFR.pdf` |
| 2006 | $5,803,405,000 | $7,289,210,000 | `SC FY 2006 CAFR.pdf` |
| 2007 | $6,515,978,000 | $7,667,405,000 | `SC FY 2007 CAFR.pdf` |
| 2008 | $6,843,844,000 | $7,515,320,000 | `SC FY 2008 CAFR.pdf` |
| 2009 | $5,229,880,000 | $6,228,514,000 | `SC FY 2009 CAFR.pdf` |
| 2010 | $4,785,390,000 | $5,908,175,000 | `SC FY 2010 CAFR.pdf` |
| 2011 | $7,923,457,000 | $8,871,374,000 | `SC FY 2011 CAFR.pdf` |
| 2012 | $8,397,741,000 | $9,508,898,000 | `SC FY 2012 CAFR.pdf` |
| 2013 | $8,823,817,000 | $9,874,881,000 | `State of South Carolina 2013 CAFR.pdf` |
| 2014 | $9,368,284,000 | $9,880,966,000 | `CAFR - FY 2014.pdf` |
| 2015 | $9,952,249,000 | $10,013,969,000 | `CAFR - FY 2015.pdf` |
| 2016 | $9,197,004,000 | $10,146,407,000 | `CAFR - FY 2016 - Final.pdf` |
| 2017 | $10,187,073,000 | $10,480,545,000 | `State of SC FY 2017 CAFR.pdf` |
| 2018 | $10,522,675,000 | $11,052,022,000 | `FY 2018 CAFR - 2018-11-15.pdf` |
| 2019 | $10,397,247,000 | $11,834,269,000 | `001 - 302 - CAFR - FY 2019.pdf` (canonical spaced variant) |
| 2020 | $10,728,014,000 | $12,154,289,000 | `001-302-CAFR-FY2020.pdf` |
| 2021 | $10,360,765,000 | $14,405,366,000 | `001-304-CAFR-FY2021.pdf` |
| 2022 | $12,345,257,000 | $15,970,194,000 | `001-304-CAFR-FY2022.pdf` |
| 2023 | $15,531,902,000 | $16,083,490,000 | `001-308-CAFR-FY2023.pdf` |
| 2024 | $18,569,778,000 | $17,835,376,000 | `001-316-ACFR-FY2024.pdf` |
| 2025 | $20,323,239,000 | $20,731,521,000 | `039-191-ACFR-FY2025-BasicFinancialStatements.pdf` (part-file — the FY2025 ACFR is split into 9 part-PDFs; this statement lives only in the BasicFinancialStatements part) |

**FYs skipped: NONE.** FY1993–FY2001 were intentionally NOT loaded — the FY2002 pre-GASB-34 boundary is the locked tranche scope (deeper SC history is Phase 115 extractor territory), even though SC's live archive on cg.sc.gov goes back to FY1993.

### Bookend tie confirmations

- **FY2025** GF Total revenues = **$20,731,521,000** (20,731,521K × 1,000) — exact match to the recon-pinned figure, diff $0.
- **FY2002** GF Total revenues = **$5,763,261,000** (5,763,261K × 1,000) — exact match to the recon-pinned figure, diff $0.
- All 24 years tied to $0 diff on BOTH the revenue total and the expenditure total (not just the two bookends) — `extract_gf.py`'s position-anchored GF-column extraction (anchored on the "Total revenues" row's numeric column position, not a fixed column count) worked cleanly across every column-layout era: FY2002's 6-column layout (extra State Tobacco Settlement column), the FY2003–2012 4-column layout, and the FY2013–2025 5-column layout.

### Extraction quirk found + fixed (documented, not a data error)

SC's printed Governmental Funds statement prints a single **"Taxes:"** subsection header ahead of ALL General Fund revenue line items in every one of the 24 loaded years — there is no second header separating the true tax lines (Individual income, Retail sales and use, Corporate income, Gas and motor vehicle, Insurance, Hospital, Other) from the non-tax lines that follow in the same unbroken list (Licenses/fees/permits, Interest and other investment income, Federal, Local and private grants, Departmental services, Contributions, Fines and penalties, Tobacco/Opioid legal settlement, catch-all Other). `extract_gf.py` has no positional-indentation signal in `pdftotext -table` output to detect where "Taxes:" logically ends, so it propagated the sub-heading to every following item. Left as-is, `gen_state.py`'s generic naming heuristic would have mislabeled "Federal" as "Federal taxes" and "Departmental services" as "Departmental services taxes" — a real accuracy defect, not cosmetic.

**Fix (Rule 1 — auto-fixed bug, applied in `_acfr-work/gen_state.py`):** added a `rev_boundary` config option. The boundary is set to `'Licenses, fees, and permits'` — confirmed as the first genuinely non-tax revenue line, in the identical list position, across all 24 loaded years. Once the extractor's item-name loop reaches that label (case-insensitive prefix match), the sub-heading is force-cleared to `None` for the remainder of that year's revenue list, so only true tax lines receive the `" taxes"` suffix. Also hardened `norm()` to strip `pdftotext` dot-leader artifacts (`"Individual income.................."`) and stray `$` tokens mis-captured into a handful of pre-2013 labels — a cosmetic cleanup, not a totals change (validated: `catSum` ties were computed from the raw extracted numeric values before any name cleanup, so this fix never touched the tie-out math).

### NASBO-replacement confirmation

**Pre-load state (queried before any write):** SC node had exactly 2 rows — FY2023 operating $12,089,000,000 ("NASBO State Expenditure Report — General Fund (FY2023 actual, budgetary basis)") and FY2024 operating $14,189,000,000 ("NASBO State Expenditure Report — General Fund (FY2024 actual, budgetary basis)") — matching the 112-RECON.md Section 5 baseline exactly. Zero pre-existing `sc-acfr-%` `data_sources` rows. Zero pre-existing revenue rows.

**Post-load state:** FY2023 and FY2024 operating rows now carry the ACFR label ("South Carolina State ACFR — General Fund (FY2023/2024 actual, GAAP basis)") at the SAME `(muni, fy, 'operating')` key — replaced in place via `treasury_sync_budget_tree`, no duplicate row created. Verified: exactly ONE operating row per `(SC, fy)` across all 24 years; **zero** rows anywhere on the SC node contain the string `"NASBO"`.

### Scope divergence vs NASBO (ACFR-31 honest relabel)

SC ACFR GF Total revenues (FY2025) = **$20,731,521,000** vs NASBO GF operating (FY2024) = **$14,189,000,000** → **~1.46× ratio**.

**Driver — UNLIKE most other Batch-2 states, this is NOT federal passthrough.** Federal revenue inside the GF column itself is only **$46,273,000** (FY2025) — a tiny fraction of the $20.73B total. The divergence is instead a **GAAP-vs-budgetary basis consolidation**: SC's GAAP General Fund statement books a broader set of transfer/interest/departmental-services/tax-detail activity than NASBO's narrower state-reported budgetary "General Fund" concept captures. This driver mechanism is documented explicitly in the loader head comment (both `processSCAcfr.js` and `processSCRevenueAcfr.js`) to distinguish it from the AZ/MO/LA/OK-style federal-passthrough-driven divergences seen elsewhere in this tranche.

### P2 clamp status (ACFR-32)

No negative GF line items were found in any of the 24 loaded years for either revenues or expenditures — "Interest and other investment income" was positive throughout (FY2025 +$684,860K, FY2002 +$62,039K). The `clampForRender()` path is wired verbatim in both loaders and will fire automatically if a future re-run/refresh encounters a negative line. **Structural note (not a P2 trigger):** SC's FY2002 General Fund ENDING FUND BALANCE was a deficit of $(139,951)K — a balance-sheet fact documented in the loader header, distinct from a revenue-line clamp concern.

### Idempotency + 0-residue re-run result

Re-ran `node scripts/processSCAcfr.js --fy 2024` and `node scripts/processSCRevenueAcfr.js --fy 2024` live a second time. Captured the full FY2024 operating + revenue `budgets` rows (id, total_budget, data_source, source_url, source_date) before and after the re-run: **byte-for-byte identical, 0 net change** — confirms the never-overwrite / idempotent-replace contract holds.

`SELECT count(*) FROM treasury.data_sources WHERE dataset_id LIKE 'sc-acfr-%'` → **0** (checked immediately after the initial 48-row load and again after the FY2024 idempotency re-run) — the ephemeral create-then-delete `data_sources` lifecycle (WR-05/LOAD-01) leaves zero residue on every run.

### Money In auto-enable

SC node now carries 24 `dataset_type='revenue'` rows (FY2002–FY2025) — Money In auto-enables data-driven via `available_datasets`, no frontend change required.

### Cohort-untouched spot check

| Node | Rows | Sample (latest FY) | Status |
|------|------|---------------------|--------|
| Indiana (IN, Phase 113 ACFR) | 48 | FY2025 operating $19,123,203,000 / revenue $23,203,835,000, "Indiana State ACFR..." | Unchanged |
| California (CA, v2.11 ACFR) | 36 | FY2025 operating $221,826,907,000 / revenue $221,591,201,000, "California State ACFR..." | Unchanged |
| Pennsylvania (PA, v2.12 ACFR) | 20 | FY2025 operating $94,758,255,000 / revenue $92,414,817,000, "Pennsylvania State ACFR..." | Unchanged |
| Kentucky (KY, un-upgraded Batch-2 roster state) | 2 | FY2023/FY2024 operating, "NASBO State Expenditure Report..." | Unchanged (still clean NASBO-only, confirms SC's load did not bleed into a sibling roster state) |

---

## Summary

South Carolina's state node is now live on full State-ACFR GAAP: 24 fiscal years (FY2002–FY2025) of GF revenue-by-source + GAAP spending-by-function, every row GAAP-basis-labelled and per-year source-stamped, NASBO operating replaced in place with zero duplicates, the ~1.46× scope divergence recorded against its correctly-identified GAAP-basis-consolidation driver (not federal passthrough — unusual for this tranche), the P2 clamp path wired (no live trigger this load), idempotent never-overwrite proven with 0 `data_sources` residue, Money In auto-enabled, and the rest of the 24-state ACFR cohort + a sampled un-upgraded NASBO state confirmed untouched.
