# 103 — PA + IL ACFR Source Location (RECON-04, PA/IL half)

**Status:** Both states located + bookend-tie-confirmed via `pdftotext -table`. $0 spend. Both are the Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* → **General Fund** column, GAAP, in thousands, FY-end June 30. Both show a TX-style scope divergence vs NASBO (federal/intergovernmental revenue sits inside the GAAP General Fund) → accept-and-relabel recommended (D-04). Recent-window (FY2023+FY2024) is covered for **both** → D-06 greenlight (no strand).

---

## Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable window (clean) | Per-year URL pattern |
|-------|------------------|------------------|-------|--------|------------------------|----------------------|
| **PA** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (printed p.58 / PDF p.~58) | **General Fund** (1st of General Fund \| Motor License Fund \| Nonmajor Funds \| Total) | thousands | Jun 30 | **FY2016–FY2025** | FY2016–FY2023: `https://www.pa.gov/content/dam/copapwp-pagov/en/budget/documents/publications-and-reports/annualfinancialreport/june-30-{YYYY}-acfr.pdf` (hyphen). **FY2024–FY2025: `…/june-30-{YYYY}%20acfr.pdf` (space, not hyphen).** Landing: `https://www.pa.gov/agencies/budget/publications-and-reports/annual-financial-report` |
| **IL** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds (printed p.36–37) | **General Fund** (1st of General Fund \| Other Nonmajor Funds \| Total Governmental Funds) | thousands | Jun 30 | **FY2021–FY2025** (FINAL audited) | Per-year variant naming under `https://illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR/`: `ACFR Final 2021.pdf`, `ACFR Final 2023 - Bookmarked.pdf`, `ACFR Final 2024 - Bookmarked.pdf`, `ACFR Final 2025 - Bookmarked.pdf` (FY2022 + naming for ≤FY2020 enumerable from the comptroller ACFR page). Landing: `https://illinoiscomptroller.gov/financial-reports-data/find-a-report/comprehensive-reporting/annual-comprehensive-financial-report/` |

> **IL — use the FINAL audited ACFR only.** The comptroller publishes a separate **"Interim … unaudited"** ACFR for each FY (e.g. `…/FY24 Interim ACFR unaudited.pdf`). Per the milestone's GAAP-audited-actuals rule, the loader must use `ACFR Final {YYYY}…pdf` and **never** the interim/unaudited file. The "Bookmarked" suffix appears on FY2023–FY2025; FY2021 has no suffix — so IL needs explicit per-year `SOURCES` entries, not a single derived pattern.

> **PA — naming changes at FY2024.** FY2016–FY2023 use a hyphen (`june-30-{YYYY}-acfr.pdf`); FY2024–FY2025 use a literal space (`june-30-{YYYY}%20acfr.pdf`). The PA `SOURCES` map must special-case FY2024+.

## Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|-------------------|-----------|
| **PA** | FY2024 (latest) | **$91,293,027K** | General-column line items sum exactly to 91,293,027; columns sum to printed Total $106,814,395K ✅ |
| **PA** | FY2023 (old-end-recent) | **$95,231,042K** | columns sum to printed Total $110,084,055K ✅; cross-confirms the FY2024 ACFR's MD&A comparative ("95,232" prior year) |
| **IL** | FY2025 (latest) | **$78,342,927K** | General + Other Nonmajor = printed Total $114,706,447K ✅ |
| **IL** | FY2023 (old-end-recent) | **$73,827,795K** | General-column line items sum exactly to 73,827,795; columns sum to printed Total $112,874,196K ✅ |

IL FY2021 confirmed as a durable real PDF (the clean old-end). PA FY2016 confirmed durable (hyphen pattern); PA FY2015 + earlier use variant naming (optional further extension).

## Four risk facts (D-05)

| Fact | PA | IL |
|------|----|----|
| **Units** | thousands | thousands |
| **Negative GF line items** | none in FY2023/FY2024 General Fund (investment earnings positive) | none in FY2023/FY2025 General Fund (interest/investment income positive) — older years TBD at load |
| **Exact column header + statement** | "General Fund", Governmental Funds *Statement of Rev/Exp/Changes in Fund Balances* (NOT Statement of Activities, NOT budgetary comparison) | "General Fund", Governmental Funds *Statement of Rev/Exp/Changes in Fund Balances* (NOT Statement of Activities) |
| **FY-end month** | June 30 ✓ | June 30 ✓ |

## Scope vs NASBO (D-04 — TX-trap analysis)

| State | ACFR GF Total revenues (latest) | NASBO GF operating (current node, ~) | Ratio | Driver | Recommendation |
|-------|--------------------------------|--------------------------------------|-------|--------|----------------|
| **PA** | ~$91B (FY2024) | ~$45B | **~2.0×** | **Intergovernmental (federal) = $42.3B sits inside the GAAP General Fund** (NASBO's budgetary GF excludes it) | **Accept-and-relabel honestly** (TX precedent): the ACFR General Fund is PA's audited GAAP general-fund-equivalent; relabel basis + per-node source chip. Confirm at Phase-105 load. |
| **IL** | ~$78B (FY2025) / ~$74B (FY2023) | ~$50B | **~1.5×** | **Federal government = $22.1B inside the GAAP General Fund** | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-105 load. |

Both divergences are the same mechanism as TX's General Revenue Fund (~3×): the GAAP "General Fund" consolidates federal/intergovernmental revenue that NASBO's budgetary "general fund" concept reports separately. The per-node basis label + source chip make this honest. Recon recommends accept-relabel for both; the accept/relabel call is confirmed at Phase-105 load.

## Recent-window verdict (D-06)

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **PA** | FY2025 | ✅ | ✅ | **GREENLIGHT** — NASBO replacement won't strand recent years. |
| **IL** | FY2025 (final audited; FY2024 final audited also exists) | ✅ | ✅ (`ACFR Final 2024 - Bookmarked.pdf`) | **GREENLIGHT** — use the FINAL audited FY2024, NOT the interim/unaudited file. |

Neither state triggers the D-06 strand flag — both have final audited ACFRs through at least FY2024 (and FY2025), so replacing their NASBO FY2023/FY2024 rows is a strict upgrade.

## Phase-105 load notes

- **PA loader:** new loader on the v2.11 pattern; GF statement layout (General Fund \| Motor License \| Nonmajor \| Total) is closest to a 3-major-column ACFR — a clean `-table` read. SOURCES map must special-case the FY2024+ space-in-filename. Window FY2016–FY2025.
- **IL loader:** new loader on the v2.11 pattern; GF statement is simpler (General Fund \| Other Nonmajor \| Total). SOURCES map needs explicit per-year URLs (variant naming) and must point ONLY at `ACFR Final …` files. Window FY2021–FY2025 (FY2022 + ≤2020 naming to enumerate if deeper coverage wanted).
- Both: revenue-by-source + spend-by-function both extract from the same statement; units thousands; relabel General Fund honestly per D-04.
