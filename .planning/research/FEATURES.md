# Feature Research: v1.6 California City Expansion

**Researched:** 2026-06-03
**Milestone:** v1.6 — Seven new California cities added to Treasury Tracker

---

## City Data Profiles

### Long Beach, CA

- **Population:** ~451,000 (ACS 2024 1-year estimate: 450,917)
- **Operating budget total:** ~$3.6B total all funds (FY2025, Oct 2024–Sep 2025); ~$3.7B FY2026
- **General Fund:** ~$1.5B estimated (general services portion; enterprise funds account for ~32% of total, roughly $1.15B)
- **Revenue budget total:** Revenue data is included in the adopted budget documents; not broken out as a standalone document, but is present within the full budget book
- **Fiscal years available:** FY2005 through FY2026 (22 years of adopted budget documents published on longbeach.gov/finance)
- **Fiscal year calendar:** October 1 – September 30 (non-standard; does NOT align with July–June CA norm)
- **Data quality notes:**
  - Large enterprise fund complex: Gas, Refuse, Water, Airport, Development Services, and Harbor each operate as self-contained enterprise funds. The Harbor Department alone has its own Comprehensive Annual Financial Report.
  - Port of Long Beach is a separate entity (~$760M annual budget) and is NOT part of the city budget — do not include it.
  - October–September fiscal year means FY25 = Oct 2024–Sep 2025. All year labels must be confirmed carefully during data load to avoid off-by-one confusion with other CA cities.
  - City is facing a projected $28M General Fund deficit in coming years (oil revenue decline); budget documents include both General Fund and all-funds figures.
  - Budget book is available as PDF sections; no interactive OpenGov portal confirmed for Long Beach.

---

### San Jose, CA

- **Population:** ~997,000 (ACS 2024: 997,368 — just under 1 million)
- **Operating budget total:** ~$5.3B total all funds (FY2024-25 adopted); ~$6.1B is cited in some sources but appears to include capital
- **General Fund:** ~$1.7B–$1.9B estimated (general fund is a subset; city operates 100+ individual funds)
- **Revenue budget total:** Revenue data is embedded in the adopted operating budget book; Financial Transparency Portal (sanjoseca.opengov.com) provides interactive access
- **Fiscal years available:** FY1999-2000 through FY2025-26 (25+ years; archived budget documents confirmed at sanjoseca.gov; FY2019-20 through FY2025-26 are recent and confirmed accessible)
- **Fiscal year calendar:** July 1 – June 30 (standard California)
- **Data quality notes:**
  - Over 100 funds in the budget structure. Enterprise funds include: Airport (SJC), Wastewater Treatment, Water Utility, and Parking — all intended to be self-sustaining via user fees and do not draw on General Fund.
  - $35.6M current-year gap and a projected FY2026 deficit of $25.9M; budget documents reflect ongoing structural challenges.
  - OpenGov Financial Transparency Portal is available for interactive exploration.
  - Largest city in the set; budget documents are comprehensive PDFs, typically 400+ pages.

---

### Sacramento, CA

- **Population:** ~536,000 (2024 estimate: 535,798)
- **Operating budget total:** ~$1.57B–$1.7B total all funds (FY2024-25: ~$1.57B proposed / $1.6B approved; FY2025-26: $1.7B adopted)
- **General Fund:** Not confirmed separately from search results; budget documents required for breakdown
- **Revenue budget total:** Revenue data present in adopted budget PDFs; Open Budget Sacramento (openbudgetsac.org) provides visualization
- **Fiscal years available:** FY2013 through FY2026-27 confirmed via Open Data portal (data.cityofsacramento.org) and official budget documents page; FY2020-21 confirmed PDF link found
- **Fiscal year calendar:** July 1 – June 30 (standard California)
- **Data quality notes:**
  - Budget is labeled as "FY2024/25" (slash format) rather than "FY2025" — be precise during data load.
  - FY2025-26 budget closed a $62.2M deficit without layoffs; documents include detailed fund summaries.
  - Open Budget Sacramento portal exists for visualization but data may lag official documents.
  - Sacramento uses an annual budget cycle (not biennial), which means a new document each year — straightforward for loading.

---

### Oakland, CA

- **Population:** ~444,000 (2024 estimate: 443,554)
- **Operating budget total:** ~$2.1B per year average (biennial FY2023-25: ~$4.26B total for two years; biennial FY2025-27: ~$4.2B adopted June 2025)
- **General Fund (General Purpose Fund):** ~39% of total budget, roughly $820M/year
- **Revenue budget total:** Revenue data is embedded in biennial budget books; Open Budget Oakland (openbudgetoakland.org) provides visualization
- **Fiscal years available:** FY2019-21 biennial through FY2025-27 biennial; previous biennial budgets going back to at least FY2013 available via Oakland's Previous Years Budget Information page
- **Fiscal year calendar:** July 1 – June 30 (standard California); BIENNIAL budget cycle — one budget document covers two fiscal years
- **Data quality notes:**
  - BIENNIAL budget cycle is the key complexity: Oakland adopts a two-year budget every odd year (FY2019-21, FY2021-23, FY2023-25, FY2025-27). Midcycle amendments are adopted in the even year. This means loading requires extracting year-by-year figures from a multi-year document.
  - "General Purpose Fund" (GPF) is Oakland's term for what most cities call the General Fund; 39% of budget.
  - Restricted funds (grants, voter-approved bonds) make up 61% of budget — these often inflate all-funds totals and should be noted during validation.
  - City facing structural $265M two-year deficit for FY2025-27; budget includes cuts to vacant positions.
  - Open Budget Oakland portal exists; ACFR (Annual Comprehensive Financial Report) published annually.
  - Measure A sales tax (approved April 2025) adds ~$30M/year in new general revenue.

---

### Fresno, CA

- **Population:** ~550,000 (2024 estimate: 550,105 — largest of the five mid-size cities in this set)
- **Operating budget total:** ~$2.0B total all funds (FY2025: ~$2.0B; FY2026: $2.36B adopted); FY2027 proposed at ~$2.55B — rapidly growing
- **General Fund:** ~$483M (FY2025); ~$512M (FY2026)
- **Revenue budget total:** Revenue data embedded in adopted budget PDF; general fund revenue ~80% from property tax, sales tax, business license, and room tax
- **Fiscal years available:** FY2013 through FY2027 (both adopted and proposed) confirmed at fresno.gov/finance/budget — 14+ years of PDFs
- **Fiscal year calendar:** July 1 – June 30 (standard California)
- **Data quality notes:**
  - Budget has grown significantly: ~$1.7B in FY2022, ~$2.0B in FY2025, ~$2.36B in FY2026. Rapid growth driven by Measure C (transportation) and large capital program (~$1B in CIP projects in FY2026).
  - FY2025 Adopted Budget PDF confirmed accessible at fresno.gov/wp-content/uploads/2024/10/FY-2025-ADOPTED-BUDGET.pdf.
  - Enterprise and internal service funds total ~$899M in FY2025 (versus $483M general fund); confirms significant enterprise complexity — utilities, transit, etc.
  - Measure C and Measure P are major special revenue funds; these are voter-approved and restricted, not general purpose. They inflate all-funds totals substantially.
  - No OpenGov portal confirmed for Fresno; data access is PDF-based.

---

### Riverside, CA

- **Population:** ~324,000 (2024 estimate: 323,757)
- **Operating budget total:** ~$1.45B per year (biennial FY2024-26: $1.45B/year adopted)
- **General Fund:** Not confirmed separately; General Fund plus Measure Z comprise unrestricted funds
- **Revenue budget total:** Revenue data embedded in biennial budget book PDF; Open Budget portal exists (budget.countyofriverside.us — note this is the COUNTY portal, city uses riversideca.gov)
- **Fiscal years available:** FY2004-05 through FY2024-26 biennial confirmed at riversideca.gov/finance/budget.asp; includes FY2020-21, FY2021-22, FY2022-24 biennial, FY2024-26 biennial
- **Fiscal year calendar:** July 1 – June 30 (standard California); BIENNIAL budget cycle
- **Data quality notes:**
  - BIENNIAL budget cycle: Riverside adopts a two-year budget (similar to Oakland). FY2024-26 is the current biennial. This means loading requires extracting individual fiscal year figures from a two-year document.
  - Major enterprise funds: Electric (Riverside Public Utilities — RPU is a publicly-owned utility serving 112,000 electric customers), Water (66,000 metered customers), Refuse, and Sewer. RPU is one of the more unusual enterprise assets among this city set — a full municipal electric utility.
  - Measure Z is a voter-approved public safety tax providing unrestricted general revenue.
  - Budget book URL pattern: riversideca.gov/finance/PDF/FY24-26%20Budget/FY%202024-2026%20Budget%20Book.pdf
  - Do NOT confuse with Riverside County budget (rivco.gov) — two separate governments.
  - Budget documents are PDFs; no confirmed city-level OpenGov interactive portal (county has one, city does not appear to).

---

### Bakersfield, CA

- **Population:** ~417,000 (2024 estimate: 417,468)
- **Operating budget total:** ~$853M total (FY2025-26: $852.7M adopted — operating $765M + capital $87.5M)
- **General Fund:** Not confirmed separately from available sources; budget portal required
- **Revenue budget total:** Revenue data in adopted budget and Open Budget portal (budget.bakersfieldcity.us)
- **Fiscal years available:** FY2020-21 confirmed (PDF links found); Open Budget portal provides interactive access; Annual Comprehensive Financial Reports available back to at least FY2020
- **Fiscal year calendar:** July 1 – June 30 (standard California)
- **Data quality notes:**
  - Smallest budget in this set at ~$853M total; General Fund is likely ~$250–350M (not confirmed from available sources — Open Budget portal required for exact figures).
  - Open Budget portal (budget.bakersfieldcity.us) is the best source for interactive data; covers revenues, expenditures, and CIP with adopted vs. amended vs. actual year-to-date data.
  - Budget document format: annual cycle (not biennial); July–June fiscal year.
  - FY2025-26 was adopted June 25, 2025 (recent).
  - Budget labels: Bakersfield may use FY2024-25 or FY25 style labels — confirm during load.
  - Less press coverage and fewer secondary sources than the larger cities; Open Budget portal is primary data access point.

---

## Coverage Summary

| City | Op. Budget | Revenue | FY Range | Population | FY Calendar | Notes |
|------|-----------|---------|----------|------------|-------------|-------|
| Long Beach | ~$3.6B | In budget docs | FY05–FY26 | ~451K | Oct–Sep | Non-standard FY; large enterprise complex |
| San Jose | ~$5.3B | In budget docs / OpenGov | FY00–FY26 | ~997K | Jul–Jun | 100+ funds; airport, water, sewer enterprise |
| Sacramento | ~$1.6B | In budget docs / OpenBudget | FY13–FY27 | ~536K | Jul–Jun | Annual budget; slash-format FY labels |
| Oakland | ~$2.1B/yr | In budget docs / OpenBudget | FY19–FY27 | ~444K | Jul–Jun | Biennial; General Purpose Fund (not General Fund) |
| Fresno | ~$2.0B | In budget docs | FY13–FY27 | ~550K | Jul–Jun | Fast growth; large Measure C/P special revenue funds |
| Riverside | ~$1.45B | In budget docs | FY04–FY26 | ~324K | Jul–Jun | Biennial; municipal electric utility (RPU) |
| Bakersfield | ~$853M | OpenBudget portal | FY20–FY26 | ~417K | Jul–Jun | Smallest; Open Budget portal primary source |

---

## Gaps and Deferred Items

### Confirmed gaps requiring phase-specific research

1. **General Fund breakdowns not confirmed for Riverside and Bakersfield.** All-funds totals are confirmed but general fund vs. enterprise fund splits need the full budget PDFs. Expect these during data load, not pre-load.

2. **Long Beach non-standard fiscal year (Oct–Sep) requires label mapping.** All other cities use Jul–Jun. The Treasury Tracker year selector will need to handle Long Beach's FY labels distinctly or document the convention used during load (e.g., "FY2025" = Oct 2024–Sep 2025 for Long Beach, but = Jul 2024–Jun 2025 for the others).

3. **Oakland and Riverside biennial budget extraction.** Both cities publish a single document covering two fiscal years. The data load process will need to extract per-year figures from a multi-year document rather than reading a single-year adopted budget. This adds complexity; plan for ~2x effort on these two cities.

4. **Revenue budget availability for Riverside and Bakersfield not independently confirmed.** Revenue is expected to be present in the budget PDFs (standard municipal practice), but was not confirmed from available search sources. Verify before claiming revenue coverage.

5. **Historical depth beyond FY2020.** Research confirmed FY2020+ documents for all cities. Pre-FY2020 data may exist but was not fully explored. Given Treasury Tracker's typical 5-year display window, FY2020–FY2026 (or FY2026 equivalent) is sufficient for v1.6.

6. **Population data source for per-capita display.** All figures above are 2024 ACS estimates. If the app uses a specific vintage (e.g., Census Bureau QuickFacts PST045224 vintage), confirm the exact values at load time.

### Items out of scope for v1.6

- Port of Long Beach (~$760M) — separate entity, not city budget
- Riverside County budget — separate from City of Riverside
- Sacramento County budget — separate from City of Sacramento
- Kern County budget — separate from City of Bakersfield
- Pre-FY2020 historical data for any city
- CAFR/ACFR financial statements (actuals) — v1.6 loads adopted budget documents only

---

## Sources

- Long Beach FY2025 budget adoption press release: https://www.longbeach.gov/press-releases/long-beach-city-council-adopts-fiscal-year-2025-budget/
- Long Beach budget archive (FY05–FY26): https://www.longbeach.gov/finance/city-budget-and-finances/budget/budget-information/
- San Jose budget documents (FY19–FY26): https://www.sanjoseca.gov/your-government/departments-offices/office-of-the-city-manager/budget/budget-documents
- San Jose enterprise funds guide: https://www.sanjoseca.gov/your-government/departments-offices/office-of-the-city-manager/budget/budgeted-funds-guide
- Sacramento FY2025-26 adopted budget: https://sacramentocityexpress.com/2025/06/11/city-council-adopts-1-7-billion-budget-for-fy2025-26-avoids-layoffs-despite-deficit/
- Sacramento open data (FY2013+): https://data.cityofsacramento.org/datasets/city-of-sacramento-approved-budgets
- Oakland FY2023-25 budget guide (OpenGov): https://stories.opengov.com/oaklandca/published/yyE4hSYfk3
- Oakland FY2025-27 budget adoption: https://oaklandside.org/2025/06/11/oakland-budget-adopted-illegal-dumping-police/
- Oakland previous years budget: https://www.oaklandca.gov/topics/previous-years-budget-information
- Fresno budget archive (FY13–FY27): https://www.fresno.gov/finance/budget/
- Fresno FY2026 budget adoption: https://fresnoland.org/2025/06/17/2026-fresno-budget/
- Fresno FY2025 total breakdown: https://abc30.com/post/city-of-fresno-2025-budget-jerry-dyer-mayor-fiscal-year/14820827/
- Riverside budget archive (FY04–FY26): https://riversideca.gov/finance/budget.asp
- Riverside biennial budget approval: https://riversideca.gov/press/city-riverside-approves-balanced-biennial-budget-145-billion-year-promote-financial-stability
- Bakersfield FY2025-26 adoption: https://www.turnto23.com/news/in-your-neighborhood/bakersfield/city-council-passes-852-7m-budget
- Bakersfield Open Budget portal: https://budget.bakersfieldcity.us/
- Population — Census Bureau QuickFacts (Sacramento, Bakersfield): https://www.census.gov/quickfacts/fact/table/bakersfieldcitycalifornia/HEA775224
- Population — California DOF E-1 2025 press release: https://dof.ca.gov/media/docs/forecasting/Demographics/estimates/E-1_2025_Press_Release.pdf
- Population — Long Beach ACS 2024: https://www.census.gov/quickfacts/fact/table/longbeachcitycalifornia/PST045225
- Population — San Jose ACS 2024: https://www.census.gov/quickfacts/fact/table/sanjosecitycalifornia/PST045224
