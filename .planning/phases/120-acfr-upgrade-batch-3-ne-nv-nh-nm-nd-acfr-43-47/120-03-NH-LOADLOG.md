# 120-03 NH — New Hampshire ACFR Load Log (ACFR-45)

**Status:** COMPLETE — NH live on full State-ACFR GAAP, FY2017–FY2024 (full recon target
window, zero honest holes), $0 spend.
**Node:** New Hampshire `c54f6dbd-3f2a-453e-b0b9-259e377aef67` · **Units:** THOUSANDS
(UNITS=1000) · **FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2017–FY2024 (8 years, the full recon target window, zero honest holes) —
  operating + revenue = **16 rows**, every FY tie-verified at $0 diff on BOTH the printed
  GENERAL FUND "Total expenditures" line and the "Total revenues" line.
- **Akamai edge-block / Wayback-proxy fetch note:** `das.nh.gov`, `www.das.nh.gov`, and
  `www.nh.gov` all returned HTTP 403 "Access Denied" (Akamai `errors.edgesuite.net`) to every
  automated `curl`/fetch variant tried (multiple full browser User-Agent strings,
  Accept/Accept-Language/sec-fetch-*/Referer headers) — a harder bot-block than the `tn.gov`
  precedent (header-spoofing alone was insufficient here). All 8 PDFs were instead fetched via
  the Internet Archive Wayback Machine mirror (`https://web.archive.org/web/{timestamp}if_/
  {original-das.nh.gov-url}`, the `if_` raw-content modifier), which is NOT Akamai-blocked. Each
  year's timestamp was resolved individually via the Wayback CDX API
  (`web.archive.org/cdx/search/cdx?url=...&output=json&filter=statuscode:200`) — never guessed.
  Every `source_url` stored on the live `treasury.budgets` rows is the durable Wayback mirror
  URL (not a synthetic host), so the citation stays honest and points at the real archived
  original. All 8 downloaded files verified as real PDFs (%PDF magic, 4.9MB–12.6MB, well above
  the 500KB soft-404 threshold) via `build_state.py`'s download guard.
- **Bookends (GENERAL FUND Total revenues tie):** FY2024 **$6,377,159,000** confirmed live in
  `treasury.budgets` (dataset_type='revenue'); FY2017 **$4,207,160,000** confirmed live — both
  exact ($0 diff), matching the recon's pinned bookends. Values stored ×1,000 (UNITS=1000,
  NH's printed statement is in thousands).
- **NASBO replaced in place:** FY2023 NASBO operating $2,136,000,000 → ACFR operating
  $6,414,896,000 (row id `177ce096-2c78-4e90-9223-934ecfa4c016`, UNCHANGED before/after —
  confirmed UPDATE not insert+delete); FY2024 NASBO operating $1,981,000,000 → ACFR operating
  $6,492,697,000 (row id `3e142249-5967-4d10-95f7-8516395c2924`, also UNCHANGED before/after).
  0 "NASBO" labels remain anywhere on the NH node; exactly one operating row per (NH, fy) across
  all 8 fiscal years (2017–2024).
- **Accept-and-relabel scope divergence (~3.22x, the WIDEST in Batch 3):** FY2024 ACFR GF Total
  revenues $6,377,159,000 vs FY2024 NASBO operating $1,981,000,000 ≈ 3.22x. "Federal Government"
  = $3,065,572,000 (48% of GF revenue) plus "Special Taxes" = $1,792,670,000 (Medicaid
  Enhancement Tax + business taxes — NH has no broad sales or income tax) are both consolidated
  directly into the GENERAL column. Accepted-and-relabelled honestly (TX precedent); GAAP basis
  label confirmed on every live row.
- **Negative-line scan:** no negative GF line items observed on either the revenue or
  expenditure side in ANY of the 8 loaded years (full-cohort scan, not just bookends) — matches
  the recon's "none observed in either bookend" finding exactly. The P2 `clampForRender` path
  stays wired per ACFR-32 as the tranche-standard safety net, unexercised for NH.
- **Idempotency:** re-ran NH `--fy 2024` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both (this RPC's `rows_inserted` reporting artifact is documented
  precedent — see 119-04-MS-LOADLOG.md / 120-01-NE-LOADLOG.md / 120-02-NV-LOADLOG.md — appearing
  identically on first-load and re-run, not a load-vs-no-op discriminator). DB confirms exactly
  the same 2 row `id`s for (NH, FY2024) afterward (operating
  `3e142249-5967-4d10-95f7-8516395c2924`, revenue `c1e3fe6e-7ef7-4d36-9546-81018cecb08e`), same
  totals — **0 net change**.
- **0 `data_sources` residue (LOAD-01):** confirmed via direct DB query —
  `treasury.data_sources WHERE dataset_id ILIKE 'nh-%'` returns 0 rows after the run (checked
  both after the initial live load and after the idempotency re-run).
- **Money In auto-enabled:** NH has 8 `dataset_type='revenue'` rows (FY2017–FY2024, data-driven,
  no frontend change needed).
- **Cohort untouched (spot-check):** California (`e1007bf5-bac9-4b1c-878e-f6834885f850`, FY2025
  revenue $221,591,201,000 / operating $221,826,907,000) and Alaska (Batch 1 sibling,
  `b268c415-0058-4fea-8ba1-24f49fb434b4`, FY2025 revenue $8,378,945,000 / operating
  $12,373,317,000) unchanged; West Virginia (un-upgraded NASBO state) still carries exactly its
  2 pre-existing `NASBO State Expenditure Report` operating rows (FY2023 / FY2024), untouched.

## DB verification detail (direct `@supabase/supabase-js` query — mcp__supabase-local tools not
available in this environment; ad-hoc verification scripts deleted before final commit, per
plan efficiency note)

- Pre-load: 2 NH rows (both NASBO operating, FY2023 $2,136,000,000 / FY2024 $1,981,000,000),
  0 `nh-%` data_sources rows.
- Post-load: 16 NH rows (8 operating [FY2017–2024, all GAAP] + 8 revenue [FY2017–2024]), all
  GAAP-basis-labelled, all non-null `source_url` (Wayback URLs) / `source_date`, 0 `nh-%`
  data_sources rows. Exactly one operating row per (NH, fy); zero remaining "NASBO" labels.
- Post-idempotency-re-run: still 16 NH rows, identical row `id`s and totals for (NH, FY2024),
  0 `nh-%` data_sources rows.
- Honest-hole FYs: none — all 8 years FY2017–2024 tied exactly on the first extraction pass
  (no interior gaps, no pre-window skips within the target window).

## Per-FY totals loaded (raw dollars, ×1,000 from the printed thousands)

| Fiscal Year | GF Revenue (Total revenues) | GF Spending (operating, Total expenditures) |
|-------------|------------------------------|----------------------------------------------|
| FY2017 | $4,207,160,000 | $4,279,104,000 |
| FY2018 | $4,396,666,000 | $4,462,815,000 |
| FY2019 | $4,427,405,000 | $4,521,314,000 |
| FY2020 | $4,406,863,000 | $4,613,575,000 |
| FY2021 | $5,307,432,000 | $5,099,364,000 |
| FY2022 | $6,157,189,000 | $5,966,059,000 |
| FY2023 | $6,555,538,000 | $6,414,896,000 (was NASBO $2,136,000,000) |
| FY2024 | $6,377,159,000 | $6,492,697,000 (was NASBO $1,981,000,000) |

Loaders: `scripts/processNHAcfr.js` + `scripts/processNHRevenueAcfr.js` (gen_state.py
`CONFIGS['NH']`, node `c54f6dbd-3f2a-453e-b0b9-259e377aef67`, UNITS=1000 — thousands, no
`rev_boundary` needed — NH's revenue lines carry no subsection headers, raw labels already read
as complete tax names e.g. "Special Taxes", "Non-Business License Taxes"). All 8 PDFs and
`pdftotext -table` outputs assembled into `_acfr-work/nh/nh_all.json` via `_acfr-work/
build_state.py` against a per-year job manifest of Wayback mirror URLs.
