# SAL-01 Spike Findings — GCC Raw Export Access, Schema, and OC Sample Reconciliation

**Date:** 2026-06-15
**Spike:** Phase 55 Plan 55-01 — SAL-01
**Source audited:** CA Government Compensation in California (GCC) — https://gcc.sco.ca.gov
**Sampled entity:** City of Irvine, Calendar Year 2024
**Purpose:** Gate decision for Plan 55-02 (statewide city-salaries loader build)

---

## Section 1: Access (D-05.1)

### 1.1 Redirect Verification

publicpay.ca.gov returns HTTP 301 → https://gcc.sco.ca.gov/

Confirmed via:
```
node -e "fetch('https://publicpay.ca.gov',{redirect:'manual'}).then(r=>console.log('status',r.status,'location',r.headers.get('location')))"
# Output: status 301 location https://gcc.sco.ca.gov/
```

### 1.2 Download URL Pattern

The GCC raw export is **static ZIP files** served from a predictable path:

```
https://gcc.sco.ca.gov/RawExport/{YEAR}_City.zip
```

**Examples:**
- `https://gcc.sco.ca.gov/RawExport/2024_City.zip` — 7.8 MB compressed / 95.8 MB extracted
- `https://gcc.sco.ca.gov/RawExport/2023_City.zip`
- ...back to `https://gcc.sco.ca.gov/RawExport/2009_City.zip`

No form submission, no session token, no API key, no query parameters — pure static file download.

The file for entity type "Cities" covers ALL California cities in a single annual file. A specific city
is obtained by filtering the `EmployerName` column (see Section 2).

**Available years:** 2009 through 2024 (16 years, confirmed from the Downloads page listing).

### 1.3 Access Verdict

**Key finding:** The main GCC website pages (gcc.sco.ca.gov/Reports/RawExport.aspx, GCC.aspx, and
the old publicpay.ca.gov entity pages) are **protected by a Cloudflare managed challenge** (HTTP 403
"Just a moment..." with Cloudflare challenge JS). A plain non-browser client gets 403.

**However:** The raw ZIP download URLs (`/RawExport/*.zip`) and the dedicated entity listing pages
(`/Reports/Cities/Cities.aspx`, `/Reports/Cities/City.aspx?entityid=N&year=Y`) are **NOT behind
the Cloudflare challenge** and return HTTP 200 with a standard browser User-Agent.

**Working client tested:**
- Tool: `curl`
- User-Agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`
- HTTP response: **200 OK**
- Downloaded file: `2024_City.zip` — 8,216,998 bytes (8.2 MB), extracted to `2024_City.csv` (95.8 MB)

**Access verdict:** REACHABLE WITH AUTOMATION.
- Download URL: `https://gcc.sco.ca.gov/RawExport/{YEAR}_City.zip`
- Required client: Standard browser-like User-Agent (curl or node fetch with a real UA string)
- No paywall, no token, no bot-defeat tooling required
- Per-city verification URL (for reconciliation): `https://gcc.sco.ca.gov/Reports/Cities/City.aspx?entityid={ID}&year={YEAR}` (HTTP 200 accessible)

**Automation pattern for loader (Plan 55-02):**
```javascript
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const url = `https://gcc.sco.ca.gov/RawExport/${year}_City.zip`;
const resp = await fetch(url, { headers: { 'User-Agent': UA } });
// resp.status === 200; download ZIP, extract CSV, filter by EmployerName === cityName
```

---

## Section 2: Schema / Field Mapping (D-05.2)

### 2.1 CSV Structure

The `{YEAR}_City.csv` file has **29 columns**, all quoted. Header row present. One row per
employee-position record (not aggregated). A city with N employees has N rows.

Source: Data Dictionary at https://gcc.sco.ca.gov/Reports/DataDictionary.aspx (HTTP 200 accessible).

### 2.2 Field Mapping Table

| GCC Raw Column | Index (0-based) | Loader/Tree Role | Notes |
|---|---|---|---|
| `Year` | 0 | Fiscal year filter | Calendar year (not fiscal year) |
| `EmployerType` | 1 | Filter: `"City"` | Confirms record is a city |
| `EmployerName` | 2 | City identifier | E.g. `"Irvine"`, `"Anaheim"` — exact match filter |
| `DepartmentOrSubdivision` | 3 | **Dept** node name in tree | Maps to LA loader's `Department` |
| `Position` | 4 | **Position** leaf node name | Maps to LA loader's `Position_Title`; no individual names |
| `ElectedOfficial` | 5 | Optional filter | "True" for elected officials |
| `Judicial` | 6 | Metadata | Not needed for tree |
| `OtherPositions` | 7 | Metadata | Pipe-delimited; skip |
| `MinPositionSalary` | 8 | Optional metadata | Not aggregated |
| `MaxPositionSalary` | 9 | Optional metadata | Not aggregated |
| `ReportedBaseWage` | 10 | Pre-2011 data only | Empty for 2011+; use `RegularPay` instead |
| `RegularPay` | 11 | **Base pay** (D-03) | Maps to LA loader's `Base_Earnings` |
| `OvertimePay` | 12 | **Overtime** (D-03) | Maps to LA loader's `Overtime_Earnings` |
| `LumpSumPay` | 13 | **Other pay** component (D-03) | Lump-sum cash-outs |
| `OtherPay` | 14 | **Other pay** component (D-03) | Car allowances, bonuses, etc. |
| `TotalWages` | 15 | **Total wages** | RegularPay + OvertimePay + LumpSumPay + OtherPay |
| `DefinedBenefitPlanContribution` | 16 | **Benefits** component (D-03) | Employer pension contribution |
| `EmployeesRetirementCostCovered` | 17 | **Benefits** component (D-03) | Employer pick-up of employee share |
| `DeferredCompensationPlan` | 18 | **Benefits** component (D-03) | Employer 401k/457/403b contributions |
| `HealthDentalVision` | 19 | **Benefits** component (D-03) | Employer health/dental/vision |
| `TotalRetirementAndHealthContribution` | 20 | **Total employer benefits** | Sum of cols 16-19 |
| `PensionFormula` | 21 | Metadata | E.g. "2%@62" |
| `EmployerURL` | 22 | Source attribution | City HR page URL |
| `EmployerPopulation` | 23 | Population | From CA Dept of Finance |
| `LastUpdatedDate` | 24 | Data freshness | Date employer last updated |
| `EmployerCounty` | 25 | County filter | E.g. `"Orange"` — useful for county-scoped queries |
| `SpecialDistrictActivities` | 26 | N/A for cities | Empty for city records |
| `IncludesUnfundedLiability` | 27 | Metadata | "True"/"False" |
| `SpecialDistrictType` | 28 | N/A for cities | Empty for city records |

### 2.3 Total Compensation Derivation (D-02)

**Total Compensation = `TotalWages` + `TotalRetirementAndHealthContribution`**

This matches the GCC website display and the LA County loader pattern (LA: `Total_Earnings` + `Total_Benefits`).

The Data Dictionary explicitly states:
- `TotalWages`: "sum of the Regular Pay, Overtime Pay, Lump-Sum Pay, and Other Pay fields"
- `TotalRetirementAndHealthContribution`: "sum of the Defined Benefit Plan Contribution, Employees Retirement Cost Covered, Deferred Compensation Plan, and Health Dental Vision fields"

There is **no separate `TotalCompensation` column** in the raw CSV. The loader computes it.

### 2.4 Wages / Benefits Breakdown for D-03

Position nodes carry the following aggregated metadata (per-employee averages):

| Metadata Field | Source Column(s) | D-03 Role |
|---|---|---|
| avg_base | `RegularPay` / employee_count | Average base/regular pay |
| avg_overtime_other | (`OvertimePay` + `LumpSumPay` + `OtherPay`) / count | Average overtime + lump-sum + other |
| avg_benefits | `TotalRetirementAndHealthContribution` / count | Average employer benefit contribution |

This mirrors LA County's `avgBase` / `avgBenefits` / `avgOvertime` metadata fields.

### 2.5 Individual Names Confirmation (D-01)

**CONFIRMED: The GCC City raw CSV contains NO individual employee name columns.**

The 29-column schema has no "EmployeeFirstName", "EmployeeLastName", or any name-like field.
The deepest identifier is `Position` (job title), which is the leaf node — exactly matching D-01.

This differs from the LA County ArcGIS source (which has `Employee_Last_Name` / `Employee_First_Name`).
The GCC statewide source is already privacy-safe by design.

### 2.6 Zero-Comp and Multi-Row Notes

- **Zero-comp records:** Records exist where `TotalWages` = 0 and `TotalRetirementAndHealthContribution` = 0
  (unpaid board members, partial-year Elected Officials with IRS 1099 pay only). These should be skipped
  (comp === 0 check), matching the LA loader's `if (comp === 0) continue`.
- **Multiple rows per Position:** The same `Position` title appears multiple times within a department
  (one row per employee). The tree builder aggregates by `DepartmentOrSubdivision` + `Position`,
  counting rows and summing compensation — this is the expected pattern.
- **EmployerType = "City":** All records in `{YEAR}_City.zip` have `EmployerType = "City"`. No
  additional entity-type filter needed when using the City-specific file.
- **Pre-2011 data:** `ReportedBaseWage` (col 10) contains data for 2009-2010; cols 11-20 are empty.
  The loader should handle the `ReportedBaseWage`-only rows for years 2009-2010.

---

## Section 3: Sample Reconciliation (D-05.3)

### 3.1 Sample Selection

- **Entity:** City of Irvine
- **Year:** 2024 (calendar year, latest available)
- **Source file:** `https://gcc.sco.ca.gov/RawExport/2024_City.zip` (HTTP 200)
- **Entity page:** `https://gcc.sco.ca.gov/Reports/Cities/City.aspx?entityid=302&year=2024` (HTTP 200)

### 3.2 Raw CSV Computation

Filtered rows where `EmployerName = "Irvine"`, skipped zero-comp records:

| Metric | Value |
|---|---|
| Non-zero position records | 2,193 |
| Unique departments | 14 |
| Unique position titles | 301 |
| Sum of `TotalWages` | $150,535,676 |
| Sum of `TotalRetirementAndHealthContribution` | $39,890,607 |
| **Computed Total Compensation** | **$190,426,283** |

### 3.3 Published Figure Verification

The GCC Cities entity page for Irvine 2024 (HTTP 200, accessible without Cloudflare challenge)
displays the following summary metrics:

```
Employees: 2,193
Population: 318,629
Total Wages: $150,535,676
Total Retirement & Health Contribution: $39,890,607
```

Source URL: https://gcc.sco.ca.gov/Reports/Cities/City.aspx?entityid=302&year=2024

The GCC Cities listing page (https://gcc.sco.ca.gov/Reports/Cities/Cities.aspx?year=2024&rpt=0)
shows the same figures for Irvine in its table row.

### 3.4 Reconciliation Result

| | Computed from Raw CSV | Published on GCC Site |
|---|---|---|
| Total Wages | $150,535,676 | $150,535,676 |
| Total Benefits | $39,890,607 | $39,890,607 |
| Total Compensation | $190,426,283 | $190,426,283 |
| Employee count | 2,193 | 2,193 |

**Absolute delta:** $0 (exact match)
**Percentage delta:** 0.00%

**Reconciliation verdict: PASS** — The raw CSV rows sum exactly to the GCC site's published
"Total Wages" and "Total Retirement & Health Contribution" figures for Irvine 2024. The field
mapping and aggregation are correct. No structural mismatch.

---

## Section 4: OC Coverage Note (D-06)

The 2024 City data file contains all **34 Orange County cities** (filtered by `EmployerCounty = "Orange"`):

Aliso Viejo, Anaheim, Brea, Buena Park, Costa Mesa, Cypress, Dana Point, Fountain Valley,
Fullerton, Garden Grove, Huntington Beach, Irvine, La Habra, La Palma, Laguna Beach,
Laguna Hills, Laguna Niguel, Laguna Woods, Lake Forest, Los Alamitos, Mission Viejo,
Newport Beach, Orange, Placentia, Rancho Santa Margarita, San Clemente, San Juan Capistrano,
Santa Ana, Seal Beach, Stanton, Tustin, Villa Park, Westminster, Yorba Linda.

This matches the 34 OC cities loaded in Phase 53 (operating + revenue). Per D-06, the full
covered/gap set (across all 16 years, 2009-2024) is confirmed during the load, not pre-enumerated
here. Cities not reporting for a given year simply produce no salaries tab for that year.

**Year coverage:** 2009-2024 (16 calendar years), consistent with D-04 (load all available years).

---

## Section 5: D-05 Gate Evaluation

| Condition | Result | Evidence |
|---|---|---|
| D-05.1 Access | PASS | ZIP files at `/RawExport/{YEAR}_City.zip` return HTTP 200 with browser UA; no paywall; download confirmed (8.2 MB ZIP, 95.8 MB CSV, 345K rows for all CA cities 2024) |
| D-05.2 Shape | PASS | 29-column schema maps all required tree fields (DepartmentOrSubdivision → Position) and D-03 breakdown (RegularPay, OvertimePay, LumpSumPay+OtherPay, TotalRetirementAndHealthContribution); no individual names present |
| D-05.3 Sample match | PASS | Irvine 2024 computed from raw CSV exactly matches GCC published figures ($190,426,283, delta = $0, 0.00%) |

---

GATE: PASS — authorize SAL-02 loader build

The three D-05 conditions all hold. The GCC statewide city-salaries source is:
1. Programmatically reachable (static ZIP, browser UA, no evasive tooling)
2. Schema-complete for Department → Position / Total Compensation tree with wages/benefits split
3. Sample-verified: raw CSV aggregates match published GCC figures exactly

Plan 55-02 (statewide city-salaries loader) is authorized to proceed upon operator approval.
