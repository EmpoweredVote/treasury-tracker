# Stack Research: v1.9 MA County-City Linking

**Milestone:** MA County Entity & Budget Loading
**Researched:** 2026-06-10
**Confidence:** MEDIUM — data sources confirmed; county PDF budget structures require hands-on verification

---

## Question 1: Does MA DLS publish county-level General Fund data?

**Answer: NO.** MEDIUM confidence.

MA Division of Local Services publishes General Fund Expenditure/Revenue Excel files only for municipalities. The DLS databank and Schedule A filing system is municipality-scoped. The DLS Gateway (`dls-gw.dor.state.ma.us`) and the downloadable `GenFundExpenditures*.xlsx` / `GenFundRevenues*.xlsx` files do not include county government entities.

County governments are not required to file Schedule A with DLS. Each active county publishes its own budget PDFs independently.

**Implication:** `loadMaGFExcel.js` cannot be reused for county budget data. The script's `municMap` lookup is keyed on DLS-issued municipality names and DOR codes — neither applies to county entities. A new per-county loader is required.

---

## Question 2: Budget sources for the 5 active MA county governments (project scope)

### How many active counties are there?

PROJECT.md lists 5 active counties (Barnstable, Bristol, Dukes, Nantucket, Norfolk). Research confirms **6 active county governments** including Plymouth. The project's own out-of-scope rule says "budget data for 9 dissolved MA counties" — Plymouth is not in that list, so it should be considered in-scope. The roadmapper should flag this discrepancy.

### Budget data for each county

**Barnstable County (Cape Cod)**
- Operating budget: ~$22.5M (FY2024; ~4.5%/yr growth)
- Source: https://www.capecod.gov/department-of-finance-treasurer/budgets/
- Available: PDFs for FY2014–FY2027; ACFR for FY2024 available as PDF
- ACFR URL: https://www.capecod.gov/wp-content/uploads/2025/06/FY24-Barnstable-County-ACFR.pdf
- Format: PDF only. No Excel/CSV.
- Loading approach: Existing PDF pipeline (Claude Haiku vision, same as Allen/Prosper/Celina TX)

**Bristol County**
- Operating budget: ~$9–14M range
- Source: https://www.countyofbristol.net/government/index.php — "Annual Budget FY25" PDF link in Document Center
- Format: PDF only; multiple FYs available via Document Center search
- Loading approach: PDF pipeline

**Dukes County (Martha's Vineyard)**
- Operating budget: ~$9–14M range
- Source: https://www.dukescounty.gov/ — meeting archives and Document Center
- Format: PDF budget documents via Document Center
- Loading approach: PDF pipeline

**Nantucket County**
- Operating budget: ~$1M (very small)
- Critical distinction: Nantucket operates as "Town & County of Nantucket" — a consolidated government. The town budget (at https://www.nantucket-ma.gov/3521/Town-Budget) covers both municipal and county functions combined. There is no separate county-only operating budget published separately. The ~$1M figure reflects only a thin residual county layer.
- Recommendation: For purposes of the county page, load the Nantucket town General Fund budget as the county budget. The data is the same entity. Document the consolidation in the entity description.
- Loading approach: PDF pipeline (FY2027 budget presentation and appendices available)

**Norfolk County**
- Operating budget: ~$14–18M; FY2025 showed ~$1.5M surplus
- Source: https://www.norfolkcounty.org/county_budget/index.php — three PDF variants per FY (public viewing, commissioner-approved, advisory-board-approved final)
- Available: FY2022–FY2027
- Format: PDF only
- Loading approach: PDF pipeline

### PDF loading pipeline cost estimate

5 county PDFs × ~10–30 pages each ≈ 100–150 pages.
At Claude Haiku vision pricing (~$0.80/1K input tokens, images at $0.08/1K tokens), total cost is well under the $5 approval threshold. No pre-approval required.

**New script needed:** `loadMACountyBudget.js`
- Accepts: county entity name, PDF file path, fiscal year, dataset type (operating/revenue)
- Uses: existing PDF→Haiku vision pipeline already in codebase
- Writes: `treasury_sync_budget_tree` RPC (unchanged), `data_sources` with `api_type: 'ma-county-pdf'`
- Lookup: find county `municipality_id` by `name + state='MA' + entity_type='county'` (unlike cities, county rows don't have DOR codes)

---

## Question 3: Census population for MA counties (2024 vintage)

### Recommended approach: existing CSV download pattern

Use the same no-API-key Census CSV download pattern as `loadMAPopulation.js`.

**Direct CSV URL (no API key, no auth required):**
```
https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv
```

File confirmed present in Census directory listing (1.7MB, released 2025-03-13).

**Filter criteria:**
- `STATE == 25` (Massachusetts FIPS)
- `COUNTY != 000` (exclude the state-level summary row where COUNTY=000)
- Use `POPESTIMATE2024` column for 2024 vintage population

**Confirmed column layout** (from Census technical documentation):

| Column | Content |
|--------|---------|
| `STATE` | State FIPS (25 = MA) |
| `COUNTY` | County FIPS, 3 digits (e.g., 001 = Barnstable) |
| `STNAME` | "Massachusetts" |
| `CTYNAME` | County name, e.g., "Barnstable County" |
| `POPESTIMATE2024` | 2024 population estimate |

**Name normalization:** Census uses "Barnstable County", "Bristol County", etc. Strip the " County" suffix to match DB `name` field — or store county rows with the " County" suffix and match exactly. Decision must be made at seeding time and applied consistently across seeder and population loader.

**County FIPS for all 14 MA counties** (confirmed from `national_county2020.txt`):

| County | 3-digit FIPS |
|--------|-------------|
| Barnstable | 001 |
| Berkshire | 003 |
| Bristol | 005 |
| Dukes | 007 |
| Essex | 009 |
| Franklin | 011 |
| Hampden | 013 |
| Hampshire | 015 |
| Middlesex | 017 |
| Nantucket | 019 |
| Norfolk | 021 |
| Plymouth | 023 |
| Suffolk | 025 |
| Worcester | 027 |

**New script needed:** `loadMACountyPopulation.js`
- Nearly identical to `loadMAPopulation.js`
- Downloads same CSV; filters `STATE=25, COUNTY!=000`
- Matches by `CTYNAME` (after stripping " County") to `municipalities.name` where `entity_type='county'`
- Updates `population` and `population_year=2024` columns (already exist on schema)

**Alternative considered:** Census API (`api.census.gov/data/2024/pep/population?for=county:*&in=state:25`) would return the same data but requires a registered API key. The CSV avoids the key requirement and matches the existing pattern. Not recommended.

---

## Question 4: Municipality-to-county mapping source

### Recommended source: Census 2020 Gazetteer — MA County Subdivisions

**Direct URL (confirmed accessible, no auth required):**
```
https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_gaz_cousubs_25.txt
```

**Format:** Tab-delimited text, one row per MA municipality.

**Confirmed columns:**
`USPS, GEOID, ANSICODE, NAME, FUNCSTAT, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG`

**GEOID structure** (10 characters, confirmed from file inspection):
- Characters 1–2: State FIPS (`25`)
- Characters 3–5: County FIPS (3 digits, e.g., `001` = Barnstable)
- Characters 6–10: County subdivision code (5 digits)

To extract county FIPS from GEOID: `geoid.substring(2, 5)`

**Sample confirmed mappings from direct file fetch:**

| GEOID | County FIPS | Municipality (Census NAME) |
|-------|-------------|--------------------------|
| 2500103690 | 001 | Barnstable Town city |
| 2500107175 | 001 | Bourne town |
| 2500300555 | 003 | Adams town |
| 2500300975 | 003 | Alford town |
| 2500500170 | 005 | Acushnet town |
| 2500700170 | 007 | Aquinnah town |

**Name normalization:** The `normalizeCensusName()` function in `loadMAPopulation.js` already strips ` city`, ` town`, ` village` suffixes and title-cases the result. This function can be directly reused (copy or `import`) in the county-linking script to match Census names to DB names.

**New script needed:** `linkMAMuniToCounty.js`
- Downloads gazetteer file (or uses local cache)
- For each row: parses GEOID → county FIPS → looks up county `municipality_id` from DB county rows
- Normalizes Census municipality name using `normalizeCensusName()`
- Matches to DB municipality rows by name + `state='MA'`
- Issues `UPDATE municipalities SET county_id = $county_id WHERE id = $muni_id`
- Idempotent: safe to re-run

**Alternatives considered and rejected:**

| Source | Verdict |
|--------|---------|
| MMA All Directory Data CSV (mma.org/all-directory-data/) | Download available but requires manual browser interaction; not automation-friendly |
| Wikipedia list of municipalities in Massachusetts | Only shows ~100 of 351 in table; incomplete |
| MassGIS shapefile | Requires GIS shapefile parsing library; more complexity than tab-delimited Gazetteer |
| MA DLS DOR codes | No county column; DOR codes are numeric municipality IDs only |

---

## Summary of New Scripts Required

| Script | Primary input | Reuses | Net new work |
|--------|--------------|--------|-------------|
| `seedMACounties.js` | Hardcoded list of 14 MA counties | Supabase client pattern | Seed `municipalities` rows with `entity_type='county', state='MA'` |
| `linkMAMuniToCounty.js` | Census Gazetteer URL | `normalizeCensusName()` from `loadMAPopulation.js` | Download, parse GEOID, UPDATE 351 `county_id` values |
| `loadMACountyPopulation.js` | Census `co-est2024-alldata.csv` | `loadMAPopulation.js` (nearly identical) | Filter to `STATE=25, COUNTY!=000` instead of SUMLEV=061 |
| `loadMACountyBudget.js` | Per-county PDF files | Existing PDF pipeline + `treasury_sync_budget_tree` RPC | Accept county name + PDF path; no DOR code lookup |

---

## Stack Additions Summary

No new npm packages required. No new infrastructure required. All work is new Node.js scripts within the existing pattern.

| Layer | Existing capability | Applies to MA counties |
|-------|--------------------|-----------------------|
| DB schema | `municipalities.entity_type`, `county_id` FK, `population` | Already migrated — no DDL needed |
| Budget loading | PDF pipeline + `treasury_sync_budget_tree` RPC | Reusable for county PDFs |
| Population | CSV download pattern from `loadMAPopulation.js` | New script with different filter |
| County-city linking | `county_id` FK already migrated, LA County pattern proven | New seeder + linker scripts |
| Frontend | `CitiesInCountyPanel`, county breadcrumb chip already built and shipped | No frontend changes needed |

---

## Sources

- MA DLS Municipal Databank: https://www.mass.gov/info-details/division-of-local-services-municipal-databank
- DLS Schedule A reports: https://mass.gov/service-details/schedule-a-reports-revenue-and-expenditure-and-more
- Barnstable County budgets: https://www.capecod.gov/department-of-finance-treasurer/budgets/
- Barnstable County FY24 ACFR: https://www.capecod.gov/wp-content/uploads/2025/06/FY24-Barnstable-County-ACFR.pdf
- Barnstable County FY2024 budget size: https://www.capecod.gov/2023/02/08/county-commissioners-approve-operating-budget-for-fy24/
- Bristol County government: https://www.countyofbristol.net/government/index.php
- Norfolk County budgets: https://www.norfolkcounty.org/county_budget/index.php
- Dukes County: https://www.dukescounty.gov/
- Nantucket Town & County budget: https://www.nantucket-ma.gov/3521/Town-Budget
- Plymouth County budget: https://www.plymouthcountyma.gov/treasurers-office/pages/revenues-and-budgets
- Active MA county governments: https://www.boston.com/news/wickedpedia/2023/12/12/massachusetts-county-governments-abolished/
- MA county government overview: https://www.sec.state.ma.us/divisions/cis/government/gov-county.htm
- Census county population CSV directory: https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/
- Census county FIPS reference: https://www2.census.gov/geo/docs/reference/codes2020/national_county2020.txt
- Census Gazetteer MA county subdivisions: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_gaz_cousubs_25.txt
- Census population estimates file layout: https://www2.census.gov/programs-surveys/popest/technical-documentation/file-layouts/2020-2024/CO-EST2024-ALLDATA.pdf

---
*Stack research for: v1.9 MA County-City Linking milestone*
*Researched: 2026-06-10*
