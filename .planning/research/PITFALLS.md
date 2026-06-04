# Pitfalls Research: v1.6 California City Expansion
**Researched:** 2026-06-03

---

## Pitfall Catalog

### 1. Long Beach Non-Standard Fiscal Year Causes Label Ambiguity
- **Description:** Long Beach runs October 1 – September 30, so "FY2025" means Oct 2024–Sep 2025. Every other city in this milestone (and in the app) uses July 1 – June 30, where "FY2025" means Jul 2024–Jun 2025. The DB stores fiscal year as an integer. When a user views the year-selector and picks 2025, Long Beach's data covers a different 12-month window than every other city's FY2025. No structural error occurs, but the data represents an overlapping-but-offset period relative to the other cities — which is silently misleading.
- **Severity:** Minor (data loads correctly; interpretation is ambiguous)
- **Cities at risk:** Long Beach only
- **Prevention:** Add a comment in the Long Beach seeder script explicitly documenting the Oct–Sep convention. Consider adding a `fiscal_year_note` or annotation field to the data source row (or just document it in the phase plan). Do NOT try to remap Long Beach's FY integers — this would break year-selector display. Accept the convention and document it.
- **Phase to address:** Phase 26 (Long Beach data load)

---

### 2. Biennial Budget PDFs Require Per-Year Extraction
- **Description:** Oakland and Riverside each publish a single budget document covering two fiscal years (e.g., Oakland FY2023-25 covers FY2024 and FY2025 in one PDF; Riverside FY2024-26 covers both years similarly). The existing PDF pipeline (bulkLoadPDF.js) was designed around single-year adopted budget documents. Biennial PDFs contain side-by-side year columns in budget tables; extracting the correct year's figures requires either (a) targeting only one year's column, or (b) running two separate extraction passes over the same PDF with different year targets. Risk: loading Year 1 data under a Year 2 label, or summing both years' columns accidentally.
- **Severity:** Blocking (without mitigation, data will be wrong)
- **Cities at risk:** Oakland, Riverside
- **Prevention:** For each biennial city, run two separate extraction passes — one for each fiscal year — with explicit column targeting instructions in the extraction prompt. Validate each year's extracted total against the known adopted total (Oakland ~$2.1B/year, Riverside ~$1.45B/year). Plan for approximately 2x effort on these two cities relative to single-year cities.
- **Phase to address:** Oakland phase and Riverside phase (separate plans for each FY extraction)

---

### 3. Enterprise Fund Inflation Across Multiple Cities
- **Description:** Several cities have large enterprise funds that will produce inflated all-funds totals if not filtered. LA's double-counting fix (WHERE exclusion for enterprise funds) established the pattern, but each city's fund structure is different. Relevant cases:
  - Long Beach: Gas, Refuse, Water, Airport, Development Services, Harbor enterprise funds — enterprise portion ~$1.15B of $3.6B all-funds total; Port of Long Beach (~$760M) is a *separate legal entity* and must not be included at all
  - San Jose: Airport (SJC), Wastewater, Water Utility, Parking — 100+ individual funds; enterprise funds are self-sustaining via user fees
  - Fresno: Enterprise + internal service funds total ~$899M vs $483M General Fund — enterprise exceeds general fund in dollar terms
  - Riverside: Riverside Public Utilities (RPU) is a full municipal electric utility serving 112,000 customers — among the largest enterprise assets in this city set
- **Severity:** Blocking for display accuracy; minor for data load (data loads either way, but totals mislead citizens)
- **Cities at risk:** Long Beach (HIGH), Fresno (HIGH), Riverside (HIGH), San Jose (MEDIUM)
- **Prevention:** During data load for each city, identify the fund type or fund category column in the source data. If loading all-funds, apply `where_extra` to filter to General Fund (or equivalent operating funds) only — matching the pattern already established for LA. Confirm filtered totals against known General Fund figures before marking load complete. Sacramento and Oakland are lower risk (general fund is documented as ~39–40% of total budget).
- **Phase to address:** Each city's load phase; validate totals against documented GF figures

---

### 4. Port of Long Beach Must Not Be Included
- **Description:** The Port of Long Beach is a legally separate government entity with its own ~$760M annual budget and its own Comprehensive Annual Financial Report. It is NOT part of the City of Long Beach budget. However, some aggregate sources cite combined figures that could include port revenue or expenditures. Any scraper or PDF extraction that pulls from an "all funds" or "total city resources" summary page risks accidentally including port data.
- **Severity:** Blocking (would inflate Long Beach totals by ~21%)
- **Cities at risk:** Long Beach only
- **Prevention:** Load only from City of Long Beach adopted budget documents (longbeach.gov/finance), not from port documents. When extracting from budget PDFs, verify that the fund list does not include "Harbor Fund" (the city does have a Harbor Department fund — distinct from the Port Authority). Cross-check the extracted total against the known ~$1.5B General Fund or ~$3.6B all-funds city figure.
- **Phase to address:** Phase 26 (Long Beach)

---

### 5. Socrata API Not Available for Most Cities — PDF Pipeline Required
- **Description:** Treasury Tracker's generic `bulkLoadBudget.js` was proven on Dallas, LA, SF, and SD — all of which have Socrata SODA API endpoints. Research did not confirm Socrata availability for any of the 7 new cities. San Jose uses OpenGov (different API, not Socrata). Sacramento has an Open Data portal that *may* be Socrata-compatible but was not confirmed. Oakland uses OpenBudget Oakland (custom portal). Fresno, Riverside, and Bakersfield appear to be PDF-only. This means the default assumption of reusing `bulkLoadBudget.js` will likely fail for most or all of these cities; `bulkLoadPDF.js` will be the primary loader.
- **Severity:** Blocking (workflow assumption is wrong for most cities)
- **Cities at risk:** All 7 cities — Fresno (HIGH risk PDF-only), Riverside (HIGH), Long Beach (HIGH), Oakland (MEDIUM — custom portal), San Jose (MEDIUM — OpenGov), Sacramento (MEDIUM — verify), Bakersfield (MEDIUM — Open Budget portal)
- **Prevention:** For each city, confirm the data access method during phase research before beginning the load plan. Check whether Sacramento's data.cityofsacramento.org dataset is Socrata-compatible (look for `/api/views/` URL pattern). For Bakersfield's budget.bakersfieldcity.us, check if it exposes a downloadable CSV or API. Assume PDF pipeline unless confirmed otherwise.
- **Phase to address:** Each city's research/planning phase — confirm data source before writing load scripts

---

### 6. Sacramento Slash-Format Fiscal Year Labels
- **Description:** Sacramento labels its budget years as "FY2024/25" (slash format) rather than "FY2025" (integer). This appears in official budget document titles, Open Data portal dataset names, and press coverage. The Treasury Tracker DB stores fiscal year as an integer. If a seeder script naively parses "FY2024/25" as a string without normalization, it may produce incorrect year values (e.g., parsing "2024" instead of "2025", or failing to parse at all). The established convention in this app is to use the ending year as the fiscal year integer (FY2024/25 → 2025).
- **Severity:** Minor (data loads correctly once convention is chosen; risk is inconsistency)
- **Cities at risk:** Sacramento only
- **Prevention:** In the Sacramento seeder, explicitly document that "FY2024/25" maps to integer `2025`. If pdftotext extraction is used, add a regex that handles both `YYYY/YY` and `YYYY-YY` slash patterns and normalizes to the ending year. Cross-check with the existing Troutdale parser which used `YYYY-YY` dash format.
- **Phase to address:** Sacramento load phase

---

### 7. Large PDF Budget Books Risk Truncation and Missing Departments
- **Description:** San Jose's budget document is confirmed at 400+ pages. Fresno's adopted budget PDF is large (multi-fund, multi-department). The PDF vision pipeline sends pages to Claude Haiku with max_tokens=8192. The v1.2 "Unknown department" fix addressed cross-page section context, but very large PDFs still risk: (a) department header on page N, line items on pages N+1 through N+5 — context window covers N+1 but not N+5; (b) fund-level summary pages that mix multiple departments without clear delimiters; (c) total page count exceeding the pipeline's batch processing tolerance. Sacramento and Oakland are also large but somewhat smaller scope.
- **Severity:** Minor to Moderate (produces "Unknown" department attributions or missed line items rather than blocking load)
- **Cities at risk:** San Jose (HIGH — 400+ pages), Fresno (MEDIUM — large CIP section), Oakland (MEDIUM — biennial complexity compounds this)
- **Prevention:** For San Jose and Fresno, pre-process PDFs with pdftotext to identify department header pages; use targeted page-range extraction rather than full-document extraction. Run a dry-run sanity check comparing extracted department count vs. expected number of departments listed in the budget table of contents. Set SANITY_MAX appropriately for each city's known total (San Jose ~$5.3B all-funds, ~$1.7B GF; Fresno ~$2.0B all-funds, ~$483M GF).
- **Phase to address:** San Jose phase and Fresno phase (plan for targeted extraction approach)

---

### 8. Oakland "General Purpose Fund" Terminology Mismatch
- **Description:** Oakland calls its primary unrestricted fund the "General Purpose Fund" (GPF), not the "General Fund." Budget documents, press coverage, and OpenBudget Oakland all use GPF. If any seeder script or enrichment prompt uses "General Fund" as a filter criterion or category label, it will fail to match Oakland's actual fund name in source data. This is a terminology trap that is easy to overlook when porting logic from other CA cities.
- **Severity:** Minor (causes wrong fund filter or category mismatch, not a crash)
- **Cities at risk:** Oakland only
- **Prevention:** In Oakland seeder and any where_extra filters, use "General Purpose Fund" or "GPF" — not "General Fund." Document this in the Oakland phase plan. Cross-check extracted GPF total against known ~$820M/year figure to confirm correct fund was targeted.
- **Phase to address:** Oakland load phase

---

## Enterprise Fund Risk by City

| City | Risk Level | Notes |
|------|-----------|-------|
| Long Beach | HIGH | Harbor, Gas, Water, Airport, Refuse, Development Services enterprise funds; Port of Long Beach is separate entity (exclude entirely) |
| Fresno | HIGH | Enterprise + internal service funds (~$899M) exceed General Fund ($483M); Measure C/P special revenue further inflates all-funds total |
| Riverside | HIGH | Riverside Public Utilities (RPU) is a full municipal electric utility — unusual for a city this size; Water, Refuse, Sewer also enterprise |
| San Jose | MEDIUM | Airport (SJC), Wastewater, Water Utility, Parking all enterprise; 100+ total funds but well-documented by the city |
| Oakland | MEDIUM | Restricted funds (grants, voter bonds) make up 61% of all-funds budget; GPF is only 39% (~$820M/year) |
| Sacramento | LOW | Annual budget; Open Budget portal separates fund types clearly; smaller enterprise footprint than other cities |
| Bakersfield | LOW | Smallest budget in the set (~$853M all-funds); General Fund likely ~$250–350M; Open Budget portal provides fund-level breakdown |

---

## Enrichment Cost Estimate

Enrichment uses Claude Haiku via the `enrichCategories.js` pipeline. Based on prior runs:
- Gresham OR: 33 enrichment rows → ~$0.01 per run (confirmed in STATE.md Phase 21 decision)
- Portland OR: 41 enrichment rows → similar cost

Scaling to 7 CA cities:
- Estimated categories per city: 30–45 operating + 10–15 revenue = ~40–50 enrichment calls per city
- 7 cities × ~45 calls = ~315 total enrichment calls
- At Haiku pricing (~$0.25/M input + $1.25/M output tokens), each enrichment call at ~300 tokens input + ~150 tokens output ≈ $0.0002/call
- 315 calls × $0.0002 = **~$0.06 total**

This is well under the $5 threshold. Run enrichment per city (one `--city --state` invocation each) rather than batching across cities, so any single-city failure does not block others. Idempotent upserts via `name_key` mean re-runs are safe at no meaningful additional cost.

**Recommended approach:** Run enrichment after each city's budget data is confirmed loaded and validated. Do not batch all 7 cities into a single enrichment run — prefer city-by-city to isolate any prompt or category issues.

---

## Population Data Source

All 7 cities are California incorporated places. The same Census sub-estimate file used for TX cities applies:

- **File:** `sub-est2024_06.csv` (state FIPS 06 = California)
- **Source:** Census Bureau Vintage 2024 Population Estimates, Sub-county files
- **URL pattern:** `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_06.csv`
- **Field:** POPESTIMATE2024, filtered to SUMLEV=162 (incorporated places) and matching PLACE name

Confirmed 2024 population estimates (from FEATURES.md research):

| City | 2024 Population |
|------|----------------|
| Long Beach | 450,917 |
| San Jose | 997,368 |
| Sacramento | 535,798 |
| Oakland | 443,554 |
| Fresno | 550,105 |
| Riverside | 323,757 |
| Bakersfield | 417,468 |

These figures should be verified against the sub-est2024_06.csv file at load time. The Census sub-estimate file is the authoritative source (same methodology used for all TX and OR cities already in the app).

---

## Validation Approach

Per-city sanity check strategy — validate extracted totals against these known figures before marking any city's load complete:

| City | Expected Op. Budget Total | Expected GF Total | FY | Notes |
|------|--------------------------|-------------------|----|-------|
| Long Beach | ~$3.6B (FY2025 all-funds) | ~$1.5B | FY2025 | Oct–Sep FY; filter enterprise funds |
| San Jose | ~$5.3B (FY2025 all-funds) | ~$1.7–1.9B | FY2025 | 100+ funds; use GF as primary validation target |
| Sacramento | ~$1.57B (FY2025 all-funds) | Not confirmed | FY2025 | Annual budget; confirm GF split from portal |
| Oakland | ~$2.1B/year (GPF ~$820M) | ~$820M GPF | FY2025 | Biennial doc; validate one year at a time |
| Fresno | ~$2.0B (FY2025 all-funds) | ~$483M GF | FY2025 | Enterprise > GF; Measure C/P in restricted funds |
| Riverside | ~$1.45B/year (all-funds) | Not confirmed | FY2025 | Biennial doc; RPU inflates enterprise portion |
| Bakersfield | ~$853M (FY2026 all-funds) | ~$250–350M est. | FY2026 | Smallest city; Open Budget portal for validation |

**Sanity check rule:** If extracted total is more than 20% above the expected all-funds figure, suspect enterprise fund double-counting or biennial year conflation. If more than 50% below, suspect wrong fund filter or missed department sections.
