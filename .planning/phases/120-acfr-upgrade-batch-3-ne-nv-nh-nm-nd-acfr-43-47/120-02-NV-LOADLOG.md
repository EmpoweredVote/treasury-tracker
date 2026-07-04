# 120-02 NV — Nevada ACFR Load Log (ACFR-44)

**Status:** COMPLETE — NV live on full State-ACFR GAAP, FY2019–FY2023 (partial window,
FY2024 honestly retained on NASBO), $0 spend.
**Node:** Nevada `d0879e45-0b72-41ee-bdbd-a214a4f2a1d5` · **Units:** DOLLARS (UNITS=1,
NOT thousands — the #1 NV load risk) · **FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2019–FY2023 (5 years, the full recon target window, zero honest holes) —
  operating + revenue = **10 rows**, every FY tie-verified at $0 diff on BOTH the printed
  GENERAL FUND "Total expenditures" line and the "Total revenues" line.
- **FY2024/FY2025 re-check (D-07):** re-checked `controller.nv.gov` live at load time
  (2026-07-04) — every tested FY2024/FY2025 filename variant (`2024-acfr-report.pdf`,
  `2024_ACFR_Report.pdf`, `FY24_ACFR.pdf`, `ACFR_FY2024.pdf`, `2025-acfr-report.pdf`,
  `2025_ACFR_Report.pdf`) returned HTTP 404; the landing page still reads "currently being
  remediated" with no FY2024/2025 mention. Confirms the recon's finding exactly — a genuine
  current-publication gap, not a durability failure. **Decision: load FY2019–FY2023 on ACFR,
  retain FY2024 NASBO with its honest label** (not fabricated, not dropped).
- **Bookends (GENERAL FUND Total revenues tie):** FY2023 **$15,153,168,081** confirmed live in
  `treasury.budgets` (dataset_type='revenue'); FY2019 **$10,411,179,917** confirmed live — both
  exact ($0 diff), matching the recon's pinned bookends. Values stored in raw DOLLARS (UNITS=1,
  no ×1,000 scaling) — the #1 NV load risk, confirmed correct.
- **NASBO replaced in place / retained:** FY2023 NASBO operating $4,742,000,000 → ACFR operating
  $12,405,372,737 (row id `eb3d2b47-35ce-47e4-b870-c61785bd953e`, UNCHANGED before/after —
  confirmed UPDATE not insert+delete); FY2024 NASBO operating $5,273,000,000 (row id
  `af226aad-02ed-434a-a09d-39d120367a8d`) is **INTENTIONALLY STILL PRESENT**, untouched, still
  carrying its "NASBO State Expenditure Report — General Fund (FY2024 actual, budgetary basis)"
  label — this is NOT a miss, it is the partial-window decision above. 0 "NASBO" labels remain
  on FY2019–FY2023; exactly one operating row per (NV, fy) across all 6 fiscal years (2019–2024).
- **Accept-and-relabel scope divergence (~2.87x, the WIDEST in Batch 3):** FY2023 ACFR GF Total
  revenues $15,153,168,081 vs FY2024 NASBO operating $5,273,000,000 ≈ 2.87x (also ≈3.20x vs the
  FY2023 NASBO figure it replaced, $4,742,000,000). Nevada's GAAP General Fund consolidates
  federal Medicaid/grant pass-through directly into the General column: "Intergovernmental" =
  $8,940,557,604 in FY2023 = 59% of GF revenue. Accepted-and-relabelled honestly (TX/NC-trap
  precedent); GAAP basis label confirmed on every live row.
- **FY2022 clamp note (P2, newly discovered — not a bookend year):** "Interest and investment
  income (loss)" = **-$141,921,982** (dollars; a real GAAP fair-value-of-investments loss, not
  an extraction artifact) rendered at 0 via `clampForRender`, signed magnitude preserved in the
  category label. Both bookend years (FY2019 +$44,986,413 / FY2023 +$113,563,504) are positive,
  matching the recon's "none observed in either bookend" finding — the negative is an
  interior-year discovery made during this load, not a recon miss. No year shows a negative GF
  Total revenues.
- **Idempotency:** re-ran NV `--fy 2023` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both (this RPC's `rows_inserted` reporting artifact is documented
  precedent — see 119-04-MS-LOADLOG.md / 120-01-NE-LOADLOG.md — appearing identically on
  first-load and re-run, not a load-vs-no-op discriminator). DB confirms exactly the same 2 row
  `id`s for (NV, FY2023) afterward (operating `eb3d2b47-35ce-47e4-b870-c61785bd953e`, revenue
  `a16c0945-7c19-4193-9fa6-2f9877d1d2ef`), same totals — **0 net change**.
- **0 `data_sources` residue (LOAD-01):** confirmed via direct DB query —
  `treasury.data_sources WHERE dataset_id ILIKE 'nv-%'` returns 0 rows after the run (checked
  both after the initial live load and after the idempotency re-run).
- **Money In auto-enabled:** NV has 5 `dataset_type='revenue'` rows (FY2019–FY2023, data-driven,
  no frontend change needed).
- **Cohort untouched (spot-check):** California (`e1007bf5-bac9-4b1c-878e-f6834885f850`, FY2025
  revenue $221,591,201,000 / operating $221,826,907,000) and Alaska (Batch 1 sibling,
  `b268c415-0058-4fea-8ba1-24f49fb434b4`, FY2025 revenue $8,378,945,000 / operating
  $12,373,317,000, `Alaska State ACFR — General Fund[...]` labels) unchanged; West Virginia
  (un-upgraded, `e21923d7-ad99-4711-b765-255b9807c059`) still carries exactly its 2
  pre-existing `NASBO State Expenditure Report` operating rows (FY2023 $3,943,000,000 / FY2024
  $4,164,000,000), untouched.
- **`gen_state.py` generator fix (reusable, ACFR-44 discovered it):** `gen_state.py` previously
  hardcoded `const UNITS = 1_000;` in the generated JS template with no override — every prior
  state's ACFR is reported in thousands, so this never surfaced. NV's printed statement is
  already in whole dollars, so a `units` config option (default 1000/thousands) was added;
  `units=1` emits `UNITS=1` and swaps every "thousands" doc/log string to "dollars" generically
  (Rule 2 fix — required for correct operation, not a plan change). `_acfr-work/` is gitignored,
  so this generator fix is not itself committed; the effect is visible in the two generated
  loader files' `UNITS = 1;` constant.

## DB verification detail (direct `@supabase/supabase-js` query — mcp__supabase-local tools not
available in this environment; ad-hoc verification script deleted before final commit, per plan
efficiency note)

- Pre-load: 2 NV rows (both NASBO operating, FY2023 $4,742,000,000 / FY2024 $5,273,000,000),
  0 `nv-%` data_sources rows.
- Post-load: 11 NV rows (6 operating [FY2019–2024, FY2024 still NASBO] + 5 revenue
  [FY2019–2023]), all FY2019–2023 rows GAAP-basis-labelled, all non-null `source_url`/
  `source_date`, 0 `nv-%` data_sources rows. FY2024 operating row confirmed still NASBO-labelled
  and byte-identical to pre-load.
- Post-idempotency-re-run: still 11 NV rows, identical row `id`s and totals for (NV, FY2023),
  0 `nv-%` data_sources rows.
- Honest-hole FYs: none within the FY2019–2023 window (all 5 years tied exactly); FY2024/2025
  absent by design (partial-window decision, not an honest hole within the loaded window).

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue (Total revenues) | GF Spending (operating, Total expenditures) |
|-------------|------------------------------|----------------------------------------------|
| FY2019 | $10,411,179,917 | $10,143,797,415 |
| FY2020 | $10,308,923,845 | $10,390,703,854 |
| FY2021 | $12,265,829,792 | $11,560,594,512 |
| FY2022 | $14,612,607,899 (incl. -$141,921,982 clamped Interest line) | $12,335,115,024 |
| FY2023 | $15,153,168,081 | $12,405,372,737 (was NASBO $4,742,000,000) |
| FY2024 | — (not loaded; NASBO retained) | $5,273,000,000 (NASBO, unchanged, honest label) |

Loaders: `scripts/processNVAcfr.js` + `scripts/processNVRevenueAcfr.js` (gen_state.py
`CONFIGS['NV']`, node `d0879e45-0b72-41ee-bdbd-a214a4f2a1d5`, UNITS=1 — dollars, no
`rev_boundary` needed — NV's revenue lines carry no subsection headers, raw labels already read
as complete tax names e.g. "Sales taxes", "Gaming taxes, fees, licenses").
