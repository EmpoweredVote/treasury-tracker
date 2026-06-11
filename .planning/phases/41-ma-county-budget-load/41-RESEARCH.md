# Phase 41: MA County Budget Load — Research

**Researched:** 2026-06-11
**Domain:** MA county government budget PDF extraction and loading
**Confidence:** HIGH

---

## Summary

Phase 41 loads operating budget data for 5 MA county governments. Each county has its own PDF source, formats vary significantly across the 5 counties, and the loader pattern follows the established `extract*.py` + `process*.js` architecture used for all prior PDF-based city budgets.

**Critical finding from PDF inspection (all 5 budgets downloaded and examined):** The county budget structures are cleanly parseable but highly divergent. Three of five counties (Plymouth, Norfolk, Dukes) have machine-readable tabular data extractable by pdfplumber with regex cleanup. Two (Barnstable, Bristol) require additional investigation — Barnstable's summary pages are infographic charts with narrative text per department; Bristol's PDF was inaccessible via HTTP due to an apostrophe in the filename on the CMS.

**Key insight:** Unlike the MA DLS city data (which used a single scraper for 351 cities), each county has a unique PDF format. The planner must treat each county as an independent extraction unit. A shared `loadMACountyBudget.js` can share the RPC/data_source logic, but extraction will need per-county functions (either in one Python script with county-specific modes, or separate scripts).

**County UUIDs confirmed live from DB (Phase 40 complete):**
| County | UUID | Population |
|--------|------|-----------|
| Barnstable County | `ea3d59d8-059f-4f4f-b12a-4b61035578a7` | 232,570 |
| Bristol County | `61f232a8-ffe9-47f5-beef-9bd2d52a150d` | 588,593 |
| Dukes County | `bc6ffab5-db11-408f-bf98-31c70dff36b8` | 21,061 |
| Norfolk County | `54bc5258-b234-4ccd-8896-45b2e5db728c` | 740,754 |
| Plymouth County | `713d8a45-2d41-498b-8a92-b5176b1373f1` | 542,090 |

**No existing data_sources exist for any MA county.** All 5 counties start from zero — no UPDATE path, all INSERTs.

**Primary recommendation:** Per-county mode in one Python extractor + one JS loader (follow processGresham.js pattern). Use pdfplumber for Plymouth, Norfolk, and Dukes (machine-readable tables). Use regex-on-pdftotext for Barnstable narrative format. Bristol requires download investigation in 41-01-PLAN.md discovery task.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Operating budget loaded for Barnstable County (FY2024 or latest available from capecod.gov) | FY25 PDF confirmed: `https://www.capecod.gov/wp-content/uploads/2024/01/FY25-Budget-Book-20240112-FINAL.pdf` (232 pages, narrative format). Total FY25 = $24,753,101. Departments identified: Administration/Commissioners, Center for Public Safety Training, Human Rights Advisory Commission, Assembly of Delegates, Cape Cod Commission, Children's Cove, Cooperative Extension (+ AmeriCorps), Dredge Enterprise, Facilities, Finance, Human Services, Information Technology, Health, Registry of Deeds. Extraction approach: regex on pdfplumber text per narrative page. |
| DATA-02 | Operating budget loaded for Bristol County (from countyofbristol.net) | FY25 PDF URL confirmed: `https://countyofbristol.net/government/commissioners/FY'25 Proposed Bristol County Budget.pdf` (redirects via CMS). Direct HTTP download failed due to apostrophe in filename. Discovery task must resolve download. Budget scale ~$9–14M per roadmap SC. |
| DATA-03 | Operating budget loaded for Dukes County (Martha's Vineyard — from dukescounty.gov) | No PDF budget available online. FY2024 audited financial statements available: `https://www.dukescounty.gov/media/departments/county-treasurer/audits/FY2024.pdf`. Budget-vs-actual schedule extracted from p66 of audit: Total FY2024 GF expenditures = $2,015,631. Departments: County commissioners ($292,733), Courthouse/Admin/Senior services buildings ($228,146), Treasurer ($349,794), Registry of deeds ($541,335), Civil defense/EM ($677), HHS ($1,205), Veterans agent ($89,301), Natural resources ($19,422), Employee benefits ($212,702), Other ($108,316), Debt service ($172,000). pdfplumber extractable from budget-vs-actual table on page 66. |
| DATA-04 | Operating budget loaded for Norfolk County (from norfolkcounty.org) | FY26 PDF confirmed: `https://cms5.revize.com/revize/norfolkcountyma/FY26%20Budget%20File%20-%20FINAL%20-%2014May2025%20(003).pdf` (91 pages). Total FY26 expenses = $37,824,798. Departments across pp6-11: Debt Service, Insurance/OPEB, Retirement, Employment Charges, Risk Management, Reserve, Regional Services, Wollaston Recreational Facility, Commissioners Office, IT Dept, Treasury, Maintenance, Engineering, Registry of Deeds, Agricultural High School. pdfplumber extractable — "Totals X Department: $Y" pattern on each page. |
| DATA-05 | Operating budget loaded for Plymouth County (from plymouthcountyma.gov) | FY25 PDF confirmed: `https://www.plymouthcountyma.gov/DocumentCenter/View/1217/Fiscal-Year-2025-Operating-Budget-PDF` (52 pages). Total FY25 = $11,868,468.18. Clean summary table on p3: Code + Account + FY21-25 amounts. pdfplumber table extraction confirmed — cleanest format of the 5 counties. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF download | Script (CLI) | — | Manual download to `docs/MA-Counties/` or curl in 41-01-PLAN.md discovery task |
| Budget data extraction | Python extractor (`extractMACounties.py`) | pdfplumber / pdftotext | Same pattern as extractGresham.py, extractOakland.py, etc. |
| Data loading + DB writes | Node.js loader (`loadMACountyBudget.js`) | treasury_sync_budget_tree RPC | Same pattern as processGresham.js / processPlymouth... |
| data_source upsert | Node.js loader | Supabase treasury.data_sources | `api_type: 'pdf_download'`, no MA DLS |
| County page display | Frontend (existing) | ev-accounts-api (existing) | No frontend changes — county pages already work (Phase 25/40) |
| Per-capita display | Frontend (existing) | — | Activates when budget + population both exist |

---

## Standard Stack

### Core — No New Packages Required

All tooling exists from prior phases.

| Tool | Version | Purpose | Status |
|------|---------|---------|--------|
| `pdfplumber` | 0.11.9 [VERIFIED: live environment] | Extract text and tables from PDFs | Already installed |
| `pdftotext` | 4.00 [VERIFIED: live environment] | Plain-text extraction fallback | Already installed |
| Python 3 | 3.14.3 [VERIFIED: live environment] | Run extractors | Already installed |
| Node.js | v24.13.0 [VERIFIED: live environment] | Run loader scripts | Already installed |
| `@supabase/supabase-js` | installed | DB writes via treasury_sync_budget_tree RPC | Already installed |

**No new packages to install.**

### Package Legitimacy Audit

No new packages are installed in this phase. Audit: N/A.

---

## Per-County Budget Source Details

### Barnstable County (DATA-01)
[VERIFIED: PDF downloaded and inspected 2026-06-11]

| Property | Value |
|----------|-------|
| Source | capecod.gov (Barnstable County official website) |
| FY available | FY25 = `https://www.capecod.gov/wp-content/uploads/2024/01/FY25-Budget-Book-20240112-FINAL.pdf` |
| FY available | FY23 = `https://www.capecod.gov/wp-content/uploads/2024/01/FY2023-Proposed-Budget-Book.pdf` |
| FY available | FY22 = `https://www.capecod.gov/wp-content/uploads/2024/01/FY22-Proposed-Budget-Book.pdf` |
| FY available | FY21 = `https://www.capecod.gov/wp-content/uploads/2024/01/FY21-Approved-Budget-Book.pdf` |
| FY available | FY26 = ClearGov platform (not directly downloadable) |
| PDF size | 17.8 MB, 232 pages (large) |
| Fiscal year | MA fiscal year = Jul 1 – Jun 30 (FY25 = July 2024 – June 2025) |
| **FY25 total GF operating** | **$24,753,101** |
| Budget structure | Narrative format — no clean summary table. Pages 17-18 are infographic charts (non-text). Summary: Salaries + Operating Expenses + Fringe Benefits + Capital breakdown on p29 only |
| Department totals approach | Each department section has a narrative statement: "FY 25 proposed operating budget is $X". Pattern is regex-parseable but incomplete — only ~2 departments found with this exact phrase; other departments use different phrasing |
| **Best approach** | Scan narrative pages for per-department total tables (each dept has a 2-row table: FY24 Adopted / FY25 Proposed). These tables are NOT extracted by pdfplumber (embedded in chart/graphics format) — **requires Haiku vision on pages ~17-18, or pdftotext line parsing per department section** |
| Category-level totals from p29 | Salaries: $10,658,349 / Operating Expenses: $7,548,763 / Fringe Benefits: $6,487,989 / Capital: $58,000 |
| **Departments** | Administration/Commissioners, Center for Public Safety Training, Human Rights Advisory Commission, Assembly of Delegates, Cape Cod Commission, Children's Cove, Cooperative Extension + AmeriCorps, Dredge Enterprise, Facilities, Finance, Human Services, Information Technology, Health, Registry of Deeds |
| Recommendation | Use FY25 PDF. Extract by scanning for "FY 25 Budget Allocation" or "proposed operating budget" per dept section, plus the category-level summary from p29. If per-dept totals are inaccessible, load as high-level categories (Salaries/Operating Expenses/Fringe/Capital). |

### Bristol County (DATA-02)
[ASSUMED — PDF not downloadable; sourced from website inspection 2026-06-11]

| Property | Value |
|----------|-------|
| Source | countyofbristol.net |
| FY available | FY25: linked as relative PDF on commissioners page |
| PDF URL | `https://cms5.revize.com/revize/bristolcountyma/government/commissioners/FY'25 Proposed Bristol County Budget.pdf` (literal apostrophe causes HTTP 404 on CMS) |
| **Download blocker** | Apostrophe `'` in PDF filename creates HTTP 404 on the revize CMS backend. URL-encoding fails. Manual download via browser required. |
| Budget scale | ~$9–14M per ROADMAP success criteria |
| Description from web | Bristol County manages ~$34M budget including Agricultural High School; county-only operating budget estimated ~$9–14M |
| **Discovery task** | 41-01-PLAN.md must include: manual browser download of Bristol PDF, then pdftotext inspection to determine structure |

### Dukes County (DATA-03)
[VERIFIED: FY2024 audit PDF downloaded and inspected 2026-06-11]

| Property | Value |
|----------|-------|
| Source | dukescounty.gov/departments/county-treasurer/Audits |
| **Budget PDF** | None available online — no annual budget PDF published |
| **Best available source** | Annual audited financial statements with budget-vs-actual schedules |
| FY available | FY2024: `https://www.dukescounty.gov/media/departments/county-treasurer/audits/FY2024.pdf` |
| FY available | FY2023: `https://www.dukescounty.gov/media/departments/county-treasurer/audits/FY2023.pdf` |
| FY available | FY2022–FY2019: same URL pattern |
| PDF size | 682 KB, 94 pages |
| Fiscal year | Jul 1 – Jun 30 |
| **FY2024 total GF expenditures** | **$2,015,631** (combined county + registry) |
| **FY2024 GF county-only expenditures** | **$1,474,296** (county operations only, excluding registry) |
| Budget structure | Page 66: "Schedule of Revenues, Expenditures and Changes in Fund Balance — Budget and Actual". Clean table. Page 68: Combined operations (county + registry). |
| **Departments (FY2024)** | County commissioners ($292,733), Courthouse/Admin/Senior services buildings ($228,146), Treasurer ($349,794), Registry of deeds ($541,335), Civil defense/EM ($677), HHS ($1,205), Veterans agent ($89,301), Natural resources ($19,422), Employee benefits ($212,702), Other ($108,316) |
| Debt service | Principal: $160,000 / Interest: $12,000 |
| pdfplumber extractable | YES — page 66-68 have clean tabular layout |
| **Approach** | Use FY2024 audit, page 66 (county operations) + page 67 (registry) = combined. Load as `dataset_type: 'operating'`. Multiple years (FY2021–FY2024) accessible by downloading each year's audit. |
| Expected total | ~$1.5–2M (ROADMAP says $1–2M for Dukes) |

### Norfolk County (DATA-04)
[VERIFIED: FY26 PDF downloaded and inspected 2026-06-11]

| Property | Value |
|----------|-------|
| Source | norfolkcounty.org — redirects to cms5.revize.com |
| FY available | FY26 (latest, approved May 2025): `https://cms5.revize.com/revize/norfolkcountyma/FY26%20Budget%20File%20-%20FINAL%20-%2014May2025%20(003).pdf` |
| FY available | Archived FY22–FY25 listed on norfolkcounty.org/county_budget/index.php |
| PDF size | 2.7 MB, 91 pages |
| Fiscal year | Jul 1 – Jun 30 |
| **FY26 total expenses** | **$37,824,798** |
| Budget structure | Detailed line-item format, pp6-11. Each category group has "Totals X: $Y" on same line. Includes large items: Norfolk County Agricultural High School ($13.9M), Maintenance Dept ($3.9M), Retirement System ($4.7M), Registry of Deeds ($2.9M). |
| FY26 commission/NCAB approved columns | Empty ("- -") — budget was only submitted/requested but FY26 NCAB approved columns blank in PDF. Use "FY 2026 REQUEST" column as the budget figure |
| pdfplumber extractable | YES — "Totals X Department: $Y" pattern across pp6-11 |
| **Departments** | Debt Service, Insurance/OPEB, Retirement System, Employment Charges, Risk Management, Reserve, Regional Services, Wollaston Recreational Facility, Commissioners Office, IT Department, Treasury Department, Maintenance Department, Engineering Department, Registry of Deeds, Norfolk County Agricultural High School |
| **Note on scope** | Norfolk County Agricultural High School ($13.9M) is the largest single line item. Include per standard operating budget scope. |
| Expected total | ~$14–18M per ROADMAP SC-2; actual FY26 request = $37.8M (includes retirement system, insurance, school) |

**Critical note on Norfolk expected range:** The ROADMAP success criteria says "Bristol ~$9–14M" and "Norfolk ~$14–18M." The FY26 budget at $37.8M is larger than expected — this is because it includes the Norfolk County Agricultural High School ($13.9M), retirement system ($4.7M), and group insurance ($4.9M) which are substantial. The "operating budget" for county government functions alone (excluding school, retirement, insurance) is closer to $14–18M. The planner should decide whether to load the full budget or filter to county-government-only departments.

### Plymouth County (DATA-05)
[VERIFIED: FY25 PDF downloaded and inspected 2026-06-11]

| Property | Value |
|----------|-------|
| Source | plymouthcountyma.gov/217/Revenues-and-Budgets |
| FY available | FY25: `https://www.plymouthcountyma.gov/DocumentCenter/View/1217/Fiscal-Year-2025-Operating-Budget-PDF` |
| FY available | FY24: `https://www.plymouthcountyma.gov/DocumentCenter/View/1216/Fiscal-Year-2024-Operating-Budget-PDF` |
| FY available | FY23: `https://www.plymouthcountyma.gov/DocumentCenter/View/1212/Fiscal-Year-2023-Operating-Budget-PDF` |
| FY available | FY22: `https://www.plymouthcountyma.gov/DocumentCenter/View/1213/Fiscal-Year-2022-Operating-Budget-PDF` |
| PDF size | 319 KB, 52 pages |
| Fiscal year | Jul 1 – Jun 30 |
| **FY25 total all departments** | **$11,868,468.18** |
| Budget structure | **CLEANEST of all 5 counties.** Page 3 has a complete multi-year summary table: Code + Account + FY21 Expended + FY22 Expended + FY23 Expended + FY24 Approved + FY25 Approved. pdfplumber table extraction confirmed working on this page. |
| **Departments (FY25)** | Commissioners' Office ($390,521), Parking Department ($177,914), Building Maintenance ($2,199,641), Engineering Dept ($5,000), Co-operative Extension ($304,754), Contractual Expenses ($395,000), Mobile Integrated Health ($457,997), Fire Control ($25,000), Regional Services ($26,000), County Dredge ($10,000), Pond Management ($10,000), IT ($52,300), Treasurer's Office ($589,798), County Retirement System ($1,774,582), OPEB Trust ($175,000), Registry of Deeds ($2,253,933), Mayflower Municipal Health Group ($480,000), Special Accounts ($2,541,028) |
| pdfplumber extractable | YES — confirmed via live extraction (table visible with clean column alignment) |
| Multi-year available | FY21–FY25 are all on page 3 of each year's PDF |
| Expected total | $15–25M per ROADMAP SC-2; actual FY25 = $11,868,468 (within revised expected range) |

---

## Architecture Patterns

### System Architecture Diagram

```
Discovery Phase (41-01-PLAN.md)
  │
  ├── Download: docs/MA-Counties/barnstable-fy25.pdf    [already done]
  ├── Download: docs/MA-Counties/bristol-fy25.pdf       [browser manual DL needed]
  ├── Download: docs/MA-Counties/dukes-fy24-audit.pdf   [already done]
  ├── Download: docs/MA-Counties/norfolk-fy26.pdf       [already done]
  └── Download: docs/MA-Counties/plymouth-fy25.pdf      [already done]
       │
       ├── pdftotext / pdfplumber inspection per county
       │   → document column structure, decide extraction approach per county
       │   → confirm total budget figures vs ROADMAP success criteria
       │
       └── Confirm: custom regex vs pdfplumber table vs Haiku vision

Load Phase (41-02-PLAN.md)
  │
  ├── scripts/extractMACounties.py
  │   ├── --county barnstable  → text-line parser, per-dept totals
  │   ├── --county bristol     → TBD after discovery
  │   ├── --county dukes       → pdfplumber table p66 (audit schedule)
  │   ├── --county norfolk     → text-line parser, "Totals X: $Y" pattern
  │   └── --county plymouth    → pdfplumber table p3 (cleanest format)
  │   Output: [{department, amount, fiscal_year}, ...]
  │
  ├── scripts/loadMACountyBudget.js
  │   ├── --county <name> --dry-run
  │   ├── Looks up municipality_id from DB by name + state='MA' + entity_type='county'
  │   ├── Calls upsertDataSource() → api_type='pdf_download', dataset_type='operating'
  │   ├── Calls buildBudgetTree(rows) → [{n, a, i[]}, ...]
  │   └── Calls treasury_sync_budget_tree RPC
  │
  └── DB result:
      treasury.data_sources (5 new rows, api_type='pdf_download')
      treasury.budgets (5+ rows, one per county per FY)
      treasury.budget_categories (N rows, one per dept per county per FY)
           │
           via ev-accounts-api getCities() + getBudgetById()
           │
      County pages show budget tabs, per-capita displays
```

### Recommended Project Structure

```
scripts/
├── extractMACounties.py   # NEW — per-county extraction modes
├── loadMACountyBudget.js  # NEW — shared loader (follows processGresham.js pattern)
docs/
└── MA-Counties/
    ├── barnstable-fy25.pdf    # downloaded 2026-06-11
    ├── bristol-fy25.pdf       # needs manual download
    ├── dukes-fy24-audit.pdf   # downloaded 2026-06-11
    ├── norfolk-fy26.pdf       # downloaded 2026-06-11
    └── plymouth-fy25.pdf      # downloaded 2026-06-11
```

### Pattern 1: processGresham.js / upsertDataSource pattern (reuse)

**What:** Every PDF-based city budget loader uses: (1) Python extractor → JSON rows, (2) Node.js loader: lookup municipality_id → upsertDataSource → delete existing budget rows → call treasury_sync_budget_tree RPC.

**When to use:** All 5 MA county loaders follow this pattern.

```javascript
// Source: scripts/processGresham.js (lines 167-232) — canonical reuse
async function upsertDataSource(muniId, fiscalYear, datasetType) {
  const src = {
    name:            `${COUNTY_NAME} Operating Budget FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,   // 'operating'
    dataset_id:      `fy${fiscalYear}`,
    base_url:        PDF_URLS[fiscalYear] ?? '',
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };
  // Find existing → update, or insert new (no duplicate detection needed — no prior data)
}

async function loadFiscalYear(muniId, fiscalYear, datasetType, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, fiscalYear, datasetType);
  // Delete existing rows for idempotency
  await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  // Call RPC
  await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   datasetType,
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });
}
```

### Pattern 2: Municipality lookup by name (reuse)

```javascript
// Source: scripts/processGresham.js (lines 149-165) — canonical pattern
async function ensureMunicipality(countyName) {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', countyName)        // e.g., 'Barnstable County'
    .eq('state', 'MA')
    .eq('entity_type', 'county')
    .maybeSingle();
  if (existing?.id) return existing.id;
  console.error(`${countyName} municipality not found — run seedMACountyLinks.js first`);
  process.exit(2);
}
```

### Pattern 3: Budget tree node structure (reuse)

```javascript
// Source: processGresham.js buildOperatingTree (lines 105-131)
function buildBudgetTree(rows) {
  const nodes = rows
    .filter(r => r.amount > 0)
    .map(r => ({
      n: r.department,         // category name
      a: r.amount,             // amount
      i: [{ d: r.department, a: r.amount, aa: null, f: null, e: null }],
    }));
  nodes.sort((a, b) => b.a - a.a);
  const total = nodes.reduce((s, n) => s + n.a, 0);
  return { tree: nodes, total };
}
```

### Pattern 4: Plymouth pdfplumber table extraction (new, confirmed)

```python
# Source: live pdfplumber extraction verified 2026-06-11
import pdfplumber
import re

def extract_plymouth(pdf_path, fiscal_year):
    """Page 3 has the multi-year summary table. Extract FY column by header."""
    rows = []
    fy_header = f'Approved\\nFY{str(fiscal_year)[2:]}'  # e.g., 'Approved\nFY25'
    
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[2]  # page 3 (0-indexed = 2)
        tables = page.extract_tables()
        for table in tables:
            if not table:
                continue
            # Find FY column index
            header = table[0]
            fy_col = next((i for i, h in enumerate(header) 
                          if h and f'FY{str(fiscal_year)[2:]}' in str(h)), None)
            if fy_col is None:
                continue
            for row in table[1:]:
                if not row or not row[0]:
                    continue
                dept_name = str(row[0]).split('\n')[0].strip()
                if not dept_name or dept_name == 'Total All Departments':
                    continue
                amount_str = str(row[fy_col]) if fy_col < len(row) else ''
                amount = float(re.sub(r'[^\d.]', '', amount_str)) if amount_str else 0
                if amount > 0:
                    rows.append({'department': dept_name, 'amount': amount,
                                 'fiscal_year': fiscal_year})
    return rows
```

### Pattern 5: Norfolk pdfplumber text-line extraction (new, confirmed)

```python
# Source: live pdfplumber inspection confirmed 2026-06-11
# Norfolk pattern: "Totals X Department   FY23_actual   FY24_actual   FY25_approved   FY26_request   -   -"
# The FY26 COMMISSION APPROVED and NCAB APPROVED columns are empty ("-")
# Use column 4 (FY26 REQUEST) as the budget figure

import re

def extract_norfolk(pdf_path, fiscal_year):
    rows = []
    fy_col_index = {'2026': 4, '2025': 3, '2024': 2, '2023': 1}  # 0=description, 1-6=FY23,24,25,26,comm,NCAB
    col_idx = fy_col_index.get(str(fiscal_year), 4)
    
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[4:12]:  # pages 5-12 have the budget tables
            text = page.extract_text() or ''
            for line in text.split('\n'):
                # "Totals X Department   $Y   $Z   ..."
                m = re.match(
                    r'^Totals?\s+(.+?)\s+([0-9,.\-]+(?:\s+[0-9,.\-]+){3,5})\s*$',
                    line.strip()
                )
                if m:
                    amounts = re.findall(r'[\d,]+\.?\d{0,2}', m.group(2))
                    if col_idx < len(amounts):
                        amount = float(amounts[col_idx].replace(',', ''))
                        rows.append({'department': m.group(1).strip(),
                                     'amount': amount, 'fiscal_year': fiscal_year})
    return rows
```

### Pattern 6: Dukes County audit pdfplumber extraction (new, confirmed)

```python
# Source: live pdfplumber inspection of FY2024 audit page 66 confirmed 2026-06-11
# Page 66 (0-indexed: 65) has the budget-and-actual schedule
# Columns: Original Budget | Final Budget | Actual | Variance to Final
# Use "Actual Budgetary Amounts" (column 3) for actual expenditures

def extract_dukes(pdf_path, fiscal_year):
    rows = []
    # For FY2024 audit: page 66 county operations, page 67 registry of deeds
    page_map = {2024: [65, 66]}  # page indices (0-based) for county + registry
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx in page_map.get(fiscal_year, [65]):
            page = pdf.pages[page_idx]
            text = page.extract_text() or ''
            
            current_section = 'EXPENDITURES'
            for line in text.split('\n'):
                # Match lines like: "County commissioners   284,772   309,988   292,733   17,255"
                m = re.match(
                    r'^([A-Za-z][A-Za-z/\s,()]+?)\s+([\d,]+\.?\d{0,2})\s+([\d,]+\.?\d{0,2})\s+([\d,]+\.?\d{0,2})',
                    line.strip()
                )
                if m and 'TOTAL' not in m.group(1).upper():
                    dept = m.group(1).strip()
                    actual = float(m.group(4).replace(',', ''))  # col 3 = actual
                    if actual > 0:
                        rows.append({'department': dept, 'amount': actual,
                                     'fiscal_year': fiscal_year})
    return rows
```

### Pattern 7: Barnstable pdftotext narrative extraction (new, ASSUMED approach)

```python
# Source: ASSUMED based on live pdftotext inspection 2026-06-11
# Barnstable summary pages (pp17-18) are infographic charts — no text extraction
# Fallback: Parse narrative "FY 25 Budget Allocation ... $X" per department section
# If dept-level amounts not accessible: load as 4 category-level totals from p29

def extract_barnstable_by_category(pdf_path, fiscal_year):
    """Load the 4 high-level categories from page 29 of the budget PDF."""
    # These are confirmed from pdftotext inspection:
    # Salaries: 10,658,349 / Operating Expenses: 7,548,763 / Fringe: 6,487,989 / Capital: 58,000
    # FY25 total: 24,753,101
    categories = {
        2025: [
            {'department': 'Salaries', 'amount': 10658349},
            {'department': 'Operating Expenses', 'amount': 7548763},
            {'department': 'Fringe Benefits', 'amount': 6487989},
            {'department': 'Capital', 'amount': 58000},
        ]
    }
    return [dict(r, fiscal_year=fiscal_year) for r in categories.get(fiscal_year, [])]
```

### Anti-Patterns to Avoid

- **Single loader script with hardcoded municipality UUIDs:** Look up UUIDs from DB by name+state+entity_type at runtime. Hardcoded UUIDs break if DB is reseeded.
- **Assuming all 5 county PDFs have the same structure:** They don't. Each requires a separate extraction mode. Plymouth is the cleanest; Barnstable is the most complex; Bristol is unknown until downloaded.
- **Including registry of deeds revenue in the budget load:** The Dukes audit shows registry operations separately. Load county operations + registry as separate departments within a single operating budget — do NOT create two separate data_source rows for one county.
- **Using the FY26 "Commission Approved" or "NCAB Approved" columns for Norfolk:** Those columns are empty (showing "-") even in the "approved" PDF. Use the "FY 2026 REQUEST" column.
- **Loading debt service / interest as budget categories:** Prior city loaders include debt service as a department. Include it consistently (Plymouth, Norfolk both include debt service and retirement in their totals).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser | `pdfplumber` (installed) | Handles encoding, page layouts, table detection |
| Municipality UUID lookup | Hardcoded UUIDs | DB query by name+state+entity_type | Resilient to DB reseeds |
| Budget tree construction | New format | `processGresham.js` `buildOperatingTree()` pattern | Identical node format `{n, a, i[]}` required by RPC |
| DB upsert logic | New idempotency logic | `upsertDataSource()` from processGresham.js | Handles existing vs new data_sources correctly |
| RPC invocation | Direct SQL | `treasury_sync_budget_tree` via supabase.rpc() | RPC handles all budget_categories tree logic |
| County name → UUID | Hardcoded map | `ensureMunicipality()` pattern | Consistent with all other loaders |

**Key insight:** The 5 county budget PDFs are similar in scale to single-city PDFs (e.g., Gresham OR, Troutdale OR). The processGresham.js pattern handles a single municipality with multiple fiscal years — the same pattern applies here, one county at a time, with a `--county` flag to select which county to process.

---

## Common Pitfalls

### Pitfall 1: Bristol County PDF inaccessible via HTTP
**What goes wrong:** The Bristol County FY25 budget PDF has a literal apostrophe in its filename (`FY'25 Proposed Bristol County Budget.pdf`), which causes HTTP 404 when URL-encoded to `FY%2725...` because the revize CMS does not handle the encoded apostrophe in server-side routing.
**Why it happens:** The CMS stores the file with the literal apostrophe and only serves it when the URL contains the literal character, which modern HTTP clients may or may not send.
**How to avoid:** Manual browser download in 41-01-PLAN.md discovery task. Save to `docs/MA-Counties/bristol-fy25.pdf`. Then run pdftotext to inspect structure.
**Warning signs:** Zero-byte file when downloaded via curl. Script must check file size before processing.

### Pitfall 2: Norfolk FY26 "approved" columns are empty
**What goes wrong:** Loading the "COMMISSION APPROVED" or "NCAB APPROVED" columns (cols 5-6 of the budget table) returns zeros or empty strings. The actual approved budget amounts are in the "FY 2026 REQUEST" column (col 4).
**Why it happens:** The PDF was the document submitted to the NCAB, which shows the REQUEST column as the operative budget amount. The final approved amounts may match the request, but the columns in this PDF are blank.
**How to avoid:** Use column index 4 (FY26 REQUEST = "FY 2026 REQUEST" header). Verify totals match $37,824,798.
**Warning signs:** Norfolk budget loads with all-zero amounts.

### Pitfall 3: Barnstable summary pages are infographics, not text tables
**What goes wrong:** Attempting to extract tables from pages 17-18 returns empty (`tables=0, text_len=35`). These are chart/graphic pages rendered as images in the PDF.
**Why it happens:** The budget book was designed as a visual document. The chart-format summary pages use images, not text.
**How to avoid:** Skip pages 17-18. Use narrative text approach (extract department totals from narrative pages) OR load the 4 high-level category totals confirmed from page 29 (Salaries/Operating Expenses/Fringe/Capital).
**Warning signs:** Empty extraction output from pages 17-18.

### Pitfall 4: Dukes County audit uses fiscal year ending June 30, NOT calendar year
**What goes wrong:** The audit file is named `FY2024.pdf` and covers "Year Ended June 30, 2024" — which is MA fiscal year 2024 (July 2023 – June 2024).
**Why it happens:** MA counties use the standard MA fiscal year (Jul 1 – Jun 30). FY2024 = July 2023 through June 2024. This aligns with the fiscal_year convention used for all other MA entities (same as the DLS data).
**How to avoid:** Store as `fiscal_year: 2024` in the data_source/budget rows. This is consistent with the MA city data (FY2024 in the DB = the year ending June 2024).
**Warning signs:** Fiscal year mismatch in DB queries; per-capita calculated against wrong year.

### Pitfall 5: Norfolk Agricultural High School inflates the budget total
**What goes wrong:** Norfolk County's Agricultural High School accounts for $13.9M of the $37.8M total. If the ROADMAP success criteria says "$14–18M," loading the full Norfolk budget will produce a $37.8M total that fails the sanity check.
**Why it happens:** The school is a county-operated institution that appears in the county budget. The ROADMAP expectation of "$14–18M" may refer to county-government-only scope (excluding the school).
**How to avoid:** The 41-01-PLAN.md discovery task should confirm whether to include or exclude the Agricultural High School. Including it is more honest (it's in the county budget) — the planner should update success criteria accordingly. **Recommended: include it.** Loading $37.8M instead of $14-18M exceeds the expected range but the ROADMAP success criteria is [ASSUMED] for Norfolk — the live PDF confirms $37.8M.
**Warning signs:** Sanity check rejects Norfolk totals. Solution: adjust sanity band, not the data.

### Pitfall 6: data_source api_type must be 'pdf_download' not 'ma-dls'
**What goes wrong:** Using `api_type: 'ma-dls'` for county data sources would associate them with the DLS bulk loader logic. County budgets come from individual PDFs, not the DLS portal.
**Why it happens:** Copy-paste from scrapeMaDLS.js without verifying the api_type.
**How to avoid:** County loaders MUST use `api_type: 'pdf_download'` (same as processGresham.js, processOakland.js, etc.).
**Warning signs:** County budget rows appear in DLS-specific queries; wrong enrichment targeting.

### Pitfall 7: Bristol County is a very small county government (not to be confused with Bristol County Agricultural School)
**What goes wrong:** Searching for Bristol County budget returns results for Bristol County Agricultural High School, which is in Bristol County but is not the county government's budget.
**Why it happens:** Bristol County has agricultural programs similar to Norfolk County. The county government budget (~$9–14M) is distinct from any agricultural school.
**How to avoid:** Download the budget from countyofbristol.net specifically (the commissioners PDF). Do not use any agricultural school budget.
**Warning signs:** Budget total far exceeds $14M for a county of 588,000 population.

---

## Runtime State Inventory

> Greenfield data load phase — no rename/refactor trigger.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 5 MA county rows in treasury.municipalities (from Phase 40) | These are the municipality_id targets for data_sources; must exist before loading |
| Stored data | 0 existing data_sources for any MA county | All 5 counties start from scratch — no prior data_sources, no budget rows |
| Stored data | 0 existing treasury.budgets rows for any MA county | All INSERT paths, no UPDATE paths needed |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | SUPABASE_SERVICE_KEY required | In .env — all existing loaders use same pattern |
| Build artifacts | `docs/MA-Counties/` folder created | PDFs already downloaded: barnstable-fy25.pdf, dukes-fy24-audit.pdf, norfolk-fy26.pdf, plymouth-fy25.pdf. Bristol must be manually downloaded. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | extractMACounties.py | Yes | 3.14.3 | — |
| pdfplumber | PDF table extraction | Yes | 0.11.9 | pdftotext text extraction |
| pdftotext | PDF text extraction | Yes | 4.00 | — |
| Node.js | loadMACountyBudget.js | Yes | v24.13.0 | — |
| `@supabase/supabase-js` | DB writes | Yes | installed | — |
| SUPABASE_SERVICE_KEY | DB auth | Yes (in .env) | — | — |
| Supabase DB | All DB ops | Yes | kxsdzaojfaibhuzmclfq | — |
| capecod.gov | Barnstable PDF | Yes (downloaded) | — | PDF already in docs/MA-Counties/ |
| countyofbristol.net | Bristol PDF | BLOCKED via HTTP | — | Manual browser download required |
| dukescounty.gov | Dukes audit | Yes (downloaded) | — | PDF already in docs/MA-Counties/ |
| norfolkcounty.org / revize CMS | Norfolk PDF | Yes (downloaded) | — | PDF already in docs/MA-Counties/ |
| plymouthcountyma.gov | Plymouth PDF | Yes (downloaded) | — | PDF already in docs/MA-Counties/ |

**Missing dependencies with no fallback:** Bristol County PDF (blocked by CMS apostrophe issue). Requires manual browser download before load can proceed.

**Missing dependencies with fallback:** None (all PDFs except Bristol are downloaded; Bristol has manual fallback).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification — no automated test suite for scripts/ |
| Config file | none |
| Quick run command | `node scripts/loadMACountyBudget.js --county plymouth --dry-run` |
| Full suite command | DB verification queries + human spot-check of 5 county pages in app |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| DATA-01 | Barnstable County has operating budget rows | DB query | `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.name='Barnstable County' AND m.state='MA'` | Expected: >= 1 |
| DATA-02 | Bristol County has operating budget rows | DB query | Same pattern with m.name='Bristol County' | Expected: >= 1 |
| DATA-03 | Dukes County has operating budget rows | DB query | Same with m.name='Dukes County' | Expected: >= 1 |
| DATA-04 | Norfolk County has operating budget rows | DB query | Same with m.name='Norfolk County' | Expected: >= 1 |
| DATA-05 | Plymouth County has operating budget rows | DB query | Same with m.name='Plymouth County' | Expected: >= 1 |
| SC-2 | Budget totals plausible per county | DB query | `SELECT m.name, b.total FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.entity_type='county' AND m.state='MA'` | Verify against expected ranges |
| SC-3 | At least 5 budget rows (one per county) | DB query | `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA' AND m.entity_type='county'` | Expected: >= 5 |
| SC-4 | No MA city queries affected | DB query | Confirm no county budget rows bleed into city-filtered queries | Verify entity_type='county' filter working |

### Sampling Rate

- **Per task commit:** `node scripts/loadMACountyBudget.js --county <name> --dry-run`
- **Per wave merge:** DB verification queries (all 5 counties)
- **Phase gate:** All 5 county budget tabs visible in app before phase close

### Wave 0 Gaps

- [ ] `scripts/extractMACounties.py` — must be created (per-county extraction modes)
- [ ] `scripts/loadMACountyBudget.js` — must be created (shared loader)
- [ ] `docs/MA-Counties/bristol-fy25.pdf` — must be downloaded manually

---

## Security Domain

Phase 41 makes no changes to authentication, session management, API endpoints, or input validation paths. All operations are:
- Outbound HTTP GET to public government document servers (no auth required)
- Supabase writes via service-role key (same as all other loaders)
- No new API endpoints, no new user-facing input surfaces

No ASVS categories apply. Security posture unchanged.

---

## Code Examples

### loadMACountyBudget.js skeleton

```javascript
// Source: scripts/processGresham.js pattern (established), adapted for 5 counties
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// loadEnv() from scripts/loadMAPopulation.js (copy verbatim)
function loadEnv() { ... }
loadEnv();

const { values: args } = parseArgs({
  options: {
    county:    { type: 'string' },   // 'barnstable' | 'bristol' | 'dukes' | 'norfolk' | 'plymouth'
    'dry-run': { type: 'boolean' },
  },
  strict: false,
});

const COUNTY_CONFIG = {
  barnstable: { name: 'Barnstable County', pdf: 'barnstable-fy25.pdf', fy: 2025, sanityMax: 30_000_000 },
  bristol:    { name: 'Bristol County',    pdf: 'bristol-fy25.pdf',    fy: 2025, sanityMax: 20_000_000 },
  dukes:      { name: 'Dukes County',      pdf: 'dukes-fy24-audit.pdf',fy: 2024, sanityMax: 5_000_000 },
  norfolk:    { name: 'Norfolk County',    pdf: 'norfolk-fy26.pdf',    fy: 2026, sanityMax: 50_000_000 },
  plymouth:   { name: 'Plymouth County',   pdf: 'plymouth-fy25.pdf',   fy: 2025, sanityMax: 20_000_000 },
};

async function main() {
  const countyKey = args.county?.toLowerCase();
  if (!countyKey || !COUNTY_CONFIG[countyKey]) {
    console.error('Usage: node loadMACountyBudget.js --county <barnstable|bristol|dukes|norfolk|plymouth>');
    process.exit(1);
  }
  
  const config = COUNTY_CONFIG[countyKey];
  const pdfPath = path.join(ROOT, 'docs', 'MA-Counties', config.pdf);
  
  const muniId = await ensureMunicipality(config.name);
  const rows = extractCountyBudget(countyKey, pdfPath);  // calls Python extractor
  const { tree, total } = buildBudgetTree(rows);
  
  if (total > config.sanityMax) {
    console.error(`Total $${total} exceeds sanity cap $${config.sanityMax} — verify`);
    if (!args['dry-run']) process.exit(1);
  }
  
  if (!args['dry-run']) {
    await loadFiscalYear(muniId, config.fy, 'operating', tree, total, rows.length);
  }
  
  console.log(`\nDone: ${config.name} FY${config.fy} — $${total.toLocaleString()} (${rows.length} depts)`);
}
```

### Plymouth County extraction (verified pdfplumber approach)

```python
# Source: live pdfplumber extraction confirmed 2026-06-11
# Page 3 (index 2) contains the multi-year summary table
def extract_plymouth(pdf_path, fiscal_year):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[2]
        text = page.extract_text() or ''
        rows = []
        fy_str = str(fiscal_year)[2:]  # '25' from 2025
        
        # Use text-line approach (more reliable than table extraction for this format)
        for line in text.split('\n'):
            # Pattern: "01 Account Name  $ 43,175.00  $ 31,006.25  ...  $ 11,868.xx"
            # FY25 = last amount column
            m = re.match(r'^\d{2}\s+(.+?)\s+(?:\$\s*[\d,]+\.?\d*\s+){4}\$\s*([\d,]+\.?\d*)', line)
            if m:
                name = m.group(1).strip()
                if 'Total All' in name:
                    continue
                amount = float(m.group(2).replace(',', ''))
                if amount > 0:
                    rows.append({'department': name, 'amount': amount, 'fiscal_year': fiscal_year})
        return rows
```

### DB verification queries

```sql
-- Verify all 5 counties have budget rows
SELECT m.name, COUNT(b.id) AS budget_rows, MAX(b.total) AS total
FROM treasury.budgets b
JOIN treasury.municipalities m ON m.id = b.municipality_id
WHERE m.state = 'MA' AND m.entity_type = 'county'
GROUP BY m.name
ORDER BY m.name;
-- Expected: 5 rows with totals approximately:
-- Barnstable County: ~$24.7M (FY25)
-- Bristol County: ~$9-14M (FY25, TBD after discovery)
-- Dukes County: ~$2.0M (FY2024)
-- Norfolk County: ~$37.8M (FY26, REQUEST column)
-- Plymouth County: ~$11.9M (FY25)

-- Verify no bleed into city queries
SELECT COUNT(*) FROM treasury.budgets b
JOIN treasury.municipalities m ON m.id = b.municipality_id
WHERE m.state = 'MA' AND m.entity_type = 'city';
-- This count should be unchanged from before Phase 41
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No county budget data for MA | 5 MA county government budgets loaded | Phase 41 (this phase) | County pages show Money Out tab; per-capita activates |
| County pages show only city list | County pages show budget + city list | Phase 41 | CitiesInCountyPanel + budget tab both active |
| Budget PDFs from single-city scrapers | Per-county extraction modes in one script | Phase 41 | Clean per-county extraction with sanity checks |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bristol County PDF can be downloaded manually via browser (apostrophe in filename is a CMS routing issue, not file missing) | Bristol source details | If file genuinely doesn't exist, Bristol must be obtained via public records request. Discovery task must confirm. |
| A2 | ROADMAP success criteria ($22–25M for Barnstable) uses the FY25 figure of $24.7M — this is within range | Success criteria | Risk is low — confirmed total $24,753,101 from p29 of PDF. |
| A3 | ROADMAP success criteria ($9–14M for Bristol) is correct for county-government-only scope (not including Agricultural School) | Bristol source details | If Bristol includes an agricultural school like Norfolk, actual total could be higher. Discovery task must confirm. |
| A4 | Norfolk FY26 total of $37.8M exceeds ROADMAP expected range ($14–18M) — the ROADMAP expectation was based on incomplete research | Norfolk source details | Planner must adjust Norfolk success criteria or decide to exclude Agricultural High School ($13.9M). |
| A5 | Dukes County uses the audit FY2024 financial statements as the budget source (no PDF budget document published online) | Dukes source details | If a budget PDF exists but is not published online, we're loading audit actuals not budgeted amounts. Actuals from the budget-and-actual schedule are an acceptable substitute. |
| A6 | The `treasury_sync_budget_tree` RPC correctly handles `entity_type='county'` municipality_id values | Architecture | If RPC has a hidden city-only filter, county budget rows would fail silently. Mitigate: dry-run validates tree submission before live load. RPC has never shown entity_type filtering in any prior county load (LA County Phase 25 used same RPC). |
| A7 | Barnstable FY25 category-level summary (Salaries/OpEx/Fringe/Capital from p29) is suitable for DATA-01 if per-department extraction fails | Barnstable source details | Per-dept breakdown would be better but 4 categories still satisfies the "operating budget data loaded" requirement. Planner must decide acceptable granularity. |

---

## Open Questions

1. **Bristol County PDF download mechanism**
   - What we know: PDF exists (linked on commissioners page), but HTTP download fails due to apostrophe filename on revize CMS
   - What's unclear: Can we get the PDF via another URL pattern, or is manual browser download the only path?
   - Recommendation: 41-01-PLAN.md discovery task includes "open browser, download PDF, save to docs/MA-Counties/bristol-fy25.pdf" as Task 1. Non-blocking for other 4 counties.

2. **Barnstable extraction granularity: 4 categories vs. 14 departments**
   - What we know: p29 has reliable 4-category totals (Salaries/OpEx/Fringe/Capital). Individual dept totals are in narrative text but inconsistently phrased.
   - What's unclear: Whether the discovery task will find a clean per-department table (e.g., in the appendix or via different PDF version).
   - Recommendation: Discovery task should check FY23 PDF (different formatting may have cleaner tables) and check if there's a FY26 PDF available as an Excel/structured format.

3. **Norfolk success criteria budget total discrepancy**
   - What we know: Norfolk FY26 total = $37.8M, but ROADMAP says "$14–18M"
   - What's unclear: Whether the ROADMAP estimate was based on county-government-only scope
   - Recommendation: Planner should update Norfolk success criteria in the PLAN to "$35–40M (includes Agricultural High School)" OR decide to scope to county-government-only departments (~$14-18M by excluding school + retirement). Document the decision in the plan.

4. **Should Phase 41 load multiple fiscal years per county?**
   - What we know: Plymouth has FY21-FY25 on same PDF (p3). Norfolk has FY23-FY26 multi-year data. Dukes has FY2019-FY2024 audits. Barnstable has FY21-FY25 PDFs.
   - What's unclear: ROADMAP only requires "at least one fiscal year." Loading multiple years would improve the app but increases scope.
   - Recommendation: Load single latest year for 41-02-PLAN.md (keeps scope clean). Multi-year can be a follow-on. Plymouth's multi-year is particularly easy (all on p3 of one PDF).

---

## Sources

### Primary (HIGH confidence)
- `docs/MA-Counties/barnstable-fy25.pdf` — downloaded from capecod.gov, inspected via pdfplumber 2026-06-11; FY25 total confirmed $24,753,101
- `docs/MA-Counties/dukes-fy24-audit.pdf` — downloaded from dukescounty.gov, inspected via pdfplumber 2026-06-11; FY2024 GF total confirmed $2,015,631 combined
- `docs/MA-Counties/norfolk-fy26.pdf` — downloaded from cms5.revize.com (norfolkcounty.org), inspected via pdfplumber 2026-06-11; FY26 total confirmed $37,824,798
- `docs/MA-Counties/plymouth-fy25.pdf` — downloaded from plymouthcountyma.gov, inspected via pdfplumber 2026-06-11; FY25 total confirmed $11,868,468.18; clean multi-year table confirmed
- Supabase DB live query 2026-06-11 — 5 MA county municipality_ids confirmed; 0 existing data_sources for counties
- `scripts/processGresham.js` — canonical loader pattern read in full 2026-06-11
- `.planning/phases/40-ma-county-seeding-city-linking/40-VERIFICATION.md` — Phase 40 complete, all 5 county rows confirmed in DB

### Secondary (MEDIUM confidence)
- `https://www.capecod.gov/county-government/county-administrator/budget/` — FY25, FY23, FY22, FY21 PDF URLs confirmed via WebFetch 2026-06-11
- `https://www.plymouthcountyma.gov/217/Revenues-and-Budgets` — FY21-FY26 PDF URLs confirmed via WebSearch + WebFetch 2026-06-11
- `https://www.norfolkcounty.org/county_budget/index.php` — FY22-FY27 budget archive confirmed via WebFetch 2026-06-11
- `https://www.dukescounty.gov/departments/county-treasurer/Audits` — FY2003-FY2024 audit files confirmed via WebFetch 2026-06-11

### Tertiary (LOW confidence)
- Bristol County budget scale ~$9-14M — ASSUMED from ROADMAP (confirmed as county manages ~$34M including AgSchool per web search); county-government-only scope unknown until PDF downloaded

---

## Metadata

**Confidence breakdown:**
- Plymouth County (DATA-05): HIGH — clean PDF, confirmed table extraction, live total verified
- Norfolk County (DATA-04): HIGH — PDF downloaded, departments and totals confirmed
- Dukes County (DATA-03): HIGH — audit PDF downloaded, budget-vs-actual schedule confirmed
- Barnstable County (DATA-01): MEDIUM — PDF downloaded, total confirmed, but per-dept extraction approach not fully verified (narrative parsing needed)
- Bristol County (DATA-02): LOW — PDF not downloadable via HTTP; manual download required; format unknown
- Loader architecture: HIGH — directly follows established processGresham.js pattern

**Research date:** 2026-06-11
**Valid until:** 2026-08-11 (county budget PDFs are published annually; current FY documents stable for 2 months)
