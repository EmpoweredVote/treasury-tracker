# 120-05 ND — North Dakota ACFR Load Log (ACFR-47)

**Status:** COMPLETE — ND live on full State-ACFR GAAP, FY2021–FY2025, all 5 target years,
$0 spend.
**Node:** North Dakota `e84aafe0-eeaa-470a-8fd3-708c88af2a80` · **Units:** dollars (UNITS=1) ·
**FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2021–FY2025 (5 years, the full recon target window, zero honest holes) —
  operating + revenue = **10 rows**, every FY tie-verified at $0 diff on BOTH the printed
  GENERAL FUND "Total expenditures" line and the "Total revenues" line.
- **Bookends (GENERAL FUND Total revenues tie):** FY2025 **$4,510,201,793** confirmed live in
  `treasury.budgets` (dataset_type='revenue'); FY2021 **$3,955,670,947** confirmed live — both
  exact ($0 diff), matching the recon's pinned bookends. Units confirmed DOLLARS (UNITS=1), not
  thousands — the ND units trap avoided.
- **FY2021 `-nd`-suffix note:** the FY2021 ACFR PDF is hosted at a filename exception —
  `.../cafr/2021-acfr-nd.pdf` (adds an `-nd` suffix not present in FY2022–FY2025's plain
  `{YYYY}-acfr.pdf` pattern). Fetched successfully via the special-cased URL in the SOURCES map
  (`_acfr-work/gen_state.py` `CONFIGS['ND']`); confirmed real PDF (%PDF magic, 18.5MB).
- **Annual-vs-biennial resolved:** North Dakota adopts its budget biennially but publishes GAAP
  financials annually — every FY2021–FY2025 has its own individually-dated single-year ACFR on
  `omb.nd.gov`, each an audited annual GAAP statement (June 30 FY-end). The D-03 biennial-budget
  concern does NOT apply to the audited ACFR; no FY was split or doubled.
- **NASBO replaced in place:** FY2023 NASBO operating $2,436,000,000 → ACFR operating
  $2,121,435,902 (row id `8b4e9279-c314-477a-b440-4a85a83eaf04`, UNCHANGED before/after —
  confirmed UPDATE not insert+delete); FY2024 NASBO operating $2,876,000,000 → ACFR operating
  $2,545,285,814 (row id `79335837-6002-4add-be0a-cf4669291be4`, UNCHANGED before/after). 0
  "NASBO" labels remain anywhere on the ND node; exactly one operating row per (ND, fy).
- **Accept-and-relabel scope divergence (~1.57x, the mildest in Batch 3):** FY2025 ACFR GF
  Total revenues $4,510,201,793 vs FY2024 NASBO operating $2,876,000,000 ≈ 1.57x. North Dakota's
  General Fund is dominated by own-source Sales and Use Taxes ($1,346,955,054 FY2025) + Oil,
  Gas, and Coal Taxes ($750,043,102 FY2025); most federal intergovernmental revenue is booked to
  the separate "Federal" special-revenue fund column (General's own "Intergovernmental" line is
  only $874,624 FY2025). Accepted-and-relabelled honestly (NE/OH/VA near-parity precedent); GAAP
  basis label confirmed on every live row.
- **FY2022 clamp note (P2, the tranche's live clamp exercise for ND):** "Interest and Investment
  Income (Loss)" went NEGATIVE in FY2022 only: **-$897,827,062** (dollars — a real GAAP
  fair-value-of-investments loss, not an extraction artifact) rendered at 0 via
  `clampForRender`, signed magnitude preserved in the category label. Both bookend years are
  positive (FY2025 +$1,595,980,317 / FY2021 +$1,674,078,872, matching the recon's "none observed
  in either bookend" finding — this negative is an interior-year discovery made during this
  load). No year shows a negative GF Total.
- **Idempotency:** re-ran ND `--fy 2025` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both (this RPC's `rows_inserted` reporting artifact is documented
  precedent — see 119-04-MS-LOADLOG.md / 120-01-NE-LOADLOG.md — appearing identically on
  first-load and re-run, not a load-vs-no-op discriminator). DB confirms exactly the same 2 row
  `id`s for (ND, FY2025) afterward (operating `4793f012-bf7f-4d75-b618-1372e8416512`, revenue
  `eee7b650-094b-44ed-9894-bc28d988cc45`), same totals — **0 net change**.
- **0 `data_sources` residue (LOAD-01):** confirmed via direct DB query —
  `treasury.data_sources WHERE dataset_id ILIKE 'nd-%' OR municipality_id = ND` returns 0 rows
  after the run (checked both after the initial live load and after the idempotency re-run).
- **Money In auto-enabled:** ND has 5 `dataset_type='revenue'` rows (data-driven, no frontend
  change needed).
- **Cohort untouched (spot-check):** California (`e1007bf5-...`, ACFR-sourced sample rows
  reconfirmed unchanged — FY2025 revenue $221,591,201,000 / operating $221,826,907,000) and
  Alaska (Batch 1 sibling, `b268c415-0058-4fea-8ba1-24f49fb434b4`, FY2025 revenue
  $8,378,945,000 / operating $12,373,317,000, matching gen_state.py's recorded bookend) both
  unchanged; Wyoming (un-upgraded, `4009951b-8a23-457e-9591-1597356dfe34`) still carries exactly
  its 2 pre-existing `NASBO State Expenditure Report` operating rows (FY2023 $1,525,000,000 /
  FY2024 $1,654,000,000), untouched.
- **Clean extraction:** all 5 years FY2021–FY2025 tied to $0 diff on BOTH the revenue and
  expenditure printed GENERAL FUND totals on the FIRST extraction pass — zero honest holes. Only
  cosmetic normalization needed: `pdftotext -table` renders "Individual and Corporate Income
  Taxes" with 1–4 stray internal spaces across different years (already handled generically by
  `gen_state.py`'s `norm()` whitespace collapse, no per-year patch); FY2023's null-valued "Bond
  and Note Cost of Issuance" line dropped by the standard v-is-None filter (no phantom zero-row).

## DB verification detail (ad-hoc `@supabase/supabase-js` script, deleted before final commit —
mcp-equivalent direct query, no manual Dashboard)

- Pre-load: 2 ND rows (both NASBO operating, FY2023/FY2024, `$2,436,000,000` /
  `$2,876,000,000`), 0 `nd-%` data_sources rows.
- Post-load: 10 ND rows (5 operating + 5 revenue), all GAAP-basis-labelled, all non-null
  `source_url`/`source_date`, 0 `nd-%` data_sources rows.
- Post-idempotency-re-run: still 10 ND rows, identical row `id`s and totals for FY2025
  (spot-checked), 0 `nd-%` data_sources rows.

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue (Total revenues) | GF Spending (operating, Total expenditures) |
|-------------|------------------------------|----------------------------------------------|
| FY2021 | $3,955,670,947 | $1,872,868,491 |
| FY2022 | $2,408,848,192 | $1,999,504,703 |
| FY2023 | $3,950,313,589 | $2,121,435,902 (was NASBO $2,436,000,000) |
| FY2024 | $4,782,318,061 | $2,545,285,814 (was NASBO $2,876,000,000) |
| FY2025 | $4,510,201,793 | $2,598,549,548 |

Loaders: `scripts/processNDAcfr.js` + `scripts/processNDRevenueAcfr.js` (gen_state.py
`CONFIGS['ND']`, node `e84aafe0-eeaa-470a-8fd3-708c88af2a80`, UNITS=1, no `rev_boundary`
needed — ND's revenue lines carry no subsection headers, every tax line already ends in the
word "Taxes" in its own printed label).
