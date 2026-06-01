# Phase 22: Troutdale OR Budget Load - Research

**Researched:** 2026-06-01
**Domain:** Troutdale OR municipal budget — PDF extraction from troutdaleoregon.gov, operating + revenue load
**Confidence:** HIGH (all 4 latest PDFs downloaded and parsed live in this session; structure fully verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Revenue Scope:** Attempt to fold both operating and revenue into Phase 22 in a single phase (Troutdale is small — likely simpler than Gresham). If revenue format turns out to be significantly harder than expected, fallback: ship operating only and note revenue as a follow-up phase. Do not block the phase on revenue.

**D-02 — FY Depth:** Researcher determines what fiscal years are available and have consistent PDF format. Default to loading as many years as possible (maximize historical depth). If the PDF format changed at some point in history, load only the post-format-change years — do not build a multi-format extractor for earlier formats.

**D-03 — Phase 23 Readiness:** Researcher assesses whether Troutdale's adopted budget PDF contains the same "Resources and Requirements — All Funds" page as Gresham/Portland. If yes, and if adding All Funds Requirements extraction adds only minimal complexity, recommend folding into Phase 22. If significant complexity, defer to Phase 23.

### Claude's Discretion

None explicitly stated (discussion stayed within phase scope).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 22 loads Troutdale, OR operating budget and revenue (Money In) data from the city's adopted budget PDFs. Troutdale is a small city (~15,749 Census 2024 population, not ~17,000 as estimated in CONTEXT.md) with 8 fiscal years of PDF budgets available at `troutdaleoregon.gov/media/{ID}` (FY2018-19 through FY2025-26), all confirmed live.

**Critical structural difference from Gresham:** Troutdale's PDF format is fund-by-fund, not a single "All Funds" summary page. The equivalent summary is labeled "CITY-WIDE FUND SUMMARY ALL FUNDS COMBINED" — but its Requirements section lists **category-level rows** (Personnel Services, Materials & Services, Capital Outlay, etc.), not department rows like Gresham. For department-level operating data, the extractor must target the **General Fund page** (ACCOUNT 01.00), which lists 17 departments (LEGISLATIVE, JUDICIAL, LEGAL, EXECUTIVE, POLICE OPERATIONS, FIRE PROTECTION SERVICES, etc.) as Requirements rows.

Revenue extraction uses the same All Funds Combined page — the Resources section lists 10 revenue categories (PROPERTY TAXES, OTHER TAXES, REVENUE FROM OTHER AGENCIES, etc.) with consistent format across all verified years. Both operating and revenue can be extracted in a single phase.

The implementation follows the Gresham template (`extractGresham.py` / `processGresham.js`) closely, with three key adaptations: (1) fiscal year parsing uses `YYYY-YY` format instead of `YYYY/YY`, (2) operating extraction targets the General Fund page rather than the All Funds page, and (3) several subtotal rows (PUBLIC SAFETY, COMMUNITY DEVELOPMENT, PARKS & FACILITIES, and a second FINANCE row) must be excluded. The `extract_tables()` method returns empty on both pages — text-line parsing is required, same as Gresham.

**Primary recommendation:** Create `extractTroutdale.py` + `processTroutdale.js` + `seedTroutdaleOregon.js` following the Gresham pattern, with FY2022-23 through FY2025-26 as the initial load (4 years, consistent format verified). Load operating and revenue in the same phase. Defer All Funds Requirements (D-03) to Phase 23 — it adds non-trivial complexity and Phase 23 already scopes this work.

---

## D-01 Assessment: Revenue Foldability

**Conclusion: YES — fold revenue into Phase 22.**

Troutdale's revenue is simpler than Gresham's Phase 21 situation. The Resources section of the All Funds Combined page has 10 categories: PROPERTY TAXES, OTHER TAXES, REVENUE FROM OTHER AGENCIES, LICENSES & PERMITS, FINES & FORFEITURES, CHARGES FOR CURRENT SERVICES, FRANCHISE FEES, RENT & INTEREST INCOME, OTHER INCOME, TRANSFERS FROM OTHER FUNDS. The section marker is a simple `'RESOURCES'` / `'REQUIREMENTS'` flip. No OCR name artifacts were found in the verified years. This is effectively the same implementation as Gresham Phase 21, already proven to be straightforward.

Revenue totals [VERIFIED: live pdfplumber extraction in this session]:
- FY2023: ~$28.2M (10 categories, excl Beginning Balance)
- FY2024: ~$31.4M (10 categories, excl Beginning Balance)
- FY2025: ~$30.3M (10 categories, excl Beginning Balance)
- FY2026: ~$33.7M (10 categories, excl Beginning Balance)

## D-02 Assessment: FY Depth

**Conclusion: Load FY2022-23 through FY2025-26 (4 years). Older years are available but unverified.**

[VERIFIED: live pdfplumber extraction in this session] FY2022-23, FY2023-24, FY2024-25, FY2025-26 all have identical structure (General Fund page at ~page 40-41, All Funds Combined at ~page 32-33, same column headers, same section markers). Format confirmed consistent across all 4.

FY2018-19 through FY2021-22 PDFs are available at confirmed-live URLs but were not downloaded and parsed in this session. Per D-02: default to loading as many years as possible, but do not build multi-format extractor for older formats. Recommendation: attempt all 8 PDFs with a single extractor; if older PDFs extract successfully in dry-run, include them. If format changed (e.g., older PDFs use a different page structure), load only the post-2022 PDFs. The plan should use dynamic readdir() discovery so older PDFs are tried automatically.

## D-03 Assessment: All Funds Requirements Extraction

**Conclusion: DEFER to Phase 23. Do not fold into Phase 22.**

Troutdale's All Funds Combined page does NOT have a direct equivalent to Gresham's department-level Requirements section. Instead, Troutdale's Requirements section on the All Funds page lists **expenditure categories** (Personnel Services, Materials & Services, Capital Outlay, Debt Service, Transfers, Contingency, Reserve, Unappropriated) — not departments. This means:

1. Phase 23's Portland/Gresham pattern ("flip section gating from `in_resources` to `in_requirements` on the same page") would produce category-level data for Troutdale, not department-level.
2. Troutdale's `all_funds_requirements` would be a different shape from Portland/Gresham's.
3. This adds complexity to both Phase 22 extractor design and Phase 23 consistency logic.

The scope mismatch issue still exists for Troutdale: the Budget tab will show General Fund departments (~$21M for FY2026) while the Money In tab shows all-funds revenue (~$33.7M). Addressing this properly belongs in Phase 23 where the All Funds consistency approach can be designed holistically across all three OR cities.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF download (8 FYs) | Script task (curl/wget) | — | Same pattern as Gresham; docs/ is gitignored |
| Operating extraction (General Fund departments) | Script (Python pdfplumber) | — | text-line parsing on GF Fund Summary page; same technique as Gresham |
| Revenue extraction (All Funds Resources) | Script (Python pdfplumber) | — | Resources section on All Funds Combined page; same technique as Gresham phase 21 |
| Fiscal year parsing (YYYY-YY format) | Script (extractTroutdale.py) | — | New parse_fy pattern; Troutdale uses dashes (2025-26) not slashes (2025/26) |
| Municipality seeder | Script (Node.js seedTroutdaleOregon.js) | — | Census pop 15,749; same upsert pattern as seedGreshamOregon.js |
| DB load (treasury_sync_budget_tree RPC) | Database (RPC) | Script (processTroutdale.js) | Same RPC used by all OR cities |
| Population update | Script (loadORPopulation.js) | — | Add Troutdale FIPS 74850 + pop 15,749 — two-constant edit |
| Enrichment | Script (enrichCategories.js) | — | Reuse as-is; `--city Troutdale --state OR` |
| UI display | Frontend (App.tsx auto-discovery) | — | Money In tab appears automatically; no frontend changes needed |

---

## Standard Stack

### No New Packages Required

| Tool | Status | Purpose |
|------|--------|---------|
| pdfplumber | Already installed (Python 3.14, pdfplumber 0.11.9) | PDF text-line parsing |
| @supabase/supabase-js | Already installed | DB writes via RPC |
| node:util parseArgs | Node.js built-in | CLI flag parsing |
| node:child_process spawnSync | Node.js built-in | Python extractor invocation |

**No package legitimacy audit needed** — no new packages being installed.

---

## Package Legitimacy Audit

No new packages required. All dependencies are already installed and in use by Gresham and Portland scripts.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Data Source Details

### PDF Availability [VERIFIED: HTTP 200 curl checks in this session]

| Fiscal Year | Media ID | Filename (from Content-Disposition) | Size | Status |
|-------------|---------|--------------------------------------|------|--------|
| FY2025-26 | 31436 | `adopted_city_budget_fy_2025-2026.pdf` | 2.74 MB | ✓ Live |
| FY2024-25 | 26636 | `adopted_city_budget_fy_2024-2025.pdf` | 2.24 MB | ✓ Live |
| FY2023-24 | 15016 | `adopted_city_budget_fy_2023-2024.pdf` | 2.60 MB | ✓ Live |
| FY2022-23 | 15021 | `adopted_city_budget_fy_2022-2023.pdf` | 2.58 MB | ✓ Live |
| FY2021-22 | 15026 | `adopted_city_budget_fy_2021-2022.pdf` | 3.22 MB | ✓ Live |
| FY2020-21 | 15031 | (filename present) | 2.56 MB | ✓ Live |
| FY2019-20 | 15036 | (filename from header) | 2.18 MB | ✓ Live |
| FY2018-19 | 15041 | `adopted_city_budget_2018-19.pdf` | 3.71 MB | ✓ Live |

**Source:** `https://www.troutdaleoregon.gov/finance/page/city-budgetacfr` [VERIFIED: page fetched in this session]

**URL pattern:** `https://www.troutdaleoregon.gov/media/{ID}` — hardcode IDs in PDF_URLS dict (no predictable filename pattern in URL path; filenames are only in Content-Disposition).

### Population [VERIFIED: Census sub-est2024_41.csv downloaded in this session]

- **Population:** 15,749 (POPESTIMATE2024, SUMLEV=162, "Troutdale city")
- **FIPS:** State 41, Place 74850
- **Note:** CONTEXT.md said "~17,000 pop" — the actual Census 2024 figure is 15,749.

---

## Architecture Patterns

### System Architecture Diagram

```
Download PDFs (curl) → docs/Troutdale/fy2022-23.pdf ... fy2025-26.pdf
  │
  └─► extractTroutdale.py
        ├── extract_budget(pdf_path)
        │     Finds page: 'GENERAL FUND' + 'FUND SUMMARY' + 'ACCOUNT 01.00'
        │     Parses FY from header: YYYY-YY format → parse_fy_from_header_dash()
        │     Captures: Requirements section, 17 department rows
        │     Skips: subtotals (PUBLIC SAFETY, COMMUNITY DEVELOPMENT, PARKS & FACILITIES)
        │             second FINANCE row, TRANSFERS, CONTINGENCY, UNAPPROPRIATED, OTHER
        │     Dollar sign handling: first num token may be '$' prefix
        │     Output: { department, adopted_amount, fiscal_year, page_num }
        │
        └── extract_revenue(pdf_path)
              Finds page: 'ALL FUNDS COMBINED' + 'FUND SUMMARY'
              Parses FY from header: same YYYY-YY parse function
              Captures: Resources section, 10 revenue category rows
              Skips: BEGINNING FUND BALANCE, TOTAL RESOURCES
              Output: { category, adopted_amount, fiscal_year, page_num }

  └─► processTroutdale.js
        ├── --mode operating  → buildOperatingTree() → treasury_sync_budget_tree(dataset_type='operating')
        └── --revenue / --mode revenue → buildRevenueTree() → treasury_sync_budget_tree(dataset_type='revenue')
        upsertDataSource() with 4-column lookup (municipality_id, api_type, dataset_id, dataset_type)
        resolvePdfDir() → docs/Troutdale/ (worktree-safe)

  └─► seedTroutdaleOregon.js
        Upsert municipality: name='Troutdale', state='OR', population=15749, population_year=2024

  └─► loadORPopulation.js (edit)
        Add 'Troutdale' to EXPECTED_CITIES
        Add Troutdale: 15749 to KNOWN_VALUES

  └─► enrichCategories.js --city Troutdale --state OR --year 2026
        Reuse as-is; no changes needed
```

### Recommended Project Structure

```
scripts/
├── extractTroutdale.py     # NEW — copy extractGresham.py, adapt for Troutdale page structure
├── processTroutdale.js     # NEW — copy processGresham.js, adapt PDF_URLS and extractor call
├── seedTroutdaleOregon.js  # NEW — copy seedGreshamOregon.js, change to Troutdale constants
└── loadORPopulation.js     # EDIT — add Troutdale to EXPECTED_CITIES + KNOWN_VALUES

docs/
└── Troutdale/              # gitignored (docs/ in .gitignore)
    ├── fy2022-23.pdf
    ├── fy2023-24.pdf
    ├── fy2024-25.pdf
    └── fy2025-26.pdf
```

### Pattern 1: General Fund Department Extraction (TROUTDALE-SPECIFIC)

**What:** Target the "GENERAL FUND / FUND SUMMARY / ACCOUNT 01.00" page (not the All Funds page)
for department-level operating budget data.
**When to use:** Troutdale operating budget extraction only.
**Key difference from Gresham:** Gresham's All Funds page has department rows in Requirements; Troutdale's does not.

```python
# Source: live pdfplumber extraction from docs/Troutdale/fy2025-26.pdf in this session
SKIP_ROWS = {
    # Totals
    'TOTAL REQUIREMENTS', 'APPROPRIATIONS:',
    # Non-operating / non-department categories
    'TRANSFERS', 'CONTINGENCY', 'UNAPPROPRIATED', 'OTHER',
    # Subtotal rows (composite of child rows — must NOT double-count)
    'PUBLIC SAFETY',           # = Police Ops + PD Building + Solid Waste
    'COMMUNITY DEVELOPMENT',   # = Planning + Tourism
    'PARKS & FACILITIES',      # = Parks & Greenways + Facilities
    # FINANCE: first row is Finance dept; second row is Finance+InfoSvcs subtotal
    # Handle via finance_count guard (see below)
}

def parse_fy_from_header(header_line):
    """
    Parse fiscal year from Troutdale header: '2022-23 2023-24 2024-25 2025-26 2025-26 2025-26'
    Returns ending year integer of the LAST pattern = Adopted column.
    e.g. 2025-26 -> 2026
    NOTE: Troutdale uses YYYY-YY (dashes), NOT YYYY/YY (slashes) like Gresham.
    """
    matches = re.findall(r'(\d{4})-(\d{2})(?!\d)', header_line)
    if not matches:
        return None
    last = matches[-1]
    century = (int(last[0]) // 100) * 100
    return century + int(last[1])

def extract_budget(pdf_path):
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            # Troutdale: target the General Fund page, not All Funds page
            if 'GENERAL FUND' not in text or 'FUND SUMMARY' not in text:
                continue
            if 'ACCOUNT 01.00' not in text:
                continue  # Skip other fund pages that say FUND SUMMARY
            fiscal_year = None
            lines = text.split('\n')
            for line in lines[:8]:
                fy = parse_fy_from_header(line)
                if fy:
                    fiscal_year = fy
                    break
            if not fiscal_year:
                continue
            in_requirements = False
            finance_count = 0
            for line in lines:
                s = line.strip()
                if re.sub(r'\s+', '', s) == 'REQUIREMENTS':
                    in_requirements = True
                    continue
                if not in_requirements:
                    continue
                tokens = s.split()
                if len(tokens) < 2:
                    continue
                # Tokenize: split name tokens from numeric tokens
                name_tokens, num_tokens, in_nums = [], [], False
                for t in tokens:
                    clean_t = re.sub(r'[\$,]', '', t)
                    if not in_nums and (re.match(r'^\d+$', clean_t) or t == '-'):
                        in_nums = True
                    (num_tokens if in_nums else name_tokens).append(t)
                if not name_tokens or len(num_tokens) < 6:
                    continue
                dept = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()
                if dept in SKIP_ROWS or dept.endswith(':'):
                    continue
                # Handle FINANCE duplication: first row = Finance dept, second = subtotal
                if dept == 'FINANCE':
                    finance_count += 1
                    if finance_count > 1:
                        continue  # Skip Finance+InfoSvcs subtotal
                # Parse adopted: last numeric token
                adopted_raw = re.sub(r'[\$,]', '', num_tokens[-1])
                try:
                    adopted = int(adopted_raw)
                except ValueError:
                    continue
                if adopted <= 0:
                    continue
                results.append({
                    'department': dept,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })
            if results:
                break
    return results
```

**Verified FY2026 output:** 17 departments, total $21,128,982

### Pattern 2: All Funds Resources Extraction (Revenue) [VERIFIED]

**What:** Extract revenue categories from the Resources section of the "CITY-WIDE FUND SUMMARY ALL FUNDS COMBINED" page.
**Page detection:** `'ALL FUNDS COMBINED' in text and 'FUND SUMMARY' in text` (distinct from General Fund page).

```python
# Source: live pdfplumber extraction from docs/Troutdale/*.pdf in this session
REVENUE_SKIP = {'BEGINNING FUND BALANCE', 'TOTAL RESOURCES'}
# Note: 'BEGINNING FUND BALANCE $' may appear with dollar sign — normalize in parsing

def extract_revenue(pdf_path):
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'ALL FUNDS COMBINED' not in text or 'FUND SUMMARY' not in text:
                continue
            # Skip General Fund page — it also contains FUND SUMMARY
            if 'ACCOUNT 01.00' in text:
                continue
            fiscal_year = None
            lines = text.split('\n')
            for line in lines[:8]:
                fy = parse_fy_from_header(line)  # same YYYY-YY function
                if fy:
                    fiscal_year = fy
                    break
            if not fiscal_year:
                continue
            in_resources = False
            for line in lines:
                s = line.strip()
                if s == 'RESOURCES':
                    in_resources = True
                    continue
                if s == 'REQUIREMENTS':
                    in_resources = False
                    continue
                if not in_resources:
                    continue
                # (same tokenization as extract_budget)
                tokens = s.split()
                name_tokens, num_tokens, in_nums = [], [], False
                for t in tokens:
                    clean_t = re.sub(r'[\$,]', '', t)
                    if not in_nums and (re.match(r'^\d+$', clean_t) or t == '-'):
                        in_nums = True
                    (num_tokens if in_nums else name_tokens).append(t)
                if not name_tokens or len(num_tokens) < 6:
                    continue
                category = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()
                if category in REVENUE_SKIP:
                    continue
                adopted_raw = re.sub(r'[\$,]', '', num_tokens[-1])
                try:
                    adopted = int(adopted_raw)
                except ValueError:
                    continue
                if adopted <= 0:
                    continue
                results.append({
                    'category': category,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })
            if results:
                break
    return results
```

**Verified revenue totals (10 categories each, excl Beginning Balance):**
- FY2023: ~$28.2M | FY2024: ~$31.4M | FY2025: ~$30.3M | FY2026: ~$33.7M

### Pattern 3: loadORPopulation.js Edit (Two-Constant Addition)

```javascript
// Source: scripts/loadORPopulation.js — same two-constant edit as Phase 20 (Gresham)

// BEFORE:
const EXPECTED_CITIES = ['Portland', 'Gresham'];
const KNOWN_VALUES = {
  Portland: 635749,
  Gresham: 111507,
};

// AFTER (Phase 22):
const EXPECTED_CITIES = ['Portland', 'Gresham', 'Troutdale'];
const KNOWN_VALUES = {
  Portland: 635749,
  Gresham: 111507,
  Troutdale: 15749,   // Census sub-est2024_41.csv, SUMLEV=162, "Troutdale city" (2024)
};
```

### Anti-Patterns to Avoid

- **Targeting All Funds page for operating extraction:** Troutdale's All Funds Requirements section has expenditure categories (Personnel, Materials), not departments. Use the General Fund page (ACCOUNT 01.00) for department-level operating data.
- **Using Gresham's `parse_fy_from_header` (slash format) for Troutdale:** Troutdale headers use `2025-26` (dash) not `2025/26` (slash). The Gresham regex `r'\d{4}/(?:\d{4}|\d{2})(?!\d)'` will return 0 matches on Troutdale PDFs.
- **Including Public Safety, Community Development, Parks & Facilities rows:** These are subtotals of child departments and will double-count if included. Verified: PUBLIC SAFETY = Police Ops + PD Building + Solid Waste.
- **Including both FINANCE rows:** The General Fund page has two FINANCE rows — the first is Finance dept only; the second is Finance+Information Services subtotal. Keep only the first.
- **Using extract_tables():** Returns empty on both the General Fund and All Funds Combined pages. Must use extract_text() + line parsing, same as Gresham.
- **Hardcoding population as 17,000:** Actual Census 2024 figure is 15,749 (not ~17,000 as in CONTEXT.md).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text parsing | Custom parser | pdfplumber extract_text() + line parsing (Gresham pattern) | Proven on Troutdale PDFs in this session |
| DB write | Custom SQL | treasury_sync_budget_tree RPC with dataset_type param | Same RPC used by all OR cities; idempotency built in |
| Revenue data_source lookup | Separate script | Extend processTroutdale.js with --revenue flag (Phase 21 pattern) | 4-column upsertDataSource lookup avoids dataset_id collision |
| Category enrichment | Custom AI pipeline | enrichCategories.js --city Troutdale --state OR | Fully reusable; no changes needed |
| Population loading | Manual DB update | loadORPopulation.js (two-constant edit) | Downloads Census CSV, validates against known values |

---

## Verified PDF Structure Details

### All Funds Combined Page [VERIFIED: live extraction in this session]

```
CITY-WIDE
FUND SUMMARY
ALL FUNDS COMBINED

                  Actual    Actual    Budget    Budget    Budget    Budget
                2022-23   2023-24   2024-25   2025-26   2025-26   2025-26

RESOURCES
BEGINNING FUND BALANCE  $  47,497,116  ...  $  47,497,116
PROPERTY TAXES              7,971,589  ...     7,971,589
OTHER TAXES                 1,825,869  ...     1,825,869
REVENUE FROM OTHER AGENCIES 4,200,835  ...     4,200,835
LICENSES & PERMITS             60,326  ...        60,326
FINES & FORFEITURES           150,000  ...       150,000
CHARGES FOR CURRENT SERVICES 11,363,390 ...  11,363,390
FRANCHISE FEES              1,872,409  ...     1,872,409
RENT & INTEREST INCOME        903,476  ...       903,476
OTHER INCOME                  110,745  ...       110,745
TRANSFERS FROM OTHER FUNDS  5,225,484  ...     5,225,484
TOTAL RESOURCES $          81,181,239  ...    81,181,239

REQUIREMENTS
PERSONNEL SERVICES $       10,471,317  ...    10,471,317
MATERIALS & SERVICES       18,184,926  ...    18,184,926
CAPITAL OUTLAY             13,170,729  ...    13,170,729
DEBT SERVICE                  774,000  ...       774,000
TRANSFERS TO OTHER FUNDS    5,125,484  ...     5,125,484
CONTINGENCY                19,958,707  ...    19,958,707
RESERVE FOR FUTURE EXPENDITURE    -    ...             -
UNAPPROPRIATED             13,496,075  ...    13,496,075
TOTAL REQUIREMENTS $       81,181,239  ...    81,181,239
```

Page number varies by FY:
- FY2025-26: page 33
- FY2024-25: page 32
- FY2023-24: page 33
- FY2022-23: page 33

### General Fund Page (Operating) [VERIFIED: live extraction in this session]

FY2026 Requirements — 17 departments:
```
LEGISLATIVE:                   $35,149
JUDICAL [sic]:                $208,458   ← consistent OCR typo across years
LEGAL:                        $256,289
GENERAL GOVERNMENT:           $439,536
ADMINISTRATION:             $1,306,450
COMMUNITY SERVICES:           $321,981
EXECUTIVE:                  $2,567,863
INFORMATION SERVICES:         $449,232
FINANCE:                      $939,995   ← first FINANCE row = Finance dept
FINANCE: [SKIP]             $1,389,227   ← second = Finance+InfoSvcs subtotal
POLICE OPERATIONS:          $6,696,682
PD BUILDING OPERATIONS:       $144,786
SOLID WASTE/RECYCLING:         $80,085
PUBLIC SAFETY: [SKIP]       $6,921,553   ← subtotal of Police + PD Bldg + Solid Waste
FIRE PROTECTION SERVICES:   $3,230,030
PLANNING:                     $859,477
TOURISM & ECONOMIC DEVELOPMENT: $785,074
COMMUNITY DEVELOPMENT: [SKIP] $1,644,550 ← subtotal of Planning + Tourism
PARKS & GREENWAYS:          $1,876,853
FACILITIES:                   $931,042
PARKS & FACILITIES: [SKIP]  $2,807,895   ← subtotal of Parks + Facilities
TRANSFERS: [SKIP]
CONTINGENCY: [SKIP]
UNAPPROPRIATED: [SKIP]
OTHER: [SKIP]
```

Verified total (17 departments, FY2026): **$21,128,982**

Page number varies by FY:
- FY2025-26: page 41
- FY2024-25: page 40
- FY2023-24: page 41
- FY2022-23: page 40

---

## Common Pitfalls

### Pitfall 1: Wrong Source Page for Operating Data
**What goes wrong:** Extractor targets the All Funds Combined page for operating/department data. The Requirements section there has expenditure categories (Personnel, Materials) — not departments — yielding 7 rows instead of 17 departments.
**Why it happens:** Gresham's All Funds page has departments in Requirements; Troutdale's does not. Direct copy of Gresham extractor page detection will land on the wrong page.
**How to avoid:** Detect the General Fund page with `'GENERAL FUND' in text and 'ACCOUNT 01.00' in text`. Add guard in extract_revenue to exclude pages with 'ACCOUNT 01.00'.
**Warning signs:** Dry-run shows 7-8 rows with names like "PERSONNEL SERVICES", "MATERIALS & SERVICES".

### Pitfall 2: Subtotal Row Double-Counting
**What goes wrong:** PUBLIC SAFETY, COMMUNITY DEVELOPMENT, PARKS & FACILITIES, and the second FINANCE row are included, doubling portions of the total.
**Why it happens:** These rows appear in the Requirements section, have 6+ numeric columns, and pass the standard filter. They are not labeled as totals.
**How to avoid:** Hard-code them in SKIP_ROWS. Track FINANCE count and skip after the first.
**Warning signs:** Dry-run total is ~$30M+ (much higher than expected ~$21M for FY2026); totals don't match LB-1 form appropriations ($22.5M).

### Pitfall 3: Wrong Fiscal Year Parsing
**What goes wrong:** Using Gresham's slash-based regex (`\d{4}/\d{2}`) on Troutdale headers returns no matches; fiscal_year is None.
**Why it happens:** Troutdale uses `2025-26` (dash) not `2025/26` (slash).
**How to avoid:** Use `re.findall(r'(\d{4})-(\d{2})(?!\d)', header_line)` in parse_fy_from_header.
**Warning signs:** `WARNING: Could not parse fiscal year on page X` for every page; all rows have fiscal_year=None.

### Pitfall 4: Dollar Sign in First Number Token
**What goes wrong:** `BEGINNING FUND BALANCE $ 47,497,116` — the `$` token is treated as a name token, and the numeric split fails.
**Why it happens:** Troutdale format includes standalone `$` between name and first number on some rows. Gresham's format places `$` as part of the first number or omits it.
**How to avoid:** In the token clean function, use `re.sub(r'[\$,]', '', t)` to strip dollar signs before checking if a token is numeric. Also add `or t == '$'` to start-of-nums detection.
**Warning signs:** BEGINNING FUND BALANCE / TOTAL RESOURCES rows show in the Resources section output with wrong amounts; some rows have 5 instead of 6 numeric tokens.

### Pitfall 5: Revenue Total Including Beginning Fund Balance
**What goes wrong:** Revenue total for FY2026 is ~$81M instead of ~$33.7M.
**Why it happens:** Beginning Fund Balance ($47.5M) is in the Resources section and has 6 numeric columns.
**How to avoid:** Add "BEGINNING FUND BALANCE" to REVENUE_SKIP. Also add "BEGINNING FUND BALANCE $" (with dollar sign) as the parsed name may include the `$` token.
**Warning signs:** Revenue total matches Total Resources ($81M) rather than sum of revenue categories.

### Pitfall 6: All Funds Combined vs General Fund Page Confusion
**What goes wrong:** extract_revenue targets the General Fund page, which also has a RESOURCES section.
**Why it happens:** The General Fund Fund Summary page also has a RESOURCES section. Without a guard, it may be processed as an All Funds page.
**How to avoid:** Add `if 'ACCOUNT 01.00' in text: continue` guard in extract_revenue to skip General Fund pages.
**Warning signs:** Revenue extraction finds only General Fund resources (~$17.5M for FY2026) instead of All Funds resources (~$33.7M).

---

## Data Validation Reference

### Expected Operating Totals (17 departments, General Fund)

| FY | Total (Appropriated Departments) | Dept Count |
|----|----------------------------------|------------|
| FY2023 | ~$17.2M | 17 |
| FY2024 | ~$18.5M | 17 |
| FY2025 | ~$18.8M | 17 |
| FY2026 | ~$21.1M | 17 |

**Sanity cap:** SANITY_MAX should be set to $30M for FY2026 (operating only). This differs from Gresham's $500M cap — Troutdale is a small city.

### Expected Revenue Totals (10 categories, excl Beginning Balance)

| FY | Revenue Total (excl BB) | Category Count |
|----|------------------------|----------------|
| FY2023 | ~$28.2M | 10 |
| FY2024 | ~$31.4M | 10 |
| FY2025 | ~$30.3M | 10 |
| FY2026 | ~$33.7M | 10 |

**Revenue sanity:** Do NOT apply SANITY_MAX to revenue mode (total Resources including Beginning Balance is $81M — legitimately large but that's all funds, not revenue).

---

## data_source Rows to Create

### Operating (to be created by processTroutdale.js)

| name | dataset_type | dataset_id | api_type |
|------|-------------|------------|----------|
| Troutdale Operating Budget FY2023 | operating | fy2023 | pdf_download |
| Troutdale Operating Budget FY2024 | operating | fy2024 | pdf_download |
| Troutdale Operating Budget FY2025 | operating | fy2025 | pdf_download |
| Troutdale Operating Budget FY2026 | operating | fy2026 | pdf_download |

### Revenue (to be created by processTroutdale.js --revenue)

| name | dataset_type | dataset_id | api_type |
|------|-------------|------------|----------|
| Troutdale Revenue Budget FY2023 | revenue | fy2023 | pdf_download |
| Troutdale Revenue Budget FY2024 | revenue | fy2024 | pdf_download |
| Troutdale Revenue Budget FY2025 | revenue | fy2025 | pdf_download |
| Troutdale Revenue Budget FY2026 | revenue | fy2026 | pdf_download |

---

## Enrichment Decision

Troutdale's operating departments are: LEGISLATIVE, JUDICAL, LEGAL, GENERAL GOVERNMENT, ADMINISTRATION, COMMUNITY SERVICES, EXECUTIVE, INFORMATION SERVICES, FINANCE, POLICE OPERATIONS, PD BUILDING OPERATIONS, SOLID WASTE/RECYCLING, FIRE PROTECTION SERVICES, PLANNING, TOURISM & ECONOMIC DEVELOPMENT, PARKS & GREENWAYS, FACILITIES.

Most are self-explanatory. Opaque ones worth enriching:
- **GENERAL GOVERNMENT** — what spending is captured here?
- **EXECUTIVE** — the largest General Fund dept at $2.6M, but what does it include?
- **COMMUNITY SERVICES** — ambiguous
- **PD BUILDING OPERATIONS** — citizens may not know this is the police facility landlord cost

Revenue categories (PROPERTY TAXES, OTHER TAXES, etc.) are plain English — enrichment value is LOW, same conclusion as Gresham Phase 21. Run dry-run first; skip if output adds no citizen value.

**Cost estimate:** 17 operating categories × ~$0.001 = ~$0.017; 10 revenue categories × ~$0.001 = ~$0.01. Well under $5 threshold.

---

## Runtime State Inventory

No runtime state to migrate. Phase 22 creates new DB rows — no existing Troutdale data in the DB (verified: STATE.md shows OR cities = Portland + Gresham only). No rename/refactor involved.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | extractTroutdale.py | ✓ | 3.14.3 | — |
| pdfplumber | extractTroutdale.py | ✓ | 0.11.5 | — |
| Node.js | processTroutdale.js | ✓ (implied by existing scripts) | — | — |
| @supabase/supabase-js | processTroutdale.js | ✓ (installed) | — | — |
| SUPABASE_SERVICE_KEY | processTroutdale.js | ✓ (.env present) | — | — |
| ANTHROPIC_API_KEY | enrichCategories.js | ✓ (.env present) | — | — |
| docs/Troutdale/*.pdf | extractTroutdale.py | ✗ (not yet downloaded) | — | Wave 0 task: download 4+ PDFs |
| Internet access (troutdaleoregon.gov) | PDF download | ✓ (verified in this session) | — | — |

**Missing dependencies with no fallback:**
- PDFs not yet on disk — must be downloaded in Wave 0 / Plan 01 before extraction.

---

## Validation Architecture

Nyquist validation not applicable (data pipeline phase). Validation via dry-run + DB verification queries.

**Operating dry-run:**
```bash
node scripts/processTroutdale.js --dry-run
```
Expected: 4 PDFs processed; FY2026 shows 17 departments, ~$21.1M total.

**Revenue dry-run:**
```bash
node scripts/processTroutdale.js --revenue --dry-run
```
Expected: 4 PDFs processed; FY2026 shows 10 categories, ~$33.7M total.

**Post-load DB verification:**
```sql
-- Check operating rows exist
SELECT fiscal_year, dataset_type, total_budget, row_count
FROM treasury.budgets b
JOIN treasury.data_sources ds ON b.data_source_id = ds.id
JOIN treasury.municipalities m ON ds.municipality_id = m.id
WHERE m.name = 'Troutdale' AND m.state = 'OR'
ORDER BY fiscal_year, dataset_type;

-- Verify no operating/revenue data_source collision
SELECT name, dataset_type, dataset_id
FROM treasury.data_sources ds
JOIN treasury.municipalities m ON ds.municipality_id = m.id
WHERE m.name = 'Troutdale' AND m.state = 'OR'
ORDER BY dataset_type, name;
```

**UI verification:**
- Select Troutdale, OR in the app
- Confirm Troutdale appears in the OR state tile
- Confirm Budget tab shows 17 department rows, ~$21M for FY2026
- Confirm "Money In" tab appears automatically
- Confirm Money In shows 10 revenue category rows, ~$33.7M for FY2026

---

## Security Domain

No new security surface area. Same pattern as Gresham Phases 20–21:
- PDF paths from controlled `docs/Troutdale/` readdir (no user input)
- spawnSync with args array (no shell injection)
- maxBuffer 8MB
- SUPABASE_SERVICE_KEY from .env (existing auth pattern)
- Amount assertion gate on operating totals (SANITY_MAX, operating mode only)

ASVS categories: not applicable (data pipeline, no user input or auth surface).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FY2018-19 through FY2021-22 PDFs have the same General Fund + All Funds Combined page structure as FY2022-23 through FY2025-26 | D-02 Assessment | If older PDFs have different structure, the extractor will fail on them silently; dry-run step will catch this before live load |
| A2 | Enrichment adds low value for Troutdale's plain-English revenue categories | Enrichment Decision | If stakeholders want enriched descriptions for revenue categories, enrichment should be run |
| A3 | The second FINANCE row is always a Finance+InfoSvcs subtotal (not a separate Finance department) | Pattern 1 Code Example | [VERIFIED: 939,995 + 449,232 = 1,389,227 confirmed for FY2026]; LOW risk |

**High-risk assumptions:** None. All critical structural decisions were verified live.

---

## Open Questions

1. **Older FY PDFs (FY2018-19 through FY2021-22): consistent format?**
   - What we know: FY2022-23 through FY2025-26 confirmed consistent in this session.
   - What's unclear: Whether older PDFs have the same ACCOUNT 01.00 General Fund page structure.
   - Recommendation: In Plan 01, download all 8 PDFs and run dry-run against all. If older PDFs pass, include them. If they fail or produce unexpected results, include only the 4 confirmed years. This is a Wave 0 discovery task.

2. **Enrichment decision for operating departments:**
   - What we know: 17 departments; a few are opaque (GENERAL GOVERNMENT, EXECUTIVE, COMMUNITY SERVICES).
   - What's unclear: Whether enrichment will add meaningful citizen value beyond the department names.
   - Recommendation: Run `enrichCategories.js --dry-run` as part of the live load plan to assess output quality before committing.

---

## State of the Art

| Old Approach | Current Approach | Phase Changed | Impact |
|--------------|------------------|---------------|--------|
| All Funds page for operating (Gresham pattern) | General Fund page for operating (Troutdale-specific) | Phase 22 | Troutdale's All Funds has category-level not dept-level Requirements |
| YYYY/YY fiscal year parsing (Gresham/Portland) | YYYY-YY fiscal year parsing (Troutdale) | Phase 22 | New parse_fy_from_header function needed |
| All-cities population in separate loader | loadORPopulation.js two-constant edit (Phase 20 pattern) | Phase 20 | Add Troutdale to EXPECTED_CITIES + KNOWN_VALUES |

---

## Sources

### Primary (HIGH confidence)
- `docs/Troutdale/fy2025-26.pdf` — live pdfplumber extraction in this session; General Fund page (p.41) and All Funds Combined page (p.33) verified
- `docs/Troutdale/fy2024-25.pdf` — live pdfplumber extraction; All Funds Combined page (p.32) verified
- `docs/Troutdale/fy2023-24.pdf` — live pdfplumber extraction; All Funds Combined page (p.33) verified
- `docs/Troutdale/fy2022-23.pdf` — live pdfplumber extraction; General Fund page (p.40) and All Funds Combined page (p.33) verified
- Census sub-est2024_41.csv — downloaded in this session; Troutdale population 15,749 (SUMLEV=162, POPESTIMATE2024)
- `https://www.troutdaleoregon.gov/finance/page/city-budgetacfr` — fetched in this session; 8 budget PDFs listed with media IDs
- HTTP HEAD checks — all 8 media URLs confirmed HTTP 200 in this session
- `scripts/extractGresham.py` — codebase; template for extractTroutdale.py
- `scripts/processGresham.js` — codebase; template for processTroutdale.js
- `scripts/seedGreshamOregon.js` — codebase; template for seedTroutdaleOregon.js
- `scripts/loadORPopulation.js` — codebase; two-constant edit pattern

### Secondary (MEDIUM confidence)
- Phase 21 RESEARCH.md (`21-RESEARCH.md`) — Gresham revenue extraction pattern (extract_revenue, REVENUE_SKIP, NORMALIZE dict pattern)

### Tertiary (LOW confidence — ASSUMED)
- Enrichment adds low value for plain-English revenue categories [ASSUMED: reasonable judgment per Phase 21 precedent, not tested for Troutdale specifically]
- FY2018-19 through FY2021-22 PDFs have consistent structure with verified years [ASSUMED: unverified in this session]

---

## Metadata

**Confidence breakdown:**
- PDF structure and page layout: HIGH — live extracted from all 4 recent PDFs
- Operating extraction (General Fund page, 17 depts): HIGH — verified with correct totals
- Revenue extraction (All Funds Resources, 10 categories): HIGH — verified across all 4 FYs
- Fiscal year parsing (YYYY-YY format): HIGH — tested against all 4 headers
- Subtotal row identification (PUBLIC SAFETY etc.): HIGH — arithmetic confirmed
- Census population (15,749): HIGH — downloaded from authoritative source
- PDF URLs (media/{ID}): HIGH — HTTP 200 confirmed on all 8
- Older FY PDF structure compatibility: LOW — unverified in this session

**Research date:** 2026-06-01
**Valid until:** 2026-09-01 (PDF structure stable; no expected changes to Troutdale budget publication format)
