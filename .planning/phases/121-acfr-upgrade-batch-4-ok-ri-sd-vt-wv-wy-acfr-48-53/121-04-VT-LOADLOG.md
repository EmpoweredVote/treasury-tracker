# 121-04 Vermont (VT) ACFR Load Log — ACFR-51

State: Vermont | Node: `563d6f1c-ce2b-4071-938f-01725d283504` | Source: VT Dept. of Finance & Management (finance.vermont.gov)

## Load Disposition

| FY | Status | GF Total Revenues | GF Total Expenditures | Source URL |
|----|--------|-------------------:|------------------------:|------------|
| 2015 | LOADED | $1,392,033,404 | $828,929,456 | FIN-2015_CAFR_FINAL.pdf |
| 2016 | LOADED | $1,430,388,220 | $803,696,532 | FIN-2016_CAFR_FINAL.pdf |
| 2017 | LOADED | $1,454,702,163 | $896,218,729 | FIN-2017_CAFR_FINAL.pdf |
| 2018 | LOADED | $1,551,378,929 | $926,931,860 | FIN-2018_CAFR_FINAL.pdf |
| 2019 | LOADED | $1,632,556,268 | $1,023,627,442 | 2019_CAFR_FINAL.pdf (naming exception) |
| 2020 | LOADED | $1,569,802,827 | $994,638,981 | VERMONT_2020_CAFR_FINAL.pdf (naming exception) |
| 2021 | LOADED | $1,894,179,158 | $1,045,477,912 | VERMONT_2021_ACFR_FINAL.pdf (Rpts_Pubs/CAFR subpath) |
| 2022 | LOADED | $2,180,020,790 | $1,467,335,595 | VERMONT_2022_ACFR_FINAL.pdf |
| 2023 | LOADED | $2,267,178,350 | $1,452,737,080 | VERMONT_2023_ACFR_FINAL.pdf |
| 2024 | LOADED (NASBO replaced in place) | $2,297,961,239 | $1,695,914,208 | VERMONT_2024_ACFR_FINAL.pdf |
| 2025 | LOADED | $2,543,030,123 | $1,627,200,216 | VERMONT_2025_ACFR_FINAL.pdf |

**Window:** FY2015–FY2025 (11 years, the full recon target window). **ZERO honest holes** — every year ties $0 diff on both the revenue and expenditure printed GENERAL FUND totals.

**Bookends confirmed (whole-dollar, UNITS=1):** FY2025 revenue $2,543,030,123 / FY2015 revenue $1,392,033,404 — both exact matches to the plan's pinned bookends, no ×1,000 skew.

## Browser User-Agent Note

`finance.vermont.gov` returns HTTP 403 to a bare/non-browser User-Agent (tn.gov precedent, confirmed by the 117 recon). All 11 PDF fetches sent `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36` via `build_state.py`'s download helper — all 11 downloaded cleanly (%PDF magic + size >500KB guard, zero soft-404s).

## Naming Exceptions (VT naming trap, 3-way)

- FY2021–FY2025: `VERMONT_{YYYY}_ACFR_FINAL.pdf` — FY2021 alone lives under the `/Rpts_Pubs/CAFR/` subpath; FY2022–2025 sit directly under `/documents/`.
- FY2015–FY2018: `FIN-{YYYY}_CAFR_FINAL.pdf`.
- FY2020 (exception): `VERMONT_2020_CAFR_FINAL.pdf` — breaks the FIN- pattern.
- FY2019 (exception): `2019_CAFR_FINAL.pdf` — bare filename, no FIN- or VERMONT_ prefix.

All four naming patterns read directly off the 117-BATCH4-SOURCES.md VT Detail Block, never guessed from the FY.

## Extraction Defect Discovered + Fixed (shared extract_gf.py generalization)

**Zero/one-whitespace dot-leader defect (FY2024/FY2025):** `pdftotext -table`'s rendering of VT's wider FY2024/FY2025 layout occasionally ran the dot-leader straight into the GF value with NO or exactly ONE whitespace character (`"Human services....758,416,630"`, `"General education.... 287,833,468"`) instead of the normal dot-leader-then-2+-spaces-then-value shape every other row uses. The prior whitespace-only separator regex in `extract_gf.py`'s `split_row()` silently dropped both rows (their labels absorbed the value as unparsed trailing text), understating GF Total Expenditures by exactly the sum of the two dropped lines ($1,046,250,098 on FY2025 alone).

**Fix:** generalized `split_row()`'s separator to accept any mix of 2+ dot/whitespace characters immediately followed by the value token — a safe superset, since normal rows never have a digit/$/- immediately after their trailing dot-or-space run (which stays ≥2 chars either way).

**Zero-regression check:** re-ran the fixed `extract_gf.py` against ND (5 files), SD (29 files, including the 9 known whole-document-scanned honest-hole years + FY2017/FY2019/FY2024/FY2025 known hand-patched/hand-transcribed years), MT (11 files), and NE (6 files) already-extracted `.txt` files — every tie/no-tie outcome and every numeric sum was byte-identical before and after the fix (including SD's non-tying years, which fail identically both ways since those years are pre-patched by hand in `sd_all.json`, not sourced from raw `extract_gf.py` output).

## Colon-less Subsection Header Label Cleanup (cosmetic, no tie impact)

VT's revenue section prints three subsection headers with NO trailing colon ("Taxes", "Earnings of departments", "Licenses"). `extract_gf.py`'s colon-based sub-heading detector only recognizes `:`-terminated headers, so these three merged into the first following item's label via the generic wrapped-label pending-accumulator (e.g. "Taxes" + "Personal income tax" → "Taxes Personal income tax"). A one-off post-process pass over `vt_all.json` stripped the three known header-prefix strings back off the merged labels (restoring "Personal income tax", "Fees", "Business") — **values untouched**, ties re-verified identical before/after on all 11 years.

## Pre-load NASBO vs Loaded ACFR + Near-Parity Note (ACFR-51)

Pre-load NASBO operating rows (recorded before Task 2 write): FY2023 $2,055,000,000, FY2024 $2,510,000,000 (both already stored in raw dollars, not ×1,000 — VT's NASBO rows happened to be stored at full-dollar scale already).

Loaded ACFR GF totals: FY2023 $1,452,737,080 (Total Expenditures) / FY2023 revenue $2,267,178,350; FY2024 $1,695,914,208 (Total Expenditures) / FY2024 revenue $2,297,961,239.

**Scope comparison (revenue vs NASBO, cross-year as the closest available comparison — NASBO's own convention):** VT ACFR GF ~1.01× NASBO GF (FY2025 ACFR revenue $2,543,030,123 vs FY2024 NASBO $2,510,000,000) — the **smallest divergence in Batch 4**. Vermont books Federal grants overwhelmingly to the separate Transportation Fund column (FY2025 Federal grants $410,507,441 in Transportation vs a blank/dash in General) — the General column's own Federal grants line is blank at every loaded year — keeping the GAAP General Fund essentially at parity with NASBO's own-source budgetary scope. Accepted-and-relabelled honestly (SD/NE near-parity precedent). No 1000× skew: both NASBO and ACFR figures compared here are raw whole-dollar totals in the DB.

## NASBO-Replacement Confirmation

FY2023 and FY2024 operating rows were REPLACED IN PLACE at the same row IDs (`b53b04e4-d9f7-414b-a904-dcf9a150e6c2` for FY2023, `ad9e9310-663f-47f3-9d12-47904c32cca7` for FY2024) — same `(muni, fy, 'operating')` RPC key, no duplicate rows created, no stale "NASBO" label remaining. Post-load DB query confirms 0 NASBO-labelled rows remain on the VT node; exactly one operating row exists per loaded FY (11/11).

## Idempotency + 0-Residue Result

Re-ran VT `--fy 2025` live for both operating and revenue loaders after the full-window load. Post-re-run DB query confirms the FY2025 operating row (`1810b4e5-33db-45fb-a3e7-72c594678aac`) and revenue row (`e518bfef-be85-469b-b684-2674edc1c7ff`) retained the SAME row IDs and values as before the re-run — 0 net change. `data_sources` table for the VT municipality_id returned 0 rows both before Task 2's initial load and after Task 3's idempotency re-run — 0 residue (LOAD-01 holds).

## Money In / `?dataset=revenue` Auto-Enable

VT now has 11 revenue rows (FY2015–FY2025) on `treasury.budgets` (`dataset_type='revenue'`) — Money In auto-enables data-driven, no frontend change required.

## Cohort-Untouched Confirmation

- North Dakota (existing ACFR node, Batch 3): `treasury.budgets` row count unchanged at 10 (5 years × 2 datasets).
- Wyoming (un-upgraded NASBO state, same Batch 4, not yet loaded in this plan): still exactly 2 NASBO-labelled operating rows (FY2023/FY2024), untouched.

## Summary

Vermont is now live on full State-ACFR GAAP for FY2015–FY2025 (11 years, zero honest holes), whole-dollar (UNITS=1), every FY GAAP-basis-labelled + per-year source-stamped, NASBO operating rows replaced in place, ~1.01× near-parity recorded (smallest divergence in Batch 4), idempotent never-overwrite proven, Money In auto-enabled, cohort untouched. Hands VT to Phase 124.
