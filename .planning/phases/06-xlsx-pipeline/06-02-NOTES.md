# Phase 6 Plan 02 — Investigation Notes

**Date:** 2026-05-01
**Investigator:** Claude (automated task 1 of 06-02-PLAN.md)

---

## Plano Check Register

- **Result:** DEFERRED
- **URL attempted:** https://checkregister.plano.gov/
- **Reason:** Dynamic web export only — the Plano portal is an ASP.NET WebForms application
  (`form action="./" method="post"`). Excel export is triggered by a server-side form POST
  with session state (ViewState + date range parameters). All static URL patterns tried
  returned HTTP 404:
  - `https://checkregister.plano.gov/export.xlsx` → 404
  - `https://checkregister.plano.gov/download` → 404
  - `https://checkregister.plano.gov/api/export` → 404
  - `https://checkregister.plano.gov/ExcelExport` → 404
  - `https://checkregister.plano.gov/checks/export` → 404
  The page HTML confirms: "export the data to a Microsoft Excel spreadsheet" requires clicking
  "Start" button after optionally selecting date ranges — no static file URL exists.
- **Column headers:** Not inspectable without a live session-based download.
- **Impact:** Plano cannot be seeded in this pass. Will be addressed in a follow-up plan
  (options: manual export workflow or session-scraping approach).

---

## McKinney Check Register

- **Sample file:** https://www.mckinneytexas.org/Archive.aspx?ADID=2752 (FY25)
- **Download result:** HTTP 200, content-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 3.2 MB
- **Sheet name:** `McKinney 2025 Fiscal Year`
- **Row count:** 50,098 rows (data rows + header)
- **Column headers (raw):**
  ```
  ["Payment Number","Payment Date","Invoice Date","Fiscal Year","Vendor Number",
   "Transaction Amount","Retainage Amount","Net Amount","Description 1",
   "Description 2","Project Number","Project Description","Account Number","Department"]
  ```
- **Sample row 2 (all columns):**
  ```json
  {
    "Payment Number": 88213,
    "Payment Date": "2025-09-26T00:00:00.000Z",
    "Invoice Date": "2025-08-06T00:00:00.000Z",
    "Fiscal Year": 2025,
    "Vendor Number": 8042,
    "Transaction Amount": 64.32,
    "Retainage Amount": " -   ",
    "Net Amount": 64.32,
    "Description 1": "INCENTIVE BRANDS",
    "Description 2": "LOGO APPAREL-TYGRAHAM",
    "Account Number": "001-2101-413.81-04",
    "Department": 2101
  }
  ```
- **Key observation:** `Description 1` holds the vendor/payee name (e.g., "INCENTIVE BRANDS").
  `Vendor Number` is an opaque integer ID — not useful for display. `Transaction Amount` is
  the line-item amount; `Net Amount` is the check total after retainage.
- **Proposed column_mapping:**
  - `date_column`: `Payment Date`
  - `amount_column`: `Net Amount`
  - `vendor_column`: `Description 1`
  - `description_column`: `Description 2`
  - `department_column`: `Department`
  - `fund_column`: null (account number embedded in Account Number string, no standalone fund field)
  - `check_number_column`: `Payment Number`

---

## McKinney Payroll Register

- **Sample file:** https://www.mckinneytexas.org/Archive.aspx?ADID=2753 (FY25)
- **Download result:** HTTP 200, content-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 2.3 MB
- **Sheet name:** `McKinney 2025 Fiscal Year`
- **Row count:** 44,452 rows
- **Column headers (raw):**
  ```
  ["Check Date","Check Number","Current Gross Amount","Employee Number",
   "Actual Position Title","Hourly/Salaried","Full/Part Time","Grade","Step","Year"]
  ```
- **Sample row 2 (all columns):**
  ```json
  {
    "Check Date": "2025-09-26T00:00:00.000Z",
    "Check Number": "Direct Deposit",
    "Current Gross Amount": 2509.10,
    "Employee Number": 17376,
    "Actual Position Title": "URBAN FORESTER",
    "Hourly/Salaried": "S",
    "Full/Part Time": "F",
    "Grade": 14,
    "Step": 5,
    "Year": 2025
  }
  ```
- **Key observation:** McKinney redacts employee names — only `Employee Number` (opaque integer)
  is provided. This is a common privacy practice for payroll registers. The `vendor_column`
  mapping uses `Employee Number` as the identifier field.
- **Proposed column_mapping:**
  - `date_column`: `Check Date`
  - `amount_column`: `Current Gross Amount`
  - `vendor_column`: `Employee Number`
  - `description_column`: `Actual Position Title`
  - `department_column`: null (no department field in payroll register)
  - `check_number_column`: `Check Number`

---

## Frisco Check Register

- **Sample file:** https://www.friscotexas.gov/DocumentCenter/View/35341/Copy-of-City_of_Frisco_Check_Register_FY25_To_Date-XLSX (FY25)
- **Download result:** HTTP 200, content-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 544 KB
- **Sheet name:** `Sheet1`
- **Row count:** 16,755 rows
- **Structure note:** Header row is at **row 5** (not row 1). Rows 1-4 are title/blank rows.
  Row 1 is blank, row 2 repeats "CITY OF FRISCO - PUBLIC CHECK REGISTER" across 5 columns,
  rows 3-4 are blank. The loader must use `header_row: 5` or skip the first 4 rows.
- **Column headers (raw, at row 5):**
  ```
  [null, "CHECK DATE", "VENDOR NAME", "DESCRIPTION", "AMOUNT"]
  ```
  Column A (index 0) is a blank filler column; data starts at column B (index 1).
- **Sample data row (row 6):**
  ```json
  {
    "CHECK DATE": "2024-10-01T00:00:00.000Z",
    "VENDOR NAME": "CHRISTOPHER BISSONNETTE",
    "DESCRIPTION": "TRAVEL/MEALS/LODGING          ",
    "AMOUNT": 933.06
  }
  ```
- **Proposed column_mapping:**
  - `date_column`: `CHECK DATE`
  - `amount_column`: `AMOUNT`
  - `vendor_column`: `VENDOR NAME`
  - `description_column`: `DESCRIPTION`
  - `department_column`: null (no department field)
  - `fund_column`: null (no fund field)
  - `header_row`: 5 (loader must skip rows 1-4)

---

## Municipality UUIDs

These UUIDs were confirmed from Quick Task 001 (seedCollinCountyMunicipalities.js run on 2026-05-01):

- **Plano:** `e02a955e-74af-4643-8f69-aa203d4f315b`
- **McKinney:** `a7e3459c-cb55-4f74-9ba9-f40e23323767`
- **Frisco:** `264035bb-5d59-4954-ae44-324d0c2e8a42`

Source: `.planning/quick/001-create-treasury-tracker-entries-for-ever/001-SUMMARY.md`

---

## Summary of Findings for Task 2 Decision

| City | Source | Result | FY Coverage | Notes |
|------|--------|--------|-------------|-------|
| Plano | checkregister.plano.gov | DEFERRED | N/A | Dynamic ASP.NET portal, no static URL |
| McKinney | mckinneytexas.org/Archive.aspx | Ready | FY22-FY25 (4 years) | 50K rows/year, vendor in Description 1 |
| McKinney Payroll | mckinneytexas.org/Archive.aspx | Ready | FY22-FY25 (4 years) | 44K rows/year, employees anonymized |
| Frisco | friscotexas.gov/DocumentCenter | Ready | FY18-FY26 (9 years) | Headers at row 5, 5-column format |

**Recommendation for Task 2:** Select `defer-plano` — proceed with McKinney (8 rows) + Frisco (9 rows) = 17 xlsx_download rows total.
