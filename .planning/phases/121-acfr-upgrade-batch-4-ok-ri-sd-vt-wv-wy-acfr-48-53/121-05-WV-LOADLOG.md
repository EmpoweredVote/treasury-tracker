# 121-05 West Virginia (WV) ACFR Load Log — ACFR-52

State: West Virginia | Node: `e21923d7-ad99-4711-b765-255b9807c059` | Source: WV Dept. of Finance (finance.wv.gov)

## Load Disposition

| FY | Status | GF Total Revenues | GF Total Expenditures | Source URL (media ID) |
|----|--------|-------------------:|------------------------:|------------|
| 2020 | LOADED (NASBO not present pre-load) | $10,760,376,000 | $10,752,235,000 | media/10646 |
| 2021 | LOADED | $13,150,666,000 | $12,419,500,000 | media/10521 |
| 2022 | LOADED | $15,897,139,000 | $14,086,000,000 | media/10236 |
| 2023 | LOADED (NASBO replaced in place) | $16,237,664,000 | $15,250,429,000 | media/10251 |
| 2024 | LOADED (NASBO replaced in place) | $13,670,366,000 | $14,141,182,000 | media/10261 |
| 2025 | LOADED | $14,639,897,000 | $15,065,132,000 | media/37441 |

**Window:** FY2020–FY2025 (6 years, the full recon target window — shallow window, MD/GA precedent, D-12 no minimum depth beyond the recency floor). **ZERO honest holes** — every year tied $0 diff on both the revenue and expenditure printed GENERAL column totals on the FIRST extraction pass, zero hand-patches required.

**Bookends confirmed (thousands×1,000, UNITS=1000):** FY2025 revenue $14,639,897,000 / FY2020 revenue $10,760,376,000 — both exact matches to the plan's pinned bookends.

## Opaque Drupal Media-ID URLs (no derivable pattern)

Every year's ACFR is served at a non-derivable `finance.wv.gov/media/{id}/download?inline` path — all 6 URLs enumerated from the landing page (`https://finance.wv.gov/annual-comprehensive-financial-report-acfr`) per the 117-BATCH4-SOURCES.md WV Detail Block, never guessed from the FY:

- FY2025: `media/37441`
- FY2024: `media/10261`
- FY2023: `media/10251`
- FY2022: `media/10236`
- FY2021: `media/10521`
- FY2020: `media/10646`

All 6 PDFs confirmed real (`%PDF` magic, 5.3MB–12.2MB each, no soft-404s). Landing page re-checked live at load time (2026-07-05) via a fresh fetch — confirmed exactly the 6 known media IDs present, no newly-added older years discoverable within the current page.

## Single "Taxes:" Header (SC/MS/MT precedent, WV's own instance)

WV's printed Governmental Funds statement puts one "Taxes:" subsection header ahead of ALL revenue line items (confirmed across all 6 loaded years FY2020–FY2025), with no closing header before the non-tax lines that follow. `gen_state.py`'s `rev_boundary='Intergovernmental'` clears the sub-heading at the first genuinely non-tax line (present in the same position every loaded year, immediately after the tax lines) so only the true tax lines (Personal Income, Consumer Sales and Use, Severance, Corporate Net Income, Business and Occupation, Medicaid, catch-all "Other") get the " taxes" suffix — "Intergovernmental" is never mislabeled "Intergovernmental taxes". A second catch-all "Other" line prints after the boundary (non-tax, stays plain "Other") — no name collision with the pre-boundary "Other Taxes".

## Category-Name Evolution (real GAAP relabeling, not extraction defects)

Confirmed against each year's own raw statement text — every year still ties exactly to its own printed GF total regardless of naming drift:

- **Revenue side:** the SNAP/food-assistance line reads "Food Stamp Revenue" FY2020–FY2022, then "SNAP Revenue" FY2023–FY2025 (same underlying program).
- **Expenditure side:** "Military Affairs and Public Safety" (FY2020) becomes "Homeland Security" (FY2021+); "Health and Human Resources" (FY2020–2023) becomes "Health, Health Facilities, and Human Services" (FY2024–2025); several functions (Arts/Culture/History, Economic Development, Employment Programs, Environmental Protection, Tourism) appear/disappear across years as the state reorganizes agency reporting lines.

## Extraction Result — Zero Hand-Patches

All 6 years extracted cleanly via `extract_gf.py`'s standard position-anchor with no code changes required. `rev_tie`/`exp_tie` both `true` on the raw extractor output for all 6 files on the first pass — no wrapped labels, no OCR/font defects, no dual-subsection collisions. 5-column layout (General | Transportation | Tobacco Settlement Finance Authority | State Road | Other Governmental Funds | Total) — `extract_gf.py`'s position-anchor isolated General regardless of the total column count.

## Negative-Line / P2 Clamp Note (ACFR-32)

"Investment Earnings" went NEGATIVE in FY2022 only: -$92,660K (thousands), confirmed printed as `(92,660)` in the raw source PDF text — a real GAAP fair-value-of-investments loss, not an extraction artifact. Every other loaded year is positive (FY2025 +$352,526K / FY2020 +$96,028K, the recon-confirmed bookends). The P2 clamp (`clampForRender`) rendered the FY2022 line at $0 with the signed magnitude preserved in the label; FY2022's category-sum still ties exactly to the printed $15,897,139K total. No year shows a negative GF Total revenues.

## Pre-load NASBO vs Loaded ACFR + ~3.52× Accept-Relabel Note (ACFR-52)

Pre-load NASBO operating rows (recorded before Task 2 write): FY2023 $3,943,000,000, FY2024 $4,164,000,000 (row IDs `aa24e6ef-ac0c-492f-9895-82aeb24dbc20` and `67f02823-f596-4087-8353-d52378c73775`).

Loaded ACFR GF totals: FY2023 Total Expenditures $15,250,429,000 / FY2023 Total Revenues $16,237,664,000; FY2024 Total Expenditures $14,141,182,000 / FY2024 Total Revenues $13,670,366,000.

**Scope comparison:** WV ACFR GF ~3.52× NASBO GF for the closest matched year (FY2024 ACFR revenue $13,670,366,000 vs FY2024 NASBO operating $4,164,000,000) — consolidating nearly all state general-purpose taxes AND a very large Intergovernmental federal-passthrough line (FY2025: $6,918,845K, ~47% of GF total revenues) into a single General Fund column. NASBO's narrower budgetary concept excludes most of that federal-passthrough activity. **2nd-largest divergence in Batch 4** (behind OK's ~3.35× by ratio label, comparable in magnitude). Accepted-and-relabelled honestly (OK/MS/TX precedent), documented prominently in `processWVAcfr.js`/`processWVRevenueAcfr.js` head comments.

## NASBO-Replacement Confirmation

FY2023 and FY2024 operating rows were REPLACED IN PLACE at the same row IDs (`aa24e6ef-ac0c-492f-9895-82aeb24dbc20` for FY2023, `67f02823-f596-4087-8353-d52378c73775` for FY2024) — same `(muni, fy, 'operating')` RPC key, no duplicate rows created, no stale "NASBO" label remaining. Post-load DB query confirms 0 NASBO-labelled rows remain on the WV node; exactly one operating row exists per loaded FY (6/6).

## Idempotency + 0-Residue Result

Re-ran WV `--fy 2025` live for both operating and revenue loaders after the full-window load. Post-re-run DB query confirms the FY2025 operating row (`9907140d-7da8-46e1-ae09-af3d4bfbbbd3`) and revenue row (`295694f2-970d-4ce8-b7de-53aef7f5a860`) retained the SAME row IDs and values as before the re-run — 0 net change. Total WV `treasury.budgets` row count = 12 (6 op + 6 rev) both before and after the re-run. `data_sources` table filtered on `dataset_id ilike 'wv-%'` returned 0 rows before Task 2's initial load and 0 rows after Task 3's idempotency re-run — 0 residue (LOAD-01 holds).

## Money In / `?dataset=revenue` Auto-Enable

WV now has 6 revenue rows (FY2020–FY2025) on `treasury.budgets` (`dataset_type='revenue'`) — Money In auto-enables data-driven, no frontend change required.

## Cohort-Untouched Confirmation

- Oklahoma (existing ACFR node, same Batch 4, Plan 121-01): FY2024 rows unchanged (operating $30,421,436,000, revenue $30,604,464,000).
- Vermont (existing ACFR node, same Batch 4, Plan 121-04): FY2025 operating row unchanged ($1,627,200,216).
- Wyoming (un-upgraded NASBO state, same Batch 4, not yet loaded — Plan 121-06): still exactly 2 NASBO-labelled operating rows (FY2023/FY2024), untouched.

## Summary

West Virginia is now live on full State-ACFR GAAP for FY2020–FY2025 (6 years, zero honest holes), thousands-scaled (UNITS=1000), every FY GAAP-basis-labelled + per-year source-stamped, NASBO operating rows replaced in place, ~3.52× accept-and-relabel divergence recorded (2nd-largest in Batch 4), idempotent never-overwrite proven, Money In auto-enabled, cohort untouched. Hands WV to Phase 124.
