# 121-03 SD — South Dakota ACFR Load Log (ACFR-50)

**Status:** COMPLETE — SD live on full State-ACFR GAAP, FY2002–FY2025, all 24 target years,
$0 spend.
**Node:** South Dakota `e7273079-b392-449d-af38-d2e4d0df73e0` · **Units:** thousands
(UNITS=1000) · **FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2002–FY2025 (24 years — the FULL recon target window, ZERO honest holes)
  — operating + revenue = **48 rows**, every FY tie-verified at $0 diff on BOTH the printed
  GENERAL FUND "Total Revenue" line and "Total Expenditures" line.
- **Bookends (GENERAL FUND column Total Revenue tie):** FY2025 **$2,423,413,000** confirmed
  live in `treasury.budgets` (dataset_type='revenue'); FY2002 **$697,589,000** confirmed live —
  both exact ($0 diff), byte-identical to the preserved 117 recon. Units confirmed THOUSANDS
  (UNITS=1000).
- **Zero honest holes:** unlike every other Batch 4 state, SD's full 24-year recon target
  window (FY2002–FY2025) loaded completely — no 404s, no unextractable years left out.

### Extractor bugs found + fixed (shared `extract_gf.py` fixes, T-121-03-B)

1. **Singular section-header/total-row labels (SD-discovered, reusable):** SD's printed
   statement uses the SINGULAR `Revenue:` section header and `Total Revenue` row label (no
   trailing "s"), unlike every other cohort state's plural `Revenues:`/`Total Revenues`. The
   prior hardcoded plural-only match in `extract_gf.py` silently returned zero revenue items
   and a null total for every single SD year. Fixed generically: match the singular stem
   (`revenue`/`totalrevenue`, a safe superset that also matches the plural forms) in both
   `find_anchor()` and the section-header/total-row detection in `extract()`. Re-verified zero
   regression against the whole already-loaded cohort (every prior state already used the
   plural form, so the widened match is a no-op for them).

### Whole-document scanned/unrenderable PDFs (9 years — generalizes the IA FY2008 precedent from a single year to a systematic pattern)

FY2003, FY2004, FY2005, FY2006, FY2007, FY2008, FY2009, FY2010, and FY2011 all produced
zero or near-zero usable text from `pdftotext` across the ENTIRE document (not just the
statement page):
- FY2003–2006 and FY2010: `pdffonts`/`pdfimages` confirm ZERO embedded fonts — every page is a
  raster image (a genuine full-document scan).
- FY2007–2009 and FY2011: `pdffonts` reports embedded fonts (with `uni=yes`), yet `pdftotext`
  (both `-table` and plain modes) still extracts to near-zero text across the whole document —
  the same practical effect as a scan, diagnosed as a font-subsetting/CID-mapping defect rather
  than a missing-glyph-map case.

All 9 years hand-transcribed directly from `pdftoppm`-rendered PNG images of the GENERAL FUND
column (150–300dpi, NM FY2022 / OK FY2019 precedent generalized from a single page to a whole
document), independently re-summed to $0 diff against the printed GENERAL FUND "Total
Revenue"/"Total Expenditures" line for **every single year** before hand-patching
`sd_all.json`. See per-year totals table below — every one ties exactly.

### Honest single-digit hand-patch (FY2017, FY2019)

Auto-extraction ties exactly on expenditures both years but silently drops a single-digit GF
"Administering Programs" revenue value (FY2017 = $2K, FY2019 = $8K) that `pdftotext -table`
renders with unusually tight column spacing relative to the label, causing the position-anchor
check to reject the cell. Re-verified against the printed page (visually confirmed present),
hand-patched into `sd_all.json`'s revenue items — both years now tie exactly $0 diff.

### Post-2021 8-column stray-space digit-split (FY2024, FY2025 — new defect this state discovered)

The wider 8-column layout (COVID-19 Federal column added from FY2021) causes `pdftotext -table`
to render some digit groups with a stray injected space (e.g. `"135, 074"` instead of
`"135,074"`), which truncates `parse_num`'s regex match and also shifts blank-GF-cell rows'
first printed token into a neighboring fund column (same class of defect as NE's DASH_TOKEN
fix, but a comma-splitting variant instead of a placeholder-glyph variant). Both years
hand-transcribed directly from 150dpi-rendered PNG images instead of patching the tokenizer (2
years only, not worth a new generic regex change); FY2025 GF Total Revenue **$2,423,413,000**
matches the 117 recon bookend exactly.

### NASBO replaced in place

FY2023 NASBO operating $2,231,000,000 → ACFR operating $2,068,824,000; FY2024 NASBO operating
$2,362,000,000 → ACFR operating $2,332,956,000. 0 "NASBO" labels remain anywhere on the SD
node; exactly one operating row per (SD, fy), 48 total rows = 24 operating + 24 revenue, 0
duplicate (fy, dataset_type) keys.

### Accept-and-relabel scope divergence (~1.03×, the SMALLEST in the entire v2.15 milestone)

FY2025 ACFR GF Total Revenue $2,423,413,000 vs FY2024 NASBO operating $2,362,000,000 ≈ 1.03×.
South Dakota's federal-passthrough revenue ("Administering Programs", $748,507K FY2025) routes
through the Transportation / Social Services Federal / COVID-19 Federal fund columns, NOT the
GENERAL FUND column, keeping GF near-parity with NASBO's narrower budgetary concept.
Accepted-and-relabelled honestly (TX/NE precedent); GAAP basis label confirmed on every live
row. This is the smallest scope divergence recorded across all of Batch 1–4 (narrower than OR's
~1.07× and NE's ~1.19×).

### FY2022 clamp note (P2, the tranche's live clamp exercise for SD)

"Use of Money and Property" revenue went NEGATIVE in FY2022 only: **-$32,246K** (a real GAAP
fair-value-of-investments loss during a rate-hike year, confirmed directly against the raw
statement text, not an extraction artifact) rendered at 0 via `clampForRender`, signed magnitude
preserved in the category label. Both bookend years are positive (FY2025 Use of Money and
Property +$127,799K / FY2002 +$23,060K, matching the recon's "no clamp needed at either
confirmed bookend" finding) — this negative is an interior-year discovery made during this
load. No year shows a negative GF Total revenues.

### Idempotency

Re-ran SD `--fy 2025` live a second time (both operating and revenue) → `Loaded 0 rows` for
both (this RPC's `rows_inserted` reporting artifact is documented precedent — see
119-04-MS-LOADLOG.md / 120-01-NE-LOADLOG.md / 120-05-ND-LOADLOG.md / 121-01-OK-LOADLOG.md —
appears identically on first-load and re-run, not a load-vs-no-op discriminator). DB confirms
exactly the same 2 row `id`s for (SD, FY2025) afterward (operating
`c38f5198-bc78-4304-9435-0a8853c4adeb`, revenue `bf7a0431-f185-4874-a3b9-dbf2f6c79199`), same
totals ($2,599,721,000 operating / $2,423,413,000 revenue) — **0 net change**.

### 0 `data_sources` residue (LOAD-01)

Confirmed via direct DB query — `treasury.data_sources WHERE municipality_id = SD` returns 0
rows after the initial live load and again after the idempotency re-run.

### Money In auto-enabled

SD has 24 `dataset_type='revenue'` rows (data-driven, no frontend change needed).

### Cohort untouched (spot-check)

- **Rhode Island** (`483f02b4-2167-4e3d-9f5c-0f3ed83be2e6`, Batch 4 sibling loaded in 121-02):
  40 rows (20 years FY2006–FY2025, op+rev) unchanged, FY2025 revenue $10,095,792,000 /
  operating $10,523,009,000 — matches 121-02's own recorded bookends.
- **Vermont** (`563d6f1c-ce2b-4071-938f-01725d283504`, Batch 4 sibling not yet loaded by this
  plan): still exactly its 2 pre-existing `NASBO State Expenditure Report` operating rows
  (FY2023 $2,055,000,000 / FY2024 $2,510,000,000), untouched.
- **California** (`e1007bf5-bac9-4b1c-878e-f6834885f850`, existing pre-v2.15 ACFR state): 36
  rows unchanged, FY2025 revenue $221,591,201,000 / operating $221,826,907,000 — matches its
  own gen_state.py-recorded bookends.

## DB verification detail (ad-hoc `@supabase/supabase-js` scripts, deleted before final commit — mcp-equivalent direct query, no manual Dashboard)

- Pre-load: 2 SD rows (both NASBO operating, FY2023/FY2024, `$2,231,000,000` /
  `$2,362,000,000`), 0 SD `data_sources` rows.
- Post-load: 48 SD rows (24 operating + 24 revenue), all GAAP-basis-labelled, all non-null
  `source_url`/`source_date`, 0 duplicate (fy, dataset_type) keys, 0 remaining NASBO labels,
  0 SD `data_sources` rows.
- Post-idempotency-re-run: still 48 SD rows, identical row `id`s and totals for FY2025
  (spot-checked), 0 SD `data_sources` rows.

## Per-FY totals loaded (raw dollars, ×1,000 from printed thousands)

| Fiscal Year | GF Revenue (Total Revenue) | GF Spending (operating, Total Expenditures) | Method |
|-------------|------------------------------|----------------------------------------------|--------|
| FY2002 | $697,589,000 | $879,803,000 | auto-extracted |
| FY2003 | $732,441,000 | $875,157,000 | hand-transcribed (scanned PDF) |
| FY2004 | $753,238,000 | $857,904,000 | hand-transcribed (scanned PDF) |
| FY2005 | $793,836,000 | $975,381,000 | hand-transcribed (scanned PDF) |
| FY2006 | $863,303,000 | $1,053,963,000 | hand-transcribed (scanned PDF) |
| FY2007 | $917,987,000 | $1,092,097,000 | hand-transcribed (scanned PDF) |
| FY2008 | $953,147,000 | $1,180,895,000 | hand-transcribed (scanned PDF) |
| FY2009 | $952,933,000 | $1,156,221,000 | hand-transcribed (scanned PDF) |
| FY2010 | $916,027,000 | $1,114,735,000 | hand-transcribed (scanned PDF) |
| FY2011 | $995,240,000 | $1,126,524,000 | hand-transcribed (scanned PDF) |
| FY2012 | $1,087,568,000 | $1,225,213,000 | auto-extracted |
| FY2013 | $1,146,458,000 | $1,278,762,000 | auto-extracted |
| FY2014 | $1,251,092,000 | $1,413,866,000 | auto-extracted |
| FY2015 | $1,237,140,000 | $1,439,978,000 | auto-extracted |
| FY2016 | $1,305,173,000 | $1,513,982,000 | auto-extracted |
| FY2017 | $1,392,218,000 | $1,598,240,000 | auto-extracted exp + hand-patched rev |
| FY2018 | $1,447,574,000 | $1,644,368,000 | auto-extracted |
| FY2019 | $1,505,314,000 | $1,678,828,000 | auto-extracted exp + hand-patched rev |
| FY2020 | $1,594,601,000 | $1,655,938,000 | auto-extracted |
| FY2021 | $1,769,432,000 | $1,635,785,000 | auto-extracted |
| FY2022 | $1,866,285,000 | $2,016,701,000 | auto-extracted (P2 clamp exercised) |
| FY2023 | $2,160,591,000 | $2,068,824,000 | auto-extracted |
| FY2024 | $2,269,333,000 | $2,332,956,000 (was NASBO $2,362,000,000) | hand-transcribed (8-col stray-space) |
| FY2025 | $2,423,413,000 | $2,599,721,000 (was NASBO absent — FY2025 not a NASBO year) | hand-transcribed (8-col stray-space) |

Loaders: `scripts/processSDAcfr.js` + `scripts/processSDRevenueAcfr.js` (gen_state.py
`CONFIGS['SD']`, node `e7273079-b392-449d-af38-d2e4d0df73e0`, UNITS=1000).
