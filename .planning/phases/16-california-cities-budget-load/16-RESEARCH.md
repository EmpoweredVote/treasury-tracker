# Phase 16 Research: California Cities Budget Load

**Researched:** 2026-05-22
**Domain:** Socrata SODA API, CSV open data portals, California city budgets
**Confidence:** HIGH for SF, LA revenue, and San Diego structure; MEDIUM for Berkeley and Fremont

---

## Summary

Five California cities were investigated for operating budget and revenue data availability. Results vary widely:

- **San Francisco** has a single Socrata dataset (`xdgd-c79v` at `data.sfgov.org`) containing both operating (spending) and revenue budget data through FY2027. Fully compatible with `bulkLoadBudget.js` with minor column mapping adjustment.
- **Los Angeles (revenue only)** has a viable revenue dataset (`vvm4-a2zu` at `controllerdata.lacity.org`) with 2,592 rows for FY2025 and $10.2B revenue_budget total — confirmed line-item data, not summaries.
- **San Diego** has operating budget and actuals CSV data at `seshat.datasd.org` — not a standard Socrata SODA endpoint. Requires a new CSV-based loader; fiscal year stored as 2-digit integer (e.g., 25 = FY2025). Has both spending and revenue (account_number prefix distinguishes them).
- **Berkeley** has a Socrata-based open data portal (`data.cityofberkeley.info`) but the only operating budget dataset (`gy8t-iqc4`) tops out at FY2015. No current data available. No revenue dataset found. **Not loadable** without manual data acquisition.
- **Fremont** has no Socrata portal and no machine-readable budget data. Budget documents are PDFs only. ArcGIS Hub is GIS-only. **Not loadable** without manual data acquisition.

**Primary recommendation:** Phase 16 should load SF (operating + revenue), SD (operating + revenue via CSV loader), and LA (revenue). Exclude Berkeley and Fremont — no suitable machine-readable data exists. This gives three cities × 2 dataset types = up to 6 data_source rows, requiring one new loader for San Diego's CSV format.

---

## City-by-City Findings

### Los Angeles (revenue only — operating loaded in Phase 15)

**Platform:** Socrata (`controllerdata.lacity.org`) — same portal as the operating budget

**Re-evaluation of excluded revenue dataset `6cbx-e2fd`:**
- Confirmed: only runs through FY2022, 1,062 total rows, ~35 rows/year
- Phase 15 decision to exclude was correct

**Newly discovered revenue dataset: `vvm4-a2zu`**

| Field | Value |
|-------|-------|
| Dataset name | "revenue" (official name on portal) |
| Dataset ID | `vvm4-a2zu` |
| Base URL | `https://controllerdata.lacity.org` |
| Fiscal year range | FY2011–FY2026 (verified live) |
| FY2025 row count | 2,592 rows |
| FY2026 row count | 2,484 rows |
| FY2025 revenue_budget total | $10,223,013,860 (~$10.2B, plausible for LA) |
| Fiscal year field | `fiscal_year` (integer: 2025, 2026) |

**Column schema (verified 2026-05-22):**
| Socrata field | Role |
|---|---|
| `fiscal_year` | year filter — stored as integer (e.g., 2025), not string |
| `department_name` | top-level category |
| `revenue_source_name` | subcategory |
| `revenue_budget` | adopted/budgeted revenue amount |
| `revenue_collected` | actual collected amount |
| `revenue_collected_pct` | percentage collected |
| `fund_name` | fund context |
| `revenue_class_name` | class name (similar to account type) |
| `fund` | fund code |
| `revenue_source_code` | numeric code |
| `revenue_class_code` | numeric code |

**Pipeline note:** `fiscal_year` is an INTEGER in this dataset. The standard `bulkLoadBudget.js` WHERE clause wraps the value in quotes (`fiscal_year='2025'`), which will fail for integer columns. The WHERE clause must be `fiscal_year=2025` (no quotes) for this dataset. This requires either a new column_mapping flag or a thin wrapper script.

**column_mapping for LA Revenue:**
```json
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "revenue_budget",
  "actual_amount_column": "revenue_collected",
  "category_column": "department_name",
  "subcategory_column": "revenue_source_name",
  "fiscal_year_type": "integer"
}
```

A `fiscal_year_type: "integer"` flag (or equivalent) would need to be added to `bulkLoadBudget.js` to skip quoting the WHERE value. Alternatively, a separate `seedLARevenueDataSources.js` / `loadLARevenue.js` can construct the WHERE clause correctly.

**Also discovered: `s234-w655` (City Revenue by Month)**
- 255,021 rows, FY2012–FY2026
- Contains monthly actuals only (no adopted budget column)
- Not suitable for the budget tree pipeline (no `approved_amount` equivalent)

---

### San Francisco

**Platform:** Socrata (`data.sfgov.org`) — YES, standard SODA API

**Base URL:** `https://data.sfgov.org`

**Unified budget dataset `xdgd-c79v`** contains BOTH operating (spending) and revenue budget data in a single dataset:

| Field | Value |
|-------|-------|
| Dataset name | "Budget" |
| Dataset ID | `xdgd-c79v` |
| Base URL | `https://data.sfgov.org` |
| Fiscal year range | FY2010–FY2027 (verified live) |
| FY2025 spending rows | 23,671 |
| FY2026 spending rows | 22,384 |
| FY2025 revenue rows | 4,663 |
| FY2026 revenue rows | 4,275 |
| FY2025 total spending budget | $15,917,870,152 (~$15.9B, correct for SF) |
| FY2025 total revenue budget | $15,917,870,147 (~$15.9B, matches spending) |
| Last data_loaded_at | 2026-05-11 (fresh) |

**Column schema (verified 2026-05-22):**
| Socrata field | Role |
|---|---|
| `fiscal_year` | year filter — stored as STRING ("2025", "2026") |
| `revenue_or_spending` | "Revenue" or "Spending" — distinguishes budget type |
| `department` | top-level category (e.g., "FIR Fire Department") |
| `organization_group` | higher grouping (e.g., "Public Protection") |
| `fund_type` | fund (e.g., "General Fund") |
| `fund` | fund detail |
| `program` | program name |
| `character` | character of expenditure (Salaries, Services, etc.) |
| `object` | object detail |
| `sub_object` | sub-object detail |
| `budget` | adopted budget amount (dollars, not thousands) |

**Note:** No `actual_amount` column — this dataset is budget (adopted) only, not actuals. Set `actual_amount_column` to null in column_mapping.

**Note:** FY2027 has only 6,936 spending rows vs 23,671 for FY2025 — FY2027 may be proposed/partial, not adopted. Use FY2025 and FY2026 for Phase 16.

**Pipeline compatibility:** The dataset requires filtering by `revenue_or_spending` in the WHERE clause in addition to the fiscal year filter. The standard `bulkLoadBudget.js` WHERE clause is `${fyCol}='${fiscalYear}'`. For SF, we need:
```
fiscal_year='2025' AND revenue_or_spending='Spending'
```
This requires a `filter_column` / `filter_value` capability in `column_mapping`, OR two separate data_source rows (one for operating, one for revenue) each with a `where_suffix` or similar extension.

**column_mapping for SF Operating (Spending):**
```json
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "budget",
  "actual_amount_column": null,
  "category_column": "department",
  "subcategory_column": "fund_type",
  "where_extra": "AND revenue_or_spending='Spending'"
}
```

**column_mapping for SF Revenue:**
```json
{
  "fiscal_year_column": "fiscal_year",
  "approved_amount_column": "budget",
  "actual_amount_column": null,
  "category_column": "department",
  "subcategory_column": "fund_type",
  "where_extra": "AND revenue_or_spending='Revenue'"
}
```

A `where_extra` field in `column_mapping` that appends to the WHERE clause would handle this cleanly. Alternatively, a separate loader script can build the where clause directly.

**Population:** 827,526 (Census sub-est2024_6.csv, 2024 estimate)

**Enrichment estimate:** ~55–70 unique department names, ~$0.12–0.14 at Haiku pricing. Well under $5 threshold.

---

### San Diego

**Platform:** Custom CSV endpoint (`seshat.datasd.org`) — NOT standard Socrata SODA

San Diego's open data portal (`data.sandiego.gov`) publishes data as static CSV files served from `seshat.datasd.org`. There are NO Socrata 4x4 dataset IDs and no SODA API endpoints. `bulkLoadBudget.js` cannot be used as-is.

**Operating Budget CSV:**
- Download URL: `https://seshat.datasd.org/operating_budget/budget_operating_datasd.csv`
- Data dictionary: `https://seshat.datasd.org/operating_budget/operating_budget_dictionary_datasd.csv`
- Last updated: 2026-05-15 (fresh)
- Fiscal years: FY2011 to most current (sample shows `report_fy: "15"` = FY2015; need to verify FY25/26 presence)

**Column schema:**
| Field | Role |
|---|---|
| `report_fy` | 2-digit fiscal year (25 = FY2025, 26 = FY2026) |
| `budget_cycle` | "adopted" or other values (e.g., proposed) |
| `fund_type` | fund type grouping |
| `fund_number` | fund identifier |
| `dept_name` | department name |
| `funds_center_number` | lowest org unit |
| `account` | account name (expense or revenue) |
| `account_number` | numeric — revenue accts start with 4, expense accts start with 5 |
| `amount` | budgeted amount (dollars) |

**Revenue vs. Expense distinction:** Revenue and expense data are in the SAME file. Filter by `account_number` prefix: revenue = 4xxxxx, expense = 5xxxxx.

**Fiscal year format:** 2-digit integer (25, 26) — NOT a 4-digit year. Loader must convert to 4-digit for display, or document convention.

**New loader required:** `scripts/loadSanDiegoCSV.js` (or similar). Must:
1. Fetch CSV from `seshat.datasd.org`
2. Filter `budget_cycle === 'adopted'`
3. Filter by 2-digit `report_fy`
4. Separate revenue (account 4xxxxx) from expense (account 5xxxxx) rows
5. Build budget tree and call `treasury_sync_budget_tree` RPC

**Operating Actuals CSV (reference only):**
- URL: `https://seshat.datasd.org/operating_actuals/actuals_operating_datasd.csv`
- Columns: `report_fy, fund_type, fund_number, dept_name, funds_center_number, account, account_number, amount`
- Same structure as budget; could be used as `actual_amount` source

**Population:** 1,404,452 (Census sub-est2024_6.csv, 2024 estimate)

**Enrichment estimate:** ~30–50 unique dept_name values, ~$0.08–0.10. Well under $5 threshold.

---

### Berkeley

**Platform:** Socrata (`data.cityofberkeley.info`) — YES, SODA compatible — BUT data is stale

**Assessment: NOT LOADABLE for Phase 16**

Berkeley's Socrata portal has only one budget dataset: `gy8t-iqc4` (City of Berkeley Operating Budget), which covers **FY2012–FY2015 only** (47,420 rows). The portal has had no financial data updates since 2015. No revenue dataset exists on the portal.

| Field | Value |
|-------|-------|
| Dataset ID | `gy8t-iqc4` |
| Base URL | `https://data.cityofberkeley.info` |
| Max fiscal year | 2015 |
| Revenue dataset | None found |

**Column schema for `gy8t-iqc4`** (would be usable if current):
| Field | Role |
|---|---|
| `fiscal_year` | string year |
| `department` | top-level category |
| `program` | program area |
| `service` | service type |
| `expense_category` | expense type |
| `approved_amount` | adopted budget |
| `fund` | fund name |
| `fund_type` | fund grouping |
| `description` | line item description |
| `expense_type` | expense type description |

**Why the data stopped at 2015:** Unknown — the portal was launched in 2015 and financial dataset updates appear to have been discontinued. Berkeley adopted a biennial budget for FY2025/26, but it is published only as PDF documents.

**Alternatives investigated and rejected:**
- Berkeley's city website: budget documents are PDFs only (no machine-readable data)
- CA Open Data portal: only a geographic dataset for Berkeley, no financial data
- ArcGIS Hub: not available for Berkeley

**Recommendation: Exclude Berkeley from Phase 16.** Adding Berkeley would require manual data extraction from PDF budget documents — a separate phase.

**Population (for future reference):** 121,749 (Census sub-est2024_6.csv, 2024 estimate)

---

### Fremont

**Platform:** ArcGIS Hub (`fremont-ca-open-data-cofgis.hub.arcgis.com`) — GIS only, no financial data

**Assessment: NOT LOADABLE for Phase 16**

Fremont has NO machine-readable budget or revenue data. Specific findings:

- **ArcGIS Hub** (`fremont-ca-open-data-cofgis.hub.arcgis.com`): GIS/mapping datasets only. Budget and finance category absent.
- **MyFremont budget portal** (`my.fremont.gov/citybudget`): Community engagement portal with PDF documents and surveys only.
- **City website finance page**: PDF documents only (Proposed Operating Budget, CAFR, etc.).
- **No Socrata portal** — Fremont has never used Socrata.
- **No OpenGov API access** — Budget is visualized on OpenGov (`sandiegoca.opengov.com` is San Diego, not Fremont; Fremont has no confirmed OpenGov public API).

Budget scale for reference: FY2025/26 adopted operating budget = $392.4M (small city by CA standards).

**Recommendation: Exclude Fremont from Phase 16.** Machine-readable data does not exist. Would require PDF extraction (Phase 7-style pipeline).

**Population (for future reference):** 228,192 (Census sub-est2024_6.csv, 2024 estimate)

---

## Pipeline Assessment

### Which cities can use `bulkLoadBudget.js` as-is?

**None exactly as-is**, but SF is close with one extension:

| City | Compatibility | Issue |
|------|--------------|-------|
| San Francisco | Needs minor extension | Must append `AND revenue_or_spending='Spending'` (or `='Revenue'`) to WHERE clause. Add `where_extra` to column_mapping support. |
| Los Angeles (revenue) | Needs minor extension | `fiscal_year` is INTEGER not STRING — WHERE must be `fiscal_year=2025` not `fiscal_year='2025'`. Add `fiscal_year_type: "integer"` to column_mapping support. |
| San Diego | Needs new loader | CSV endpoint, not SODA. 2-digit fiscal year. Same-file revenue/expense splitting by account prefix. |
| Berkeley | Not applicable | No current data |
| Fremont | Not applicable | No machine-readable data |

### Which need a new loader or custom column mapping?

**San Diego** requires a new `loadSanDiegoCSV.js` script. The CSV approach is fundamentally different from SODA — requires HTTP fetch of full CSV, CSV parsing, filtering by `budget_cycle === 'adopted'` and `report_fy === 25`, splitting by account prefix for operating vs. revenue, then calling `treasury_sync_budget_tree`.

**LA Revenue** and **SF** can reuse `bulkLoadBudget.js` with small changes:
1. Add `fiscal_year_type: "integer"` support to suppress quotes in WHERE clause (for LA)
2. Add `where_extra` support to append extra WHERE conditions (for SF)

These are 5–10 line changes to `bulkLoadBudget.js`.

### Any cities without Socrata?

| City | Platform | Notes |
|------|----------|-------|
| San Francisco | Socrata (data.sfgov.org) | Full SODA API |
| Los Angeles | Socrata (controllerdata.lacity.org) | Full SODA API (two portals — use controllerdata, not data.lacity.org) |
| San Diego | Custom CSV (seshat.datasd.org) | No SODA — CSV file download only |
| Berkeley | Socrata (data.cityofberkeley.info) | SODA available but data stale since 2015 |
| Fremont | ArcGIS Hub (GIS only) | No financial data at all |

---

## Recommended Scope

### Include

| City | Datasets | Reasoning |
|------|----------|-----------|
| San Francisco | Operating (FY2025, FY2026) + Revenue (FY2025, FY2026) | Socrata, fresh data, ~$16B budget, large city |
| Los Angeles | Revenue only (FY2025, FY2026) | Socrata, discovered `vvm4-a2zu` with $10.2B budget data |
| San Diego | Operating (FY2025, FY2026) + Revenue (FY2025, FY2026) | CSV, fresh data (updated 2026-05-15), but needs new loader |

### Exclude

| City | Reason |
|------|--------|
| Berkeley | Socrata portal data stops at FY2015. No current machine-readable data. |
| Fremont | No machine-readable budget data exists — PDF only. |

### Estimated Enrichment Costs

| City | Unique Categories (est.) | Cost per call | Estimated Cost |
|------|--------------------------|---------------|----------------|
| San Francisco | ~60 dept names | $0.002 | ~$0.12 |
| Los Angeles revenue | ~40 dept names (overlaps with operating) | $0.002 | ~$0.00–$0.08 (mostly pre-enriched) |
| San Diego | ~35 dept names | $0.002 | ~$0.07 |
| **Total** | | | **~$0.19–$0.27** |

Well under the $5 approval threshold.

### Suggested Phase Structure

**Option A — Single Phase (recommended for SF + LA revenue):**
If San Diego is deferred, Phase 16 = SF (operating + revenue) + LA (revenue only). All Socrata, requires only small `bulkLoadBudget.js` extensions.

**Option B — Two Phases (recommended if San Diego is in scope):**
- **Phase 16**: SF operating + SF revenue + LA revenue (all Socrata, minor loader changes)
- **Phase 17**: San Diego operating + San Diego revenue (new CSV loader)

**Option C — Full scope single phase:**
All three cities in one phase — higher risk due to two different loader patterns (Socrata + CSV).

**Recommended: Option B.** Building the CSV loader for San Diego is a non-trivial task that deserves its own phase with clear success criteria. SF and LA revenue are low-risk Socrata additions.

---

## Open Questions

1. **LA revenue: integer fiscal_year WHERE clause**
   - What we know: `vvm4-a2zu.fiscal_year` is stored as an integer (not a string). The current `bulkLoadBudget.js` always quotes the WHERE value: `` `${fyCol}='${fiscalYear}'` ``.
   - What's unclear: Does modifying `bulkLoadBudget.js` to support both string and integer fiscal year columns risk breaking existing TX city integrations?
   - Recommendation: Add a `fiscal_year_type: "integer"` flag to `column_mapping`; default behavior (string) unchanged. Or use a dedicated `seedLARevenueDataSources.js` with a custom WHERE builder.

2. **SF: where_extra column_mapping extension**
   - What we know: SF needs `AND revenue_or_spending='Spending'` appended to the WHERE clause. Standard `bulkLoadBudget.js` does not support this.
   - What's unclear: Whether `where_extra` in `column_mapping` is the right approach or whether a dedicated SF loader is cleaner.
   - Recommendation: Add `where_extra` to `column_mapping` support in `bulkLoadBudget.js` — this will also be useful for other cities with combined datasets in the future.

3. **San Diego fiscal year format verification**
   - What we know: The data dictionary sample shows `report_fy: "15"` (2-digit). The dataset was last updated 2026-05-15.
   - What's unclear: Is FY2025 represented as `25` or `2025` in the actual CSV? The sample only shows `"15"` (2015), which is 2-digit. Need to download and sample the CSV to confirm FY2025 and FY2026 presence.
   - Recommendation: Before building the San Diego loader, download a sample of the CSV and verify FY25/26 rows exist and `report_fy` values.

4. **San Diego revenue split by account prefix**
   - What we know: Revenue accounts begin with 4, expense with 5 (per data dictionary).
   - What's unclear: Whether all rows are present in the budget file or if some revenue items are absent. Need to validate that revenue rows sum to a plausible total.
   - Recommendation: Sample 20–30 rows with `account_number` starting with 4 to verify revenue data is usable.

5. **Berkeley exclusion — is there an alternative data source?**
   - What we know: `data.cityofberkeley.info` data stopped at FY2015.
   - What's unclear: Whether Berkeley publishes budget Excel files that could be loaded via the XLSX pipeline.
   - Recommendation: Check `berkeleyca.gov/your-government/financial-information/city-budget` for Excel downloads before permanently deferring. If XLSX exists, this is a Phase 7-style pipeline, not Phase 16 scope.

6. **San Francisco FY2026 vs FY2027**
   - What we know: FY2026 has 22,384 spending rows (~$16B), FY2027 has only 6,936 rows (partial).
   - What's unclear: Whether FY2027 is a proposed budget or an early adoption. Loading partial years may skew per-capita display.
   - Recommendation: Load FY2025 and FY2026 only for Phase 16. Revisit FY2027 when row count grows to match prior years.

---

## Population Data (Census sub-est2024_6.csv, verified 2026-05-22)

| City | POPESTIMATE2024 | Source Field |
|------|-----------------|-------------|
| Los Angeles | 3,878,704 | Los Angeles city (SUMLEV=162) — already in DB from Phase 15 |
| San Francisco | 827,526 | San Francisco city (SUMLEV=162) |
| San Diego | 1,404,452 | San Diego city (SUMLEV=162) |
| Berkeley | 121,749 | Berkeley city (SUMLEV=162) — for future use |
| Fremont | 228,192 | Fremont city (SUMLEV=162) — for future use |

Census file: `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_6.csv`

---

## Sources

### Primary (HIGH confidence)
- Live API: `https://data.sfgov.org/resource/xdgd-c79v.json` — column schema, FY coverage, row counts, spending/revenue split verified 2026-05-22
- Live API: `https://controllerdata.lacity.org/resource/vvm4-a2zu.json` — column schema, FY2025/2026 row counts, revenue_budget totals verified 2026-05-22
- Live API: `https://controllerdata.lacity.org/resource/s234-w655.json` — monthly actuals confirmed, no adopted budget column
- Live API: `https://controllerdata.lacity.org/resource/6cbx-e2fd.json` — max FY=2022 confirmed (Phase 15 finding revalidated)
- Live API: `https://data.cityofberkeley.info/resource/gy8t-iqc4.json` — max FY=2015 confirmed 2026-05-22
- Live page: `https://data.sandiego.gov/datasets/operating-budget/` — CSV structure, column names, last updated 2026-05-15
- Live page: `https://seshat.datasd.org/operating_budget/operating_budget_dictionary_datasd.csv` — column definitions confirmed
- Census CSV: `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_6.csv` — all five city populations verified

### Secondary (MEDIUM confidence)
- WebSearch + API cross-reference: San Diego uses `seshat.datasd.org` CSV endpoints, not Socrata SODA — confirmed by absence of 4x4 IDs and direct CSV URLs in dataset pages
- WebSearch + API cross-reference: SF `6pm8-ckfn` (older "San Francisco Budget" dataset) has no `fiscal_year` column — use `xdgd-c79v` instead
- LA Controller portal search: `vvm4-a2zu` discovered via `controllerdata.lacity.org/api/views.json` revenue category

### Tertiary (LOW confidence)
- WebSearch only: Fremont has no machine-readable budget data — no positive confirmation from official source, inferred from absence across multiple platforms (ArcGIS Hub, MyFremont, city website)
- WebSearch only: Berkeley open data portal stalled at 2015 — reason unknown, portal still active

---

## Metadata

**Confidence breakdown:**
- SF dataset ID + columns: HIGH — verified against live Socrata API
- LA revenue dataset + columns: HIGH — verified against live Socrata API
- San Diego CSV structure: HIGH for column schema; MEDIUM for fiscal year format (2-digit confirmed from sample but FY25/26 presence not directly verified)
- Berkeley staleness: HIGH — live API confirmed max FY=2015
- Fremont exclusion: MEDIUM — no machine-readable data found across all platforms searched
- Population figures: HIGH — verified against Census CSV

**Research date:** 2026-05-22
**Valid until:** 2026-08-22 (Socrata APIs stable; Census file valid until 2025 vintage released; San Diego CSV updated monthly)
