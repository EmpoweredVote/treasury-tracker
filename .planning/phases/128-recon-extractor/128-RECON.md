# Phase 128 — Tucson ACFR Recon (TUC-01)

**Ran:** 2026-07-10 (inline execution — no subagent)
**Source:** City of Tucson ACFRs (GAAP actuals), free / no-auth, `tucsonaz.gov`.
**Archive index:** https://www.tucsonaz.gov/Departments/Business-Services-Department/Accounting-and-Finance/Annual-Comprehensive-Financial-Reports
  *(the HTML index is CDN-bot-blocked → 403 even with a browser UA; direct PDF asset URLs serve fine. Per-year URLs below were resolved via search + HTTP verification.)*

**Extraction tool:** `pdftotext -table` (poppler 4.00) — the same tool the state-ACFR loaders use. `-layout` scrambles the multi-fund columns; **`-table` is used, never `-layout`.**
**Basis:** whole dollars (not thousands) — printed FY2024 `Total revenues = $773,493,270` (9 digits).
**GF column:** the General Fund is always the **first data column** and is fully present on the statement's title page (older ACFRs column-split the *remaining* funds onto a `(Continued)` page, which we don't need).

---

## Per-year results (General Fund bookend tie)

Tie method: `Σ printed GF revenue-source rows == printed Total revenues` and `Σ printed GF expenditure-function rows == printed Total expenditures`, both required to be **exactly $0**. Verified with a positional column parser (anchors the 6 fund columns from the fully-populated `Total revenues` row; assigns each row's numbers to the nearest column; GF = column 0). Every windowed year reproduces the parser's `rev_delta == 0` and `exp_delta == 0`.

| FY | GF Total revenues | GF Total expenditures | Rev tie Δ | Exp tie Δ | Stmt pg (−table) | Status |
|----|------------------:|----------------------:|:---------:|:---------:|:----------------:|--------|
| 2024 | $773,493,270 | $648,657,363 | 0 | 0 | 50 | ✅ ties (matches §0 probe) |
| 2023 | $723,626,260 | $636,406,169 | 0 | 0 | 50 | ✅ ties |
| 2022 | $649,808,046 | $548,167,229 | 0 | 0 | 49 | ✅ ties |
| 2021 | $593,601,098 | $492,891,842 | 0 | 0 | 46 | ✅ ties |
| 2020 | $558,372,140 | $470,241,319 | 0 | 0 | 44 | ✅ ties |
| 2019 | $552,193,362 | $492,258,428 | 0 | 0 | 44 | ✅ ties |
| 2018 | $539,336,322 | $487,299,396 | 0 | 0 | 44 | ✅ ties |
| 2017 | $500,835,212 | $427,806,734 | 0 | 0 | 46 | ✅ ties |
| 2016 | $493,460,305 | $430,230,002 | 0 | 0 | 46 | ✅ ties |
| 2015 | $468,385,932 | $422,167,515 | 0 | 0 | 43 | ✅ ties |

GF revenue rises monotonically FY2015→FY2024 ($468M → $773M) — a sanity signal that the correct primary statement (not a combining/subfund page) was located every year. FY2020's expenditure dip ($470M) is a plausible COVID-year effect, not a parse error.

---

## Locked clean-extract window

**Locked clean-extract window: FY2015–FY2024 (10 contiguous years).** Every year in the range bookend-ties the General Fund column at exactly $0 on its primary governmental-funds *Statement of Revenues, Expenditures and Changes in Fund Balances*. There are **no holes inside the window.**

- **Newest boundary:** FY2025 ACFR is **not yet published** under a resolvable direct URL as of 2026-07-10 (candidate patterns `cot-2025-…` and `acfr-2024-2025.pdf` return 404). Honest newest-boundary gap — not a failure; add FY2025 when the city publishes it (~late 2026).
- **Oldest boundary:** FY2015 (`2014-2015-acfr.pdf`) is the deepest year pursued. Pre-FY2015 ACFRs may exist in the archive but were **not pursued** — 10 years is a deep, generous window for a one-off city onboarding, and pre-2015 layouts carry higher format risk. Deeper history is deferred, not blocked.

## Holes / non-extractable years

**None inside the locked window.** Every FY2015–FY2024 primary statement extracts and ties $0.

---

## Format-era notes (for the extractor — Plan 128-02)

1. **Statement title wraps.** FY2016/2017/2020 (and other older years) wrap the title as `…and Changes` / `in Fund Balances` across two lines — the page-finder must match the title **whitespace-flexibly** (allow newlines between words), or those years' primary pages are missed and a later self-tying *combining* page is wrongly selected. (This bit during recon; the working finder regex allows `\s+` between every title word.)
2. **Two layout eras:**
   - **Single-page (FY2023–FY2024):** header `General Fund` on one line; all funds on one page.
   - **Column-split `(Continued)` (FY2015–FY2022):** header wraps `General` / `Fund`; the GF column + both `Total` rows sit on the statement's title page, the *other* funds' columns spill to a `(Continued)` page. **Only the title page is needed** (GF is fully on it).
3. **No printed intermediate sub-totals.** The perfect $0 ties across all 10 years prove Tucson lists function rows directly under `Current:` and `Debt service:` **without** printing `Total Current` / `Total Debt service` rows. The extractor must therefore treat `Current` and `Debt service` as **label-only parent nodes whose value = Σ children** (computed, never read from a printed sub-total) — and must NOT sum any intermediate total row (there are none) into the leaves.
4. **Self-tie is necessary but not sufficient.** A combining/subfund statement can self-tie on a smaller number (FY2020 briefly matched a $204M combining page; FY2017 a $9.9M subfund page). The finder must select the **primary** statement — earliest qualifying page, title matched, `Combining`/`Reconciliation`/`Budgetary`/`Net Position`/`Proprietary`/`Fiduciary` excluded. The monotonic GF-revenue sanity column above is the cross-check that the right page was chosen.
5. **Landmines confirmed present:** wrapped `Community enrichment and` / `development` label; `$` glyphs and blank cells in non-GF columns (e.g. GF `Developer fees` is blank → must resolve to 0, not borrow the Non-Major column's number); parenthesized negatives in the fund-balance rollforward rows (excluded from the leaf trees).

---

## Durable per-year PDF URLs (all HTTP 200, `application/pdf`, verified 2026-07-10)

| FY | Local file | Durable URL |
|----|-----------|-------------|
| 2024 | `docs/Tucson/cot-2024-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/cot-2024-annual-comprehensive-financial-report.pdf |
| 2023 | `docs/Tucson/cot-2023-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/city-of-tucson-fy-2023-annual-comprehensive-financial-report-final.pdf |
| 2022 | `docs/Tucson/cot-2022-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/acfr-2021-2022.pdf |
| 2021 | `docs/Tucson/cot-2021-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/city-services/business-services/documents/city_of_tucson_annual_comprehensive_financial_report_fy_2020-2021_0.pdf |
| 2020 | `docs/Tucson/cot-2020-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2020.pdf |
| 2019 | `docs/Tucson/cot-2019-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2019.pdf |
| 2018 | `docs/Tucson/cot-2018-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2018.pdf |
| 2017 | `docs/Tucson/cot-2017-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2016-2017-acfr.pdf |
| 2016 | `docs/Tucson/cot-2016-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2015-2016-acfr.pdf |
| 2015 | `docs/Tucson/cot-2015-acfr.pdf` | https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2014-2015-acfr.pdf |

*PDFs stored in `docs/Tucson/` (gitignored via `docs/*`; downloaded on `main`, not a worktree — worktrees are unsafe for gitignored data per the v2.15 loader notes).*

**Exact extraction command (per year):** `pdftotext -table "docs/Tucson/cot-<FY>-acfr.pdf" -` → locate the primary statement page → GF = column 0.
