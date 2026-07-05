# 121-01 OK — Oklahoma ACFR Load Log (ACFR-48)

**Status:** COMPLETE — OK live on full State-ACFR GAAP, FY2002–FY2024, all 23 target years,
$0 spend.
**Node:** Oklahoma `54233a91-919d-4a5f-9f24-2f9325250e64` · **Units:** thousands (UNITS=1000) ·
**FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2002–FY2024 (23 years, the full recon target window, zero honest holes
  WITHIN the window) — operating + revenue = **46 rows**, every FY tie-verified at $0 diff on
  BOTH the printed GENERAL "Total Revenues" line and "Total Expenditures" line.
- **Bookends (GENERAL column Total Revenues tie):** FY2024 **$30,604,464,000** confirmed live in
  `treasury.budgets` (dataset_type='revenue'); FY2002 **$9,568,595,000** confirmed live — both
  exact ($0 diff), byte-identical to the preserved v2.14/117 recon. Units confirmed THOUSANDS
  (UNITS=1000).
- **Honest hole (FY2025):** re-checked live at load time (2026-07-04) — `acfr-2025.pdf` returns
  HTTP 404; the OMES landing page's newest entry remains FY2024. Not a gap — normal reporting
  lag, matches the 117 recon's finding exactly. Does not block the recency floor (FY2023 +
  FY2024 both loaded). OMITTED per the plan's STOP rule (never force-write a 404).
- **Extractor bug found + fixed (T-121-01-B, shared `extract_gf.py` fix):** FY2013's
  `pdftotext -table` output letter-spaces the bold "T otal Revenues" / "T otal Expenditures" row
  labels (same class of defect as AR's letter-spaced headers / MT's parenthetical-suffix
  header). The un-normalized `startswith('total revenues')` check silently missed these rows,
  which let the extractor fall through to a WRONG earlier candidate (an MD&A narrative
  paragraph mentioning the statement's title in prose, with its own unrelated summary-table
  numbers) and mis-tie against that wrong statement instead of the real Governmental Funds
  page. Fixed generically: a new `flat()` label-only whitespace-stripper in `extract_gf.py` so
  "T otal Revenues" normalizes to "totalrevenues" before comparison. Re-verified against the
  correct real statement page (line 2772, not the false MD&A candidate at line 1505) — FY2013
  now ties exactly (rev $16,731,218K / exp $16,862,909K). **Regression check:** re-ran the fixed
  extractor against every already-loaded cohort .txt on disk — SC 24/24, MT 11/11, NE 6/6,
  ND 7/7, KS 7/7, CO 3/3, UT 7/7, ME 24/24 (excl. its own documented FY2000/2001 pre-GASB-34
  holes) all tie identically to before the fix; IA's dedicated `ia_extract.py` post-processor is
  unaffected by design (does not use `extract_gf.py`'s total-row detection the same way);
  MO/OR spot-checked non-tying scratch files were ALREADY non-tying before the fix (confirmed
  by testing a reconstructed pre-fix copy) — zero new regressions introduced.
- **Honest hand-patch (FY2019, NM FY2022 precedent):** FY2019's Governmental Funds statement
  page (PDF page 56) has NO text layer for its data table at all — `pdffonts`/`pdfimages`
  confirm the entire numeric table is a single embedded JPEG image (2388×2619px), while the
  narrative pages immediately before and after extract normally. Rendered the page to PNG
  (`pdftoppm -r 300`) and hand-transcribed the crisp GENERAL column directly from the image;
  independently re-summed BOTH revenue items (→ $19,417,878K) and expenditure items (→
  $18,344,756K) to confirm exact $0 diff against the printed totals before hand-patching
  `ok_all.json`. Category-name convention matches the sibling FY2018/FY2020 auto-extracted years
  exactly (OK's PDFs never put a colon after a "Taxes"/"Debt Service" subsection header, so the
  extractor's own pending-label mechanism merges the header text onto only the first item in
  that subsection — FY2019 was hand-authored to follow this same established pattern).
- **NASBO replaced in place:** FY2023 NASBO operating $7,752,000,000 → ACFR operating
  $28,121,194,000; FY2024 NASBO operating $9,139,000,000 → ACFR operating $30,421,436,000. 0
  "NASBO" labels remain anywhere on the OK node; exactly one operating row per (OK, fy), 46 total
  rows = 23 operating + 23 revenue, 0 duplicate (fy, dataset_type) keys.
- **Accept-and-relabel scope divergence (~3.35×, the WIDEST in Batch 4):** FY2024 ACFR GF Total
  Revenues $30,604,464,000 vs FY2024 NASBO operating $9,139,000,000 ≈ 3.35×. Oklahoma's General
  Fund consolidates nearly all state general-purpose taxes AND the full Federal Grants line
  ($13,780,254K FY2024, ~45% of GF total revenues) into a single fund, whereas NASBO's narrower
  budgetary concept excludes most earmarked/dedicated-revolving-fund and federal-passthrough
  activity. Accepted-and-relabelled honestly (TX/MI/WV precedent); GAAP basis label confirmed on
  every live row. This mechanism was verified real — not a transcription error — by confirming
  the Federal Grants line item is genuinely present at that magnitude in the GENERAL column of
  the printed statement (not the Total Governmental Funds column) at both bookends.
- **FY2014 clamp note (P2, the tranche's live clamp exercise for OK):** "Other" revenue went
  NEGATIVE in FY2014 only: **-$99,596K** (printed "(99,596)" in the GENERAL column — a real GAAP
  refund/adjustment, confirmed directly against the raw statement text, not an extraction
  artifact) rendered at 0 via `clampForRender`, signed magnitude preserved in the category
  label. Both bookend years are positive (FY2024 Interest and Investment Revenue +$459,743K /
  FY2002 +$96,796K, matching the recon's "none observed in either bookend" finding — this
  negative is an interior-year discovery made during this load). No year shows a negative GF
  Total revenues (FY2014 GF total revenues still ties positive at $16,866,273K).
- **Idempotency:** re-ran OK `--fy 2024` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both (this RPC's `rows_inserted` reporting artifact is documented
  precedent — see 119-04-MS-LOADLOG.md / 120-01-NE-LOADLOG.md / 120-05-ND-LOADLOG.md — appears
  identically on first-load and re-run, not a load-vs-no-op discriminator). DB confirms exactly
  the same 2 row `id`s for (OK, FY2024) afterward (operating `04fde014-cc75-412f-81ca-02e747f015d3`,
  revenue `5e2e6346-65f5-4f7a-a974-af4abb38aef6`), same totals ($30,421,436,000 operating /
  $30,604,464,000 revenue) — **0 net change**.
- **0 `data_sources` residue (LOAD-01):** confirmed via direct DB query —
  `treasury.data_sources WHERE municipality_id = OK` returns 0 rows after the initial live load
  and again after the idempotency re-run.
- **Money In auto-enabled:** OK has 23 `dataset_type='revenue'` rows (data-driven, no frontend
  change needed).
- **Cohort untouched (spot-check):** California (`e1007bf5-bac9-4b1c-878e-f6834885f850`, FY2025
  revenue $221,591,201,000 / operating $221,826,907,000) and Alaska (Batch 1 sibling,
  `b268c415-0058-4fea-8ba1-24f49fb434b4`, FY2025 revenue $8,378,945,000 / operating
  $12,373,317,000) both unchanged, matching their own gen_state.py-recorded bookends. Rhode
  Island (`483f02b4-2167-4e3d-9f5c-0f3ed83be2e6`, Batch 4 sibling not yet loaded by this plan)
  and Vermont (`563d6f1c-ce2b-4071-938f-01725d283504`, same) both still carry exactly their 2
  pre-existing `NASBO State Expenditure Report` operating rows (RI FY2023 $5,075,000,000 /
  FY2024 $5,236,000,000; VT FY2023 $2,055,000,000 / FY2024 $2,510,000,000), untouched.
- **Clean extraction (post-fix):** 21 of 23 years tied to $0 diff on BOTH revenue and
  expenditure printed GENERAL totals on the first automated extraction pass after the `flat()`
  fix; FY2013 required the `flat()` fix itself (see above); FY2019 required the hand-patch (see
  above). No other honest holes within the window.

## DB verification detail (ad-hoc `@supabase/supabase-js` scripts, deleted before final
commit — mcp-equivalent direct query, no manual Dashboard)

- Pre-load: 2 OK rows (both NASBO operating, FY2023/FY2024, `$7,752,000,000` /
  `$9,139,000,000`), 0 OK `data_sources` rows.
- Post-load: 46 OK rows (23 operating + 23 revenue), all GAAP-basis-labelled, all non-null
  `source_url`/`source_date`, 0 duplicate (fy, dataset_type) keys, 0 remaining NASBO labels,
  0 OK `data_sources` rows.
- Post-idempotency-re-run: still 46 OK rows, identical row `id`s and totals for FY2024
  (spot-checked), 0 OK `data_sources` rows.

## Per-FY totals loaded (raw dollars, ×1,000 from printed thousands)

| Fiscal Year | GF Revenue (Total Revenues) | GF Spending (operating, Total Expenditures) |
|-------------|------------------------------|----------------------------------------------|
| FY2002 | $9,568,595,000 | $10,107,983,000 |
| FY2003 | $10,219,858,000 | $10,580,440,000 |
| FY2004 | $11,412,583,000 | $11,004,663,000 |
| FY2005 | $12,048,398,000 | $11,663,447,000 |
| FY2006 | $13,542,723,000 | $12,847,605,000 |
| FY2007 | $14,087,832,000 | $14,050,015,000 |
| FY2008 | $14,924,272,000 | $14,921,282,000 |
| FY2009 | $15,336,038,000 | $15,953,003,000 |
| FY2010 | $15,290,433,000 | $16,457,887,000 |
| FY2011 | $16,256,409,000 | $16,451,307,000 |
| FY2012 | $16,806,165,000 | $16,484,978,000 |
| FY2013 | $16,731,218,000 | $16,862,909,000 |
| FY2014 | $16,866,273,000 | $17,331,768,000 |
| FY2015 | $17,121,752,000 | $17,171,876,000 |
| FY2016 | $16,621,650,000 | $17,754,999,000 |
| FY2017 | $16,674,725,000 | $17,300,084,000 |
| FY2018 | $17,469,602,000 | $17,180,747,000 |
| FY2019 | $19,417,878,000 (hand-patched) | $18,344,756,000 (hand-patched) |
| FY2020 | $19,404,585,000 | $19,566,178,000 |
| FY2021 | $23,373,562,000 | $22,278,303,000 |
| FY2022 | $28,615,026,000 | $25,591,387,000 |
| FY2023 | $30,542,100,000 | $28,121,194,000 (was NASBO $7,752,000,000) |
| FY2024 | $30,604,464,000 | $30,421,436,000 (was NASBO $9,139,000,000) |

Loaders: `scripts/processOKAcfr.js` + `scripts/processOKRevenueAcfr.js` (gen_state.py
`CONFIGS['OK']`, node `54233a91-919d-4a5f-9f24-2f9325250e64`, UNITS=1000, no `rev_boundary`
needed — OK's "Taxes" subsection header has no trailing colon so it merges onto the first tax
item's label rather than needing an explicit boundary).
