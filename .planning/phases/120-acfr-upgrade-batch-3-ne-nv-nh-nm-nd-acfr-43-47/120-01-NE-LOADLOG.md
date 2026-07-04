# 120-01 NE — Nebraska ACFR Load Log (ACFR-43)

**Status:** COMPLETE — NE live on full State-ACFR GAAP, FY2020–FY2025, all 6 target years,
$0 spend.
**Node:** Nebraska `ccfb8751-ae32-4974-96a9-d8c8ea85a898` · **Units:** thousands (UNITS=1000) ·
**FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2020–FY2025 (6 years, the full recon target window, zero honest holes) —
  operating + revenue = **12 rows**, every FY tie-verified at $0 diff on BOTH the printed
  GENERAL FUND "Total expenditures" line and the "Total revenues" line.
- **Bookends (GENERAL FUND Total revenues tie):** FY2025 **$6,308,910,000** confirmed live in
  `treasury.budgets` (dataset_type='revenue'); FY2020 **$4,993,719,000** confirmed live — both
  exact ($0 diff), matching the recon's pinned bookends.
- **NASBO replaced in place:** FY2023 NASBO operating $5,154,000,000 → ACFR operating
  $5,588,274,000 (row id `00759bf2-bf3a-48c4-8ffa-269270ffdaf5`, UNCHANGED before/after —
  confirmed UPDATE not insert+delete); FY2024 NASBO operating $5,314,000,000 → ACFR operating
  $6,327,646,000 (row id `f82832ae-7a52-4bed-ab56-10783832b2df`, UNCHANGED before/after). 0
  "NASBO" labels remain anywhere on the NE node; exactly one operating row per (NE, fy).
- **Accept-and-relabel scope divergence (~1.19x, the smallest in Batch 3):** FY2025 ACFR GF
  Total revenues $6,308,910K vs FY2024 NASBO operating $5,314,000K ≈ 1.19x. Nebraska's General
  Fund is ~91% own-source (Income Taxes $3,094,901K + Sales and Use Taxes $2,619,973K, FY2025);
  Federal Grants and Contracts is only $157K (~0.002%) of the GF — federal flows are booked to
  the separate FEDERAL major-fund column, not General. Accepted-and-relabelled honestly
  (OH/VA/IN/KS near-parity precedent); GAAP basis label confirmed on every live row.
- **FY2020 clamp note (P2):** "Other Taxes" = **-$193,000** (thousands; a real GAAP-basis minor
  tax refund/adjustment, not an extraction artifact) rendered at 0 via `clampForRender`, signed
  magnitude preserved in the category label. Every other loaded year's "Other Taxes" line is
  positive (FY2025 +$136K, FY2021–2024 range +$126K to +$747K). FY2022's "Investment Income"
  is also negative (-$191,405K, a real GAAP fair-value loss) and routes through the same clamp.
  No year shows a negative GF Total revenues.
- **Idempotency:** re-ran NE `--fy 2025` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both (this RPC's `rows_inserted` reporting artifact is documented
  precedent — see 119-04-MS-LOADLOG.md — appearing identically on first-load and re-run, not a
  load-vs-no-op discriminator). DB confirms exactly the same 2 row `id`s for (NE, FY2025)
  afterward (operating `1363baed-85ff-484c-86cb-528346d85bc8`, revenue
  `414ca110-ce03-4d81-84b8-0d38378ebb9a`), same totals — **0 net change**.
- **0 `data_sources` residue (LOAD-01):** confirmed via direct DB query —
  `treasury.data_sources WHERE dataset_id ILIKE 'ne-%'` returns 0 rows after the run (checked
  both after the initial live load and after the idempotency re-run).
- **Money In auto-enabled:** NE has 6 `dataset_type='revenue'` rows (data-driven, no frontend
  change needed).
- **Cohort untouched (spot-check):** California (`e1007bf5-bac9-4b1c-878e-f6834885f850`, 36
  rows, `California State ACFR — General Fund[...]` labels) and Alaska (Batch 1 sibling,
  `b268c415-0058-4fea-8ba1-24f49fb434b4`, 40 rows, `Alaska State ACFR — General Fund[...]`
  labels) unchanged; Wyoming (un-upgraded, `4009951b-8a23-457e-9591-1597356dfe34`) still carries
  exactly its 2 pre-existing `NASBO State Expenditure Report` operating rows (FY2023/FY2024),
  untouched.
- **Extractor bug fixed generically (ACFR-43, reusable):** the FY2024 PDF's `pdftotext -table`
  output rendered the blank-GF-cell placeholder glyph as an invalid standalone UTF-8 byte
  (0xAD, soft hyphen) instead of the ASCII `-`/`--` dash token used by NE's own other 5 years
  and every other loaded state. Decoded with `errors='ignore'` the old way, that byte vanished
  entirely rather than leaving an explicit blank marker, silently shifting a LATER major-fund
  column's real value into an EARLIER blank General-Fund cell's position (FY2024 "Petroleum
  Taxes"/"Surcharge" wrongly picked up Highway's/Nonmajor's values on first extraction attempt).
  Fixed in `extract_gf.py`: read with `errors='replace'` (invalid byte → single U+FFFD,
  preserving column position) and recognize U+FFFD as a DASH_TOKEN. Verified zero regression on
  NE's own other 5 years and a spot-check of KS/MT (still tie exactly).

## DB verification detail (mcp-equivalent direct query, no manual Dashboard)

- Pre-load: 2 NE rows (both NASBO operating, FY2023/FY2024), 0 `ne-%` data_sources rows.
- Post-load: 12 NE rows (6 operating + 6 revenue), all GAAP-basis-labelled, all non-null
  `source_url`/`source_date`, 0 `ne-%` data_sources rows.
- Post-idempotency-re-run: still 12 NE rows, identical row `id`s and totals, 0 `ne-%`
  data_sources rows.

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue (Total revenues) | GF Spending (operating, Total expenditures) |
|-------------|------------------------------|----------------------------------------------|
| FY2020 | $4,993,719,000 | $4,751,700,000 |
| FY2021 | $5,915,992,000 | $4,818,326,000 |
| FY2022 | $6,060,843,000 | $5,031,866,000 |
| FY2023 | $6,219,850,000 | $5,588,274,000 (was NASBO $5,154,000,000) |
| FY2024 | $6,826,088,000 | $6,327,646,000 (was NASBO $5,314,000,000) |
| FY2025 | $6,308,910,000 | $7,776,942,000 |

Loaders: `scripts/processNEAcfr.js` + `scripts/processNERevenueAcfr.js` (gen_state.py
`CONFIGS['NE']`, node `ccfb8751-ae32-4974-96a9-d8c8ea85a898`, UNITS=1000, no `rev_boundary`
needed — NE's revenue lines carry no subsection headers).
