# Stack Research: v1.8 Massachusetts All-Cities Financial Transparency

**Domain:** MA DLS reporting portal HTTP API + loader pattern for 351 MA municipalities
**Researched:** 2026-06-09
**Confidence:** HIGH — verified against live portal + codebase contains completed implementation

---

## Summary

The MA DLS portal (`dls-gw.dor.state.ma.us/reports/rdPage.aspx`) is a GrapeCity ActiveReports
web viewer — not a REST API. Data access requires: (1) a GET to establish a session and extract
`rdDataCache`, (2) an optional POST to filter by municipality/year, and (3) either a POST-based
Excel export using `rdReportFormat=NativeExcel` (preferred — all 351 rows in one request) or
AJAX GET pagination through 8-51 HTML pages as a fallback.

`scripts/scrapeMaDLS.js` is a complete, tested implementation already in the codebase. It
produced real output for FY2025 (`scripts/output/ma_dls_special-revenue_2025_expenditures.json`
and `scripts/output/ma_dls_revenue-by-source_2025.json`). No new npm packages beyond `exceljs`
(already at `^4.4.0` in package.json) are required.

---

## MA DLS Portal — HTTP API Shape

### Base URL

```
https://dls-gw.dor.state.ma.us/reports/rdPage.aspx
```

There are two domains in use; they are interchangeable:
- `dls-gw.dor.state.ma.us` (current canonical)
- `dlsgateway.dor.state.ma.us` (legacy alias, also live)

### Authentication

No API key. No login required for the public report pages. A session cookie (`AWSALB`) is
issued on first GET and must be pinned for all subsequent requests to the same backend. The
cookie rotates on each response — use the cookies from the INITIAL GET only, not rotated values,
to avoid routing to a different backend that lacks the in-memory `rdDataCache`.

### Request Flow (3 steps)

**Step 1 — GET initial page (establishes rdDataCache):**

```
GET /reports/rdPage.aspx?rdreport={rdreport}[{rdreportParams}]
```

Response: HTML page. Extract from HTML:
- `rdDataCache` — numeric string (e.g. `"8177198124"`); present in `rdDataCache=NNN` pattern
- Municipality list — `<input type="checkbox" name="iclMuni" value="Abington">` (or `iclMuni2`
  for the revenue-by-source subreport)
- Year options — `<select name="islYear">` (or `<input type="checkbox" name="iclYear2">`)

**Step 2 (revenue-by-source only) — POST to filter by FY:**

For `rdreport=RevenueBySource.RBS.RevbySource2`, the initial GET shows all years. Must POST
`iclMuni2` (checkbox array) + `iclYear2` (single year) to get a year-filtered `rdDataCache`.

```
POST /reports/rdPage.aspx?rdreport=RevenueBySource.RBS.RevbySource2&rdSubReport=True&rdResizeFrame=True

Body (application/x-www-form-urlencoded):
  rdreport=RevenueBySource.RBS.RevbySource2
  iclYear2=2025
  iclMuni2=Abington&iclMuni2=Acton&...  (all 351 municipalities)
  dtCurrent-PageNr=1
  rdShowElementHistory=
```

**Step 3A — Excel export (preferred, all 351 rows in one request):**

```
POST /reports/rdPage.aspx
  ?rdReport={rdreport}
  &rdReportFormat=NativeExcel
  &rdExportTableID={tableID}
  &rdExportFilename={exportFilename}
  &rdDataCache={rdDataCache}

Body: rdDataCache={rdDataCache}
```

Response: `application/vnd.ms-excel` binary (XLSX). Parse with `exceljs`. Returns all
municipalities for the selected fiscal year in one workbook.

**Step 3B — HTML pagination fallback (if Excel export returns HTML):**

For `xtFedGrants` (special-revenue): AJAX GET, 8 pages of ~45 rows each.
For `dtCurrent` (revenue-by-source): POST-based SubmitForm, up to 51 pages.

AJAX GET pattern:
```
GET /reports/rdPage.aspx
  ?rdReport={rdreport}
  &{tableID}-PageNr={page}
  &rdDataCache={rdDataCache}
  &rdShowModes=
  &rdSort=
  &rdNewPageNr=True1
  &rdAjaxCommand=RefreshElement
  &rdDataTablePaging=True
  &rdRefreshElementID={tableID}
  &rdRequestForwarding=Form
```

POST-based SubmitForm pattern:
```
POST /reports/rdPage.aspx
  ?rdReport={rdreport}&{tableID}-PageNr={page}&rdDataCache={rdDataCache}&rdShowModes=&rdSort=&rdNewPageNr=True1&rdRequestForwarding=Form

Body: all original form fields (iclMuni2 array, iclYear2, etc.) + {tableID}-PageNr={page}
```

### Report Definitions

| Report name | rdreport param | tableID | Dataset type | FY range | Notes |
|-------------|----------------|---------|--------------|----------|-------|
| `special-revenue` | `ScheduleA.Special_Rev_Funds.SpecialRevFunds` | `xtFedGrants` | operating | 2002–2025 | Has Expenditures/Revenues toggle (`islAmountType`). Municipality input: `iclMuni`. Year input: `islYear` (select). |
| `revenue-by-source` | `RevenueBySource.RBS.RevbySource2` | `dtCurrent` | revenue | 2003–2026 | Subreport — use `rdreportParams: '&rdSubReport=True&rdResizeFrame=True'`. Municipality input: `iclMuni2`. Year input: `iclYear2` (checkboxes). Pagination: POST-based. Column names must be overridden (colspan headers misalign `<th>` extraction). |

### Response Format — Parsed Record Shape

After Excel/HTML parsing and normalization, each record has:

```json
{
  "dorCode": "001",
  "municipality": "Abington",
  "fiscalYear": 2025,
  "Tax Levy": 42906155,
  "State Aid": 17614336,
  "Local Receipts": 5692102,
  "All Other": 2332700,
  "Enterprise & CPA Funds": 10170340,
  "Total Receipts": 68545294
}
```

DOR Code is a zero-padded 3-digit string (001–351). Municipality is the full plain-English name
matching the DLS form values (e.g. "Boston", "Cambridge"). fiscalYear is an integer.

### Rate Limits / Politeness

No documented rate limits. The scraper uses `DELAY_MS = 1500` ms between requests as a
courtesy delay. For 351 municipalities across multiple fiscal years, expect 1-3 seconds per
request. Total time for one report/year is under 30 seconds with Excel export (single request)
or 15-20 minutes with HTML pagination (8-51 pages at 1.5s each).

No API key. No CAPTCHA observed. No robots.txt restriction on the reports subdirectory.

---

## Recommended Stack

### Core Technologies (all already in use — no new packages)

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Node.js ESM scripts | existing | Loader entry point | Pattern matches all existing loaders |
| `node fetch` (built-in) | Node 18+ | HTTP GET/POST to rdPage.aspx | No node-fetch package needed |
| `exceljs` | `^4.4.0` | Parse Excel export bytes | Already in package.json |
| `@supabase/supabase-js` | existing | Call `treasury_sync_budget_tree` RPC | Unchanged |
| HTML regex parsing | — | Fallback when Excel export returns HTML | Implemented in scrapeMaDLS.js |

### New Scripts (no new packages)

| Script | Status | Purpose |
|--------|--------|---------|
| `scripts/scrapeMaDLS.js` | COMPLETE — tested | Scrapes MA DLS, seeds municipalities, loads to Supabase |

The script is complete. Its `--scrape`, `--seed`, and `--load` commands cover the full
pipeline. Additional work is seeding the 351 municipality rows and running multi-year scrapes.

---

## Verified Outputs (HIGH confidence)

The scraper has been run successfully against the live portal:

- `scripts/output/ma_dls_special-revenue_2025_expenditures.json` — 351 records, FY2025
- `scripts/output/ma_dls_revenue-by-source_2025.json` — 351 records, FY2025

Both files confirm: correct municipality names, DOR codes 001–351, numeric dollar amounts, and
the column structure documented above.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Puppeteer / Playwright | Portal works with plain HTTP; no JavaScript execution needed | Native fetch |
| Cheerio HTML parser | Regex-based table extraction already implemented in scrapeMaDLS.js | Existing implementation |
| node-fetch package | Node 18+ has built-in fetch | Built-in fetch |
| REST API calls | MA DLS has no REST or SODA API — it is a stateful ASP.NET reporting server | rdPage.aspx POST/GET flow |
| Socrata bulkLoadBudget.js | Only works for Socrata-hosted datasets; MA DLS is not Socrata | scrapeMaDLS.js |
| data.mass.gov / opendata.digital.mass.gov | Does not host DLS Schedule A or Revenue by Source datasets | dls-gw.dor.state.ma.us directly |

---

## Gotchas

1. **AWSALB sticky-session cookie rotation**: The AWSALB load-balancer cookie rotates with
   each response. If you use the rotated cookie to paginate, you land on a different backend
   that has no memory of the rdDataCache. Fix: always pass the cookies from the INITIAL GET
   for all subsequent pagination requests.

2. **revenue-by-source column header misalignment**: The `dtCurrent` table uses `colspan` and
   `rowspan` in its `<th>` rows, causing auto-extracted headers to misalign with `<td>` columns.
   Fix: use `report.columnNames` override: `['DOR Code', 'Municipality', 'Fiscal Year', 'Tax
   Levy', 'State Aid', 'Local Receipts', 'All Other', 'Enterprise & CPA Funds', 'Total Receipts']`.

3. **RevbySourceMAIN vs RevbySource2**: `rdreport=RevenueBySource.RBS.RevbySourceMAIN` is a
   wrapper page that renders `RevbySource2` inside an iframe. Use `RevbySource2` directly to
   avoid iframe-breaking the scraper. Add `&rdSubReport=True&rdResizeFrame=True` to the URL.

4. **rdDataCache is per-session, not per-URL**: The cache identifier is returned by the server
   after each initial GET or POST. It is a large numeric string. It does not appear in a
   predictable URL pattern and must be extracted from the response HTML each time.

5. **351 municipalities but DOR codes go up to ~360**: Some codes are skipped or represent
   districts rather than municipalities. The DOR Code zero-padded string is the canonical
   identifier. Municipality name (as it appears in the DLS form) is needed to match to the
   `municipalities` table.

---

## Sources

- `scripts/scrapeMaDLS.js` — codebase (primary, authoritative, implemented and tested)
- `scripts/output/ma_dls_special-revenue_2025_expenditures.json` — live scrape output
- `scripts/output/ma_dls_revenue-by-source_2025.json` — live scrape output
- Live portal inspection: `https://dls-gw.dor.state.ma.us/reports/rdPage.aspx` (2026-06-09)
- GrapeCity ActiveReports web viewer — confirmed backend reporting engine (rdPage.aspx pattern)

---
*Stack research for: v1.8 MA DLS city budget loader*
*Researched: 2026-06-09*
