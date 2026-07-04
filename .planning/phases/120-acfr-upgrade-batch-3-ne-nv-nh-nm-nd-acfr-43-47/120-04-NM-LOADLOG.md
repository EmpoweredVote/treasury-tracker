# 120-04 NM — New Mexico ACFR Load Log (ACFR-46)

**Status:** COMPLETE — NM live on full State-ACFR GAAP, FY2019/FY2022/FY2023/FY2024 (4 of the
recon's aspirational 6-year target window; FY2020/FY2021 honest-gapped), $0 spend.
**Node:** New Mexico `1e60ff76-c9fa-48d0-9442-042f61cd40ea` · **Units:** THOUSANDS
(UNITS=1000) · **FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2019, FY2022, FY2023, FY2024 (4 years) — operating + revenue = **8
  rows**, every FY tie-verified at $0 diff on BOTH the printed GENERAL FUND "Total
  expenditures" line and the "Total revenues" line.
- **FY2022 image-only / embedded-data finding:** the FY2022 ACFR's Statement of Revenues,
  Expenditures, and Changes in Fund Balances — Governmental Funds (printed pp. 36–37) renders
  as a RASTER IMAGE in the live PDF — `pdftotext -table`/`-layout` returned zero numeric
  content for those pages (`extract_gf.py` correctly reported "statement not found" rather
  than mis-transcribing a blank/zero row — the KY FY2023 no-ToUnicode-CMap precedent, distinct
  from an OCR-recoverable scan). Phase 117 recon had already rendered the two pages to PNG
  (`_acfr-work/nm/nm_2022_hires-048.png` / `-049.png`); this load hand-transcribed the
  GENERAL FUND column directly from those rendered images (both fully legible at full
  resolution) and embedded the result as static data in `_acfr-work/nm/nm_all.json` (NJ Phase
  115 precedent). Independently re-summed at assembly time: GF Total revenues
  **$26,161,736,000** (9 line items, $0 diff) and GF Total expenditures **$20,159,689,000** (12
  line items, $0 diff) — both exact-tie the printed totals, matching the recon's
  hand-verification exactly (two independent transcriptions of the same image, identical
  result).
- **FY2023 live-discovery result: FOUND.** `nmdfa.state.nm.us`'s own landing/reports pages do
  not link the ACFR directly (recon precedent, confirmed again this load — crawled both
  `financial-control/statewide-financial-reporting-accountability-bureau/` and
  `financial-control/financial-reports/`, neither links an ACFR PDF). Live Wayback CDX crawl of
  `nmdfa.state.nm.us/wp-content/uploads/2024/*` located
  `FINAL-341-A-State-of-New-Mexico-FY-2023-FS-5-15-2024.pdf` (confirmed live: HTTP 200,
  `application/pdf`, %PDF magic, 3.2MB — well above the soft-404 threshold). Extracted cleanly
  via the standard `pdftotext -table` + `extract_gf.py` pass on the FIRST attempt: GF Total
  revenues **$30,260,179,000** (9 items, $0 diff) and GF Total expenditures
  **$22,181,074,000** (12 items, $0 diff) — no embedded-data fallback needed for this year.
- **FY2020/FY2021 — honest gap (not pursued beyond a bounded search):** a live crawl of
  `nmdfa.state.nm.us/wp-content/uploads/{2020,2021,2022}/*` via Wayback CDX found several
  single-agency "Financial Statements FY20/FY21" / "Agency-341-...-FS" style filings — but these
  are DFA's own individual-agency financial statements (agency code 341, without the "-A"
  statewide-component-unit suffix used by every year we DID load), a narrower and different
  document than the statewide "341-A"/"SoNM" ACFR. No statewide-ACFR-pattern PDF was found for
  FY2020 or FY2021. This matches the recon's original 3-year source enumeration
  (FY2019/FY2022/FY2024 only) — FY2020/FY2021 were never claimed reachable by the recon, and
  this load's own bounded re-check (same effort budget as the NE "pre-FY2020, low priority" /
  KS "shallow window, not chased" precedent in this tranche) did not find them either. OMITTED
  as an honest hole, not force-transcribed from the wrong document. Durable loaded window =
  FY2019, FY2022 (embedded), FY2023, FY2024.
- **Bookends (GENERAL FUND Total revenues tie):** FY2024 **$30,530,269,000** confirmed live in
  `treasury.budgets` (dataset_type='revenue'); FY2019 **$15,358,087,000** confirmed live — both
  exact ($0 diff), matching the recon's pinned bookends. Values stored ×1,000 (UNITS=1000, NM's
  printed statement is in thousands).
- **NASBO replaced in place:** FY2023 NASBO operating $8,682,000,000 → ACFR operating
  $22,181,074,000 (row id `0e6da335-0aa1-487b-acd8-663f233c6ac9`, UNCHANGED before/after —
  confirmed UPDATE not insert+delete); FY2024 NASBO operating $9,975,000,000 → ACFR operating
  $23,955,264,000 (row id `a1249c5f-5089-4ec1-8e94-c33fee35c246`, also UNCHANGED before/after).
  0 "NASBO" labels remain anywhere on the NM node; exactly one operating row per (NM, fy) across
  all 4 fiscal years (2019, 2022, 2023, 2024).
- **Accept-and-relabel scope divergence (~3.06x):** FY2024 ACFR GF Total revenues
  $30,530,269,000 vs FY2024 NASBO operating $9,975,000,000 ≈ 3.06x. Two consolidation drivers
  land in the same GENERAL FUND column: "Federal Revenue" = $11,691,941,000 (38% of GF revenue,
  federal passthrough — the TX-trap mechanism) PLUS "Rentals and Royalties" (oil & gas) =
  $5,353,926,000 (a substantial OWN-SOURCE severance/royalty stream, not federal — NM's own
  distinguishing driver vs NV/NH's purely-federal divergence in this batch). Accepted-and
  relabelled honestly (TX precedent, two-driver note); GAAP basis label confirmed on every live
  row.
- **Negative-line scan / P2 clamp exercised:** "Investment Income (Loss)" went NEGATIVE in
  FY2022 only: **-$91,222,000** — a real GAAP fair-value-of-investments loss, independently
  confirmed twice (Phase 117 recon's hand-verification and this load's own re-transcription
  from the rendered page image both read the identical parenthesized value). Every other loaded
  year is positive (FY2024 +$1,163,349,000 / FY2023 +$419,897,000 / FY2019 +$122,313,000). The
  P2 `clampForRender` path fired live for FY2022: the dry-run AND live run both render the line
  at $0 with the signed magnitude in the label ("Investment Income (Loss) (net refund/loss —
  shown at 0; actual -91,222,000)") while the parent GF total stays the printed
  $26,161,736,000 exactly.
- **Idempotency:** re-ran NM `--fy 2024` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both (this RPC's `rows_inserted` reporting artifact is documented
  precedent — see 119-04-MS-LOADLOG.md / 120-01/02/03-LOADLOG.md — appearing identically on
  first-load and re-run, not a load-vs-no-op discriminator). DB confirms exactly the same 2 row
  `id`s for (NM, FY2024) afterward (operating `a1249c5f-5089-4ec1-8e94-c33fee35c246`, revenue
  `f46e169e-4177-4581-9880-5aa0a0fcaaa2`), same totals — **0 net change**.
- **0 `data_sources` residue (LOAD-01):** confirmed via direct DB query —
  `treasury.data_sources WHERE dataset_id IN ('nm-acfr-gf-operating','nm-acfr-gf-revenue')`
  returns 0 rows after the run (checked both after the initial live load and after the
  idempotency re-run).
- **Money In auto-enabled:** NM has 4 `dataset_type='revenue'` rows (FY2019/2022/2023/2024,
  data-driven, no frontend change needed).
- **Cohort untouched (spot-check):** California (`e1007bf5-bac9-4b1c-878e-f6834885f850`, FY2025
  revenue $221,591,201,000 / operating $221,826,907,000) and Alaska (Batch 1 sibling,
  `b268c415-0058-4fea-8ba1-24f49fb434b4`, FY2025 revenue $8,378,945,000 / operating
  $12,373,317,000) unchanged; North Dakota (`e84aafe0-eeaa-470a-8fd3-708c88af2a80`, the Batch-3
  sibling covered by a separate plan, 120-05 — not yet loaded) still carries exactly its 2
  pre-existing `NASBO State Expenditure Report` operating rows (FY2023 $2,436,000,000 / FY2024
  $2,876,000,000), untouched by this NM-only plan.

## DB verification detail (direct `@supabase/supabase-js` query — mcp__supabase-local tools not
available in this environment; ad-hoc verification scripts run inline via `node -e`, no
scratch files left on disk, per plan efficiency note)

- Pre-load: 2 NM rows (both NASBO operating, FY2023 $8,682,000,000 / FY2024 $9,975,000,000),
  0 `nm-%` data_sources rows.
- Post-load: 8 NM rows (4 operating [FY2019/2022/2023/2024, all GAAP] + 4 revenue
  [FY2019/2022/2023/2024]), all GAAP-basis-labelled, all non-null `source_url` / `source_date`,
  0 `nm-%` data_sources rows. Exactly one operating row per (NM, fy); zero remaining "NASBO"
  labels.
- Post-idempotency-re-run: still 8 NM rows, identical row `id`s and totals for (NM, FY2024),
  0 `nm-%` data_sources rows.
- Honest-hole FYs: FY2020, FY2021 — no statewide-ACFR-pattern PDF found under a bounded Wayback
  CDX search of the 2020/2021/2022 uploads directories (only narrower single-agency DFA-341
  filings exist for those years). Not a durability failure within the loaded window — all 4
  loaded years (FY2019, FY2022, FY2023, FY2024) tied exactly, no in-window gaps.

## Per-FY totals loaded (raw dollars, ×1,000 from the printed thousands)

| Fiscal Year | GF Revenue (Total revenues) | GF Spending (operating, Total expenditures) |
|-------------|------------------------------|----------------------------------------------|
| FY2019 | $15,358,087,000 | $13,931,193,000 |
| FY2022 (embedded, image-only source page) | $26,161,736,000 | $20,159,689,000 |
| FY2023 (was NASBO $8,682,000,000) | $30,260,179,000 | $22,181,074,000 |
| FY2024 (was NASBO $9,975,000,000) | $30,530,269,000 | $23,955,264,000 |

Loaders: `scripts/processNMAcfr.js` + `scripts/processNMRevenueAcfr.js` (gen_state.py
`CONFIGS['NM']`, node `1e60ff76-c9fa-48d0-9442-042f61cd40ea`, UNITS=1000 — thousands, no
`rev_boundary` needed — both of NM's tax-line labels ("General and Selective Taxes", "Income
Taxes") already end in the word "Taxes" in the printed source, so `default_rev_name()`'s
Taxes-suffix logic is a no-op). FY2019/FY2023/FY2024 PDFs and `pdftotext -table` outputs plus
the FY2022 hand-transcribed embedded data assembled into `_acfr-work/nm/nm_all.json` directly
(no `build_state.py` batch driver needed for this 4-year, opaque-URL, single-image-year state).
