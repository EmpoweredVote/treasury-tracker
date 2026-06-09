# Feature Landscape: MA DLS Data for All 351 Municipalities

**Domain:** Massachusetts municipal financial data via DLS (Division of Local Services) reporting portal
**Researched:** 2026-06-09
**Confidence:** HIGH — verified from live portal fetches, actual scraped JSON files in `scripts/output/`, and authoritative PDF (MBLC FY2017 Municipal Pie report citing DLS directly)

---

## Report 1: General Fund Revenue by Source

**rdreport:** `RevenueBySource.RBS.RevbySource2`
**tableID:** `dtCurrent`
**Data source:** Tax Rate Recapitulation sheet submitted by Board of Assessors
**dataset_type in scraper:** `revenue`

### Column Names (exact, from live scraped JSON)

| Column | Notes |
|--------|-------|
| DOR Code | 3-digit municipality identifier (001-351) |
| Municipality | Town/city name |
| Fiscal Year | Integer |
| Tax Levy | Property tax levy — largest revenue source (~71% median share) |
| State Aid | Cherry Sheet distributions + education aid (~11% median) |
| Local Receipts | Motor vehicle excise, permits, fees, service charges (~8% median) |
| All Other | Transfers, free cash, miscellaneous (~7% median) |
| Enterprise & CPA Funds | Enterprise fund revenues + Community Preservation Act (~10% median) |
| Total Receipts | Sum of the five columns above |

Also present in raw HTML but not loaded as budget items (percentage columns):
- Tax Levy as % of Total, State Aid as % of Total, Local Receipts as % of Total, All Other as % of Total (without Enterprise/CPA)
- Same four percentages recalculated including Enterprise & CPA

### Fiscal Year Availability

FY2003 through FY2026 (24 years). FY2026 is confirmed available as a checkbox on the live form. The scraper's `--list` comment says "2002-2025" but live form inspection of `explore_rbs2.html` shows FY2026 as the first checkbox.

### Municipality Coverage

All 351 municipalities present in FY2025 with non-zero totals. Verified from actual JSON file `scripts/output/ma_dls_revenue-by-source_2025.json`:
- Records count: 351
- Zero-total records: 0
- Every municipality from DOR code 001 (Abington) through 351 (Yarmouth) is present

---

## Report 2: Schedule A — Special Revenue Funds

**rdreport:** `ScheduleA.Special_Rev_Funds.SpecialRevFunds`
**tableID:** `xtFedGrants` (Federal Grants tab — the only tab currently scraped)
**Data source:** Schedule A annual financial report submitted by town accountant/city auditor
**dataset_type in scraper:** `operating`
**supportsType:** Yes — has Expenditures / Revenues toggle

### This Report Has Five Tabs — Only One Is Currently Scraped

| Tab | tableID | Status |
|-----|---------|--------|
| Federal Grants | `xtFedGrants` | Scraped; JSON exists in `scripts/output/` |
| State Grants | unknown | Not scraped; tableID needs `--explore` |
| Receipts Reserved for Appropriation | unknown | Not scraped |
| Revolving Funds | unknown | Not scraped |
| Other Special Revenue | unknown | Not scraped |

The scraper only captures the Federal Grants tab. The other four tabs contain legitimate special revenue data but their tableIDs are unknown.

### Federal Grants Tab — Column Names (exact, from live scraped JSON)

| Column | Notes |
|--------|-------|
| DOR Code | 3-digit identifier |
| Municipality | Town/city name |
| Fiscal Year | Integer |
| Federal General Government Grants | Admin/management federal grants |
| Federal Public Safety Grants | Police, fire, COPS grants |
| Federal Public Works Grants | Infrastructure federal grants |
| Federal Education Grants | Title I, IDEA, and other education grants |
| Federal Emergency Management Agency | FEMA disaster/hazard grants |
| Federal Culture and Recreation Grants | Arts, parks federal grants |
| Federal Community Development Block Grants | HUD CDBG program |
| Other Federal Housing and Urban Development Grants | Other HUD programs |
| Other Federal Grants | Catch-all for remaining federal programs |
| Total Revenues | Sum (header says "Total Revenues" even in Expenditures view — this is a DLS column naming quirk) |

### Fiscal Year Availability

FY2002 through FY2025 (24 years). Confirmed from select dropdown in `explore_special-revenue.html`.

### Municipality Coverage

All 351 municipalities present in FY2025. Verified from `scripts/output/ma_dls_special-revenue_2025_expenditures.json`:
- Records count: 351
- 59 municipalities show $0 across all federal grant columns — this is correct and expected; small rural towns receive no federal grants
- 292 municipalities have at least one non-zero federal grant category
- Boston FY2025: $450.8M total federal grants (largest)
- Many small towns: $0 (not a data gap — reflects actual funding)

---

## Report 3: General Fund Expenditures by Function (not yet scraped)

This is the primary operating budget report and maps most naturally to the existing Department → Category → Line Item tree. It represents the general fund — the main appropriation process governed by town meeting or city council.

**rdreport:** `ScheduleA.GenFund_MAIN` confirmed in search results and live URL; however the scraper's `gf-expenditures` entry used a wrong guessed rdreport (`ScheduleA.GF.ExpendituresByFunctionMain`) and returned an error. The correct tableID is not yet known and must be discovered via `--explore`.

**Data source:** Schedule A annual financial report (UMAS — Uniform Municipal Accounting System)

### Expenditure Function Categories

Confirmed from two sources: MBLC FY2017 Municipal Pie PDF (derived from DLS Schedule A) and DLS Community Snapshot dashboard showing Abington FY2024 breakdown.

| Category | FY2017 Statewide Share | Notes |
|----------|----------------------|-------|
| Education | 47.26% | K-12 operating + regional school district assessments — dominant category |
| Safety | 14.40% | Police + Fire + Other Public Safety (DLS groups these; sub-breakdown may vary) |
| Fixed Costs | 13.70% | Health insurance (largest fixed cost), pension assessments, OPEB |
| Debt Service | 6.46% | Principal + interest on municipal debt |
| Public Works | 5.65% | Highways, snow removal; water/sewer often in enterprise funds not here |
| General Government | 5.22% | Selectmen/city council, assessors, finance, town clerk, legal |
| Other | 4.59% | Miscellaneous not elsewhere classified |
| Human Services | 1.56% | Council on aging, veterans services, health department |
| Library Services | 1.16% | Public library (DLS separates from Culture & Recreation for analysis) |
| Culture and Recreation | ~1% | Parks, recreation programs (excluding library) |
| Intergovernmental Assessments | separate | County assessments, RMV surcharges |

Note: The DLS Community Snapshot showed 12 functional categories for Abington FY2024, suggesting the web report may have a slightly finer breakdown than the 9-category MBLC summary.

---

## Budget Size Range Across All 351 Municipalities

### Revenue Distribution (Total Receipts, FY2025) — from actual scraped data

| Tier | Range | Count | Examples |
|------|-------|-------|---------|
| Tiny | < $5M | 31 | New Ashford ($787K), Monroe ($1.1M), Hawley ($1.4M), Mt. Washington ($1.5M), Gosnold ($1.9M) |
| Small | $5M – $20M | 61 | Rural and western MA towns |
| Medium | $20M – $100M | 158 | Majority of MA municipalities; typical suburbs |
| Large | $100M – $500M | 93 | Boston suburbs (Brookline, Quincy, Framingham, etc.) |
| Very large | > $500M | 8 | Boston ($4.72B), Cambridge ($1.07B), Springfield ($958M), Worcester ($946M), Newton ($666M), and 3 others |

**Median municipality total receipts: ~$51M.** Distribution is right-skewed — most municipalities are small by dollar amount but all are required to report.

**Boston-to-smallest ratio:** Boston at $4.72B is approximately 6,000x the size of New Ashford at $787K. This matters for enrichment decisions.

### Revenue Column Medians (share of total)

| Column | Median % of Total Receipts |
|--------|--------------------------|
| Tax Levy | 71.2% |
| Enterprise & CPA Funds | 10.3% |
| State Aid | 10.9% |
| Local Receipts | 8.2% |
| All Other | 7.2% |

Tax levy dominates in most towns. State Aid is more significant for lower-income communities with large Chapter 70 education aid.

---

## How DLS Data Maps to Existing Budget Tree Format

The existing tree format is: **Department → Category → Line Item** (3 levels, introduced in v1.7).

### Revenue by Source (5 columns → flat structure)

Each of the 5 revenue columns becomes a category with a single line item underneath it. No meaningful Department grouping — all 5 are at the same level of the revenue taxonomy.

```
[category: "Tax Levy"]
  line item: "Tax Levy", amount: $X
[category: "State Aid"]
  line item: "State Aid", amount: $X
[category: "Local Receipts"]
  line item: "Local Receipts", amount: $X
[category: "All Other"]
  line item: "All Other", amount: $X
[category: "Enterprise & CPA Funds"]
  line item: "Enterprise & CPA Funds", amount: $X
```

The current scraper builds exactly this. 5 tree nodes per municipality. Enrichment adds plain-language descriptions to each of the 5 category names.

### Special Revenue / Federal Grants (9 columns → flat structure)

Same pattern: 9 grant-type columns become 9 category nodes. Zero-valued columns should be omitted (scraper already skips `amount === 0`). For the 59 towns with no federal grants, no budget nodes are created.

### General Fund Expenditures (when scraped — richer structure)

The 9-12 UMAS function categories map cleanly to a 2-level tree where the function name is the category and a single line item carries the dollar amount. A plausible Department grouping:

```
Department: "Public Safety"
  Category: "Police"
  Category: "Fire"
  Category: "Other Public Safety"
Department: "Education & Social Services"
  Category: "Education"
  Category: "Human Services"
  Category: "Library Services"
  Category: "Culture and Recreation"
Department: "Infrastructure"
  Category: "Public Works"
Department: "Administration"
  Category: "General Government"
  Category: "Fixed Costs"
  Category: "Debt Service"
  Category: "Intergovernmental Assessments"
```

This is the most citizen-relevant data in the MA DLS portal — knowing that Education is 47% of spending is a meaningful fact. This report is the one worth prioritizing after Revenue by Source.

---

## Table Stakes for This Milestone

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Revenue by Source for all 351 cities | Already scraped FY2025; scraper exists and is tested | Low | Run `--scrape --report revenue-by-source` per FY |
| MA shown in city picker | First fully-covered state; milestone goal | Low | Add "Massachusetts" to STATE_LABELS |
| Population data for all 351 MA towns | Per-capita display requires it | Medium | 2020 Census; MA has ~75 sub-5K towns; USCB API or lookup table |
| Special Revenue (Federal Grants) for all 351 | Scraper already works; FY2025 JSON exists | Low | Run per FY; skip zero-grant towns in display |

## Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| General Fund Expenditures by Function | The real operating budget story; Education 47% is meaningful to citizens | Medium | Requires discovering correct tableID via `--explore schedulea.genfund_main` first |
| Multi-year loading (FY2015–FY2025) | Year-over-year comparison for all 351 cities at once | Medium | 10 years × 351 = 3,510 loads; scraper loops per FY; plan rate limiting |
| All 5 Special Revenue tabs | State grants, revolving funds, receipts reserved add nuance | High | 4 unknown tableIDs; each tab needs `--explore`; defer to follow-on phase |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| All-funds data from enterprise/capital/trust fund tabs | Sewer/water/utilities vary wildly by fund structure across cities; DLS itself recommends GF for cross-community comparison | Load General Fund only for operating budgets |
| Loading all 24 fiscal years in one pass | 24 × 2 reports × 351 cities = 16,848 HTTP requests at 1.5s = 7+ hours unattended | Load FY2020–FY2025 first; backfill older years as a second pass |
| Per-municipality enrichment for all 351 cities | 351 × 9 columns = 3,159 enrichment rows at ~$0.001 each = $3+ in API calls; worse, the category names are identical across all cities | Enrich once per unique category name (~23 total); reuse across municipalities |
| Enriching tiny-town data | A $787K town with 3 federal grant categories adds marginal transparency value | Scope enrichment to municipalities above a threshold (e.g., > $5M total receipts or > 1,000 population) |

---

## Fiscal Year Recommendations

| Report | Earliest | Latest | Recommended Load Range | Rationale |
|--------|----------|--------|----------------------|-----------|
| Revenue by Source | FY2003 | FY2026 | FY2015–FY2026 | 11 years of trend data; FY2026 is the freshest available anywhere in the app |
| Special Revenue Federal Grants | FY2002 | FY2025 | FY2020–FY2025 | 5 years sufficient; older data less relevant for grant programs |
| General Fund Expenditures | FY2002 | FY2025 | FY2020–FY2025 | Needs tableID discovery first; match Revenue by Source range once working |

---

## Enrichment Scope Guidance

The MA DLS data uses a fixed schema — the same column names appear for every municipality. This is fundamentally different from TX/CA city data where each city has hundreds of unique department/line item names.

- **Revenue by Source:** 5 unique category names across all 351 cities. One enrichment call per name = 5 total AI calls.
- **Special Revenue Federal Grants:** 9 unique category names. 9 total AI calls.
- **General Fund Expenditures:** ~9-12 unique function categories. 12 total AI calls maximum.
- **Grand total:** ~26 AI calls to enrich all MA DLS data statewide, regardless of how many municipalities are loaded.

The existing `enrichCategories.js` script enriches per-municipality per-category. For MA, the team should either: (a) run enrichment once for a single representative municipality and manually copy enrichment records for others, or (b) extend the enrichment system to support a "shared enrichment" mode where one enrichment row is reused for all municipalities sharing that category name.

---

## Municipality Coverage Assessment (Summary)

**Coverage is complete and consistent across all 351 municipalities for both confirmed reports.**

- All 351 DOR codes (001–351) appear in FY2025 for both Revenue by Source and Special Revenue Federal Grants
- Revenue by Source: zero municipalities with missing or zero total receipts in FY2025
- Special Revenue: 59 municipalities with $0 federal grants — accurate, not a gap
- Tiny towns (New Ashford, Monroe, Hawley, Mount Washington, Gosnold) are all present and properly represented
- Data is described as "current as of 06/09/2026" on the live portal
- Schedule A is submitted each fall after fiscal year close; FY2025 data was released approximately December 2025
- Late filers are possible but rare; DLS notes data is real-time from submissions — a very late filer could have a temporary $0 row

---

## Sources

- Live portal: `https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=schedulea.special_rev_funds.specialrevfunds` — FY2002–2025 select dropdown confirmed (HIGH)
- Live portal: `https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=RevenueBySource.RBS.RevbySource2` — FY2003–2026 checkboxes, exact column names (HIGH)
- Actual scraped data: `scripts/output/ma_dls_revenue-by-source_2025.json` — 351 records, all non-zero (HIGH)
- Actual scraped data: `scripts/output/ma_dls_special-revenue_2025_expenditures.json` — 351 records, Federal Grants tab (HIGH)
- Existing scraper: `scripts/scrapeMaDLS.js` — rdreport, tableID, paginationType, columnNames documented per report (HIGH)
- MBLC FY2017 Municipal Pie PDF (archives.lib.state.ma.us) — confirms 9 UMAS expenditure function categories, statewide totals, confirms Schedule A as source (HIGH)
- DLS Community Snapshot (`rdreport=CommunityPage`) — confirms 12 functional categories including Library Services separated from Culture & Recreation (MEDIUM)
- DLS GF Revenues and Expenditures (`rdreport=dashboard.category_4`) — confirms expenditure functions: Education 48%, Fixed Costs 18%, Safety 15%, Debt Service 7%, Public Works 6%, General Government 5%, Other 1% (MEDIUM)
