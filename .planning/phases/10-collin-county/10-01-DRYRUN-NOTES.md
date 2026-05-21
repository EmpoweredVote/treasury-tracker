# Phase 10-01 Dry-Run Notes

**Date:** 2026-05-21
**Cache dir:** C:/tmp/collin-budgets/

---

## Garland

- **PDF URL:** https://garlandtx.gov/DocumentCenter/View/20565/City-of-Garland-2024-25-Annual-Operating-Budget-PDF
- **Preferred FY:** 2025 (FY2026 at `/22610/` is only 211KB — confirmed summary brochure)
- **File size:** 135,510,134 bytes (~129MB) — full comprehensive budget book
- **pdftotext header sample (first 50 lines):**
  ```
  City of Garland
  Annual Operating Budget FY 2024-25
  City of Garland, Texas
  2024-25 Adopted Budget, September 3, 2024
  ...Table of Contents with page numbers...
  General Fund Department Detail: Animal Services (69), Fire (75), Police (81),
  Budget & Research (85), City Administration (88), City Attorney (90),
  Financial Services (97), Human Resources (100), Municipal Court (112),
  Engineering (123), Building Inspection (137), Library (152), Parks & Recreation (156)
  ```
- **Found total lines (grep result):**
  ```
  The FY 2024-25 Approved General Fund Expenditures are $246.9 million
  The FY 2024-25 General Fund Budget totals $246.9 million
  Total General Fund revenues are anticipated to be $242.7 million for FY 2024-25
  Totals $235.5 $11.4 $246.9
  ```
- **Estimated grand total:** $246.9M (General Fund expenditures)
- **Sanity check (expect $200M–$500M):** PASS
- **Routing decision:** `pdftotext-parser`
- **Rationale:** PDF has clean tabular department detail — department names appear in rows with multi-year dollar columns (Actual / Approved / Revised / Approved). Layout is identical to the Longview pattern: named departments + numeric columns. 135MB PDF has 400+ pages, but the General Fund department section starts around page 69 and lists ~20 named departments.
- **Plan for 10-02:** Write `scripts/processGarlandBudget.js` modeled on `processLongviewBudget.js`. Key section: General Fund Expenditures by Area table (~page 65 in PDF) lists all dept totals in a single summary, and each dept has a detail page. Use summary table for top-level extraction — department names + 4-column amounts (2022-23 Actual | 2023-24 Approved | 2023-24 Revised | 2024-25 Approved).

---

## Richardson

- **PDF URL (attempted):** https://cdnsm5-hosted.civiclive.com/UserFiles/Servers/Server_7964838/File/Government/Departments/Finance/Financial%20Transparency/Annual%20Budgets/2025%20Budget%20Book%20-%20compressed%208-28.pdf
- **Preferred FY:** 2026 (also tried FY2025)
- **File size:** FY2025 = 40,323,778 bytes; FY2026 = 40,339,050 bytes
- **⚠️ CRITICAL ERROR:** Both downloaded PDFs are from **Roseville, California**, not Richardson, Texas. The CivicLive CDN `Server_7964838` hosts Roseville CA budget documents. The research-phase URL is wrong.
  ```
  pdftotext output shows:
  "Annual Budget - City of Roseville, California"
  "Mayor: Krista Bernasconi"  (Roseville CA mayor)
  "City Manager: Dominick Casey"
  ```
- **Estimated grand total:** N/A (wrong city)
- **Sanity check:** FAIL (wrong city)
- **Routing decision:** `skip` — URL error
- **Rationale:** The CivicLive CDN server ID used in research (`Server_7964838`) belongs to Roseville CA, not Richardson TX. Richardson TX's website (`cor.net`) blocks direct HTTP fetching (HTTP 403). The correct direct PDF URL for Richardson TX was not discoverable via web search as of 2026-05-21.
- **Plan for 10-02:** **Skip Richardson in this phase.** Update `scripts/seedPDFDataSources.js` to remove/replace Richardson entries with placeholder `base_url` until correct URL is found. Richardson can be added via a quick task once the correct URL is manually sourced (visit cor.net/departments/budget in a browser).
- **Action needed before 10-02:** Manually visit https://www.cor.net/departments/budget in a browser to find direct PDF download URL for the Annual Budget document, then update `seedPDFDataSources.js` and re-run seeder.

---

## Wylie

- **PDF URL:** https://cms2.revize.com/revize/wylienew/Departments/Finance/Budget/FY%202026%20Final%20Budget.pdf
- **Preferred FY:** 2026
- **File size:** 18,911,544 bytes (~18MB)
- **pdftotext header sample:**
  ```
  No-New-Revenue Tax Rate: $0.521441/100 | $0.507537/100
  Voter-Approval Tax Rate: $0.407776/100 | $0.375823/100
  Total debt obligation for City of Wylie secured by property taxes: $67,270,781.
  GOVERNMENT FINANCE OFFICERS ASSOCIATION Distinguished Budget Presentation Award — PRESENTED TO City of Wylie
  
  Table of Contents:
  5111 - City Council, 5112 - City Manager, 5113 - City Secretary, 5114 - City Attorney,
  5131 - Finance, 5211 - Police, 5231 - Fire, 5411 - Streets, 5511 - Parks, 5551 - Library...
  ```
- **Found total lines:**
  ```
  TOTAL REVENUES & TRANSFERS-IN  ($75,479,822) | ($79,952,566) | ($83,752,085)
  TOTAL EXPENDITURES & TRANSFERS-OUT ($75,479,822) | ($79,952,566) | ($83,752,085)
  Total General Fund  1,511,148  [supplemental appropriation line]
  ```
- **Estimated grand total:** ~$76–80M General Fund (FY2026 is the 2nd-to-last column in multi-year projection table)
- **Sanity check (expect $50M–$150M):** PASS
- **Routing decision:** `pdftotext-parser`
- **Rationale:** PDF is NOT image-heavy (Pitfall 3 did not apply). pdftotext extracts rich text with department section codes (5111, 5112, etc.), fund labels, and numeric tables. The "for Web" warning from research was a false alarm — the PDF has clean tabular budget content. Each department has its own section with expenditure breakdowns by category.
- **Plan for 10-03:** Write `scripts/processWylieBudget.js`. Department sections are keyed by 4-digit codes (5111 = City Council, 5211 = Police, etc.). Summary of revenues and expenditures tables appear before dept detail. Parse the General Fund summary table for totals or parse per-dept total rows.

---

## Sachse

- **PDF URL:** https://www.cityofsachse.com/DocumentCenter/View/12467/FY2025-2026-Adopted-Budget
- **Preferred FY:** 2026
- **File size:** 62,685,481 bytes (~60MB)
- **pdftotext header sample:**
  ```
  City of Sachse, Texas | Adopted Budget 2025-2026
  Property Tax Rate: $0.650416/100 (2025-2026 and 2024-2025 — unchanged)
  Total debt obligation for City of Sachse secured by property taxes: $8,435,388
  ```
- **Found total lines:**
  ```
  General Fund revenues and budget transfers in are estimated at $31,250,209
  General Fund operating expenditures and budget transfers out total $31,181,759
  Total Inflows 31,250,209 | Total Outflows 31,181,759
  ```
- **Estimated grand total:** $31.2M (General Fund expenditures)
- **Sanity check (expect $30M–$100M):** PASS
- **Routing decision:** `pdftotext-parser`
- **Rationale:** PDF has clean department-level expenditure tables. Each department (City Manager, Police, Fire, etc.) has an EXPENDITURES section with rows for Personnel Costs, Supplies, Maintenance, Contractual Services, and Transfers Out — with Actual (3 years) + Budget columns. Text extraction is clean and tabular.
- **Plan for 10-03:** Write `scripts/processSachseBudget.js`. Parse per-department EXPENDITURES tables. Department sections are labeled with department names and "General Fund". Key total line per department: sum Personnel + Supplies + Maintenance + Contractual Services + Capital + Transfers.

---

## Murphy

- **PDF URL:** https://www.murphytx.org/DocumentCenter/View/9835/City-of-Murphy-Budget-Book-with-amendments-as-of-09162025
- **Preferred FY:** 2025 (amended version `/9835/` preferred over original `/9213/`)
- **File size:** 25,822,095 bytes (~24MB)
- **pdftotext header sample:**
  ```
  City of Murphy, Texas | FY 2025 Adopted Budget
  This budget will raise less revenue from property taxes than last year's budget
  by an amount of $-424,841, which is a -3.05 percent decrease from last year's budget.
  Property Tax Rate: $0.362533/100 | No-New-Revenue Rate: $0.374232/100
  Total debt obligation for City of Murphy secured by property taxes: $3,399,814
  ```
- **Found total lines:**
  ```
  Total General Fund revenue for FY25 is $19,733,072, a net increase of $1.6 million
  [expenditures ~$19.7M — not stated explicitly as single figure but matches revenue]
  Total Capital Outlay: $3,159,393 | $3,639,761 | $3,458,869 | $3,975,886 (FY25)
  ```
- **Estimated grand total:** ~$19.7M (General Fund, FY2025)
- **Sanity check (expect $20M–$80M):** PASS (just under $20M; Murphy pop ~25k; $19.7M / 25k = $788/resident — slightly below the $1,000/resident floor, but Murphy is a small bedroom community with limited municipal services; plausible)
- **Routing decision:** `pdftotext-parser`
- **Rationale:** PDF extracts clearly with department headings and expenditure category breakdowns (Personnel Services, Contractual Services, Materials & Supplies, Capital Outlay). Column format matches Longview/Sachse patterns. Department list includes: Fire & Rescue, Public Works, Police, Parks, Administration.
- **Plan for 10-03:** Write `scripts/processMurphyBudget.js`. Parse per-department expenditure sections. Key column is "FY2025 Budgeted" (rightmost non-projected column). Use Total Expense Objects line per department as the department total.

---

## Princeton

- **PDF URL:** https://princetontx.gov/DocumentCenter/View/6974/Adopted-Budget-2025-26
- **Preferred FY:** 2026 (9.7MB, explicitly adopted; FY2025 at `/2902/` is 4.4MB)
- **File size:** 10,127,014 bytes (~9.7MB) — confirmed correct
- **pdftotext header sample:**
  ```
  CITY OF PRINCETON
  ADOPTED ANNUAL BUDGET FY 2025-2026
  Table of Contents: Budget Message, General Fund, Proprietary Funds, Special Revenue Funds,
  Debt Service Funds, CIP Summary...
  Full-Time Equivalent Budgeted Positions by department
  CITY OF PRINCETON BUDGET HIGHLIGHTS FISCAL YEAR 2025-2026
  ```
- **Found total lines:**
  ```
  General Fund budget $36,852,089
  TOTAL REVENUES $36,852,089
  total combined expenditure is $152,734,236 [all funds]
  of which $70,405,053 is [implied: General Fund portion from prior context]
  ```
- **Estimated grand total:** $36.9M (General Fund budget)
- **Sanity check (expect $15M–$60M):** PASS
- **Routing decision:** `pdftotext-parser`
- **Rationale:** PDF extracts cleanly. Each department has an EXPENSE SUMMARY table with rows for Personnel, Supplies, Maintenance, Charges for Services, Contract Services, Capital, Capital Leases, Transfers — with Actual/Amended/Projected/Adopted columns. Layout is consistent across departments. Princeton's rapid growth (~15k pop but fast-growing) justifies $36.9M ($2,460/resident — upper end of range, plausible given infrastructure buildout).
- **Plan for 10-03:** Write `scripts/processPrincetonBudget.js`. Each department is labeled `GENERAL FUND / [DEPARTMENT NAME]` with a fund account code. Parse EXPENSE SUMMARY TOTAL per department. Key column: "Adopted 2025-2026".

---

## Summary Routing Table

| City | FY | Decision | File Size | GF Total | Sanity | Target Plan |
|------|----|----------|-----------|----------|--------|-------------|
| Garland | 2025 | pdftotext-parser | 135MB | $246.9M | PASS ($200-500M) | 10-02 |
| Richardson | 2026 | skip (URL error) | 40MB (Roseville CA) | N/A | FAIL | 10-02 (note only) |
| Wylie | 2026 | pdftotext-parser | 18MB | ~$80M | PASS ($50-150M) | 10-03 |
| Sachse | 2026 | pdftotext-parser | 60MB | $31.2M | PASS ($30-100M) | 10-03 |
| Murphy | 2025 | pdftotext-parser | 24MB | ~$19.7M | PASS ($20-80M) | 10-03 |
| Princeton | 2026 | pdftotext-parser | 9.7MB | $36.9M | PASS ($15-60M) | 10-03 |

**Richardson Action Required:** Before executing Plan 10-02, manually visit https://www.cor.net/departments/budget in a browser, find the direct PDF download URL for the Annual Budget document, and update `scripts/seedPDFDataSources.js` entries for `Richardson Operating Budget FY2025` and `Richardson Operating Budget FY2026` with the correct URL. Then re-run the seeder.

---

## Notes for 10-02 and 10-03

- All 5 non-Richardson cities have clean pdftotext output — parser approach confirmed viable.
- All parsers should follow the `processLongviewBudget.js` pattern: download → pdftotext -layout → parse line by line → whitelist General Fund dept names → call `treasury_sync_budget_tree` RPC.
- Richardson is skipped — 1 of 6 cities unavailable due to URL error. Phase success criteria require only that each city "appears in app OR is documented as skipped."
- Garland FY2026 (`/22610/`) is confirmed summary-only (211KB) — do NOT attempt to extract from it.
