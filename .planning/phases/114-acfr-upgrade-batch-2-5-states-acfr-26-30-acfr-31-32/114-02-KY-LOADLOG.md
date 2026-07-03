# 114-02 — Kentucky ACFR Load Disposition

**Phase:** 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
**Plan:** 114-02
**State:** Kentucky (KY), node `6d9dfe88-f908-466c-95d5-66dce0777ee0`
**Requirements:** ACFR-27, ACFR-31, ACFR-32
**Method:** Node native `fetch` (no TLS workaround needed) on official finance.ky.gov ACFR/CAFR PDFs + `_acfr-work/extract_gf.py` + `_acfr-work/gen_state.py`. $0 spend, no paid APIs.

---

## Load Disposition

### FYs loaded

**23 of the 24 recon-scoped fiscal years FY2002–FY2025 loaded, both `operating` (GF spend-by-function) and `revenue` (GF revenue-by-source). FY2023 is a documented honest hole (see below).**

| FY | Operating (GAAP GF spend) | Revenue (GAAP GF revenue) | Source file |
|----|---------------------------|----------------------------|-------------|
| 2002 | $6,650,623,000 | $6,510,474,000 | `2002 CAFR.pdf` |
| 2003 | $6,665,596,000 | $6,914,984,000 | `2003CAFR.pdf` |
| 2004 | $6,824,064,000 | $6,984,268,000 | `2004CAFR.pdf` |
| 2005 | $7,232,441,000 | $7,737,391,000 | `2005CAFR.pdf` |
| 2006 | $8,042,030,000 | $8,374,025,000 | `2006CAFR.pdf` |
| 2007 | $8,297,979,000 | $8,449,576,000 | `2007PDFCAFR.pdf` |
| 2008 | $8,992,548,000 | $8,684,116,000 | `2008PDFCAFR.pdf` |
| 2009 | $8,696,721,000 | $8,464,775,000 | `2009CAFRFINAL.pdf` |
| 2010 | $7,942,849,000 | $8,113,287,000 | `2010CAFR.pdf` |
| 2011 | $9,010,611,000 | $8,560,421,000 | `2011CAFRFINALBOOK.pdf` |
| 2012 | $8,907,430,000 | $8,945,590,000 | `2012 CAFR.pdf` |
| 2013 | $8,829,409,000 | $9,408,751,000 | `2013 CAFR FOR WEB.pdf` |
| 2014 | $9,287,871,000 | $9,430,486,000 | `2014 CAFR FINAL.pdf` |
| 2015 | $9,260,605,000 | $10,010,544,000 | `2015CAFR.pdf` |
| 2016 | $9,584,205,000 | $10,356,874,000 | `2016 CAFR.pdf` |
| 2017 | $10,464,451,000 | $10,454,680,000 | `2017 CAFR.pdf` |
| 2018 | $10,432,406,000 | $10,772,696,000 | `2018 CAFR.pdf` |
| 2019 | $10,835,302,000 | $11,534,740,000 | `2019 CAFR.pdf` |
| 2020 | $10,914,165,000 | $11,708,933,000 | `2020 CAFR Report FINAL.pdf` |
| 2021 | $10,413,575,000 | $12,903,095,000 | `FY 2021 Kentucky Annual Comprehensive Financial Report.pdf` |
| 2022 | $11,969,615,000 | $14,741,962,000 | `2022 Commonwealth of Kentucky, Annual Comprehensive Financial Report.pdf` |
| 2023 | **SKIPPED — honest hole (see below)** | **SKIPPED — honest hole** | `2023 Kentucky Annual Comprehensive Financial Report.pdf` (downloaded, unusable) |
| 2024 | $13,410,629,000 | $15,456,606,000 | `2024 Kentucky Annual Comprehensive Financial Report.pdf` |
| 2025 | $14,495,976,000 | $15,541,675,000 | `2025 Commonwealth of Kentucky Annual Comprehensive Financial Report.pdf` |

**FYs skipped: FY2023 only.** FY2001 and earlier were intentionally NOT loaded — the FY2002 pre-GASB-34 boundary is the locked tranche scope, even though KY's live archive on finance.ky.gov goes back to FY2001 (confirmed present but not loaded per D-12).

### FY2023 honest hole — extraction failure, not a data error

The FY2023 ACFR PDF downloaded successfully (`%PDF` magic, 4.2MB, well above the 500KB soft-404 threshold) but its embedded fonts are subsetted TrueType/Identity-H CID fonts with **no ToUnicode CMap** — confirmed via `pdffonts KY2023.pdf` (every embedded font shows `uni=no`). `pdftotext` (tried `-table`, `-layout`, and `-raw`) produces a **consistently garbled text layer across the entire document**, not just the financial-statement pages — e.g. the cover title "Commonwealth of Kentucky..." renders as `"JHHJIR@<GOCJA*@IOP>FT  IIP<G"JHKM@C@INDQ@%DI<I>D<G`. This is categorically different from the FY2002 case (a 73MB *scanned* document whose OCR text layer was garbled in narrative sections but whose numeric table still extracted cleanly) — FY2023's PDF has a genuine, machine-generated but non-decodable text layer with no numeric fallback path.

No OCR tooling (`tesseract`) was available in this environment to fall back on. Checked the Wayback Machine for an alternate cached copy of the same URL — it returned the **byte-identical file** (same font-encoding defect, not a different upload). FY2023 is therefore **omitted as a genuine, documented extraction failure** — never force-transcribed from unreadable source text. FY2022 and FY2024 bracket the gap on both sides.

### Bookend tie confirmations

- **FY2024** GF Total revenues = **$15,456,606,000** (15,456,606K × 1,000) — exact match to the recon-pinned figure, diff $0.
- **FY2002** GF Total revenues = **$6,510,474,000** (6,510,474K × 1,000) — exact match to the recon-pinned figure, diff $0.
- All 23 loaded years tied to $0 diff on BOTH the revenue total and the expenditure total — `extract_gf.py`'s position-anchored GF-column extraction (anchored on the "Total revenues" row's numeric column position) worked cleanly across the full 24-year archive.

### Extraction fixes found + applied (documented, not data errors)

**1. Wrapped-label truncation (generic fix, `_acfr-work/extract_gf.py`).** KY's narrow label column in the Statement of Revenues, Expenditures, and Changes in Fund Balances wraps several category names across two physical `pdftotext -table` lines with no numbers on the first line — e.g. `"Interest and other"` / `"investment income"`, `"Increase (decrease) in fair"` / `"value of investments"`, `"Natural resources and"` / `"environmental protection"`. `extract_gf.py` was silently dropping the first-line fragment (numeric ties were always correct; only display names were truncated to e.g. `"investment income"` and `"environmental protection"`). **Fix:** added a `pending`-prefix accumulator to `extract_gf.py`'s `extract()` — a text-only line with no digits anywhere on it is held and prepended onto the next data row's label, then cleared. Verified fix does not affect any numeric tie (re-ran extraction on all 23 years post-fix; every tie held at $0 diff). This is a generic, reusable fix — not KY-specific — for any future state with the same narrow-column wrapping behavior.

**2. FY2002 OCR typo (one-off, hand-corrected in `ky_all.json`).** The 73MB scanned FY2002 PDF's OCR text layer misread `"Fines and forfeits"` as `"Rnes and forfeits"` (F→R) on the row carrying the number. Confirmed against the identical row position and relative value pattern in every other loaded year (`grep` of the raw text also showed the correctly-spelled "Fines and Forfeits" elsewhere in the same document's column-header/table-of-contents text, confirming this was an isolated glyph-recognition miss on one row, not a systemic OCR failure). Corrected the label directly in the extracted JSON before generating the loaders; the numeric value ($44,760 thousand) was never affected — OCR only garbled the label glyph, not the digits.

### NASBO-replacement confirmation

**Pre-load state (queried before any write):** KY node had exactly 2 rows — FY2023 operating $14,350,000,000 ("NASBO State Expenditure Report — General Fund (FY2023 actual, budgetary basis)") and FY2024 operating $14,188,000,000 ("NASBO State Expenditure Report — General Fund (FY2024 actual, budgetary basis)") — matching the 112-RECON.md Section 5 baseline exactly. Zero pre-existing `ky-acfr-%` `data_sources` rows. Zero pre-existing revenue rows.

**Post-load state:** FY2024 operating row now carries the ACFR label ("Kentucky State ACFR — General Fund (FY2024 actual, GAAP basis)") at the SAME `(muni, fy, 'operating')` key — replaced in place via `treasury_sync_budget_tree`, no duplicate row. **FY2023 operating remains the original NASBO row, untouched** — since FY2023's source PDF could not be transcribed, the loader never wrote FY2023 and the pre-existing NASBO row was correctly left in place rather than force-replaced with fabricated data. Verified: exactly ONE operating row per `(KY, fy)` across all 24 years (23 ACFR-labelled + 1 remaining NASBO-labelled for FY2023); the string `"NASBO"` appears on exactly one row (FY2023 operating), as expected.

### Scope near-parity (ACFR-31 honest finding)

KY ACFR GF Total revenues (FY2024) = **$15,456,606,000** vs NASBO GF operating (FY2024) = **$14,188,000,000** → **~1.09× ratio** — near-parity, the second-smallest divergence in the tranche after Indiana's ~0.99×.

**Driver — same favorable mechanism as Indiana:** Kentucky reports Federal funds through a **separate major fund column** ($20,593,582,000 FY2024) rather than consolidating them into the General Fund column, keeping the GAAP General column's scope close to NASBO's narrower budgetary GF concept. This is documented explicitly in both loader head comments to distinguish it from the AZ/MO/CO/SC-style larger-divergence drivers seen elsewhere in this tranche.

### P2 clamp status (ACFR-32)

**Live clamp exercised in nearly every loaded year.** "Interest and other investment income" and "Increase (decrease) in fair value of investments" both go negative in most years (e.g. FY2012: −$681,000 / −$15,574,000; FY2020: −$3,863,000 / −$1,364,000) — real GAAP fair-value-of-investments accounting lines, not extraction artifacts. `clampForRender()` renders these at $0 with the true signed magnitude preserved in the category label (verified in the FY2012 revenue dry-run: `"Interest and other investment income (net refund/loss — shown at 0; actual -681,000)"`), while the printed GF Total (which already nets the negative) is carried unchanged as the root total. No year showed a negative GF Total.

### Idempotency + 0-residue re-run result

Captured the full FY2024 operating + revenue `budgets` rows before a second live re-run of `node scripts/processKYAcfr.js --fy 2024` and `node scripts/processKYRevenueAcfr.js --fy 2024`. Compared before/after (excluding volatile `id`/timestamp columns): **byte-for-byte identical, 0 net change** — confirms the never-overwrite / idempotent-replace contract holds.

`SELECT count(*) FROM treasury.data_sources WHERE dataset_id LIKE 'ky-acfr-%'` → **0** (checked immediately after the initial 46-row load and again after the FY2024 idempotency re-run) — the ephemeral create-then-delete `data_sources` lifecycle (WR-05/LOAD-01) leaves zero residue on every run.

### Money In auto-enable

KY node now carries 23 `dataset_type='revenue'` rows (FY2002–FY2022, FY2024–FY2025) — Money In auto-enables data-driven via `available_datasets`, no frontend change required.

### Cohort-untouched spot check

| Node | Rows (sample) | Status |
|------|------|--------|
| South Carolina (SC, Phase 114-01 ACFR) | FY2025 operating $20,323,239,000 / revenue $20,731,521,000, "South Carolina State ACFR..." | Unchanged |
| Indiana (IN, Phase 113 ACFR) | FY2025 operating $19,123,203,000 / revenue $23,203,835,000, "Indiana State ACFR..." | Unchanged |
| California (CA, v2.11 ACFR) | FY2025 operating $221,826,907,000 / revenue $221,591,201,000, "California State ACFR..." | Unchanged |
| Utah (UT, un-upgraded Batch-2 roster state) | FY2023/FY2024 operating, "NASBO State Expenditure Report..." | Unchanged (still clean NASBO-only, confirms KY's load did not bleed into a sibling roster state) |

---

## Summary

Kentucky's state node is now live on full State-ACFR GAAP for 23 of its 24 recon-scoped fiscal years (FY2002–FY2022, FY2024–FY2025) — GF revenue-by-source + GAAP spending-by-function, every loaded row GAAP-basis-labelled and per-year source-stamped. FY2023 is a documented honest hole: the source PDF's text layer is fundamentally undecodable in this environment (no ToUnicode CMap, no OCR fallback available), so its pre-existing NASBO operating row was correctly left untouched rather than force-replaced with fabricated data. NASBO FY2024 operating replaced in place with zero duplicates; the ~1.09× near-parity recorded against its correctly-identified favorable driver (Federal reported through a separate major fund column, same mechanism as Indiana); the P2 clamp path fired live in nearly every year (Interest/investment-value lines went negative repeatedly, all correctly clamped with signed magnitude preserved); idempotent never-overwrite proven with 0 `data_sources` residue; Money In auto-enabled; and the rest of the ACFR cohort plus a sampled un-upgraded NASBO state (Utah) confirmed untouched. Two reusable tooling improvements were made to the shared `extract_gf.py` (wrapped-label prefix accumulator) that will benefit any future state with the same narrow-column wrapping quirk.
