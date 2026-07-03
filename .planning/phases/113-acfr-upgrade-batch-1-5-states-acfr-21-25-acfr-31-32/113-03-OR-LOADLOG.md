# 113-03 — Oregon ACFR Load Log

**Date:** 2026-07-02
**Node:** Oregon `7686da27-5d64-44c2-bae2-f8c85c073e37` (resolved + asserted)
**Loaders:** `scripts/processORAcfr.js` + `scripts/processORRevenueAcfr.js`, UNITS=1_000 (thousands)

## Load Disposition

| Item | Result |
|------|--------|
| FYs loaded | **FY2022–FY2025 (all 4), operating + revenue** — the full recon-locked window |
| FY2005–FY2021 | **NOT loaded** — Wayback-only, 404 live (D-06 durable-URL exclusion; recon-locked honest window). DB confirms min_fy = 2022 |
| Rounding | Oregon rounds line items independently: leaf sums differ from printed section totals by ±1–3 (thousands). validate() tolerance = 10 thousands; stored root totals are the PRINTED totals |
| Bookend ties | FY2025 GF Total revenues = 17,291,987K ✅ (recon match); FY2022 = 15,711,953K ✅ (recon match) |
| Filename quirk | Each year's filename uses a different separator (2025.ACFR / 2024_ACFR / 2023ACFR / 2022 ACFR) — enumerated verbatim in SOURCES; all 4 downloads passed %PDF magic |

## NASBO Replacement (in place)

| FY | Pre-load NASBO operating (recon baseline) | Loaded ACFR operating (GAAP) |
|----|-------------------------------------------|------------------------------|
| 2023 | $13,586,000,000 | $14,859,176,000 |
| 2024 | $16,100,000,000 | $16,455,067,000 |

Post-load: **0 NASBO labels remain; exactly one operating row per (OR, fy)** (dup query = 0). FY2022/FY2025 operating + all 4 revenue rows net-new.

## Scope Divergence (ACFR-31)

ACFR GF FY2024 revenues $16,151,462K vs NASBO FY2024 operating $16,100M → **~1.00–1.07× as recon predicted — smallest relabel risk in Batch 1** (Oregon's federal flows route through the separate Health and Social Services / Public Transportation fund columns). GAAP basis label on all 8 rows.

## Negative Lines (ACFR-32)

None in any loaded year (Investment Income positive throughout: FY2025 +$411,848K … FY2022 +$59,464K). Clamp wired as safety net.

## Idempotency + 0-Residue

- Re-ran `--fy 2025` live (both loaders): UPDATE-in-place, 0 net change.
- `data_sources` rows with dataset_id LIKE 'or-acfr-%' → **0**.

## Money In + Cohort

- 4 revenue rows → **Money In auto-enabled**.
- Same-session cohort spot-check (CA 36 / PA 20 / NJ 12 / OK 2 / KS 2) unchanged.
