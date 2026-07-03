# 113-01 — Indiana ACFR Load Log

**Date:** 2026-07-02
**Node:** Indiana `7eb77ada-b504-4531-98cc-8262cfb22ff5` (resolved + asserted by both loaders)
**Loaders:** `scripts/processINAcfr.js` (operating) + `scripts/processINRevenueAcfr.js` (revenue), IL template, UNITS=1_000 (thousands)

## Load Disposition

| Item | Result |
|------|--------|
| FYs transcribed + tied | **FY2002–FY2025, all 24 years, both sections, $0 diff every year** (extraction: `pdftotext -table`, GF = 1st numeric column; extractor tie-verified sum == printed total per section per year) |
| FYs skipped / honest holes | **None** — Indiana's archive is complete and every year extracted + tied cleanly |
| Bookend ties | FY2024 GF Total revenues = 22,101,900K ✅ (recon match, $0 diff); FY2002 = 7,341,746K ✅ (recon match, $0 diff) |
| FY2001 | Not loaded — pre-GASB-34 boundary honored (D-12); not in SOURCES |
| Download note | FY2023 PDF truncated on first download (curl error 18, 5.8MB missing, passed %PDF magic but incomplete) — re-downloaded cleanly (7MB). All 24 PDFs verified %PDF magic + plausible size |

## NASBO Replacement (in place)

Pre-load baseline (queried live before any write — matches 112-RECON Section 5 exactly):

| FY | Pre-load NASBO operating | Loaded ACFR operating (GAAP) |
|----|--------------------------|------------------------------|
| 2023 | $26,397,000,000 (budgetary basis) | $20,298,587,000 |
| 2024 | $22,405,000,000 (budgetary basis) | $18,534,655,000 |

Post-load: **0 rows with a "NASBO" label remain on the IN node; exactly one operating row per (IN, fy)** (dup-FY query = 0). Replacement happened at the same `(muni, fy, 'operating')` RPC key — no duplicates.

## Scope Parity Record (ACFR-31)

ACFR GF FY2024 total revenues $22,101,900K vs NASBO FY2024 operating $22,405M → **~0.99× — near parity, as recon predicted.** Indiana reports Medicaid through a separate major fund ("Public Welfare-Medicaid Assistance Fund", $15,111,031K FY2024) rather than folding it into the GF column. Note: the ACFR *expenditure* totals (e.g. FY2023 $20.3B GAAP) sit below the NASBO budgetary totals (FY2023 $26.4B) for the same mechanism plus basis differences — honest GAAP relabel, no silent inflation. GAAP basis label verified on all 48 live rows.

## Negative-Line / P2 Clamp (ACFR-32)

Every loaded year's GF column scanned: exactly one negative — **FY2022 "Investment income (loss)" = −30,464K** (recon's "negatives ARE possible" warning confirmed). Rendered clamped to 0 with label "Investment income (loss) (net loss — shown at 0)"; root total carries the signed net and still ties the printed 20,938,603K. All other years positive.

## Idempotency + 0-Residue (LOAD-01)

- Re-ran `--fy 2024` live a second time on BOTH loaders: identical UPDATE-in-place (same totals, same stamps), 0 net change.
- `SELECT count(*) FROM treasury.data_sources WHERE dataset_id LIKE 'in-acfr-%'` → **0** (ephemeral lifecycle held across 3 live runs).

## Final DB State + Money In + Cohort

- 24 operating + 24 revenue rows, all `Indiana State ACFR — … (FY{fy} actual, GAAP basis)`, 0 unstamped (source_url + source_date non-null on all 48).
- Revenue bookends in DB: FY2024 = 22,101,900,000; FY2002 = 7,341,746,000 (raw dollars, ×1,000 from thousands).
- **Money In auto-enabled** (24 revenue rows ≥ 1).
- Cohort spot-check unchanged: CA 36 rows (FY2008–2025), PA 20 (FY2016–2025), NJ 12 (FY2020–2025) — expected ACFR shapes; OK + KS still 2 NASBO rows each.
