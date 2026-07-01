# 109-05 MI LOADLOG — Michigan ACFR GAAP Upgrade (Sep-30 FY-end exception)

**Node:** Michigan `38c9f1ff-130e-423d-955a-6f0aa5aecae2` · **Executed:** 2026-07-01 · **Spend:** $0

## Load Disposition

**Attempted window (D-01):** FY2019–FY2025 (7 yrs — full available archive; pre-FY2019 not listed). **Loaded: 7/7 — 0 holes.**

| FY (Oct–Sep) | Operating (GF Total Exp, $) | Revenue (GF Total Rev, $) | Tie (thousands) |
|----|---------------------------|--------------------------|-----|
| 2019 | 36,124,451,000 | 36,674,832,000 | 0 / 0 |
| 2020 | 38,474,725,000 | **39,920,656,000** (bookend ✅) | +1 / 0 |
| 2021 | 42,797,164,000 | 45,816,490,000 | 0 / −1 |
| 2022 | 47,059,185,000 | 51,687,153,000 | 0 / +1 |
| 2023 | 50,245,666,000 | 50,134,359,000 | 0 / +1 |
| 2024 | 52,289,162,000 | 52,482,154,000 | 0 / 0 |
| 2025 | 55,592,047,000 | **53,788,610,000** (bookend ✅, printed; line-sum +1) | −1 / +1 |

All diffs ≤ $1K = documented GAAP thousands-rounding (TOL=5, MA/MD precedent); no real mis-ties.

## September-30 FY-end semantics (D-03) — verified live
- Every MI budgets row: `source_date = {FY}-09-30` (**0 non-Sep-30 dates** in DB check).
- Every MI budgets row: `fiscal_year_start_month = 10` (**0 wrong values**) — set in the data_sources payload (RPC-propagated per migration 20260613120000) + belt-and-suspenders post-RPC stamp.
- FY labels align to NASBO's designation: ACFR "FY2025" = Oct 2024–Sep 2025 = NASBO "FY2025" ✓.

## Fund-10 column (recon risk fact) — verified
Column headers are fund codes (10 | 20 | 30 | 70). GF = Fund 10 = 1st numeric column; the ~$19.5B School Aid Fund (Fund 20) never bled in — the FY2025 bookend (53,788,610K, not 73M+) is the proof.

## Parser generalizations forced by MI (recorded in maAcfrExtract.mjs)
1. **Case-insensitive header match** in the positional variant — MI prints "GENERAL FUND" / "GOVERNMENTAL FUNDS" all-caps; the case-sensitive `/General/` check missed the statement entirely.
2. **"(Note NN)" cross-reference stripping** — MI's "Tax credits (Note 16)" line: the bare "16" was read as the first numeric column, dropping $1.588B from the GF expenditure sum. Stripped position-preservingly before tokenizing.
Regression-checked: TN FY2009, CT FY2002/FY2005, WI FY2011 all still tie $0.

## URL special-case (confirmed at load)
FY2025 = `FY-2025-ACFR.pdf` (reversed name) vs `ACFR-FY{YYYY}.pdf` FY2019–FY2024; no query params needed. All 7 real PDFs (2.2–13.2 MB).

## NASBO replacement (RECON-08)
Pre-load baseline: exactly 2 NASBO operating rows — FY2023 **$14,861M**, FY2024 **$15,129M**, 0 revenue rows. Post-load: **14 rows (7 op + 7 rev), 0 NASBO, 0 dups, 0 unsourced** — NASBO FY2023/FY2024 replaced in place.

## Accept-and-relabel divergence (D-07, ACFR-19) — THE TRANCHE'S LARGEST
MI ACFR GAAP GF vs NASBO budgetary GF: FY2023 operating $50,246M vs $14,861M (**3.38×**); FY2024 $52,289M vs $15,129M (**3.46×**); recon's ~3.56× (revenue-side) confirmed in range. Driver: **~$30.3B "From federal agencies"** (Medicaid federal match + ARP passthrough) inside the GAAP GF vs NASBO's narrow budgetary fund — the TX-trap at its most pronounced. Documented prominently in both loader headers; every row GAAP-basis-labelled.

## P2 clamp (D-06, ACFR-20)
No standalone investment-income line (embedded in Miscellaneous) — no negative categories in any loaded year, as recon predicted. clampForRender wired as safety net; not triggered.

## Idempotency (D-09)
FY2025 re-run (operating + revenue) → 14 rows, 0 dups, totals unchanged — **0 net change**.

## Money In
7 revenue rows live → Money In auto-enabled on the MI node.

## Cohort untouched (RECON-08) — full 50-state check
Post-load: **19 ACFR states** (14 pre-109 + TN/CT/WI/WA/MI), **31 clean NASBO states** (exactly 2 NASBO rows each), **0 anomalies**.
