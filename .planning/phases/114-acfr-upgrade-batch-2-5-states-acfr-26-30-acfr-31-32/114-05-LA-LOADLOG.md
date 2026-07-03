# 114-05 Louisiana ACFR Load Log

**State:** Louisiana (LA) — state node `b7e9e7cd-8b7e-4272-8e42-ef41b293120b`
**Requirements:** ACFR-30, ACFR-31, ACFR-32
**Source:** State of Louisiana Division of Administration, Office of Statewide Reporting and Accounting Policy (OSRAP) Annual Comprehensive Financial Report (ACFR)/Comprehensive Annual Financial Report (CAFR), Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances, **General Fund column** (GAAP basis, thousands).

## Load Disposition

### FYs loaded

**All 24 requested FYs loaded with zero honest holes: FY2002–FY2025.** Both `operating` (spending-by-function) and `revenue` (revenue-by-source) datasets loaded for every year. Every year tied to $0 diff on BOTH the revenue and expenditure printed General Fund totals.

| FY | Rev tie | Exp tie | Operating total (loaded, dollars) | Revenue total (loaded, dollars) |
|----|---------|---------|-----------------------------------|----------------------------------|
| 2002 | $0 diff | $0 diff | 14,695,770,000 | 5,807,699,000 |
| 2003 | $0 diff | $0 diff | 15,396,766,000 | 6,333,578,000 |
| 2004 | $0 diff | $0 diff | 16,082,176,000 | 6,691,138,000 |
| 2005 | $0 diff | $0 diff | 16,807,994,000 | 7,101,146,000 |
| 2006 | $0 diff | $0 diff | 19,428,136,000 | 8,899,321,000 |
| 2007 | $0 diff | $0 diff | 22,243,498,000 | 12,499,982,000 |
| 2008 | $0 diff | $0 diff | 25,638,521,000 | 13,414,077,000 |
| 2009 | $0 diff | $0 diff | 25,135,973,000 | 12,889,013,000 |
| 2010 | $0 diff | $0 diff | 23,223,603,000 | 12,441,850,000 |
| 2011 | $0 diff | $0 diff | 24,040,678,000 | 12,878,833,000 |
| 2012 | $0 diff | $0 diff | 23,311,027,000 | 11,660,084,000 |
| 2013 | $0 diff | $0 diff | 22,733,857,000 | 10,287,062,000 |
| 2014 | $0 diff | $0 diff | 23,081,502,000 | 10,682,828,000 |
| 2015 | $0 diff | $0 diff | 23,538,351,000 | 10,625,856,000 |
| 2016 | $0 diff | $0 diff | 23,113,145,000 | 10,080,454,000 |
| 2017 | $0 diff | $0 diff | 26,499,546,000 | 13,841,215,000 |
| 2018 | $0 diff | $0 diff | 26,045,367,000 | 13,138,256,000 |
| 2019 | $0 diff | $0 diff | 26,943,048,000 | 13,760,440,000 |
| 2020 | $0 diff | $0 diff | 29,532,215,000 | 16,202,084,000 |
| 2021 | $0 diff | $0 diff | 34,079,241,000 | 20,434,431,000 |
| 2022 | $0 diff | $0 diff | 37,748,650,000 | 22,874,308,000 |
| 2023 | $0 diff | $0 diff | 40,126,350,000 | 25,951,221,000 |
| 2024 | $0 diff | $0 diff | 39,856,311,000 | 24,115,531,000 |
| 2025 | $0 diff | $0 diff | 39,246,140,000 | 22,780,529,000 |

Bookends confirmed exactly against this plan's source_facts: FY2025 GF Total revenues = $22,780,529K (loaded $22,780,529,000); FY2002 GF Total revenues = $5,807,699K (loaded $5,807,699,000). Both exact, $0 diff.

### FYs skipped

None. All 24 requested FYs (FY2002–FY2025) were downloaded, extracted, tied, and loaded on this run — the cleanest coverage outcome in the tranche after Alabama. Pre-FY2002 files (`cafr94.pdf` through `cafr01.pdf`) are live on the `doa.la.gov/doa/osrap/archives/` page but were intentionally excluded per the locked FY2002 pre-GASB-34 boundary (D-12) — Phase 115 extractor territory, not an extraction failure.

### Hash-URL enumeration (mechanical trap, ACFR-30)

Every per-year URL was resolved live from the two doa.la.gov landing pages, never guessed from the FY:
- `https://doa.la.gov/doa/osrap/annual-financial-report/` — FY2022–FY2025 (`/media/lqvhnfhs/fy25-acfr-final.pdf`, `/media/db0f1bsl/fy2024-acfr-final.pdf`, `/media/epmbw2el/fy2023-acfr-final.pdf`, `/media/ofqdeujb/acfr-2022.pdf`).
- `https://doa.la.gov/doa/osrap/archives/` — FY2002–FY2021 (24 further hash-path PDFs enumerated by scanning every `href` on the archive page for `cafr`/`carf` filenames).

All 24 files downloaded with valid `%PDF` magic bytes and sizes between 1.29MB and 10.44MB (well above the ~500KB soft-404 guard) — no HTML page was ever saved as a `.pdf`. One filename quirk confirmed by content, not assumed: the FY2003 archive file is misspelled `carf03.pdf` (not `cafr03.pdf`) on doa.la.gov itself — verified correct by tying to FY2003's printed GF totals ($0 diff on both revenue and expenditure), not a wrong-year download.

### GF-alone scope decision + federal-composition record (ACFR-31)

**Decision: load the printed General Fund column ALONE — not a synthetic GF+Bond Security & Redemption Fund composite.** This resolves the load-phase flag left open by 112-BATCH2-SOURCES.md's LA Detail Block.

- **Pre-load NASBO baseline** (recorded before any write, via direct DB query): FY2023 operating $11,880,000,000; FY2024 operating $11,970,000,000; both `data_source_id=null`; zero revenue rows; zero `data_sources` rows for LA — exactly matching the 112-RECON.md Section 5 baseline.
- **Loaded ACFR GF totals**: FY2025 GF Total revenues $22,780,529,000 vs. NASBO FY2024 operating $11,970,000,000 = **~1.90× (~1.903×)**.
- **Driver — structurally different from every other tranche state**: this is NOT a modest federal-passthrough increment (the IL/AZ/MO/CO/SC-class mechanism). LA's GAAP General Fund is **~99% federal Intergovernmental Revenues** — $22,482,784,000 of $22,780,529,000 FY2025 (Medicaid/grant passthrough) — while Louisiana's **own-source state tax revenue (~$14.1B)** is booked entirely to the **separate Bond Security & Redemption Fund** column of the same statement, not the General Fund column. This was confirmed by inspecting every one of the 24 loaded years: the "Taxes," "Gaming," and "Tobacco Settlement" revenue lines print a blank ("--") GENERAL FUND cell in EVERY single year FY2002–FY2025 — their real dollar amounts sit entirely in the Bond Security & Redemption Fund column instead, never in the GF.
- **Rationale for GF-alone**: the phase's tie standard ("every loaded FY ties to its printed GF column total") and the cohort-wide uniform mold (every ACFR state in this milestone loads the printed GF column of the same statement, nothing else — the UT/AL ACFR-31 precedent) both point at the printed column. A synthetic GF+Bond-Security composite is a total no statement prints.
- **Honest-relabel prominence (ACFR-31 obligation)**: the verbatim category "Intergovernmental Revenues" visibly DOMINATES the LA General Fund revenue tree (~98.7% of the FY2025 total: $22,482,784,000 of $22,780,529,000). This is the honest rendering, not a bug — but it must never be misread as "Louisiana's state tax revenue." The loader's `dataSource()` GAAP-basis label, the generated loader's head-comment SCOPE DECISION block, and this LOADLOG all carry the composition record so no downstream consumer makes that naive-GF assumption.
- **Column-position note**: GF is column 1 in every loaded year; the major-fund lineup to its right is General Fund | Bond Security & Redemption Fund | [Capital Outlay Escrow Fund, FY2025+ only] | Louisiana Education Quality Trust Fund | Nonmajor Governmental Funds | Total Governmental Funds. Extracted by POSITION (first numeric token, anchored to the "Total revenues"/"Total expenditures" row, with a position-blind first-cell fallback for years where the anchor's right-edge alignment drifted — see Tooling section below), never by column-header text matching. No Bond Security & Redemption (or any other non-GF major-fund) amount was summed into any stored total — confirmed by inspecting every year's extracted category list.

### Negative-line / P2 clamp record (ACFR-32)

A full-cohort scan (not just the two bookend years) of every loaded year's revenue category values found negative GF lines in exactly 4 of the 24 years, all on the same line item ("Use of Money and Property," later years print "Use of Money & Property"):

| FY | Negative amount (thousands) |
|----|------------------------------|
| 2004 | -38,246 |
| 2012 | -20,092 |
| 2013 | -80,800 |
| 2022 | -4,006 |

All four are real GAAP fair-value-of-investments losses, not extraction artifacts. Every other loaded year (20 of 24) is positive on this line, including both bookend years (FY2002 +$18,822K, FY2025 +$50,906K), matching the plan's source_facts prediction of "no negative-line risk in either bookend GF column." The `clampForRender` P2-clamp path fired live for these 4 years — spot-checked via `--dry-run --fy 2013`: the tree renders `Use of Money and Property (net refund/loss — shown at 0` at $0 with a `[Note: ... true value: -80,800,000 (clamped at render)]` line preserving the signed magnitude; the root total (`$10,287,062,000`) correctly carries the printed (signed) total. No expenditure-side negative lines were found in any of the 24 years.

### Two shared-tooling fixes discovered by LA (generalized, not LA-specific)

**1. ALL-CAPS source labels (`_acfr-work/gen_state.py`).** LA's printed Governmental Funds statement renders every category label in ALL CAPS (e.g. `"INTERGOVERNMENTAL REVENUES"`, `"USE OF MONEY & PROPERTY"`) — unlike every prior tranche state (SC/KY/UT/AL/MO/AZ/OR/CO), which already print Title Case. `norm()` now title-cases any label that is genuinely all-uppercase via a new `smart_title()` helper (lowercasing connector words — "of," "and," "&," "or," "in," "for," "to," "the," "a," "an" — except when leading), so LA's tree reads `"Intergovernmental Revenues"` like every other cohort state instead of shouting. Amounts are completely unaffected, only display casing. Re-verified zero regression: re-ran `extract_gf.py` across all 96 already-loaded SC/KY/UT/AL state-years post-fix — every tie held identical to before (their source PDFs are not all-uppercase, so the new branch never fires for them).

**2. Dual Current/Intergovernmental expenditure-subsection collision (`_acfr-work/gen_state.py`).** LA's printed EXPENDITURES section repeats the SAME function-name lineup (General Government, Education, Public Safety, ...) under TWO separate subsections starting in FY2015 — "Current" (direct state spending) and "Intergovernmental" (aid/transfers to local governments, by function) — a genuine GAAP distinction, not a duplicate row (FY2002–FY2014 print only the "Current" breakdown, with "Intergovernmental" appearing as a single flat line item instead — a real reporting-era structure change, not an extraction gap). `default_exp_name()` now appends `" — Intergovernmental"` to the second occurrence so the tree never shows two identically-named leaves — e.g. FY2025 shows both `"Education"` (Current, direct state spending, $1,309,762K) and `"Education — Intergovernmental"` (MFP formula aid to local school boards, $6,801,090K — larger than the Current-Education line itself, a real and expected GAAP fact for Louisiana's K-12 funding mechanism, not a bug).

**3. `extract_gf.py` statement-header regex whitespace (shared fix).** LA's FY2016–FY2019 PDFs print the `"STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES"` header with large multi-space gaps between words (a title-line rendering quirk unique to those 4 files) — the original regex required a single literal space between `"Revenues,"` and `"Expenditures"`, causing `find_statement()` to report "statement not found" for those 4 years. Fixed by tolerating `\s+` instead of a single space. Re-verified zero regression on SC/KY/UT/AL.

**4. `extract_gf.py` position-anchor fallback for non-uniform column alignment (shared fix).** FY2003–FY2005's `pdftotext -table` output does not hold a stable right-edge column position across every row in the same section (label-length-dependent padding drift in LA's older-era statement layout, not a wrap) — the single `'Total revenues'`-anchored position check wrongly rejected genuine in-column GF values on some rows (FY2003: "Use of Money and Property" and "Other" both dropped; FY2005: similar drops) and, in FY2004, the entire expenditures section's true right edge drifted away from the revenue section's anchor entirely (causing `Total Expenditures` itself to read as blank). `extract()` now retries with position-blind first-cell extraction (GF is always column 1, so the first non-dash numeric token after the label is always correct) whenever the anchored pass fails to tie, tried per-document in `main()`. FY2003/2004/2005 now all tie at $0 diff using the fallback path; every other year (20 of 24) still ties via the original anchored path. Re-verified zero regression: re-ran `extract_gf.py` across all 96 already-loaded SC/KY/UT/AL state-years post-fix — same ties, same `use_anchor: true` path, as before this fix.

### NASBO-replacement confirmation

Pre-load, LA had exactly 2 NASBO operating rows (FY2023 $11,880,000,000, FY2024 $11,970,000,000, `data_source` = "NASBO State Expenditure Report…", `data_source_id=null`). Post-load DB query confirms:
- **0 rows** remain with a "NASBO" label anywhere on the LA node.
- **Exactly one operating row per (LA, fy)** across all 24 loaded years (no duplicates) — the RPC's `(muni, fy, 'operating')` key overwrote the NASBO row for FY2023 (id `d3ba0513-e2f6-4712-b225-b607843d8d4b`) and FY2024 (id `bda397ab-2b67-4815-a42d-a75d88ad0d22`) in place, same row `id`s persisted through the upgrade; FY2002–2022 and FY2025 were net-new.
- All 24 operating + 24 revenue rows (48 total) carry the GAAP-basis label `"Louisiana State ACFR — General Fund (FY{fy} actual, GAAP basis)"` / `"…General Fund Revenue…"`, with non-null `source_url` and `source_date` on every row.

### Idempotency + 0-residue re-run

Captured the full FY2024 operating + revenue `budgets` rows (id, total, data_source, source_url, source_date), then re-ran `node scripts/processLAAcfr.js --fy 2024` and `node scripts/processLARevenueAcfr.js --fy 2024` live a second time. Result: **0 net change** — identical row `id`s, identical `total_budget` ($39,856,311,000 operating / $24,115,531,000 revenue), identical `data_source`/`source_url`/`source_date` before and after the re-run; total node row count unchanged at 48. `treasury.data_sources` query for `dataset_id LIKE 'la-acfr-%'` returns **0 rows** after the full 48-row load AND after the idempotency re-run — the ephemeral create/RPC/delete lifecycle (WR-05/LOAD-01) leaves zero residue.

### Cohort-untouched spot-check

Sampled 4 existing ACFR-cohort nodes loaded earlier in this same milestone (South Carolina, Kentucky, Utah, Alabama) and one un-upgraded NASBO-only state (Wyoming):

| Node | Rows | NASBO-labelled | Status |
|------|------|-----------------|--------|
| South Carolina | 48 | 0 | Unchanged (matches its 114-01 load) |
| Kentucky | 47 | 1 (FY2023, documented honest hole per 114-02-LOADLOG) | Unchanged (matches its 114-02 load exactly) |
| Utah | 14 | 0 | Unchanged (matches its 114-03 load) |
| Alabama | 48 | 0 | Unchanged (matches its 114-04 load) |
| Wyoming (un-upgraded NASBO) | 2 | 2 | Unchanged, no cross-state write leakage |

No cross-state bleed from the LA load into any sibling node.

### Money In auto-enable

LA now has 24 `dataset_type='revenue'` rows (FY2002–FY2025) — Money In auto-enables data-driven on the LA node, no frontend change required.

## Summary

Louisiana is fully live on State-ACFR GAAP: GF revenue-by-source + GAAP spending-by-function across the complete FY2002–FY2025 window (24 years, zero honest holes), every FY GAAP-basis-labelled and per-year sourced with hash URLs live-enumerated from the doa.la.gov landing/archive pages (never guessed), NASBO replaced in place with zero duplicates. The GF-alone scope decision is recorded with the ~1.90× divergence AND — uniquely in this tranche — its structurally distinct driver: LA's GF is ~99% federal Intergovernmental Revenues while Louisiana's own state tax revenue sits entirely in the separate Bond Security & Redemption Fund column, documented with the prominence ACFR-31 requires so the figure is never misread as "Louisiana's state tax revenue." The P2 clamp path fired live for 4 of 24 years on "Use of Money and Property," idempotent never-overwrite with 0 `data_sources` residue confirmed via a live re-run, Money In auto-enabled, and the existing ACFR cohort (SC/KY/UT/AL) plus a NASBO-only sample state (WY) confirmed untouched. Two reusable tooling improvements were made to the shared `gen_state.py`/`extract_gf.py` (ALL-CAPS title-casing, dual Current/Intergovernmental expenditure disambiguation, statement-header regex whitespace tolerance, and a position-anchor/first-cell fallback for non-uniform column alignment) that will benefit any future ALL-CAPS or inconsistently-tabled state.
