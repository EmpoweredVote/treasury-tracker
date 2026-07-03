# 113-05 — Colorado ACFR Load Log

**Date:** 2026-07-02
**Node:** Colorado `89d2aff1-6980-4c20-80fe-513618bce8ac` (resolved + asserted)
**Loaders:** `scripts/processCOAcfr.js` + `scripts/processCORevenueAcfr.js`, UNITS=1_000 (thousands)

## Load Disposition

| Item | Result |
|------|--------|
| FYs loaded | **FY2023–FY2025 (all 3), operating + revenue** — the full recon-locked window (pre-FY2023 lost to a site migration; D-12 shallow window) |
| Access | Every `osc.colorado.gov` fetch sent `Referer: https://osc.colorado.gov/financial-operations/financial-reports/acfr` — all 3 PDFs downloaded first try (53MB/15MB/10MB), %PDF-verified |
| Statement trap | The "…Reconciled To Statement Of Activities" schedule skipped; extraction anchored on the target statement; "General Funds" (plural) column header confirmed |
| Ties | All 3 years tie **$0 diff** on BOTH sections. FY2024 GF Total revenues = 26,271,588K ✅ (recon bookend); FY2023 = 24,912,540K ✅ (matches recon Section 2); FY2025 = 27,950,701K (fresh extraction, ties printed total) |

## TABOR Presentation-Form Check (per year, both forms — ACFR-32)

| FY | Standalone negative line? | Netted form? | Disposition |
|----|---------------------------|--------------|-------------|
| 2023 | No | Yes — refund netted into Individual and Fiduciary Income (recon-confirmed narrative; no standalone line in the GF column) | No clamp needed; noted |
| 2024 | **Yes — "TABOR Excess Revenue" = −1,214,908K** (recon exact match) | — | Transcribed SIGNED; validate() ties on signed values; rendered clamped |
| 2025 | **Yes — "TABOR Excess Revenue" = −129,536K** (new finding — the standalone form continues) | — | Same signed-transcribe + clamp path |

**Live stored-tree confirmation (FY2024 revenue):** `treasury.budget_categories` contains child "TABOR Excess Revenue (net refund/loss — shown at 0; actual -1,214,908,000)" with amount **0**; the budgets row total = **26,271,588,000** (signed net = printed total). The clamp is live, honest, and total-preserving.

## NASBO Replacement (in place)

| FY | Pre-load NASBO operating (recon baseline) | Loaded ACFR operating (GAAP) |
|----|-------------------------------------------|------------------------------|
| 2023 | $13,647,000,000 | $24,805,259,000 |
| 2024 | $14,513,000,000 | $24,875,053,000 |

Post-load: **0 NASBO labels; one operating row per (CO, fy); FY2025 net-new; min_fy = 2023** (no pre-window rows).

## Scope Divergence (ACFR-31)

~1.81× as recon-pinned: "Federal Grants and Contracts" = $9,692,569K of the FY2024 GF total (federal passthrough inside GAAP GF). Accepted-and-relabelled honestly; GAAP basis label on all 6 rows.

## Idempotency + 0-Residue

- Re-ran `--fy 2024` live (both loaders): UPDATE-in-place, 0 net change (clamped tree deterministic).
- `data_sources` 'co-acfr-%' rows → **0**.

## Money In + Cohort

- 3 revenue rows → **Money In auto-enabled**.
- Cohort spot-check (CA/PA/NJ/OK/KS) unchanged this session.
