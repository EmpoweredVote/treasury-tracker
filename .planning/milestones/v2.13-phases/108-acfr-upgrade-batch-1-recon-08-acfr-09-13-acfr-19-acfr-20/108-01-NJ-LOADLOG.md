# 108-01 — New Jersey ACFR Load Log

**State:** New Jersey (node `91f310a1-bec9-404a-9825-82b1106c911f`)
**Loaders:** `scripts/processNJAcfr.js` (operating), `scripts/processNJRevenueAcfr.js` (revenue)
**Window loaded:** FY2020–FY2025 (full recon-confirmed clean window, 6 years) — **0 honest holes**
**Units:** DOLLARS (UNITS=1 — NJ is the only tranche state not in thousands)
**Spend:** $0 (free nj.gov PDFs, pdftotext -table, no paid AI)

---

## Source URL correction (load-time discovery)

Recon (107-BATCH1-SOURCES.md) recorded a URL pattern with a spurious `/pdfs/` path segment
(`…/{YY}fr/pdfs/NJFRFY{YYYY}Complete.pdf`) — every one 404'd (soft-404 HTML, caught by the
magic-byte guard). The real paths (enumerated from the OMB landing `nj.gov/treasury/omb/fr.shtml`)
have no `/pdfs/` segment:

| FY | URL |
|----|-----|
| 2020 | `…/publications/20fr/NJFRFY2020Complete.pdf` |
| 2021 | `…/publications/21fr/NJFRFY2021Complete.pdf` |
| 2022 | `…/publications/22fr/NJFRFY2022Complete.pdf` |
| 2023 | `…/publications/23fr/NJFRFY2023Complete.pdf` |
| 2024 | `…/publications/24fr/NJFRFY2024Complete.pdf` |
| 2025 | `…/publications/25fr/NJFY2025Complete.pdf` (FR infix dropped — special-cased) |

Column-label note: recon labeled the 2nd major fund "Transportation Trust Fund"; the actual
FY2020–FY2025 statements show **"Property Tax Relief Fund"**. The GENERAL FUND is still the 1st
column, so extraction is unaffected.

---

## Load Disposition

All 6 FYs extracted from the Governmental Funds *Statement of Revenues, Expenditures, and Changes
in Fund Balances* — GENERAL FUND column (1st of 4) — and tie **exactly ($0 diff)** to the printed
General-Fund Total for both revenues and expenditures.

| FY | Operating (Total Exp, $) | Revenue (Total Rev, $) | Tie |
|----|--------------------------|------------------------|-----|
| 2020 | 36,563,705,440 | 38,768,977,008 | $0 / $0 ✅ (old-end bookend) |
| 2021 | 43,197,990,156 | 48,182,629,272 | $0 / $0 ✅ |
| 2022 | 50,311,616,860 | 57,510,588,567 | $0 / $0 ✅ |
| 2023 | 53,640,149,629 | 61,016,633,737 | $0 / $0 ✅ |
| 2024 | 59,174,201,425 | 60,554,040,145 | $0 / $0 ✅ |
| 2025 | 59,603,886,014 | 60,979,024,211 | $0 / $0 ✅ (latest bookend) |

Both recon bookends reproduced exactly: FY2025 rev 60,979,024,211 ✅, FY2020 rev 38,768,977,008 ✅.

## NASBO replacement (RECON-08)

Pre-load: NJ node held exactly 2 NASBO operating rows — FY2023 $48,837,000,000, FY2024
$52,996,000,000 (data_source_id=null, budgetary basis), NO revenue rows, NO data_sources metadata.

Post-load (DB-confirmed): 6 operating rows (all "New Jersey State ACFR — General Fund (… GAAP
basis)") + 6 revenue rows (all "… General Fund Revenue …"), every row `source_url`/`source_date`
stamped. **ZERO "NASBO" data_source rows remain** on the NJ node; exactly one operating row per
(NJ, fy). The FY2023 + FY2024 NASBO operating rows were replaced in place (same
(muni, fy, 'operating') RPC key). Fresh `data_sources`: `nj-acfr-gf-operating` (d0f19474…),
`nj-acfr-gf-revenue` (69c50805…).

## Accept-and-relabel divergence (ACFR-19)

| Basis | FY2023 | FY2024 |
|-------|--------|--------|
| NASBO GF operating (pre-load, budgetary) | $48.837B | $52.996B |
| ACFR GF revenue (GAAP, loaded) | $61.017B | $60.554B |

NJ ACFR GF ≈ **1.15× NASBO** (smallest divergence in the tranche) — federal/intergovernmental
revenue ("Federal and other grants" ≈ $25–26B) sits inside the GAAP General Fund that NASBO's
budgetary concept excludes. Accepted-and-relabelled honestly via the GAAP basis label + source
chip; not a silent inflation.

## P2 clamp (ACFR-20)

No negative GENERAL FUND category in any loaded NJ FY (investment earnings positive every year:
FY2025 +$952,995,499 … FY2021 +$26,064,984). `clampForRender` is wired as a safety net; not
triggered.

## Idempotency (never-overwrite)

Re-ran NJ --fy 2025 (operating + revenue) live a second time → "Loaded 0 rows", source re-stamped,
no error, no duplicate rows (RPC keyed (muni, fy, dataset_type) → UPDATE-in-place). Idempotent.

## Money In

NJ now has 6 `dataset_type='revenue'` rows → the data-driven "Money In" view + `?dataset=revenue`
deep-link auto-enable on the NJ node (no frontend change).

## Cohort untouched (RECON-08) — CONFIRMED

DB spot-check after the NJ load (one transient `53300` pool-saturation retry, then clean):

| Node | operating | revenue | NASBO | Verdict |
|------|-----------|---------|-------|---------|
| California | 18 | 18 | 0 | unchanged (FY2008–2025) ✅ |
| Pennsylvania | 10 | 10 | 0 | unchanged (FY2016–2025) ✅ |
| Texas | 10 | 10 | 0 | unchanged (FY2015–2024) ✅ |
| Ohio | 6 | 6 | 0 | unchanged (FY2020–2025) ✅ |
| Georgia | 2 | 0 | 2 | still NASBO — untouched (108-04 not yet run) ✅ |
| New Jersey | 6 | 6 | 0 | this load ✅ |

All existing ACFR nodes match their RECON-08 row counts; Georgia (a Batch-1 mate not yet loaded) is
correctly still on NASBO. The NJ loaders resolve only `name='New Jersey'` so they cannot touch other
nodes. RECON-08 contract confirmed. (Phase 110 runs the authoritative full 50-node audit.)

## Deferred

NJ pre-FY2020 history: the OMB landing page exposes deeper ACFRs (FY2002–FY2019) under varying
filename patterns (`19fr/NJFR2019 Complete.pdf`, `18fr/FR 2018 Secured Final.pdf`,
`{YY}fr/pdf/fullfr{YYYY}.pdf`, etc.). Out of scope for the recon-confirmed FY2020–FY2025 clean
window; candidate for a future deepening pass (per 108-CONTEXT Deferred Ideas).
