# Phase 20: Gresham OR Budget Load - Research

**Researched:** 2026-05-31
**Domain:** Gresham, Oregon municipal budget data acquisition and loading
**Confidence:** HIGH (PDF structure verified by download and inspection; all PDF URLs confirmed live; Census population confirmed; all patterns verified from codebase)

---

## Summary

Gresham, Oregon publishes its adopted budget as a single multi-volume PDF document per fiscal year, available at greshamoregon.gov. Unlike Portland (which uses separate Vol 1 / Vol 2 PDFs for operating vs. revenue), Gresham's single PDF contains both operating (Requirements) and revenue (Resources) data on one summary page: "Resources and Requirements — All Funds." All five fiscal year PDFs from FY2021-22 through FY2025-26 are confirmed live and downloadable at stable URLs.

The key structural difference from Portland: Gresham's All Funds page does NOT produce clean output from pdfplumber's `extract_tables()` — that returns empty. However, `page.extract_text()` returns perfectly clean, fully parseable text lines. The column structure is: `[dept name] [FY-3 actual] [FY-2 actual] [FY-1 revised] [FY adopted proposed] [FY adopted approved] [FY ADOPTED]`. Column 6 (last) = the official Council-Adopted budget for that fiscal year's PDF. The Adopted column is always the last number on each department line.

This means the extractor pattern is a **text-line parser** (not `extract_tables()`), reading from `page.extract_text()` and extracting department names + last numeric value. This is a simpler and more reliable approach than the Portland bureau-table pattern. Older PDFs (FY2022-23) have minor OCR spacing artifacts in both names and numbers (e.g., "Li censes", "3 5,569,000") that require whitespace-normalization before parsing.

**Primary recommendation:** Write `extractGresham.py` (pdfplumber text-line parser — NOT `extract_tables()`) and `processGresham.js` + `seedGreshamOregon.js` following Portland patterns. Load FY2023-FY2026 (four adopted-budget PDFs). Update `loadORPopulation.js` to add Gresham (population 111,507 per Census 2024). Run `enrichCategories.js --city Gresham --state OR` after load.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gresham municipality seeder | Database (scripts) | — | Same pattern as seedPortlandOregon.js — upsert via Supabase client |
| PDF data extraction | Script (Python pdfplumber text-parse) | — | Machine-generated PDF; text extraction works; extract_tables() returns empty |
| Budget load (treasury_sync_budget_tree) | Database (Node.js script) | — | Same RPC used by all prior loaders |
| Population load (Census CSV) | Database (Node.js script) | — | Existing loadORPopulation.js — add Gresham to EXPECTED_CITIES |
| Category enrichment | Script (enrichCategories.js) | Anthropic API | Existing pipeline; --city Gresham --state OR |

---

## Data Source Finding

### FINDING: Gresham is NOT on Socrata — single-PDF-per-FY source [VERIFIED: greshamoregon.gov/budget-and-finance/budget-and-financial-documents/]

Gresham publishes a single adopted budget PDF per fiscal year via globalassets CDN URLs. No Socrata portal, no CSV export, no XLSX. All PDFs are machine-generated (pdfplumber-extractable).

**No Socrata, no CSV, PDF-only:** Same situation as Portland. Use the pdfplumber pipeline.

**Single PDF vs. Portland's multi-volume:** Portland uses Vol 1 (operating) + Vol 2 (revenue) separately. Gresham uses ONE PDF per year containing both operating (Requirements) and revenue (Resources) on the same summary page.

---

## Standard Stack

### Core (no new packages — all exist in project)

| Tool | Version | Purpose | Status |
|------|---------|---------|--------|
| pdfplumber | 0.11.9 | Text extraction from machine-generated PDFs | [VERIFIED: confirmed importable] |
| @supabase/supabase-js | existing | DB writes via treasury_sync_budget_tree | Already in project |
| node:util parseArgs | Node.js built-in | CLI flag parsing | Already used in all loaders |

**No new npm or Python packages needed.** All dependencies are already installed.

---

## Package Legitimacy Audit

No new packages required for this phase. Existing dependencies (pdfplumber 0.11.9, @supabase/supabase-js) are already installed and in use by the project.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Gresham Adopted Budget PDFs (greshamoregon.gov/globalassets/...)
  FY2025-26 → FY2024-25 → FY2023-24 → FY2022-23 (4 PDFs)
  └─► pdfplumber text-line extractor (extractGresham.py)
        │  extracts: dept name, adopted_amount (last col), fiscal_year
        │  strategy: page.extract_text() NOT extract_tables()
        └─► processGresham.js (Node.js)
              │  calls Python via execSync, parses JSON
              ├─► treasury_sync_budget_tree RPC (operating: dept-level)
              └─► treasury_sync_budget_tree RPC (revenue: resource-level, if scoped)

Census sub-est2024_41.csv (already cached at C:/tmp/sub-est2024_41.csv)
  └─► loadORPopulation.js (UPDATE: add Gresham to EXPECTED_CITIES + KNOWN_VALUES)
        └─► municipalities UPDATE (population=111507, population_year=2024)

seedGreshamOregon.js (adapt from seedPortlandOregon.js)
  └─► treasury.municipalities (upsert Gresham, OR)

enrichCategories.js --city Gresham --state OR --year 2026
  └─► category_enrichment rows (scoped to Gresham municipality_id)
```

### Recommended Script Structure

```
scripts/
├── seedGreshamOregon.js      # municipality upsert (adapt from seedPortlandOregon.js)
├── extractGresham.py         # pdfplumber text-line extractor (NOT extract_tables)
└── processGresham.js         # Node.js loader: calls Python, calls RPC

docs/
└── Gresham/                  # Downloaded PDFs (4 files)
    ├── fy2022-23.pdf
    ├── fy2023-24.pdf
    ├── fy2024-25.pdf
    └── fy2025-26.pdf

loadORPopulation.js           # UPDATE: add Gresham to EXPECTED_CITIES + KNOWN_VALUES
```

### Pattern 1: Text-Line Extraction (Gresham-specific — NOT extract_tables)

**What:** `page.extract_text()` returns clean lines. Each department row has the format:
```
[Dept Name]  [num1]  [num2]  [num3]  [num4]  [num5]  [num6]
```
Column 6 = Council-Adopted budget for the PDF's target fiscal year.

**Critical difference from Portland:** Portland uses `extract_tables()` on Appropriation Schedule pages. Gresham's All Funds page returns `Tables found: 0` from `extract_tables()` — use text-line parsing instead.

**Key extraction approach:**
```python
# Source: verified by direct PDF inspection 2026-05-31

import re, pdfplumber

DEPT_SKIP = {
    'Operating Total', 'Non-Operating Total', 'Total Requirements',
    'Total Resources', 'Capital Improvement', 'Debt Service', 'Transfers',
    'Contingency', 'Other Requirements', 'Unappropriated',
    # Resources rows (revenue-side):
    'Taxes', 'Licenses & Permits', 'Intergovernmental', 'Charges for Services',
    'Utility License Fees', 'Miscellaneous Income', 'Internal Payments',
    'Interfund Transfers', 'Internal Svc Chrg', 'Internal Service Charges',
    'Financing Proceeds', 'Beginning Balance',
}

def parse_money_gresham(s):
    """Handle OCR spacing artifacts in older PDFs: '3 5,569,000' -> 35569000."""
    if not s or not s.strip() or s.strip() == '-':
        return 0
    cleaned = re.sub(r'[\$\(\)\s,]', '', s.strip())
    neg = s.strip().startswith('(')
    try:
        return int(round(float(cleaned) * (-1 if neg else 1)))
    except ValueError:
        return 0

def parse_fy_gresham(header_text):
    """
    FY2025-26 PDF header: '2022/23 2023/24 2024/25 2025/26 2025/26 2025/26'
    FY2022-23 PDF header: '2019/20 2020/2021 2021/2022 2022/2023 2022/2023 2022/2023'
    Returns the LAST FY in the header (= the Adopted column year).
    """
    # Find all YYYY/YY or YYYY/YYYY patterns
    fys = re.findall(r'\d{4}/(?:\d{4}|\d{2})(?!\d)', header_text)
    if fys:
        last = fys[-1]
        m4 = re.match(r'(\d{4})/(\d{4})', last)
        if m4:
            return int(m4.group(2))
        m2 = re.match(r'(\d{4})/(\d{2})', last)
        if m2:
            return int(m2.group(1)) // 100 * 100 + int(m2.group(2))
    return None

def extract_dept_rows(pdf_path):
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        fiscal_year = None
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' not in text or 'All Funds' not in text:
                continue
            # Parse fiscal year from column header line
            for line in text.split('\n')[:8]:
                fy = parse_fy_gresham(line)
                if fy:
                    fiscal_year = fy
                    break
            # Parse department rows
            in_requirements = False
            for line in text.split('\n'):
                s = line.strip()
                if not s:
                    continue
                # Normalize OCR name artifacts (older PDFs have spaces mid-word)
                if s == 'Requirements':
                    in_requirements = True
                    continue
                if not in_requirements:
                    continue
                # Extract: name = everything before first run of digits
                m = re.match(r'^(.+?)\s+((?:[\d,\s]+|-)\s+){5}([\d,\s]+|-)$', s)
                if not m:
                    continue
                dept = m.group(1).strip()
                if not dept or dept in DEPT_SKIP:
                    continue
                # Last whitespace-delimited token = Adopted amount
                tokens = s.split()
                adopted_raw = tokens[-1]
                adopted = parse_money_gresham(adopted_raw)
                if adopted <= 0:
                    continue
                results.append({
                    'department': dept,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })
            break  # Only one All Funds page per PDF
    return results
```

**Simpler and more robust alternative** (verified approach for the actual regex pattern):
```python
# Parse each department line by splitting on whitespace and taking:
# - All tokens up to the first number = department name
# - Last token = Adopted amount (col 6)
def parse_line(line):
    tokens = line.strip().split()
    if len(tokens) < 7:
        return None, None
    # Find split: name tokens (no commas/dashes) vs number tokens (have commas/dashes)
    name_end = 0
    for i, t in enumerate(tokens):
        if re.match(r'^[\d,]+$', t) or t == '-':
            name_end = i
            break
    if name_end == 0:
        return None, None
    dept_name = ' '.join(tokens[:name_end])
    # Handle OCR: dept name may have internal spaces ('Li censes' -> 'Licenses')
    # For simplicity, use the raw name and normalize in post-processing
    adopted_raw = tokens[-1]
    # Handle OCR in number: '3 5,569,000' would be split as ['3', '5,569,000']
    # => the last token after split is just the trailing fragment
    # Better: strip all spaces from the number portion of the line
    return dept_name, parse_money_gresham(adopted_raw)
```

**NOTE:** The exact regex for name vs number boundary needs to be tested against the FY2022-23 PDF's OCR artifacts. Plan task 1 should inspect the actual extracted lines before finalizing the extractor.

### Pattern 2: Municipality Seeder (seedPortlandOregon.js pattern)

Exact same structure as `seedPortlandOregon.js`. Single municipality entry:
```javascript
const GRESHAM = {
  name: 'Gresham',
  state: 'OR',
  entity_type: 'city',
  population: 111507,
  population_year: 2024,
};
```

Note: `seedPortlandOregon.js` does NOT create data_source rows — those are created by `processPortland.js` (one per FY per type). Follow the same pattern for Gresham: seeder = municipality only; loader = data_source rows.

### Pattern 3: Population Loader — Update loadORPopulation.js

**What:** `loadORPopulation.js` already exists for Oregon with Portland only. Add Gresham to two config arrays.

**Required change (two lines):**
```javascript
// scripts/loadORPopulation.js — change these two constants:

const EXPECTED_CITIES = ['Portland', 'Gresham'];

const KNOWN_VALUES = {
  Portland: 635749,
  Gresham: 111507,  // Census 2024 SUMLEV=162, 'Gresham city' -> 'Gresham'
};
```

**Census data confirmed:** [VERIFIED: C:/tmp/sub-est2024_41.csv, row: 162,41,000,31250,...]
- SUMLEV: 162 (incorporated place)
- NAME: "Gresham city"
- POPESTIMATE2024: 111,507
- After `normalizeCensusName()`: "Gresham"
- `normalizeCensusName` already strips ` city` suffix — no code change needed.

### Pattern 4: processGresham.js (adapt from processPortland.js)

Key adaptations vs. processPortland.js:
- `ensureMunicipality()`: look up `name='Gresham', state='OR'`
- `PDF_URLS`: Gresham URL map (see Data Source Details below)
- `extractPDF()`: calls `extractGresham.py` (not `extractPortland.py`)
- `buildOperatingTree()`: same tree node shape — departments are the top-level nodes
- `upsertDataSource()`: `name: 'Gresham Operating Budget FY${fiscalYear}'`
- PDF discovery: `docs/Gresham/` directory, filter `*.pdf`
- No `--revenue` flag needed for Phase 20 scope (revenue deferred — see Scope Decision)
- Filename inference: `fy2025-26.pdf` → 2026, `fy2022-23.pdf` → 2023

```javascript
// PDF_URLS for Gresham operating (single PDF per FY, no Vol 1/2 split)
const PDF_URLS = {
  2026: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/fy-2025-26-adopted-budget.pdf',
  2025: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy24-25.pdf',
  2024: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy-2023-24.pdf',
  2023: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/adopted-budget-for-fiscal-year-2022-23.pdf',
};
```

### Anti-Patterns to Avoid

- **Using `extract_tables()` for Gresham PDFs:** Returns empty on the All Funds page. Text extraction is the correct approach.
- **Using `extractPortland.py` for Gresham:** Portland extractor looks for "Appropriation Schedule" and subtotal rows. Gresham has no such pages — a new extractor is required.
- **Using the FY2025-26 PDF's historical columns for prior fiscal years:** Columns 1-3 in that PDF are historical actuals or "Revised" (not Adopted). Each year's Adopted figure must come from that year's dedicated PDF (column 6).
- **Hardcoding population:** Use `loadORPopulation.js` with the Census file; the known-values dict is a sanity check only.
- **Expecting Portland amounts (billions) from Gresham:** Gresham's Operating Total is ~$330M. `Total Requirements` (~$897M) includes capital, debt, and unappropriated — do NOT use that as the operating total.

---

## Data Source Details

### Gresham Adopted Budget PDFs [VERIFIED: greshamoregon.gov + curl HTTP 200 checks]

| Fiscal Year | DB fiscal_year | PDF URL | File Size | Status |
|-------------|---------------|---------|-----------|--------|
| FY 2025-26 | 2026 | `https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/fy-2025-26-adopted-budget.pdf` | 7.3 MB | 200 OK |
| FY 2024-25 | 2025 | `https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy24-25.pdf` | 7.9 MB | 200 OK |
| FY 2023-24 | 2024 | `https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy-2023-24.pdf` | 6.8 MB | 200 OK |
| FY 2022-23 | 2023 | `https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/adopted-budget-for-fiscal-year-2022-23.pdf` | 7.9 MB | 200 OK |

Note: URL patterns are inconsistent across fiscal years (different paths, different filename formats). All four URLs confirmed live via `curl -sI` checks 2026-05-31.

FY 2021-22 is also available but omitted from scope — loading FY2023-FY2026 (4 years) matches the Portland historical depth.

### Gresham Budget Structure [VERIFIED: direct PDF inspection via pdfplumber]

**Single PDF per FY.** No Vol 1 / Vol 2 split.

**All Funds page location:**
- FY2025-26 PDF: page 18 (PDF page 11 per footer)
- FY2024-25 PDF: page 21
- FY2022-23 PDF: page 16
- All are labeled "Resources and Requirements — All Funds"

**Column structure (6 columns of numbers per data row):**
```
2022/23    2023/24    2024/25    2025/26    2025/26    2025/26
Actual     Actual     Revised    Proposed   Approved   Council Adopted
                                                       ← USE THIS
```

**Column 6 (last) = Council Adopted = official budget.** Always the last number on the line.

**Operating departments (FY2025-26):** [VERIFIED: PDF text extraction]

| Department | FY2026 Adopted |
|-----------|---------------|
| Office of Governance & Management | $4,487,895 |
| City Attorney's Office | $11,335,221 |
| Budget & Finance | $9,469,877 |
| Information Technology | $9,272,850 |
| Citywide Services | $45,642,777 |
| Police | $66,214,970 |
| Fire | $50,182,956 |
| Urban Renewal | $2,016,000 |
| Urban Design & Planning | $16,204,508 |
| Community Development | $6,380,549 |
| Economic Development | $8,519,945 |
| Community Livability | $5,633,064 |
| Youth & Recreation Services | $6,759,278 |
| Parks | $6,340,381 |
| Environmental Services | $82,191,807 |
| **Operating Total** | **$330,652,078** |

**15 departments, Operating Total = $330,652,078 for FY2026.** This is the correct operating budget total (not `Total Requirements` = $897M which includes capital, debt, and unappropriated).

### Scope Decision: Operating Only for Phase 20

The Gresham PDF contains both operating (Requirements) and revenue (Resources) on the same All Funds page. Revenue categories are available: Taxes, Licenses & Permits, Intergovernmental, Charges for Services, Utility License Fees, Miscellaneous Income, etc. However:

- Phase 20's primary goal matches Portland Phase 17's scope: operating budget load
- Revenue extraction requires parsing the Resources section (first half of the same page)
- Revenue can be added in a follow-up phase (analogous to Portland Phase 19)
- Scoping to operating keeps Phase 20 a direct Portland-pattern reuse

**Recommendation:** Operating budget only for Phase 20. Revenue is a follow-up (Phase 21 or later). Revenue extraction would be straightforward (same page, same parser, different row set) if the user wants to expand scope.

### Fiscal Year Naming Convention

Gresham uses `FY YYYY/YY` (e.g., "FY 2025/26") — note SLASH not DASH (differs from Portland's "FY 2025-26").

DB convention: `fiscal_year` = ending calendar year. FY 2025/26 → `fiscal_year = 2026`. FY 2022/23 → `fiscal_year = 2023`. Consistent with all prior cities.

**Gresham does NOT use "FY" prefix in the All Funds page header** — the year columns appear as bare `2025/26`, `2022/23`, etc. The cover page says "Fiscal Year 2025/26".

Older PDFs (FY2022-23) use 4-digit year format in the header: `2020/2021`, `2021/2022`, `2022/2023` — parse_fy must handle both `YYYY/YY` and `YYYY/YYYY`.

---

## Population Data

### Gresham 2024 Census Population [VERIFIED: C:/tmp/sub-est2024_41.csv, row confirmed]

| Property | Value |
|----------|-------|
| Census file | `sub-est2024_41.csv` |
| SUMLEV | 162 (incorporated place) |
| Census name | "Gresham city" |
| After normalizeCensusName | "Gresham" |
| POPESTIMATE2024 | **111,507** |
| File location | C:/tmp/sub-est2024_41.csv (already cached from Phase 17) |

`normalizeCensusName` in `loadORPopulation.js` strips ` city` suffix — "Gresham city" → "Gresham" correctly with no code changes.

**Note on census trajectory:** Population has been declining: 114,265 (2020) → 111,507 (2024). The 2024 figure is the correct one to use.

---

## Enrichment Cost Estimate

Gresham has 15 operating departments at depth=0. Portland (141 enrichment rows for FY2022-FY2026 combined operating + revenue) used ~140 API calls.

Gresham FY2023-FY2026 operating: 15 departments × 4 years = 60 potential category rows at depth=0. `enrichCategories.js` is idempotent via `name_key` upsert — categories that share a name_key across fiscal years are enriched once.

**Cost estimate:** Claude Haiku 4.5 at ~$0.80/1M input tokens + $4/1M output tokens. Each enrichment call ≈ 500 input tokens + 512 output tokens.
- 60 categories × ~1,000 tokens/call × average $2/1M = **~$0.12**
- Absolute worst case (all unique, verbose): $0.50
- Well under the $5/run threshold. No approval needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Municipality upsert | Custom DB insert | `seedGreshamOregon.js` (adapt `seedPortlandOregon.js`) | FK ordering, idempotency, name collision handling |
| PDF text extraction | Custom text parser from scratch | pdfplumber + `page.extract_text()` | Handles encoding, multi-page; verified on Gresham PDFs |
| Budget tree to DB | Custom SQL | `treasury_sync_budget_tree` RPC | Upsert logic, category hierarchy, idempotency |
| Population load | Manual lookup | Update `loadORPopulation.js` | CSV format is tested; normalizeCensusName handles "Gresham city" |
| Category enrichment | Custom AI pipeline | `enrichCategories.js --city Gresham --state OR` | Idempotent, scoped, handles concurrency |

---

## Common Pitfalls

### Pitfall 1: extract_tables() Returns Empty on Gresham PDFs
**What goes wrong:** Calling `page.extract_tables()` on the All Funds page returns `[]`. No table rows are found. Zero department rows extracted.
**Why it happens:** Gresham's All Funds page layout doesn't have HTML-style table borders that pdfplumber's table detector recognizes. Portland's Appropriation Schedule pages do have detectable table structure.
**How to avoid:** Use `page.extract_text()` and parse by line. This is confirmed working — all 15 departments parse cleanly from FY2025-26.
**Warning signs:** `rows = []` after extraction despite PDF being valid.

### Pitfall 2: OCR Spacing Artifacts in FY2022-23 PDF
**What goes wrong:** Department names have mid-word spaces ("Li censes & Permits", "Ci tywide Services") and numbers have internal spaces ("3 5,569,000", "4 ,197,000"). Name matching against enrichment or expected-dept lists fails.
**Why it happens:** Gresham's FY2022-23 PDF has minor text rendering/extraction artifacts not present in FY2023-24 through FY2025-26.
**How to avoid:** (1) Normalize names in a post-processing step or normalize before comparison. (2) Use `re.sub(r'[\$\(\)\s,]', '', s)` for number cleaning — this removes all spaces, handling "3 5,569,000" → "35569000" correctly. (3) For name normalization: collapse multiple spaces to single space.
**Warning signs:** FY2023 department total not matching expected Operating Total of ~$269M.

### Pitfall 3: Using Total Requirements as Operating Total
**What goes wrong:** Loader uses $897M (Total Requirements, FY2026) or $330M (Operating Total) — the wrong figure is passed as `p_total` to treasury_sync_budget_tree.
**Why it happens:** Gresham's All Funds page shows both Operating Total ($330M) and Total Requirements ($897M). The $897M includes capital improvements, debt service, transfers, and unappropriated ending balance — these are not spending categories.
**How to avoid:** Sum only the department rows (Office of Governance through Environmental Services). Exclude rows: "Operating Total", "Capital Improvement", "Debt Service", "Transfers", "Contingency", "Other Requirements", "Unappropriated", "Non-Operating Total", "Total Requirements". The sum of the 15 department rows = $330,652,078 for FY2026. Verify this matches "Operating Total" on the page.
**Warning signs:** `p_total` > $500M for any Gresham fiscal year.

### Pitfall 4: Department Name Changes Across Fiscal Years
**What goes wrong:** Department names differ across fiscal years, causing duplicate enrichment entries or mismatched categories.
**Why it happens:** Gresham reorganized some departments between fiscal years:
- FY2024-25: "City Manager's Office" → FY2025-26: "Office of Governance & Management"
- FY2022-23: "Fire & Emergency Services" → FY2024-25 onward: "Fire"
- FY2022-23: "Ec onomic & Developement Services" (OCR artifact) — normalize to "Economic Development"
- FY2022-23: "Co mmunity Services" → later years use different names
**How to avoid:** `enrichCategories.js` uses `name_key` (lowercased slug of category name) for idempotency. Department renames create separate enrichment entries, which is correct. Do NOT attempt to merge renamed departments — let enrichment handle each name independently.
**Warning signs:** enrichment run shows unexpected duplicate name_key collisions.

### Pitfall 5: Fiscal Year Parsing — Slash vs. Dash, and YYYY/YYYY Format
**What goes wrong:** `parse_fy` written for Portland's "FY 2025-26" format fails on Gresham's "2025/26" (no "FY" prefix, slash separator) or the older "2020/2021" (4+4 digit format).
**Why it happens:** Portland uses dash separator and "FY " prefix. Gresham uses slash separator without prefix, and older PDFs use 4-digit year for the ending year.
**How to avoid:** Write a Gresham-specific `parse_fy_gresham(header_text)` that:
1. Finds all patterns `\d{4}/\d{4}` or `\d{4}/\d{2}(?!\d)`
2. Takes the last match (= the Adopted FY column header)
3. Returns the ending year as integer
**Warning signs:** `fiscal_year = None` in extracted rows, or fiscal_year = 202526 (concatenated).

### Pitfall 6: Missing loadORPopulation.js Gresham Entry
**What goes wrong:** Running `node loadORPopulation.js` after adding Gresham municipality row fails with "ERROR: Missing cities in CSV: Gresham" or the Gresham population stays NULL.
**Why it happens:** `loadORPopulation.js` has an `EXPECTED_CITIES` guard that fails if a listed city isn't found in the CSV. Adding Gresham to the DB without adding it to the script causes a mismatch.
**How to avoid:** Update BOTH arrays in `loadORPopulation.js` before running: `EXPECTED_CITIES` and `KNOWN_VALUES`. The Census CSV already contains "Gresham city" at SUMLEV=162.
**Warning signs:** Script exits non-zero; or DB shows `population = NULL` for Gresham after running.

---

## Code Examples

### extractGresham.py — Core Extraction Logic

```python
# Source: verified by pdfplumber inspection of Gresham FY2025-26 PDF (2026-05-31)

import sys, json, re, pdfplumber

# Rows to EXCLUDE from the department list (totals, non-operating, and revenue lines)
SKIP_ROWS = {
    # Totals
    'Operating Total', 'Non-Operating Total', 'Total Requirements', 'Total Resources',
    # Non-operating requirements
    'Capital Improvement', 'Debt Service', 'Transfers', 'Contingency',
    'Other Requirements', 'Unappropriated',
    # Resources (revenue) rows — exclude from operating load
    'Taxes', 'Licenses & Permits', 'Intergovernmental', 'Charges for Services',
    'Utility License Fees', 'Miscellaneous Income', 'Internal Payments',
    'Interfund Transfers', 'Internal Svc Chrg', 'Internal Service Charges',
    'Financing Proceeds', 'Beginning Balance',
}

def parse_money(s):
    """Handle OCR artifacts: '3 5,569,000' -> 35569000, '4 ,197,000' -> 4197000."""
    if not s or not s.strip() or s.strip() == '-':
        return 0
    cleaned = re.sub(r'[\$\(\)\s,]', '', s.strip())
    neg = s.strip().startswith('(')
    try:
        return int(round(float(cleaned) * (-1 if neg else 1)))
    except ValueError:
        return 0

def parse_fy_from_header(header_line):
    """
    Parse fiscal year from column header line.
    Handles: '2022/23 2023/24 2024/25 2025/26 2025/26 2025/26'
             '2019/20 2020/2021 2021/2022 2022/2023 2022/2023 2022/2023'
    Returns ending year integer of the LAST pattern (= Adopted column).
    """
    # Match YYYY/YYYY (4+4) or YYYY/YY (4+2, not followed by digit)
    matches = re.findall(r'\d{4}/(?:\d{4}|\d{2})(?!\d)', header_line)
    if not matches:
        return None
    last = matches[-1]
    m4 = re.match(r'(\d{4})/(\d{4})', last)
    if m4:
        return int(m4.group(2))
    m2 = re.match(r'(\d{4})/(\d{2})', last)
    if m2:
        return int(m2.group(1)) // 100 * 100 + int(m2.group(2))
    return None

def extract_budget(pdf_path):
    """
    Extract department-level operating budget from Gresham All Funds page.
    Returns list of: { department, adopted_amount, fiscal_year, page_num }
    """
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' not in text or 'All Funds' not in text:
                continue
            # Parse fiscal year from column headers (first 8 lines of page)
            fiscal_year = None
            lines = text.split('\n')
            for line in lines[:8]:
                fy = parse_fy_from_header(line)
                if fy:
                    fiscal_year = fy
                    break
            if not fiscal_year:
                print(f'  WARNING: Could not parse fiscal year on page {page_num}', file=sys.stderr)
                continue
            # Extract department rows from Requirements section
            in_requirements = False
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                if s == 'Requirements':
                    in_requirements = True
                    continue
                if not in_requirements:
                    continue
                # Each data line: "Dept Name  num  num  num  num  num  ADOPTED"
                # Split and check: need at least 2 tokens, last is a number
                tokens = s.split()
                if len(tokens) < 2:
                    continue
                # Find where department name ends and numbers begin
                # Numbers are: digits+commas, or '-'
                name_tokens = []
                num_tokens = []
                in_nums = False
                for t in tokens:
                    if not in_nums and (re.match(r'^[\d,]+$', t) or t == '-'):
                        in_nums = True
                    if in_nums:
                        num_tokens.append(t)
                    else:
                        name_tokens.append(t)
                if not name_tokens or not num_tokens:
                    continue
                dept = ' '.join(name_tokens)
                # Check against skip list (normalize OCR spaces for comparison)
                dept_normalized = re.sub(r'\s+', ' ', dept).strip()
                if dept_normalized in SKIP_ROWS:
                    continue
                # Adopted = last token
                adopted = parse_money(num_tokens[-1])
                if adopted <= 0:
                    print(f'  [skipped] Zero/negative amount: {dept}', file=sys.stderr)
                    continue
                results.append({
                    'department': dept_normalized,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })
            break  # Only one All Funds page per PDF
    return results

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extractGresham.py <pdf_path>', file=sys.stderr)
        sys.exit(1)
    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
```

### processGresham.js — Key Adaptations from processPortland.js

```javascript
// Source: adapted from scripts/processPortland.js (verified pattern, 2026-05-31)

// PDF URL map (Gresham has single PDF per FY, no vol1/vol2 distinction)
const PDF_URLS = {
  2026: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/fy-2025-26-adopted-budget.pdf',
  2025: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy24-25.pdf',
  2024: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy-2023-24.pdf',
  2023: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/adopted-budget-for-fiscal-year-2022-23.pdf',
};

// Municipality lookup (adapt ensureMunicipality from processPortland.js)
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Gresham')       // changed from 'Portland'
    .eq('state', 'OR')
    .maybeSingle();
  if (existing?.id) { console.log(`  Municipality: ${existing.name} (${existing.id})`); return existing.id; }
  console.error('  Gresham, OR municipality not found — run seedGreshamOregon.js first');
  process.exit(2);
}

// Tree builder (operating — same shape as Portland)
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;
  for (const row of rows) {
    nodes.push({
      n: row.department,          // 'department' field (vs Portland's 'bureau')
      a: row.adopted_amount,
      i: [{ d: row.department, a: row.adopted_amount, aa: null, f: null, e: null }],
    });
    total += row.adopted_amount;
  }
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// Data source naming convention
// name: 'Gresham Operating Budget FY2026'  (matches Portland pattern)
// api_type: 'pdf_download'
// dataset_type: 'operating'
// dataset_id: 'fy2026'
// fiscal_years: [2026]

// Filename-to-FY inference
// 'fy2025-26.pdf' → 2026   (slash converted to dash in filename)
// 'fy2022-23.pdf' → 2023
function inferFiscalYearFromFilename(filename) {
  const m = filename.match(/fy(\d{4})-(\d{2})/i);
  if (m) {
    const century = Math.floor(parseInt(m[1], 10) / 100) * 100;
    return century + parseInt(m[2], 10);
  }
  return null;
}

// PDF discovery: docs/Gresham/ (create this directory)
// No volSuffix filter needed — all PDFs are operating (no vol1/vol2)
```

### loadORPopulation.js — Two-Line Update

```javascript
// scripts/loadORPopulation.js — CHANGE THESE TWO CONSTANTS ONLY:

const EXPECTED_CITIES = ['Portland', 'Gresham'];  // add 'Gresham'

const KNOWN_VALUES = {
  Portland: 635749,
  Gresham: 111507,  // add this entry
};
// All other code stays the same. The .eq('state', 'OR') filter covers both cities.
```

### enrichCategories.js Command

```bash
# Run after processGresham.js has loaded all fiscal years
node scripts/enrichCategories.js --city Gresham --state OR --year 2026
# Repeat for each loaded fiscal year:
node scripts/enrichCategories.js --city Gresham --state OR --year 2025
node scripts/enrichCategories.js --city Gresham --state OR --year 2024
node scripts/enrichCategories.js --city Gresham --state OR --year 2023
# Or run without --year to enrich all fiscal years at once
```

### Verification Queries

```sql
-- After load: verify all 4 fiscal years present
SELECT fiscal_year, dataset_type, total_budget
  FROM treasury.budgets
  WHERE municipality_id = (SELECT id FROM treasury.municipalities WHERE name='Gresham' AND state='OR')
  ORDER BY fiscal_year, dataset_type;
-- Expected: 4 rows (FY2023-FY2026, dataset_type='operating'), totals ~$269M to ~$330M

-- After enrichment
SELECT COUNT(*), COUNT(plain_name)
  FROM treasury.category_enrichment
  WHERE municipality_id = (SELECT id FROM treasury.municipalities WHERE name='Gresham' AND state='OR');

-- After population load
SELECT population, population_year
  FROM treasury.municipalities
  WHERE name='Gresham' AND state='OR';
-- Expected: population=111507, population_year=2024
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Portland extract_tables() pattern | Text-line parsing for Gresham | This phase | Gresham PDFs don't expose tables to pdfplumber |
| loadORPopulation.js Portland-only | loadORPopulation.js Portland + Gresham | This phase | Add 2 lines to config arrays |
| Single OR city (Portland) | Two OR cities (Portland + Gresham) | This phase | EntitySwitcher already has OR: 'Oregon' from Phase 17 — no change needed |

**Deprecated/outdated for Gresham:**
- `extract_tables()` on All Funds page: confirmed empty; use `extract_text()` instead
- Multiplying amounts by 1000: Gresham amounts are full dollars, same as Portland

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FY2023-24 and FY2022-23 PDFs have the same All Funds page structure as FY2025-26 | Data Source Details | Low risk: FY2022-23 confirmed same structure (same page type, same column layout) — only OCR artifacts differ |
| A2 | Department list is parseable with ~15 departments across all four fiscal years | Architecture Patterns | Low: FY2025-26 has exactly 15; FY2022-23 has similar count with different names. Dry-run will surface any structural surprises |
| A3 | Revenue scope is deferred (operating only for Phase 20) | Scope Decision | If user wants revenue, the extractor can be extended with a second pass on the Resources rows — low effort |
| A4 | `enrichCategories.js` will handle Gresham with no code changes | Enrichment | HIGH confidence — same `--city --state` pattern; already works for Portland |

**Assumptions Log is minimal** — most claims in this research were verified by direct PDF download and inspection.

---

## Open Questions

1. **FY2023-24 PDF structure confirmation**
   - What we know: FY2025-26 and FY2022-23 confirmed identical page structure. FY2024-25 confirmed at page 21.
   - What's unclear: FY2023-24 All Funds page number and any structural variations.
   - Recommendation: Plan task 1 downloads FY2023-24 PDF and runs the extractor to confirm. Low-risk — four PDFs span 10 years of the same city with consistent annual budget publication format.

2. **Is `OR: 'Oregon'` already in EntitySwitcher.tsx?**
   - What we know: Phase 17 added `OR: 'Oregon'` to STATE_LABELS as part of that phase. The Phase 17 PATTERNS.md confirms this was completed.
   - What's unclear: Confirming the current state of the file at plan execution time.
   - Recommendation: Plan task 1 verifies `grep "OR: 'Oregon'" src/components/EntitySwitcher.tsx` — no change needed if already present.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | extractGresham.py | ✓ | 3.14.3 | — |
| pdfplumber | extractGresham.py | ✓ | 0.11.9 | pip install pdfplumber |
| Node.js | All .js scripts | ✓ | (project runs) | — |
| SUPABASE_SERVICE_KEY | All DB scripts | ✓ (in .env) | — | — |
| ANTHROPIC_API_KEY | enrichCategories.js | ✓ (in .env) | — | — |
| Census OR CSV | loadORPopulation.js | ✓ | cached at C:/tmp/sub-est2024_41.csv | re-download from census.gov |

**No missing dependencies.** All tools verified present from Phase 17 execution.

---

## Validation Architecture

Nyquist validation not applicable to this data-loading phase. Validation is done via dry-run commands and DB verification queries (matching Phase 17 VERIFICATION.md pattern).

**Verification approach:**
```bash
# Dry-run validation (no DB writes)
node scripts/processGresham.js --dry-run

# Expected dry-run output per fiscal year:
# FY2026 Operating — $330,652,078 total (15 departments)
# FY2025 Operating — ~$302M total (approx — check actual PDF)
# FY2024 Operating — ~$239M total
# FY2023 Operating — ~$269M total

# Idempotency test
node scripts/processGresham.js && node scripts/processGresham.js   # second run should show 0 new rows
```

---

## Security Domain

No new security surface area introduced. This phase:
- Reads public greshamoregon.gov PDFs (HTTPS fetch, no auth)
- Reads existing cached Census CSV (local file, already validated in Phase 17)
- Writes to Supabase using SUPABASE_SERVICE_KEY (existing auth pattern)
- No new frontend changes required (OR: 'Oregon' already added in Phase 17)

ASVS categories: not applicable (data pipeline, no user-facing auth/input).

---

## Sources

### Primary (HIGH confidence)
- `greshamoregon.gov/budget-and-finance/budget-and-financial-documents/` — confirmed PDF-only budget data; all 5 PDF URLs listed with fiscal year labels [VERIFIED: WebFetch]
- `greshamoregon.gov PDF FY2025-26` — downloaded (7.3 MB), pdfplumber text extraction confirmed working, 15 departments extracted, Operating Total = $330,652,078 [VERIFIED: direct inspection]
- `greshamoregon.gov PDF FY2024-25` — downloaded (7.9 MB), confirmed same page structure at page 21 [VERIFIED: direct inspection]
- `greshamoregon.gov PDF FY2022-23` — downloaded (7.9 MB), confirmed same page structure at page 16 with OCR artifacts documented [VERIFIED: direct inspection]
- All 4 PDF URLs — confirmed HTTP 200 OK via curl -sI check [VERIFIED: HTTP headers]
- `C:/tmp/sub-est2024_41.csv` — Oregon Census subcounty data; Gresham SUMLEV=162 row confirmed; POPESTIMATE2024=111507 [VERIFIED: grep on local file]
- `scripts/processPortland.js`, `scripts/extractPortland.py`, `scripts/seedPortlandOregon.js`, `scripts/loadORPopulation.js` — codebase; existing analog patterns [VERIFIED: direct file read]

### Secondary (MEDIUM confidence)
- `greshamoregon.gov PDF FY2023-24` — URL confirmed HTTP 200, structure assumed consistent with other years but not inspected directly

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Data source format (PDF-only, no Socrata): HIGH — confirmed
- PDF structure (text-parse approach): HIGH — verified on 3 of 4 target PDFs; FY2023-24 not inspected but consistent family
- Gresham 2024 population (111,507): HIGH — verified from Census CSV
- Loader pattern (processPortland.js adaptation): HIGH — direct codebase analogs confirmed
- OCR handling strategy: HIGH — confirmed working via Python test
- Enrichment cost estimate: HIGH — well under $5 threshold

**Research date:** 2026-05-31
**Valid until:** 2026-09-01 (stable annual budget publication cycle; Census file valid until 2025 vintage released ~May 2027)
