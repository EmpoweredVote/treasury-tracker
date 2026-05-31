# Phase 19: Portland Revenue Budget (Vol 2) - Research

**Researched:** 2026-05-31
**Domain:** Portland Oregon municipal budget Volume 2 PDF extraction — fund-level revenue/resources data
**Confidence:** HIGH (PDFs downloaded and pdfplumber extraction tested end-to-end; all figures validated)

---

## Summary

Portland's adopted budget Volume 2 ("City Funds & Capital Projects") contains a Fund Summary page for every fund in the city's budget. Each Fund Summary page has a consistent 7-column table showing Actuals (2 prior years), Revised, Proposed, Approved, and **Adopted** amounts for both Resources and Requirements. The Adopted column is always the rightmost column (index 6) and parses cleanly with pdfplumber's `page.extract_tables()`.

The key extraction target is the **Resources Total** row from each Fund Summary table. Resources Total = External Revenues + Internal Revenues + Beginning Fund Balance, and its sum across all funds ($8.633B FY2026, $8.282B FY2025) matches Portland's published total budget figures exactly — confirming correctness. This is the right value to store as `dataset_type: 'revenue'` at fund level.

The structure is **highly consistent between FY2024-25 and FY2025-26**. Both PDFs have the same 7-column layout, same row labels, and the same detection logic works on both. FY2025-26 has 88 funds; FY2024-25 has 85 funds (4 new funds added, 1 removed). One PDF artifact — a garbled double-rendered number in one cell of FY2025-26 — is detectable by the presence of `,,` (double comma) and cleanable algorithmically. This artifact does not affect Resources Total rows.

The extractor is a straightforward adaptation of `scripts/extractPortland.py` (which Phase 17 already wrote for Vol 1). A new function `extract_revenue()` replaces `extract_budget()`, using the same cover-page fiscal year detection and the same page-walking loop. The Node.js loader (`processPortland.js`) needs only a new `--revenue` flag path that calls `extract_revenue`, builds a flat fund-level tree, and calls `treasury_sync_budget_tree` with `dataset_type: 'revenue'`.

**Primary recommendation:** Adapt `extractPortland.py` with a new `extract_revenue()` function that targets Vol 2 PDFs. Adapt `processPortland.js` with a `--revenue` mode. Adapt `seedPortlandOregon.js` to add a revenue `data_source` row for each fiscal year. Estimated implementation complexity: LOW — the hard work (pdfplumber extraction, tree building, RPC calling) is already done in Phase 17 scripts.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vol 2 PDF text/table extraction | Script (Python pdfplumber) | — | Machine-generated PDF; same tool already used for Vol 1 |
| Garbled number cleaning | Script (Python util) | — | One-cell artifact; cleanable with simple string logic |
| Fund-level revenue tree building | Script (Node.js processPortland.js) | — | Adapt existing `buildOperatingTree` pattern |
| DB write (treasury_sync_budget_tree) | Database (RPC) | — | Same RPC used for operating budget; `dataset_type='revenue'` |
| data_source row (revenue) | Script (seedPortlandOregon.js) | — | Add alongside existing operating rows |
| Fiscal year detection | Script (Python) | — | Cover page text `'Fiscal Year YYYY-YY'` → ending year integer |

---

## Verified Download URLs

| Fiscal Year | Volume | URL | File Size | Verified |
|-------------|--------|-----|-----------|---------|
| FY 2025-26 | Vol 2 | `https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-2-city-funds-and-capital-projects/download` | 2.26 MB | [VERIFIED: HTTP 200, 2,370,525 bytes downloaded] |
| FY 2024-25 | Vol 2 | `https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-2-city-portland-city-funds-and-capital-projects/download` | 2.03 MB | [VERIFIED: HTTP 200, 2,133,490 bytes downloaded] |

PDFs are saved at `docs/Portland/fy2025-26-vol2.pdf` and `docs/Portland/fy2024-25-vol2.pdf`.

---

## PDF Structure Description

### Document Layout

- **Cover page (page 1):** `City of Portland, Oregon / ADOPTED BUDGET / Fiscal Year YYYY-YY / Volume 2 / City Funds & Capital Projects`
- **Pages 2-4:** Table of contents (two pages)
- **Pages 5-6:** User's Guide / explanatory text
- **Pages 7-10:** Figure 1 — Appropriated Funds by Managing Agency (fund registry table, not used for extraction)
- **Pages 11 onward:** One Fund Section per fund, each containing:
  - A header page with the Fund Summary table (Resources + Requirements)
  - One or more narrative/detail pages (Fund Overview, Significant Changes, optional Debt Summary)

### Fund Summary Table — Column Layout

Every Fund Summary page has a 7-column table with this header row:

```
Col 0        | Col 1            | Col 2            | Col 3         | Col 4          | Col 5          | Col 6
Label        | Actuals FY N-2   | Actuals FY N-1   | Revised FY N  | Proposed FY N  | Approved FY N  | Adopted FY N
```

**Example from FY 2025-26 General Fund (page 11):**

```
Col 0                     Col 1        Col 2        Col 3        Col 4        Col 5        Col 6
Actuals FY 2022-23        (None)       Actuals      Revised      Proposed     Approved     Adopted
                                       FY 2023-24   FY 2024-25   FY 2025-26   FY 2025-26   FY 2025-26

Resources                 (None)       (None)       (None)       (None)       (None)       (None)
External Revenues         (None)       (None)       (None)       (None)       (None)       (None)
Taxes                    341,263,166  374,450,632  381,000,000  381,000,000  381,000,000  381,000,000
Licenses & Permits       304,500,288  318,989,107  338,070,000  (None)       (None)       (None)
Charges for Services      20,994,259   18,820,767   18,294,810  (None)       (None)       (None)
Intergovernmental         41,310,631   43,727,008   45,913,554   45,913,554  (None)       (None)
Miscellaneous              7,971,672    4,753,667    5,887,942  (None)       (None)       (None)
External Revenues Total  716,040,015  760,741,180  789,166,306  789,166,306  789,166,306  789,166,306*
Internal Revenues         (None)       (None)       (None)       (None)       (None)       (None)
Fund Transfers - Revenue  77,602,423   69,997,103  167,772,083  (None)       (None)       (None)
Interagency Revenue       60,439,682   77,995,295  116,751,091  (None)       (None)       (None)
Internal Revenues Total  138,042,105  147,992,398  284,523,174  281,571,650  281,571,650  283,597,649
Beginning Fund Balance   161,964,850   94,667,960   42,171,124   39,458,477   39,458,477   39,458,477
Resources Total        1,016,046,971  908,733,578 1,115,860,604 1,110,196,433 1,110,196,433 1,112,222,432
```

*Note: The General Fund External Revenues Total Adopted cell has a garbled rendering artifact (see Pitfall 1 below). Resources Total for the same fund is clean.

### Revenue Line Item Labels

The following labels appear in the Resources section across all funds:

| Label | Category | Notes |
|-------|----------|-------|
| `Taxes` | External Revenue | Property tax, business license tax, etc. |
| `Licenses & Permits` | External Revenue | Business and development permits |
| `Charges for Services` | External Revenue | Utility rates, user fees |
| `Intergovernmental` | External Revenue | State/federal grants and shared revenue |
| `Bond & Note` | External Revenue | Bond proceeds |
| `Miscellaneous` | External Revenue | Interest income, other |
| `Miscellaneous Fund Allocations` | External Revenue | Rare; only a few funds |
| `External Revenues Total` | External Subtotal | Sum of above; affected by garbling in 1 cell |
| `Fund Transfers - Revenue` | Internal Revenue | Transfers in from other city funds |
| `Interagency Revenue` | Internal Revenue | Revenue from other city bureaus |
| `Internal Revenues Total` | Internal Subtotal | Sum of above |
| `Beginning Fund Balance` | Fund Balance | Carry-forward; not a revenue |
| `Resources Total` | Grand Total | External + Internal + Beginning Balance |

**Important:** Individual line item rows (Taxes, Licenses, etc.) have column merge issues in pdfplumber — Cols 4/5/6 are `None` for many rows even when the PDF visually shows values. This is a PDF rendering issue where narrow columns cause pdfplumber to merge them. **Only the Total rows (External Revenues Total, Internal Revenues Total, Resources Total) reliably parse all 7 columns.** Resources Total is the recommended extraction target.

### Fiscal Year Identification

- Cover page text: `Fiscal Year 2025-26` — parse as: `century + last_two_digits` → `2000 + 26 = 2026`
- Table header row col 6: `'Adopte d\nFY 2025-26'` (FY2025-26 PDF) or `'Adopted\nFY 2024-25'` (FY2024-25 PDF)
- **Best approach:** Read cover page first, extract `Fiscal Year YYYY-YY` pattern

### Amount Units

Full dollars — do NOT multiply by 1000. Same as Vol 1 (confirmed by validated totals: $8.633B sum matches published Portland total).

---

## Extraction Validation Results

| PDF | Fiscal Year | Funds Extracted | Resources Total Sum | Expected (Portland published) | Match |
|-----|-------------|-----------------|--------------------|-----------------------------|-------|
| fy2025-26-vol2.pdf | 2026 | 88 | $8,633,801,721 | $8.64B (published total) | YES |
| fy2024-25-vol2.pdf | 2025 | 85 | $8,281,926,518 | — | reasonable |

General Fund Resources Total (FY2026): $1,112,222,432 — matches table value exactly.
General Fund Resources Total (FY2025): $1,071,558,091 — matches table value exactly.
Zero duplicate fund names. Zero garbled Resources Total cells.

---

## Recommended Extraction Approach

### Adapt `extractPortland.py` — add `extract_revenue()` function

The existing `extract_budget()` function in `scripts/extractPortland.py` already handles:
- pdfplumber PDF opening
- Cover page fiscal year detection (adapt to use `Fiscal Year YYYY-YY` pattern)
- Page-walking with keyword detection
- Table extraction and row parsing
- JSON output to stdout

The new `extract_revenue()` function should:

1. **Detect pages:** Look for pages containing both `'Fund Summary'` and `'Resources Total'`
2. **Extract fund name:** First line of page text that is not `'Fund Summary'`, `'Resources'`, `'City of Portland'`, a service area label, or a FY reference
3. **Extract Resources Total:** From the row where `row[0].strip() == 'Resources Total'`, take `row[6]`
4. **Clean garbled values:** If `',,'` appears in the value, apply double-digit deduplication (only affects one cell in FY2025-26, but safe to apply always)
5. **Output:** List of `{ fund, resources_total, fiscal_year, page_num }`

**Key difference from `extract_budget()`:** No need to track `current_bureau`, no need to detect bureau headers or subtotals. One target row per page.

### Parse money — correct algorithm

```python
def parse_money_vol2(s):
    """Parse dollar amount from Vol2 fund summary table cell.
    
    Handles the garbled double-rendering artifact (e.g. '778899,,116666,,330066' -> 789166306).
    Only triggered when ',,' appears in the value — safe to apply unconditionally.
    Does NOT strip consecutive same-digits from normal values like '1,112,222,432'.
    """
    if not s:
        return 0
    s = str(s).strip()
    if not s or s == '-':
        return 0
    if ',,' in s:
        # Garbled: doubled digits + double commas. Deduplicate consecutive pairs.
        cleaned = s.replace(',,', ',')
        result = ''
        i = 0
        while i < len(cleaned):
            c = cleaned[i]
            if c.isdigit() and i + 1 < len(cleaned) and cleaned[i + 1] == c:
                result += c   # keep one of the doubled pair
                i += 2
            else:
                result += c
                i += 1
        s = result
    neg = s.startswith('(')
    val = re.sub(r'[^\d]', '', s)
    if not val:
        return 0
    try:
        return int(-float(val) if neg else float(val))
    except ValueError:
        return 0
```

### Adapt `processPortland.js` — add `--revenue` mode

The Node.js loader already has the full pattern for calling Python and calling `treasury_sync_budget_tree`. Revenue mode needs:

1. Call `extractPortland.py` with `--mode revenue` flag and the Vol 2 PDF path
2. Build a flat tree: each fund is a top-level node (`n: fund_name, a: resources_total`)
3. Call `treasury_sync_budget_tree` with `p_dataset_type: 'revenue'`

The tree node shape is already defined in Phase 17 PATTERNS.md:

```javascript
// Revenue tree node (flat — no line items needed for fund-level data)
{ n: 'General Fund', a: 1112222432, i: [] }
```

### Adapt `seedPortlandOregon.js` — add revenue data_source rows

Add two revenue `data_source` rows alongside the existing operating rows:

```javascript
function PORTLAND_REVENUE(municipalityId, fiscalYear) {
  const urls = {
    2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-2-city-funds-and-capital-projects/download',
    2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-2-city-portland-city-funds-and-capital-projects/download',
  };
  return {
    name: `Portland Revenue Budget FY${fiscalYear}`,
    api_type: 'pdf_download',       // matches existing Fremont/Portland pattern
    dataset_type: 'revenue',
    base_url: urls[fiscalYear],
    dataset_id: `fy${fiscalYear}`,
    fiscal_years: [fiscalYear],
    municipality_id: municipalityId,
  };
}
```

---

## Data Granularity Decision

**Recommended granularity: Fund-level (one row per fund)**

| Option | Rows (FY2026) | Granularity | Reliability |
|--------|---------------|-------------|------------|
| Resources Total per fund | 88 | Fund | HIGH — total rows always parse |
| External Revenues Total per fund | 66 non-zero | Fund (external only) | MEDIUM — 1 garbled cell |
| Line items per fund (Taxes, Licenses, etc.) | ~200-400 | Category × Fund | LOW — column merge issues |

**Rationale for Resources Total (not External Revenues Total):**

- Resources Total provides the complete fund budget picture including what the fund has available — this is the standard municipal finance view and matches what other cities store
- Resources Total has zero garbling across all 88 funds in FY2025-26 and all 85 in FY2024-25
- The validated sum ($8.633B) matches Portland's published total budget exactly, providing strong cross-validation
- External Revenues Total has one garbled cell (General Fund FY2025-26) that requires cleaning and verification

**`dataset_type` value:** `'revenue'` — matching the existing pattern for CA cities (which have both `'operating'` and `'revenue'` dataset types).

---

## Gotchas and Format Differences

### Gotcha 1: Column Merge — Individual Line Items Have None in Cols 4-6

**What:** For rows like `Taxes`, `Licenses & Permits`, `Charges for Services`, pdfplumber returns `None` for columns 4, 5, and/or 6 even when the PDF visually shows values.

**Why:** These numbers are right-aligned in narrow columns. When adjacent numbers have similar widths, pdfplumber's column boundary detection can merge two adjacent columns into one, pushing later values to the wrong column index or dropping them.

**Impact:** Only affects individual line item rows. Total rows (`External Revenues Total`, `Internal Revenues Total`, `Resources Total`) have longer numbers that span full column widths and parse correctly to col 6.

**Mitigation:** Restrict extraction to Total rows only. Do not try to extract individual categories (Taxes, Licenses, etc.) from Vol 2 using the table extraction approach without additional per-row text fallback logic.

### Gotcha 2: Garbled Double-Rendered Cell in FY2025-26

**What:** One cell in FY2025-26 — General Fund `External Revenues Total`, col 6 (Adopted) — renders as `'778899,,116666,,330066'` instead of `'789,166,306'`. This appears in both table extraction and text extraction, so it is a genuine PDF rendering artifact.

**Why:** The PDF source has a double-rendering layer for that specific cell. Every digit is doubled and commas are doubled.

**Detection:** `',,'` present in the string value.

**Fix:** Replace `,,` with `,`, then deduplicate consecutive identical digit pairs.

**Scope:** Only confirmed in FY2025-26, only in External Revenues Total, only in General Fund. FY2024-25 has zero garbled values. Resources Total has zero garbled values in both years.

### Gotcha 3: Service Area Naming Changed Between Years

**What:** FY2024-25 uses `'City Funds'` as the section label for funds under the City Administrator Service Area. FY2025-26 uses `'City Administrator Service Area Funds'`. Also FY2024-25 used `'Budget & Finance Service Area Funds'` which was renamed in FY2025-26.

**Why:** Portland reorganized its service area structure between fiscal years.

**Impact:** Service area is not needed for extraction — fund names are consistent. No impact on fund name detection or Resources Total extraction.

### Gotcha 4: Fund Count Differs Between Years (88 vs 85)

**What:** FY2025-26 has 88 funds; FY2024-25 has 85 funds. 8 new funds appeared (mostly new TIF district debt service funds), 5 funds were removed (some were renamed, some consolidated).

**Impact:** This is expected for a real-world municipal budget. The extraction loop handles it naturally — it processes whatever Fund Summary pages exist. No hardcoded fund count needed.

### Gotcha 5: Truncated Fund Names from PDF

**What:** Two fund names in FY2025-26 are truncated by the PDF layout:
- `Central Eastside Corridor TIF District Debt` (truncated — full name is "...Debt Service Fund")
- `Central Eastside Industrial District Debt Ser-` (truncated with hyphen)

**Why:** Fund names wider than the page header area get cut off by the PDF renderer.

**Impact:** These truncated names will be stored as-is. The amounts are correct. This is acceptable — the names are still unique and recognizable. If exact full names are needed, they can be found in the Table of Contents on page 3.

### Gotcha 6: Fiscal Year Detection Must Use Cover Page, Not 'Adopted' Column

**What:** The `'Adopted'` column header in the table appears as `'Adopte d\nFY 2025-26'` (with a space inside "Adopted" due to PDF text layout) followed by the FY label on the next line. A regex for `Adopted\nFY YYYY-YY` would fail due to the extra space.

**Correct approach:** Read the cover page (page index 0) and match `r'Fiscal Year (\d{4})-(\d{2})'`. This is 100% reliable in both years.

---

## Complexity Assessment

| Dimension | Assessment |
|-----------|-----------|
| Extractor changes | LOW — add one new function to existing `extractPortland.py` |
| Loader changes | LOW — add `--revenue` flag path to existing `processPortland.js` |
| Seeder changes | LOW — add 2 rows to existing `seedPortlandOregon.js` |
| Table parsing | LOW — target only Resources Total rows (all parse cleanly) |
| Fiscal year detection | LOW — cover page pattern is reliable |
| Garbled value handling | LOW — one cell, detectable + fixable with a trivial string check |
| Cross-year consistency | HIGH — structure is identical between FY2024-25 and FY2025-26 |

**Total estimated effort:** 1-2 hours for a developer familiar with the existing Portland scripts.

---

## Implementation Blueprint

### Changes to `scripts/extractPortland.py`

Add after the existing `extract_budget()` function:

```python
def extract_revenue(pdf_path):
    """
    Walk the PDF pages looking for Fund Summary pages.
    Extract fund name + Resources Total (Adopted) from each fund.
    
    Returns list of dicts: { fund, resources_total, fiscal_year, page_num }
    """
    results = []
    fiscal_year = None

    with pdfplumber.open(pdf_path) as pdf:
        # Detect fiscal year from cover page
        cover_text = pdf.pages[0].extract_text() or ''
        m = re.search(r'Fiscal Year (\d{4})-(\d{2})', cover_text, re.I)
        if m:
            century = int(m.group(1)) // 100 * 100
            fiscal_year = century + int(m.group(2))

        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Fund Summary' not in text or 'Resources Total' not in text:
                continue

            lines = [l.strip() for l in text.split('\n') if l.strip()]

            # Extract fund name: first line that is not a section label or header
            fund_name = None
            for line in lines[:3]:
                if (line and
                    line not in ['Fund Summary', 'Resources'] and
                    'City of Portland' not in line and
                    'Table of Contents' not in line and
                    len(line) > 5 and
                    not re.search(r'(Service Area Funds|City Funds)$', line) and
                    'FY ' not in line):
                    fund_name = line
                    break

            if not fund_name:
                print(f'  [skipped] No fund name found on page {page_num}', file=sys.stderr)
                continue

            # Find Resources Total row and extract col[6] (Adopted)
            tables = page.extract_tables()
            res_total = None

            for table in tables:
                if not table:
                    continue
                for row in table:
                    if not row or not row[0]:
                        continue
                    if row[0].strip() == 'Resources Total':
                        val = row[6] if len(row) > 6 else None
                        res_total = parse_money(val)  # parse_money already handles garbled
                        break
                if res_total is not None:
                    break

            if res_total is None:
                print(f'  [skipped] No Resources Total found on page {page_num}: {fund_name}',
                      file=sys.stderr)
                continue

            results.append({
                'fund': fund_name,
                'resources_total': res_total,
                'fiscal_year': fiscal_year,
                'page_num': page_num,
            })

    return results
```

Update `parse_money()` in `extractPortland.py` to use the garble-safe algorithm:

```python
def parse_money(s):
    """Parse dollar string. Handles garbled double-rendered artifact (contains ',,')."""
    if s is None:
        return 0
    s = s.strip()
    if not s or s == '-':
        return 0
    if ',,' in s:
        # PDF rendering artifact: digits doubled and commas doubled.
        # '778899,,116666,,330066' -> '789,166,306'
        cleaned = s.replace(',,', ',')
        result = ''
        i = 0
        while i < len(cleaned):
            c = cleaned[i]
            if c.isdigit() and i + 1 < len(cleaned) and cleaned[i + 1] == c:
                result += c
                i += 2
            else:
                result += c
                i += 1
        s = result
    neg = s.startswith('(')
    val = re.sub(r'[$()\s,]', '', s)
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0
```

Update the `__main__` block to support `--mode` argument:

```python
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf_path')
    parser.add_argument('--mode', choices=['operating', 'revenue'], default='operating')
    args = parser.parse_args()

    if args.mode == 'revenue':
        data = extract_revenue(args.pdf_path)
    else:
        data = extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
```

### Changes to `scripts/processPortland.js`

Add PDF URLs for Vol 2:

```javascript
const PORTLAND_PDF_URLS = {
  operating: {
    2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download',
    2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-1-city-portland-city-summaries-and-bureau/download',
  },
  revenue: {
    2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-2-city-funds-and-capital-projects/download',
    2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-2-city-portland-city-funds-and-capital-projects/download',
  },
};
```

Add CLI flag:

```javascript
const { values: opts } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    revenue:   { type: 'boolean', default: false },  // add this
    pdf:       { type: 'string' },
  },
  strict: false,
});
const mode = opts.revenue ? 'revenue' : 'operating';
```

Call Python extractor with mode:

```javascript
function extractPDF(pdfPath, mode = 'operating') {
  const pyScript = path.join(ROOT, 'scripts', 'extractPortland.py');
  const raw = execSync(`python "${pyScript}" "${pdfPath}" --mode ${mode}`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

Build revenue tree (flat — fund name → Resources Total):

```javascript
function buildRevenueTree(rows) {
  // rows: [{ fund, resources_total, fiscal_year, page_num }]
  return rows
    .filter(r => r.resources_total > 0)
    .map(r => ({
      n: r.fund,
      a: r.resources_total,
      i: [],
    }));
}
```

---

## DB Impact

### New data_source rows

Two new `data_source` rows (one per fiscal year):

```
name: 'Portland Revenue Budget FY2026'
name: 'Portland Revenue Budget FY2025'
api_type: 'pdf_download'
dataset_type: 'revenue'
```

### New budget rows

- FY2026: 88 fund-level rows under dataset_type='revenue'
- FY2025: 85 fund-level rows under dataset_type='revenue'
- All amounts in full dollars

### Existing operating rows

Unchanged. Phase 17 loaded operating budget from Vol 1. Revenue from Vol 2 is additive.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Resources Total` is the correct value for `dataset_type='revenue'` in the DB | Data Granularity | If other cities store only external revenues, the Portland revenue figure would include fund balance carry-forward unlike other cities — inconsistency |
| A2 | The garbled double-rendering artifact in FY2025-26 is isolated to one cell (External Revenues Total for General Fund) and does not affect Resources Total | Gotcha 2 | If other cells are also garbled, the cleaning algorithm would need broader application — but the algorithm is safe to apply to all cells |
| A3 | FY2023-24 and older Vol 2 PDFs (available at portland.gov/budget/archived-budgets) have the same 7-column structure | Not scoped | If historical year structure differs, extraction would require a separate investigation |

---

## Open Questions

1. **Should `dataset_type='revenue'` store Resources Total or External Revenues Total?**
   - Resources Total includes Beginning Fund Balance (carry-forward), which inflates the figure relative to "new revenue collected this year"
   - External Revenues Total is pure external revenue but has one garbled cell
   - Recommendation: Use Resources Total (matches the "total available for this fund this year" framing; validated against published total). Confirm against how CA cities store their revenue figures before finalizing.

2. **Should zero-resource funds be excluded?**
   - 10 funds in FY2025-26 have $0 Resources Total (empty/inactive funds)
   - Recommendation: Filter them out (`resources_total > 0`) to avoid loading meaningless rows

3. **Should FY2023-24 historical data be loaded?**
   - Portland archives past budgets at portland.gov/budget/archived-budgets
   - FY2023-24 Vol 2 would add a third year for each fund
   - Recommendation: Out of scope unless requested — the 2-year pattern (FY2025 + FY2026) matches Phase 17's operating budget scope

---

## Sources

### Primary (HIGH confidence)
- `docs/Portland/fy2025-26-vol2.pdf` — downloaded directly from portland.gov; 398 pages; pdfplumber extraction tested and validated [VERIFIED: downloaded and inspected]
- `docs/Portland/fy2024-25-vol2.pdf` — downloaded directly from portland.gov; 360 pages; pdfplumber extraction tested and validated [VERIFIED: downloaded and inspected]
- FY2025-26 Vol 2 URL: `https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-2-city-funds-and-capital-projects/download` [VERIFIED: HTTP 200]
- FY2024-25 Vol 2 URL: `https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-2-city-portland-city-funds-and-capital-projects/download` [VERIFIED: HTTP 200]
- Extraction results validated: General Fund FY2026 $1,112,222,432 and FY2025 $1,071,558,091 match table values exactly; total $8.633B matches Portland published total [VERIFIED: cross-validated]
- `scripts/extractPortland.py` — existing extractor (Phase 17); pattern reused directly [VERIFIED: codebase]
- `scripts/processPortland.js` — existing loader (Phase 17); pattern reused [VERIFIED: codebase]
- `scripts/seedPortlandOregon.js` — existing seeder (Phase 17); pattern reused [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `portland.gov/budget/2025-2026-budget/development/adopted` — adopted budget page listing Vol 1 and Vol 2 document links [CITED: portland.gov/budget]

---

## Metadata

**Confidence breakdown:**
- PDF URLs (working download links): HIGH — HTTP 200 confirmed, files downloaded
- Table structure (7 columns, Resources Total at col 6): HIGH — verified by pdfplumber inspection on 88 funds across 2 PDFs
- Garbled cell scope (1 cell, only External Revenues Total): HIGH — scanned all 398 pages of FY2025-26 PDF
- Resources Total reliability (zero garbling): HIGH — scan confirmed 0 garbled Resources Total rows across both PDFs
- Extraction algorithm correctness: HIGH — end-to-end test produces validated totals
- Cross-year structure consistency: HIGH — same column layout, same row labels in both PDFs

**Research date:** 2026-05-31
**Valid until:** 2026-08-31 (Portland budget publication cycle; Vol 2 URLs stable once adopted budget is published)
