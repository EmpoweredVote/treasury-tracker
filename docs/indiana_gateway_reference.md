# Indiana Gateway Data Reference

> Generated 2026-03-27 from Indiana Gateway for Government Units CSV exports.
> Source: https://gateway.ifionline.org/

## Table of Contents

1. [Summary Table](#summary-table)
2. [Budget Unit Type Codes](#budget-unit-type-codes)
3. [Monroe County Data Availability](#monroe-county-data-availability)
4. [HIGH Relevance Files — Detailed](#high-relevance-files)
5. [MEDIUM Relevance Files — Detailed](#medium-relevance-files)
6. [LOW Relevance Files — Detailed](#low-relevance-files)
7. [Empty / Unavailable Files](#empty--unavailable-files)
8. [Supabase Loading Priorities](#supabase-loading-priorities)

---

## Summary Table

| File | Description | Rows | Year | Monroe Co. Rows | Relevance |
|------|-------------|------|------|-----------------|-----------|
| `detailedExpenditures_2025.csv` | Line-item budget expenditures by fund, dept, category | 284,944 | 2025 | 4,659 | **HIGH** |
| `form4a_2025.csv` | Budget form 4A — published & approved amounts by category | 180,121 | 2025 | 3,040 | **HIGH** |
| `form22_2025.csv` | Tax distributions to entities (license excise, CVET, etc.) | 81,505 | 2025 | 507 | **HIGH** |
| `detailedrevenue_2025.csv` | Adopted revenue budgets by fund and revenue source | 39,128 | 2025 | 416 | **HIGH** |
| `eca_fund_expenditures_2024.csv` | School ECA (extra-curricular) fund expenditures | 387,112 | 2024 | 2,514 | **HIGH** |
| `eca_fund_receipts_2024.csv` | School ECA fund receipts by source | 343,942 | 2024 | 2,371 | **HIGH** |
| `townshipDisburseByVendor_2025.csv` | Township disbursements by vendor (vendor-level spending) | 188 | 2025 | 0 | **HIGH** |
| `eca_fund_balances_2024.csv` | School ECA fund beginning/ending balances | 54,331 | 2024 | 558 | **MEDIUM** |
| `Grants_2025.csv` | Federal/state grant awards by entity | 12,640 | 2025 | 215 | **MEDIUM** |
| `certNAV_2025.csv` | Certified Net Assessed Values by tax district | 2,911 | 2025 | 18 | **MEDIUM** |
| `e1_entity_funds_2025.csv` | Non-profit E1 entity fund reports (not-for-profits) | 3,054 | 2025 | 131 | **MEDIUM** |
| `CashInvCombined_2025.csv` | Cash & investment balances by fund | 41 | 2025 | 0 | **MEDIUM** |
| `afr_CapAssets_2025.csv` | Annual Financial Report — capital assets | 63,181 | 2025 | 0* | LOW |
| `afr_debt_2025.csv` | Annual Financial Report — debt schedules | 4 | 2025 | 0 | LOW |
| `nonGovEntities_2025.csv` | Non-governmental entities (volunteer fire depts, etc.) | 3 | 2025 | 0 | LOW |
| `ta7_2025.csv` | Township annual report (TA-7 questionnaire) | 5 | 2025 | 0 | LOW |
| `afr_pension_2025.csv` | *Empty — "Data Not Available"* | 0 | 2025 | — | N/A |
| `afr_OPEB_2025.csv` | *Empty — "Data Not Available"* | 0 | 2025 | — | N/A |
| `afr_leases_2025.csv` | *Empty — "Data Not Available"* | 0 | 2025 | — | N/A |
| `detailedReceipts_2025.csv` | *Empty — "Data Not Available"* | 0 | 2025 | — | N/A |
| `detailedDisburse_fundsNOdept_2025.csv` | *Empty — "Data Not Available"* | 0 | 2025 | — | N/A |
| `detailedDisburse_fundswithdept_2025.csv` | *Empty — "Data Not Available"* | 0 | 2025 | — | N/A |
| `eca_fund_balances_2025.csv` | *Empty — "Data Not Available"* | 0 | 2025 | — | N/A |

\* `afr_CapAssets` has Monroe Township entries in Adams County but no Monroe County (cnty_cd=53) data.

---

## Budget Unit Type Codes

These codes appear in `budget_unit_type` or `unit_type` columns across all files:

| Code | Entity Type | Examples |
|------|-------------|----------|
| 1 | County | MONROE COUNTY, ADAMS COUNTY |
| 2 | Township | BLOOMINGTON TOWNSHIP, PERRY TOWNSHIP |
| 3 | City/Town | BLOOMINGTON CIVIL CITY, ELLETTSVILLE CIVIL TOWN |
| 4 | School Corporation | MONROE COUNTY COMMUNITY SCHOOL CORPORATION |
| 5 | Library | MONROE COUNTY PUBLIC LIBRARY |
| 6 | Special District | BLOOMINGTON TRANSPORTATION, SOLID WASTE MANAGEMENT |
| 7 | Conservancy District | LAKE LEMON CONSERVANCY DISTRICT |
| 8 | Regional Development Authority | Port authorities, regional dev authorities |
| 9 | Charter/Other School | Individual schools (used in Grants) |

---

## Monroe County Data Availability

Monroe County = `cnty_cd` / `county_cd_fk` = **53**, `cnty_description` = **Monroe**

### Monroe County Entities Found

| Entity Type | Entity Name | unit_code |
|-------------|-------------|-----------|
| County | MONROE COUNTY | 0000 |
| Township | BEAN BLOSSOM TOWNSHIP | 0001 |
| Township | BENTON TOWNSHIP | 0002 |
| Township | BLOOMINGTON TOWNSHIP | 0003 |
| Township | CLEAR CREEK TOWNSHIP | 0004 |
| Township | INDIAN CREEK TOWNSHIP | 0005 |
| Township | PERRY TOWNSHIP | 0006 |
| Township | POLK TOWNSHIP | 0007 |
| Township | RICHLAND TOWNSHIP | 0008 |
| Township | SALT CREEK TOWNSHIP | 0009 |
| Township | VAN BUREN TOWNSHIP | 0010 |
| Township | WASHINGTON TOWNSHIP | 0011 |
| City | BLOOMINGTON CIVIL CITY | 0113 |
| Town | ELLETTSVILLE CIVIL TOWN | 0788 |
| Town | STINESVILLE CIVIL TOWN | 0789 |
| School | MONROE COUNTY COMMUNITY SCHOOL CORPORATION | 5740 |
| School | RICHLAND-BEAN BLOSSOM COMMUNITY SCHOOL CORPORATION | 5705 |
| Library | MONROE COUNTY PUBLIC LIBRARY | 0154 |
| Special | BLOOMINGTON TRANSPORTATION | 0951 |
| Special | MONROE COUNTY SOLID WASTE MANAGEMENT DISTRICT | 0990 |
| Special | Monroe Fire Protection District | 0972 |
| Conservancy | LAKE LEMON CONSERVANCY DISTRICT | 0055 |

### Filtering for Monroe County

All files use one of these patterns:
```
-- Pattern A (most files): cnty_cd = '53' AND cnty_description = 'Monroe'
WHERE cnty_cd = '53'

-- Pattern B (form22): COUNTY_CD = '53'
WHERE county_cd = '53'

-- Pattern C (eca files): county_cd_fk = '53'
WHERE county_cd_fk = '53'
```

**Warning:** Searching for the string "Monroe" will also match Monroe Townships in other counties (Adams, Allen, etc.). Always filter by county code 53.

---

## HIGH Relevance Files

### detailedExpenditures_2025.csv
**284,944 rows** | Line-item budget expenditures — the most granular spending data

| Column | Description |
|--------|-------------|
| `year` | Budget year (2025) |
| `cnty_cd` | County code (53 for Monroe) |
| `cnty_description` | County name |
| `unit_type` | Budget unit type code (1-7) |
| `unit_code` | Unit identifier within county |
| `unit_name` | Entity name |
| `sboa_id` | State Board of Accounts file number |
| `fund_cd` | Fund code |
| `fund_description` | Fund name (e.g., "GENERAL", "MOTOR VEHICLE HIGHWAY") |
| `department_cd` | Department code |
| `department_description` | Department name |
| `expenditure_cat_id` | Expenditure category ID |
| `expenditure_cat_description` | Category (e.g., "PERSONAL SERVICES", "SERVICES AND CHARGES") |
| `expenditure_subcat_id` | Subcategory ID |
| `expenditure_subcat_description` | Subcategory (e.g., "Professional Services") |
| `item_ref_code` | Line-item reference code |
| `item_description` | Line-item description |
| `item_amt` | Published/advertised amount |
| `item_amt_pc` | Per capita amount |
| `item_approved_amt` | Approved amount |
| `item_approved_amt_pc` | Approved per capita amount |
| `pop2010` | 2010 census population |

**Entity types represented:** All 7 types (County, Township, City/Town, School, Library, Special, Conservancy)
**Monroe County:** 4,659 rows across 22 entities

---

### form4a_2025.csv
**180,121 rows** | Budget Form 4A — published and approved budget amounts by category

| Column | Description |
|--------|-------------|
| `year` | Budget year |
| `cnty_cd` | County code |
| `cnty_description` | County name |
| `unit_type` | Budget unit type code |
| `unit_code` | Unit identifier |
| `unit_name` | Entity name |
| `sboa_id` | SBOA file number |
| `fund_description` | Fund name with code prefix (e.g., "0061 - RAINY DAY") |
| `department_label` | Department (e.g., "0000 NO DEPARTMENT") |
| `category_type_id_string` | Category code (e.g., "270000") |
| `Category` | Category description (e.g., "Debt Service", "Personal Services") |
| `amount_published` | Published/advertised budget amount |
| `amount_approved` | Approved budget amount |

**Monroe County:** 3,040 rows

---

### form22_2025.csv
**81,505 rows** | Tax distribution data — how state-collected taxes are distributed to local entities

| Column | Description |
|--------|-------------|
| `YR_NBR` | Year |
| `COUNTY_CD` | County code (format: "53") |
| `COUNTY` | County with code prefix (e.g., "53 - Monroe") |
| `UNIT_TYPE_CD` | Unit type code |
| `unit_type_description` | Entity type name (County, Township, City/Town, School, Library, Special, Conservancy) |
| `UNIT_CD` | Unit code |
| `UNIT` | Unit with code prefix |
| `ENTITY_CD` | Entity/fund code |
| `Entity` | Entity/fund name |
| `DISTRIBUTION_CD` | Distribution type code (L, C, F, etc.) |
| `distrib_type` | Distribution type name (License Excise, CVET, Financial Institutions, etc.) |
| `DISTRIBUTION_DATE` | Date of distribution |
| `ADVANCE` | Advance amount |
| `WARRANT` | Warrant amount |
| `AMT` | Distribution amount |
| `distribution_month` | Month name |

**Monroe County:** 507 rows across all entity types
**Key insight:** Shows actual money flowing from state to local entities — real revenue data.

---

### detailedrevenue_2025.csv
**39,128 rows** | Adopted revenue budget by fund and revenue source

| Column | Description |
|--------|-------------|
| `year` | Budget year |
| `cnty_cd` | County code |
| `cnty_description` | County name |
| `unit_type` | Budget unit type code |
| `unit_code` | Unit identifier |
| `unit_name` | Entity name |
| `sboa_id` | SBOA file number |
| `fund_cd` | Fund code |
| `fund_description` | Fund name |
| `expenditure_cat_id` | Revenue category ID |
| `expenditure_cat_description` | Revenue category (e.g., "TAXES AND INTERGOVERNMENTAL") |
| `item_ref_code` | Revenue line-item code (e.g., R112, R114) |
| `item_description` | Revenue source description |
| `adopted_amount` | Adopted budget amount |
| `adopted_amt_pc` | Per capita amount |
| `pop2010` | 2010 census population |

**Monroe County:** 416 rows

---

### eca_fund_expenditures_2024.csv
**387,112 rows** | School Extra-Curricular Account fund expenditures (most granular school spending)

| Column | Description |
|--------|-------------|
| `year` | Year (2024) |
| `county_cd_fk` | County code |
| `cnty_description` | County name |
| `corp_county` | Corporation county |
| `idoe_school_corp_number` | IDOE school corporation number |
| `corp_name` | School corporation name |
| `unit_name` | School-level unit name |
| `unit_type_id` | Unit type (196 = ECA) |
| `fund_id` | Fund ID |
| `fund_name` | Fund name (e.g., "Athletics", "Band") |
| `purpose` | Expenditure purpose/description |
| `amount` | Dollar amount |

**Monroe County:** 2,514 rows (MCCSC + Richland-Bean Blossom)

---

### eca_fund_receipts_2024.csv
**343,942 rows** | School ECA fund receipts

| Column | Description |
|--------|-------------|
| `year` | Year (2024) |
| `county_cd_fk` | County code |
| `cnty_description` | County name |
| `corp_county` | Corporation county |
| `idoe_school_corp_number` | IDOE school corp number |
| `corp_name` | School corporation name |
| `unit_name` | School-level unit name |
| `unit_type_id` | Unit type |
| `fund_id` | Fund ID |
| `fund_name` | Fund name |
| `SOURCE` | Receipt source description |
| `NATURE` | Nature of receipt |
| `amount` | Dollar amount |
| `submit_status` | Submission status |

**Monroe County:** 2,371 rows

---

### townshipDisburseByVendor_2025.csv
**188 rows** | Township disbursements broken down by vendor — vendor-level spending transparency

| Column | Description |
|--------|-------------|
| `year` | Year |
| `cnty_description` | County name |
| `county_cd_fk` | County code |
| `budget_unit_type` | Unit type (2 = Township) |
| `unit_code` | Unit identifier |
| `unit_name` | Township name |
| `sboa_id` | SBOA file number |
| `afr_unit_type` | AFR unit type |
| `Fund_code` | Fund code |
| `unit_fund_number` | Fund number |
| `unit_fund_name` | Fund name |
| `disburse_class_code` | Disbursement class code |
| `disburse_class_name` | Class name (e.g., "Personal Services") |
| `vendor_name` | Vendor/payee name |
| `vendor_disburse_code` | Vendor disbursement code |
| `amount` | Dollar amount |

**Monroe County:** 0 rows currently (only 188 rows statewide — early in reporting cycle)
**Note:** This is the only file with vendor-level detail. When fully populated, this is extremely valuable for tracking where township money goes.

---

## MEDIUM Relevance Files

### eca_fund_balances_2024.csv
**54,331 rows** | School ECA fund beginning and ending balances

Columns: `year`, `county_cd_fk`, `cnty_description`, `corp_county`, `idoe_school_corp_number`, `corp_name`, `unit_name`, `unit_type_id`, `fund_id`, `fund_name`, `beginning_bal`, `rcpts`, `expd`, `end_bal`, `submit_status`

**Monroe County:** 558 rows — useful for understanding fund health over time.

---

### Grants_2025.csv
**12,640 rows** | Federal and state grant awards to local entities

Columns: `year`, `cnty_description`, `cnty_cd`, `budget_unit_type`, `unit_code`, `unit_name`, `sboa_id`, `afr_unit_type`, `submit_status`, `cfda_no`, `agency_name`, `grant_program_title`, `local_project_name`, `pass_through_agency`, `award_name`, `award_number`, `local_unit_fund_number`, `local_unit_fund_name`, `grant_type_code`, `grant_type_description`, `receipts`, `disbursements`, `subrecipients`, `loans_outstanding`, `noncash_assistance`, `insurance`

**Monroe County:** 215 rows (filter: `cnty_description = 'Monroe' AND cnty_cd = '53'`)
**Entity types:** Counties (2,451), Cities/Towns (1,482), Schools (6,464), Special (807), Libraries (19), Townships (31)

---

### certNAV_2025.csv
**2,911 rows** | Certified Net Assessed Values by tax district — the tax base data

Columns: `budget_year`, `unit_type`, `county_number`, `cnty_description`, `Tax District Code`, `Tax District Name`, `Bank PP AV`, `Net AV 1%`, `Net AV 2%`, `Net AV 3%`, `Real Est. Net AV`, `Bus. PP Net AV`, `Utility PP Net AV`, `Rail PP Net AV`, `PP Net AV`, `AV TIF Real Est.`, `AV TIF PP`, `AV Withholding`, `Adjusting Net AV`, `AV TIF Released`, `AV Annex Change`

**Monroe County:** 18 rows (one per tax district)
**Key insight:** Essential for understanding property tax capacity and TIF impacts.

---

### e1_entity_funds_2025.csv
**3,054 rows** | E1 reports from non-profit entities receiving government funds

Contains extensive entity detail: name, address, operating officer, organization type, legal status, founding date, purpose description, audit info, and individual fund awards with amounts.

**Monroe County:** 131 rows — useful for tracking taxpayer money flowing to non-profits.

---

### CashInvCombined_2025.csv
**41 rows** | Combined cash and investment balances by fund (very early in reporting)

Columns: `year`, `cnty_description`, `cnty_cd`, `budget_unit_type`, `unit_code`, `unit_name`, `sboa_id`, `afr_unit_type`, `fund_code`, `unit_fund_number`, `fund_name`, `ent_id`, `ent_name`, `beg_cash_inv`, `r_bal`, `r_exceptions`, `d_bal`, `d_exceptions`, `cash_bal`

**Monroe County:** 0 rows currently (only 41 rows statewide)

---

## LOW Relevance Files

### afr_CapAssets_2025.csv
**63,181 rows** | Capital assets from Annual Financial Reports — land, buildings, equipment, infrastructure

Columns include: `asset_class`, `capital_assets_type_name`, `beginning_balance`, `additions`, `reductions`, `ending_balance`

No Monroe County (cnty_cd=53) data present. Contains Monroe Townships in other counties.

### afr_debt_2025.csv
**4 rows** | Debt schedules — only 4 entries (very early in reporting cycle)

### nonGovEntities_2025.csv
**3 rows** | Non-governmental entities linked to townships (e.g., volunteer fire departments)

### ta7_2025.csv
**5 rows** | Township Annual Report (TA-7) questionnaire responses — very few submissions

---

## Empty / Unavailable Files

The following files returned "Data Not Available for this Year and Unit Type" (0 rows):

- `afr_pension_2025.csv` — Pension data
- `afr_OPEB_2025.csv` — Other Post-Employment Benefits
- `afr_leases_2025.csv` — Lease obligations
- `detailedReceipts_2025.csv` — Detailed receipts (may become available later)
- `detailedDisburse_fundsNOdept_2025.csv` — Disbursements without department
- `detailedDisburse_fundswithdept_2025.csv` — Disbursements with department
- `eca_fund_balances_2025.csv` — 2025 ECA balances (not yet reported)

**Note:** Many 2025 files are still being populated. The 2024 ECA files have full data. Check back periodically for updated 2025 data, especially `detailedReceipts`, `detailedDisburse`, and `CashInvCombined`.

---

## Supabase Loading Priorities

### Phase 1 — Core Budget Data (load first)

1. **`detailedExpenditures_2025.csv`** (284K rows) — The single most important file. Line-item expenditure budgets for every entity. Filter to Monroe County for 4,659 rows.

2. **`detailedrevenue_2025.csv`** (39K rows) — Revenue budgets by source. Pairs with expenditures. Monroe: 416 rows.

3. **`form22_2025.csv`** (81K rows) — Actual tax distributions (real money, not budgets). Monroe: 507 rows.

4. **`form4a_2025.csv`** (180K rows) — Budget Form 4A with published vs. approved amounts. Monroe: 3,040 rows.

### Phase 2 — School Transparency

5. **`eca_fund_expenditures_2024.csv`** (387K rows) — School extra-curricular spending. Monroe: 2,514 rows.

6. **`eca_fund_receipts_2024.csv`** (344K rows) — School ECA receipts. Monroe: 2,371 rows.

7. **`eca_fund_balances_2024.csv`** (54K rows) — ECA fund balances. Monroe: 558 rows.

### Phase 3 — Grants & Tax Base

8. **`Grants_2025.csv`** (12K rows) — Federal/state grant awards. Monroe: 215 rows.

9. **`certNAV_2025.csv`** (2.9K rows) — Certified assessed values (tax base). Monroe: 18 rows.

10. **`e1_entity_funds_2025.csv`** (3K rows) — Non-profit entity reports. Monroe: 131 rows.

### Phase 4 — When Data Becomes Available

11. **`townshipDisburseByVendor_2025.csv`** — Re-download when fully populated. Vendor-level spending is unique to this file.

12. **`detailedReceipts_2025.csv`** — Re-download when 2025 data is published.

13. **`detailedDisburse_fundsNOdept_2025.csv`** / **`detailedDisburse_fundswithdept_2025.csv`** — Re-download when available. These may provide actual disbursement data (vs. budget).

14. **`CashInvCombined_2025.csv`** — Re-download when more entities report.

### Loading Strategy Notes

- **Filter to Monroe County first** (cnty_cd=53) to keep Supabase manageable. Total Monroe rows across all populated files: ~14,000.
- **Statewide data is ~1.4M rows** across populated files. Consider loading statewide only for comparison/benchmarking features.
- **Common join keys:** `cnty_cd` + `unit_type` + `unit_code` uniquely identifies an entity. `sboa_id` is another unique identifier.
- **Year column** enables multi-year trend analysis if you download prior years.
- **ECA files use different column names** (`county_cd_fk` instead of `cnty_cd`, `idoe_school_corp_number` for school IDs). Plan for schema normalization.
- **form22 uses different casing** (`COUNTY_CD`, `YR_NBR` vs. lowercase in other files). Normalize on import.
