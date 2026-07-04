# 119-02 KS — Kansas ACFR Load Log (ACFR-39)

**Status:** COMPLETE — KS live on full State-ACFR GAAP, FY2019–FY2025, zero honest holes,
$0 spend.
**Node:** Kansas `bb3dcf05-586c-4e68-85d3-26a6199cc4ab` · **Units:** thousands (UNITS=1000) ·
**FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2019–FY2025 (7 contiguous years, the FULL durable window — no interior
  gaps), operating + revenue = **14 rows**, every FY tie-verified at $0 diff on BOTH the printed
  General column expenditure total and the printed General column revenue total.
- **Shallow-window note:** the current `admin.ks.gov` ACFR Reports category page only lists
  FY2019–FY2025 (7 years) — this is the durable window per Phase 117 recon, not an honest hole to
  chase further back this pass. EMMA (Electronic Municipal Market Access) was noted in recon as
  an unverified alternate historical-filing venue for FY2009+; not pursued this pass.
- **Bookends (General column Total revenues, confirmed live in `treasury.budgets`, not just
  dry-run):** FY2025 **$10,352,600,000** ✅; FY2019 **$7,539,362,000** ✅ (both exact).
- **General-not-Total confirmation:** KS's Governmental Funds statement carries a WIDE 8-column
  layout (General | Social Services | Health and Environment | Transportation | Executive |
  Commerce | Non-major Governmental | Total Governmental). `extract_gf.py`'s existing
  position-anchor (right-edge of the FIRST numeric token on the "Total revenues" row) isolates
  General regardless of total column count — the same mechanism already proven on the CO/MO
  wide-layout precedent. NO code changes to `extract_gf.py` were required. Confirmed at both
  bookends (exact $0 diff) and re-confirmed on all 7 loaded years (uniform 9-revenue-category /
  9-expenditure-category shape, zero name collisions).
- **Opaque-hash URLs:** all 7 per-FY `admin.ks.gov/browse/files/{hash}/download` URLs were taken
  directly from the Phase 117 recon (`117-BATCH2-SOURCES.md` KS Detail Block, which had already
  enumerated and verified all 7 years off the ACFR Reports category page). Each was independently
  re-verified this pass: downloaded, confirmed `%PDF` magic + size 1.86–3.42MB (all well above
  the soft-404 guard threshold), and `pdftotext -table`-extracted cleanly.
- **Zero honest holes:** all 7 years (FY2019–FY2025) tied exactly on the FIRST extraction pass —
  no wrapped labels, no ALL-CAPS source text, no dual-subsection name collisions, no rev_boundary
  sub-heading complications (KS's revenue lines carry no sub-heading at all — `sub=None`
  throughout every loaded year). The simplest/cleanest cohort member extracted in this tranche
  to date.
- **NASBO replaced in place:** FY2023 NASBO $8,727,000,000 → ACFR operating $8,693,141,000;
  FY2024 NASBO $9,365,000,000 → ACFR operating $9,451,234,000. Confirmed post-load: 0 rows with
  a "NASBO" label remain anywhere on the KS node; exactly ONE operating row per (KS, fy) across
  all 7 fiscal years (verified via direct per-FY row-count query, not just spot-check).
- **Accept-relabel scope divergence (~1.11×, the NARROWEST in Batch 2):** FY2025 ACFR GF
  $10,352,600K vs FY2024 NASBO GF $9,365,000K. Driver: Kansas's Operating grants and Capital
  grants lines are BOTH $0 in the General column at every single loaded year FY2019–FY2025 —
  federal flows route entirely through the separate Social Services / Health and Environment /
  Transportation / Executive / Commerce major-fund columns, not the General column. This is the
  state's own fund-accounting structure, not a load-time choice. Accepted-and-relabelled
  honestly (NJ-precedent modest-divergence mechanism); GAAP basis label confirmed on every live
  row.
- **P2 clamp exercised:** FY2021 "Investment earnings" = **-$3,712K** (real GAAP
  fair-value-of-investments loss, not an extraction artifact) — rendered at 0 with the signed
  value in the label (confirmed in dry-run + live output). Every other loaded year is positive
  (FY2025 +$305,819K / FY2019 +$36,370K, the recon-confirmed bookends). No year shows a negative
  GF Total.
- **Idempotency:** re-ran KS `--fy 2025` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both; DB confirms exactly 14 total KS rows afterward (7 operating + 7
  revenue, same UUIDs, same totals as the first load) — 0 net change.
- **0 `data_sources` residue (LOAD-01):** confirmed via direct query — 0 rows match
  `dataset_id ILIKE 'ks-%'` in `treasury.data_sources` after the run.
- **Money In auto-enabled:** KS has 7 `dataset_type='revenue'` rows (data-driven, no frontend
  change needed).
- **Cohort untouched (spot-check):** Alaska (Batch 1 sibling, `b268c415-0058-4fea-8ba1-24f49fb434b4`,
  40 rows) and Iowa (Batch 2 sibling, `6e71a93f-a43d-4972-a239-85ddbebe2545`, 46 rows) both
  unchanged at their pre-existing row counts; Wyoming (un-upgraded NASBO state) still carries
  exactly its 2 pre-existing `NASBO State Expenditure Report` rows, untouched.

### Tooling generalizations confirmed reusable this load

- No new `extract_gf.py`/`gen_state.py` generalizations were required — KS's WIDE 8-column
  layout was handled entirely by the existing position-anchor mechanism (CO/MO precedent) and
  KS's clean, uniform statement shape needed none of IA's NET-REVENUES/Capital-Outlay-collision
  fixes. This confirms both prior generalizations are genuinely reusable, not one-off patches.

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue (General column) | GF Spending (operating, General column) |
|-------------|------------------------------|-------------------------------------------|
| FY2019 | $7,539,362,000 | $7,151,077,000 |
| FY2020 | $7,587,410,000 | $7,546,056,000 |
| FY2021 | $8,533,069,000 | $7,222,708,000 |
| FY2022 | $9,772,911,000 | $8,509,358,000 |
| FY2023 | $10,512,729,000 | $8,693,141,000 |
| FY2024 | $10,237,246,000 | $9,451,234,000 |
| FY2025 | $10,352,600,000 | $10,267,038,000 |

## Verification Summary

- Both loaders `--dry-run`: every FY "validation: PASS", no "sum ≠ total" — confirmed for all 7
  years on both operating and revenue.
- `processKSRevenueAcfr.js --dry-run --fy 2025` → `10,352,600,000`; `--fy 2019` →
  `7,539,362,000` — both exact.
- Extracted column confirmed General (1st of 8), not Total, at both bookends.
- Live: KS node has operating + revenue rows for all 7 FYs, GAAP-labelled, non-null
  source_url/source_date.
- Re-run KS `--fy 2025` → `Loaded 0 rows` for both loaders; 0 net change; 0 `data_sources`
  residue for KS.
- KS has 7 revenue rows → Money In auto-enabled.
- Accept-relabel divergence (~1.11×) recorded against pre-load NASBO totals.
- Alaska + Iowa (existing ACFR nodes) + Wyoming (un-upgraded NASBO state) unchanged.
