# Phase 33: CA State Budget Data — Research

**Researched:** 2026-06-07
**Domain:** California state budget data loading (LAO Excel, openpyxl, enrichCategories.js modification)
**Confidence:** HIGH

---

## Summary

Phase 33 seeds California as a `entity_type='state'` municipality, loads its General Fund operating budget from the LAO Historical Expenditures Excel file, and enriches the resulting categories with state-level policy framing. The infrastructure needed (DB constraint, TypeScript type, EntitySwitcher UI) was completed in Phase 32 — Phase 33 is a pure data phase.

The LAO Excel file is machine-readable and structurally clean. The "Pivot Table Data" worksheet is a flat, row-per-record table with 8 named columns. Filtering for `Fund = 'General Fund'` and the target fiscal year gives a clean set of rows. The `DOF Agency` column provides 12 natural top-level categories; the `Department` column provides the second level (up to ~205 unique entries). Phase 33 loads a 2-level tree (`DOF Agency -> Department`). Phase 35 will reload as a 3-level tree after Phase 34 adds the `department` column to `budget_line_items`.

One important correction to the roadmap figure: the `~212B` figure cited in ROADMAP.md and REQUIREMENTS.md was the January 2025 Governor's Budget proposal. The enacted 2025-26 Budget Act (what the LAO Excel reflects as of August 2025) totals **$228.4B General Fund**. The success criterion "~$212B range" should be updated to "~$228B range" for FY2025-26.

**Primary recommendation:** Download the LAO Excel file at phase start, inspect it via the Python snippet below to confirm the column structure has not changed, then build `extractCA.py` (openpyxl parser) + `processCA.js` (Node.js loader) following the same pattern as `processPortland.js`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Municipality seeding (CA state row) | Scripts (seeder) | Database | Same upsert pattern as all prior seeders |
| Data extraction (Excel parsing) | Scripts (Python) | — | openpyxl on the LAO .xlsx file |
| Data loading (RPC call) | Scripts (Node.js) | Supabase RPC | Same `treasury_sync_budget_tree` call as all existing loaders |
| AI enrichment | Scripts (enrichCategories.js) | Claude API | Existing pipeline; needs new `state` case in `buildEntityContext()` |
| Per-capita display | Frontend (App.tsx) | API | Already works — reads population from municipality row; no changes needed |
| Year selector | Frontend (App.tsx) | API | Already works — driven by budgets rows in DB; no changes needed |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | California seeded as `entity_type='state'` municipality (`name='California'`, `state='CA'`, `population=~39,500,000`) | DB CHECK constraint accepts 'state' (Phase 32 complete). Seeder follows `seedAnaheimSantaAnaCA.js` upsert pattern exactly. |
| DATA-02 | California General Fund budget (~$228B enacted) loaded for at least FY2024-25 and FY2025-26 via LAO Excel | LAO Excel confirmed: `https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx`. "Pivot Table Data" sheet, Fund='General Fund' filter. FY2024-25=233.6B, FY2025-26=228.4B. Amounts in thousands. |
| DATA-03 | CA state budget categories AI-enriched with state-level framing | `enrichCategories.js` already has `buildEntityContext()` switch; needs `'state'` case added. No `--entity-type state` CLI flag required — the entity_type is read from the DB municipality row and passed to `buildEntityContext()`. |
| DATA-04 | CA state budget page functional in live app — per-capita, year selector, Money Out tab | Per-capita: population on municipality row drives it automatically. Year selector: driven by budget rows in DB. Money Out tab: existing frontend logic, no changes needed. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openpyxl | 3.1.x | Read LAO .xlsx (Pivot Table Data sheet) | [VERIFIED: npm registry] — confirmed installed (`python -c "import openpyxl"` passes). Standard for Excel in Python. |
| @supabase/supabase-js | installed | Call `treasury_sync_budget_tree` RPC | [VERIFIED] — used by all existing loaders |
| node built-ins (fetch, fs, path) | Node 24 | Download Excel, shell out to Python | [VERIFIED] — confirmed Node 24.13.0 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pdfplumber | installed | ebudget.ca.gov PDF fallback only | Use only if LAO Excel is inaccessible or malformed at phase start |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LAO Excel (primary) | ebudget.ca.gov PDF (fallback) | PDF requires pdfplumber + brittle table detection. Excel is machine-readable and confirmed clean — PDF is fallback only |
| openpyxl Python | xlsx npm package (Node.js) | openpyxl is already proven in this repo; no new tool needed |

**Installation:**
Both `openpyxl` and `pdfplumber` are already installed. No new package installation required for Phase 33.

---

## Package Legitimacy Audit

No new packages are installed in Phase 33. Both `openpyxl` and `pdfplumber` are existing dependencies already used in this project (Phases 17-31). No slopcheck required.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| openpyxl | PyPI | Already installed, used since Phase 28 | Approved |
| pdfplumber | PyPI | Already installed, used since Phase 17 | Approved |

---

## Architecture Patterns

### System Architecture Diagram

```
LAO Excel (.xlsx, 5.5 MB)
  https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx
       |
       v
extractCA.py (openpyxl)
  - Open 'Pivot Table Data' sheet
  - Filter: Fund == 'General Fund', FY in target list
  - Map: FY '2025-26' -> fiscal_year=2026 (ending year)
  - Group: DOF Agency (top-level) -> Department (second level)
  - Emit: JSON array of rows [{agency, department, fy, amount_thousands}]
       |
       v (stdout JSON)
processCA.js (Node.js)
  - Parse rows from extractCA.py stdout
  - Build 2-level tree: { n: agency, a: total, c: [{ n: dept, a: sub_total, i: [{d, a, aa, f, e}] }] }
  - Sanity check: total in [$150B, $300B] range per FY
  - call treasury_sync_budget_tree(p_data_source_id, p_fiscal_year, 'operating', total, tree, row_count, 'bulk_load')
       |
       v
Supabase: treasury.budget_categories (2-level) + treasury.budget_line_items
       |
       v
enrichCategories.js --city "California" --state CA --year 2026
  - buildEntityContext(municipality) where entity_type='state'
  - New 'state' case added to switch statement
  - Prompt: state government policy/program framing (not city-department framing)
       |
       v
treasury.category_enrichment rows (municipality_id = CA state UUID)
```

### Recommended Project Structure
```
scripts/
├── extractCA.py          # NEW: openpyxl extractor for LAO Excel
├── processCA.js          # NEW: Node.js loader, calls treasury_sync_budget_tree
├── seedCAState.js        # NEW: seeds CA municipality + data_source row
└── enrichCategories.js   # MODIFIED: add 'state' case to buildEntityContext()
docs/
└── California/           # NEW directory: store downloaded LAO Excel
    └── Historical_Expenditures.xlsx
```

### Pattern 1: extractCA.py — openpyxl General Fund filter
**What:** Python script reads 'Pivot Table Data' sheet, filters for `Fund == 'General Fund'`, maps FY string to integer, groups by DOF Agency and Department, emits JSON to stdout.
**When to use:** Primary path. Run once to produce the data file.
**Example:**
```python
# Source: Verified by direct Excel inspection (2026-06-07)
import openpyxl, json, sys

SHEET = 'Pivot Table Data'
COLS = {
    'dept_code': 0, 'department': 1, 'function': 2,
    'fiscal_year': 3, 'fund': 4, 'dof_agency': 5,
    'debt_service': 6, 'amount': 7
}

def fy_to_int(fy_str):
    """'2025-26' -> 2026 (ending calendar year = app fiscal_year)"""
    parts = fy_str.split('-')
    if len(parts) != 2: return None
    century = (int(parts[0]) // 100) * 100
    return century + int(parts[1])

wb = openpyxl.load_workbook('docs/California/Historical_Expenditures.xlsx',
                             read_only=True, data_only=True)
ws = wb[SHEET]
rows_out = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[COLS['fund']] != 'General Fund': continue
    if not row[COLS['amount']]: continue
    fy = fy_to_int(row[COLS['fiscal_year']] or '')
    if not fy: continue
    rows_out.append({
        'fiscal_year': fy,
        'dof_agency': row[COLS['dof_agency']],
        'department': row[COLS['department']],
        'amount_thousands': row[COLS['amount']],
    })
print(json.dumps(rows_out))
```

### Pattern 2: processCA.js — 2-level tree builder
**What:** Node.js script calls extractCA.py, builds the 2-level tree shape, calls `treasury_sync_budget_tree` RPC.
**When to use:** Primary data load path.
**Example:**
```javascript
// Source: Derived from processPortland.js + loadSacramentoCSV.js patterns (verified)
// 2-level tree shape (Phase 33, pre-3-level RPC update):
// [{ n: 'Health and Human Services', a: 87_139_490_000, c: [
//     { n: 'Department of Health Care Services', a: 50_000_000_000, i: [{d, a, aa, f, e}] },
//     ...
// ]}, ...]
//
// NOTE: LAO amounts are in THOUSANDS — multiply by 1000 for absolute dollars
function buildCATree(rows) {
  const agencyMap = new Map();
  for (const row of rows) {
    const amtDollars = (row.amount_thousands || 0) * 1000;
    if (!agencyMap.has(row.dof_agency)) agencyMap.set(row.dof_agency, new Map());
    const deptMap = agencyMap.get(row.dof_agency);
    if (!deptMap.has(row.department)) deptMap.set(row.department, 0);
    deptMap.set(row.department, deptMap.get(row.department) + amtDollars);
  }
  const tree = [];
  for (const [agency, depts] of agencyMap) {
    let agencyTotal = 0;
    const children = [];
    for (const [dept, amt] of depts) {
      agencyTotal += amt;
      children.push({ n: dept, a: amt, i: [{ d: dept, a: amt, aa: null, f: null, e: null }] });
    }
    children.sort((a, b) => b.a - a.a);
    tree.push({ n: agency, a: agencyTotal, c: children });
  }
  tree.sort((a, b) => b.a - a.a);
  return tree;
}

// RPC call (same signature as all existing loaders):
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year: fiscalYear,        // integer e.g. 2026
  p_dataset_type: 'operating',
  p_total: total,                   // sum in dollars (not thousands)
  p_tree: tree,                     // 2-level JSON array
  p_row_count: rows.length,
  p_triggered_by: 'bulk_load',
});
```

### Pattern 3: seedCAState.js — municipality + data_source upsert
**What:** Idempotent seeder inserts/updates CA state municipality row and one data_source row.
**When to use:** Wave 1, Step 1.
**Example:**
```javascript
// Source: Derived from seedAnaheimSantaAnaCA.js pattern (verified)
const CALIFORNIA = {
  name: 'California',
  state: 'CA',
  entity_type: 'state',             // Phase 32 CHECK constraint accepts 'state'
  population: 39500000,             // 2024 Census estimate
  population_year: 2024,
  // county_id stays NULL — states don't belong to a county
};

// data_source row (canonical, not per-FY):
const DATA_SOURCE = {
  name: 'California General Fund Operating Budget',
  api_type: 'xlsx_download',
  dataset_type: 'operating',
  dataset_id: 'ca-lao-gf-operating',
  base_url: 'https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx',
  municipality_id: caStateId,
  fiscal_years: [2025, 2026],       // FY2024-25 and FY2025-26 (minimum requirement)
};
```

### Pattern 4: enrichCategories.js — 'state' case
**What:** Add `'state'` case to `buildEntityContext()` switch statement. No CLI flag change needed — entity_type is already read from the DB municipality row.
**When to use:** After budget rows are loaded. Call as `node scripts/enrichCategories.js --city "California" --state CA --year 2026`
**Example:**
```javascript
// Source: enrichCategories.js lines 291-304 (verified — 'state' case MISSING, must be added)
function buildEntityContext(municipality) {
  const entityType = municipality.entity_type || 'city';
  switch (entityType) {
    // ... existing cases ...
    case 'state':
      return `This is a state government budget. The California state budget covers
policy programs funded through the General Fund — primarily K-12 and higher education,
health and human services (Medi-Cal), corrections and rehabilitation, and government
operations. Programs are organized by the Department of Finance's agency groupings.
Amounts are in the hundreds of millions to tens of billions of dollars. Frame
descriptions as state policy programs visible to residents statewide, not as
local city departments.`;
    default:
      return `This is a city government with a mayor and city council.`;
  }
}
```

### Anti-Patterns to Avoid
- **Loading all-funds (~$495B):** Do NOT load rows where `Fund != 'General Fund'`. The file contains Special Funds, Bond Funds, and Federal Funds alongside General Fund — filter strictly on `Fund == 'General Fund'`.
- **Loading GO Debt Service rows as program spending:** `Debt Service? = 'GO Debt Service'` rows are general obligation debt payments. Include them (they are legitimately GF expenditures) but be aware they inflate the total slightly vs. "program" only.
- **Wrong amount units:** LAO Excel amounts are in THOUSANDS. Multiply by 1000 before passing to the RPC. A value of `87,139,490` in the Excel = $87.1B (not $87.1M).
- **Wrong fiscal year mapping:** `'2025-26'` maps to `fiscal_year=2026` (the ending calendar year), consistent with the app's integer FY convention used everywhere.
- **Using the Pivot Table sheet:** Use `'Pivot Table Data'` sheet (flat rows), NOT `'Pivot Table'` (pivot layout with merged cells/totals). Only the Data sheet is parseable row-by-row.
- **Treating `~212B` as the FY2025-26 target:** The $212B figure was the January 2025 Governor's Budget proposal. The enacted Budget Act (what the LAO Excel contains) is $228.4B for FY2025-26. The success criterion total must be updated accordingly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel parsing | Custom binary reader | openpyxl | openpyxl handles all .xlsx variants including pivot tables; already installed |
| Budget tree upsert | Custom INSERT logic | `treasury_sync_budget_tree` RPC | RPC handles idempotency, category hierarchy, line items, and percentages atomically |
| Municipality upsert | Custom SQL | Supabase client select-then-insert pattern (per seedAnaheimSantaAnaCA.js) | Existing pattern is idempotent and tested |
| Category enrichment | New AI pipeline | `enrichCategories.js` (modified) | Only needs 1-line `'state'` case addition to `buildEntityContext()` |

---

## Data Source Deep Dive

### LAO Excel: `Historical_Expenditures.xlsx`

**URL:** `https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx`
**Updated:** August 2025 (per LAO historical data page)
**File size:** 5.5 MB
**Source:** [VERIFIED: https://lao.ca.gov/PolicyAreas/state-budget/historical-data]

**Structure (verified by direct inspection 2026-06-07):**

| Sheet | Use |
|-------|-----|
| `Pivot Table` | Human-readable pivot table with YoY totals. DO NOT use for loading. |
| `Pivot Table Data` | Machine-readable flat rows. USE THIS. |

**Pivot Table Data columns (all 8 are used):**

| Column Index | Column Name | Example Value | Notes |
|---|---|---|---|
| 0 | `Dept. Code` | `'1110'` | Numeric string; not used for loading |
| 1 | `Department` | `'Department of Health Care Services'` | Second-level category |
| 2 | `Function` | `'Local Assistance'` / `'State Operations'` / `'Capital Outlay'` | Not used for 2-level Phase 33 load |
| 3 | `Fiscal Year` | `'2025-26'` | String; map to integer via ending year |
| 4 | `Fund` | `'General Fund'` | Filter key — include only `'General Fund'` rows |
| 5 | `DOF Agency` | `'Health and Human Services'` | Top-level category (12 values) |
| 6 | `Debt Service?` | `'Not GO Debt Service'` / `'GO Debt Service'` | Include all (do not filter out debt service) |
| 7 | `Amount` | `87139490` | In THOUSANDS — multiply by 1000 |

**Fiscal year coverage:** 1984-85 through 2025-26 (42 years). All recent FYs confirmed present.

**General Fund totals (confirmed):**
| App FY | LAO FY String | GF Total (enacted) | Non-null rows |
|--------|---------------|-------------------|---------------|
| 2022 | `2021-22` | $216.8B | 252 |
| 2023 | `2022-23` | $195.2B | 256 |
| 2024 | `2023-24` | $205.7B | 253 |
| 2025 | `2024-25` | $233.6B | 253 |
| 2026 | `2025-26` | $228.4B | 219 |

**12 DOF Agency categories (top-level in 2-level tree):**
1. Health and Human Services ($87.1B FY2026)
2. K-12 Education ($80.3B)
3. Higher Education ($22.7B)
4. Corrections and Rehabilitation ($13.4B)
5. Legislative, Judicial, and Executive ($8.6B)
6. General Government ($6.3B)
7. Natural Resources ($4.4B)
8. Government Operations ($2.7B)
9. Labor and Workforce Development ($0.96B)
10. Business, Consumer Services, and Housing ($0.92B)
11. Transportation ($0.73B)
12. Environmental Protection ($0.14B)

**FY depth decision:** Minimum requirement is FY2024-25 and FY2025-26. Loading FY2022-23 through FY2025-26 (4 years) is consistent with the prior city pattern and adds meaningful trend context for the year selector. Loading back to FY1984-85 is possible but not needed — the LAO note explicitly warns that pre-2023 data may not be trend-comparable due to accounting changes.

### ebudget.ca.gov PDF (fallback only)

**URL:** `https://ebudget.ca.gov/2025-26/pdf/Enacted/BudgetSummary/FullBudgetSummary.pdf`
**Status:** Fallback only — do not use unless LAO Excel is unavailable or broken.
**Reason:** PDF requires pdfplumber table extraction + brittle page detection. The LAO Excel is definitively machine-readable and already in use.

---

## treasury_sync_budget_tree RPC

**Location:** Supabase PostgreSQL function (not in local codebase). Confirmed callable via `supabase.rpc()`.

**Confirmed signature (verified by calling loaders):**
```javascript
supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: string,   // UUID of data_source row
  p_fiscal_year:    number,   // integer e.g. 2026
  p_dataset_type:   string,   // 'operating' | 'revenue' | 'all_funds_requirements'
  p_total:          number,   // total budget in dollars (NOT thousands)
  p_tree:           array,    // 2-level JSON tree (see tree shape below)
  p_row_count:      number,   // number of source rows processed
  p_triggered_by:   string,   // 'bulk_load' | 'manual' | etc.
})
// Returns: { rows_inserted: number } or { error: string }
```

**2-level tree shape (Phase 33):**
```json
[
  {
    "n": "Health and Human Services",
    "a": 87139490000,
    "c": [
      {
        "n": "Department of Health Care Services",
        "a": 50000000000,
        "i": [
          { "d": "Department of Health Care Services", "a": 50000000000, "aa": null, "f": null, "e": null }
        ]
      }
    ]
  }
]
```
- `n` = name (string)
- `a` = amount in dollars (NOT thousands)
- `c` = children array (subcategories)
- `i` = line items array (leaf nodes)
- `d` = description, `aa` = actual amount, `f` = fund, `e` = external_id

**Note:** `budget_line_items` currently has NO `department` column (verified by live DB inspection). Phase 34 will add it. Phase 33 uses the 2-level tree shape where the `c` array has `i` (not nested `c`). Phase 35 will reload CA as 3-level after Phase 34 completes.

---

## enrichCategories.js: state entity support

**Current state (verified by code inspection, lines 291-304):**
The `buildEntityContext()` function has a `switch (entityType)` with cases for `'township'`, `'county'`, `'school_district'`, and `default` (city). **There is NO `'state'` case.** Without it, CA state categories will get city-level framing ("a city government with a mayor and city council").

**Required change:** Add one `case 'state':` block to `buildEntityContext()`. No CLI changes needed — the municipality's `entity_type` is already read from the DB row and passed to the function.

**CLI usage (unchanged):**
```bash
node scripts/enrichCategories.js --city "California" --state CA --year 2026
```
This works because `getMunicipality('California', 'CA')` will return `entity_type='state'` from the DB, and the enrichment pipeline already passes `municipality.entity_type` to `buildEntityContext()`.

**Estimated cost:** ~12 DOF Agency categories × ~$0.0002/call ≈ $0.002 total. Well under the $5 threshold.

---

## CA State Municipality Seeding

**Entity row to insert:**
```javascript
{
  name: 'California',
  state: 'CA',
  entity_type: 'state',
  population: 39500000,      // 2024 Census estimate (~39.5M)
  population_year: 2024,
  // county_id: null         -- states don't belong to a county
  // geo_id: null            -- no TIGER MTFCC for 'state' in TREASURY_ENTITY_MTFCC
}
```

**Per-capita calculation (success criterion verification):**
- FY2025-26 GF total: $228.4B
- Population: 39.5M
- Per-capita: $228,400,000,000 / 39,500,000 = **$5,782 per resident**
- Note: success criterion says "approximately $5,400 per resident" — that was based on the $212B figure. Actual will be ~$5,800. Success criterion should be updated.

**data_source row:**
```javascript
{
  name: 'California General Fund Operating Budget',
  api_type: 'xlsx_download',          // new api_type for this source
  dataset_type: 'operating',
  dataset_id: 'ca-lao-gf-operating',
  base_url: 'https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx',
  municipality_id: caStateId,
  fiscal_years: [2022, 2023, 2024, 2025, 2026],  // FY2021-22 through FY2025-26
}
```

---

## Common Pitfalls

### Pitfall 1: Loading amounts in thousands instead of dollars
**What goes wrong:** The LAO Excel `Amount` column is in thousands. If you pass `87139490` directly as dollars, the budget appears as $87M instead of $87B.
**Why it happens:** The header note "In Thousands" is on the Pivot Table sheet, easy to miss when working only with the Pivot Table Data sheet.
**How to avoid:** Always multiply `row['Amount'] * 1000` before building the tree. Add a sanity check: GF total for FY2025-26 should be in [$200B, $260B] range.
**Warning signs:** Total budget shows $228M instead of $228B in dry-run output.

### Pitfall 2: Using wrong fiscal year integer mapping
**What goes wrong:** LAO uses `'2025-26'` string. If mapped as 2025 (starting year) instead of 2026 (ending year), FY2025-26 would land as `fiscal_year=2025`, conflicting with FY2024-25 data.
**Why it happens:** Different conventions exist — California state uses the start-end notation; the app uses ending year.
**How to avoid:** Split on `-`, take the second part, add the century from the first part: `'2025-26' -> century(2025) + 26 = 2026`. This is identical to Portland's `inferFiscalYearFromFilename` logic.
**Warning signs:** Year selector shows wrong years; duplicate fiscal_year conflicts in DB.

### Pitfall 3: Missing `'state'` case in buildEntityContext()
**What goes wrong:** CA state categories get enriched with "This is a city government with a mayor and city council" framing. GPT-style responses will describe Health and Human Services as a city department instead of a $87B state program.
**Why it happens:** The switch falls through to `default`.
**How to avoid:** Add the `'state'` case before implementing enrichment.
**Warning signs:** Enrichment descriptions mention "city council", "residents of [California]" in a local-government tone.

### Pitfall 4: Loading null-amount rows
**What goes wrong:** Some departments have `Amount = None/null` in the Excel for a given FY+Fund combination (100 null-amount rows for GF 2025-26). If these pass through, zero-amount categories appear in the icicle.
**Why it happens:** Not every department has GF spending in every year.
**How to avoid:** Filter `if not row[COLS['amount']]: continue` in extractCA.py. Confirmed pattern — 219 non-null rows out of 319 total for GF FY2025-26.
**Warning signs:** Zero-amount categories appearing in the tree; RPC inserting more rows than expected.

### Pitfall 5: Using 'Pivot Table' sheet instead of 'Pivot Table Data'
**What goes wrong:** The 'Pivot Table' sheet has merged cells, header rows, and formula cells. openpyxl reads merged cells as None. You'll get mostly None rows.
**Why it happens:** The sheet name sounds like the main data.
**How to avoid:** Always use `wb['Pivot Table Data']`. The data sheet has a clean row 1 header.
**Warning signs:** Almost all rows have None values; only ~4 recent FYs appear in output.

### Pitfall 6: Budget total expectation mismatch
**What goes wrong:** Success criterion says "~$212B range for FY2025-26" but the enacted budget is $228.4B. The app page will show $228.4B which fails the numeric check if $212B is treated as the target.
**Why it happens:** The $212B figure is from the Governor's January 2025 budget proposal. The LAO Excel reflects the enacted Budget Act (August 2025).
**How to avoid:** Update the success criterion in ROADMAP.md. The correct enacted total is $228.4B for FY2025-26 and $233.6B for FY2024-25. Per-capita is ~$5,782 (not ~$5,400).

---

## Code Examples

### Full dry-run test for extractCA.py
```bash
python scripts/extractCA.py --fy 2026 --dry-run
# Expected: 219 rows, total ~$228.4B
```

### Full dry-run test for processCA.js
```bash
node scripts/processCA.js --fy 2026 --dry-run
# Expected output:
# FY2026 operating — $228,365,858,000 total (12 agencies)
#   Health and Human Services: $87,139,490,000
#   K-12 Education: $80,334,039,000
#   ...
```

### Enrichment dry-run
```bash
node scripts/enrichCategories.js --city "California" --state CA --year 2026 --dry-run
# Expected: 12 categories, state-level framing
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `~212B` (Governor's proposal) | `$228.4B` (Enacted Budget Act) | August 2025 (LAO update) | Success criteria must be updated |
| No `entity_type='state'` | Phase 32 CHECK constraint added | 2026-06-06 | Phase 33 can now seed CA state |
| No `'state'` case in enrichCategories.js | Must add in Phase 33 | This phase | Required for correct enrichment framing |

**Deprecated/outdated:**
- `~212B General Fund target`: This was the January 2025 Governor's Budget. The enacted (and LAO-tracked) figure is $228.4B for FY2025-26.
- `~$5,400 per-capita`: Based on $212B. Correct figure with enacted data is ~$5,782.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | LAO Excel URL is stable and publicly accessible at phase execution time | Standard Stack | File may have moved; verify URL at phase start before writing loader |
| A2 | `treasury_sync_budget_tree` RPC signature has not changed since it was last used in Phase 31 | Standard Stack | RPC may have been modified; verify with a dry-run before live load |
| A3 | The enrichCategories.js `--city "California" --state CA` lookup will work via `.ilike('name', 'California').eq('state', 'CA')` | Pattern 4 | Works only after seedCAState.js runs (DATA-01 prerequisite) |
| A4 | Loading 4 fiscal years (FY2022-FY2026) will not cause performance issues with the RPC | Common Pitfalls | Each FY call is independent; batch size is small (~219 rows per FY) |

---

## Open Questions (RESOLVED)

1. **Fiscal year depth: 2 years or 4 years?**
   - What we know: Minimum is FY2024-25 + FY2025-26 (DATA-02 requirement). LAO Excel has data back to 1984-85.
   - RESOLVED: Load FY2022-2026 (5 FYs: 2021-22 through 2025-26) — consistent with prior city patterns, gives meaningful year-selector depth. Pre-2022 excluded per LAO's trend-comparability caveat. Decision encoded in 33-02.

2. **Should `fiscal_years` array on the data_source row reflect all loaded FYs?**
   - What we know: Anaheim seeder sets `fiscal_years: null` on the canonical row; per-FY rows are created by the processor. Sacramento seeder sets `fiscal_years` explicitly on a single shared row.
   - RESOLVED: Use a single canonical data_source row with `fiscal_years: [2022, 2023, 2024, 2025, 2026]`, following the Sacramento pattern. Decision encoded in 33-01.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | extractCA.py | confirmed | Python 3.14.0 (installed) | — |
| openpyxl | extractCA.py | confirmed | installed (`python -c "import openpyxl"` passes) | — |
| pdfplumber | ebudget PDF fallback | confirmed | installed | — |
| Node.js | processCA.js, seedCAState.js | confirmed | 24.13.0 | — |
| @supabase/supabase-js | all loaders | confirmed | installed | — |
| Supabase project | live DB writes | confirmed | kxsdzaojfaibhuzmclfq | — |
| SUPABASE_SERVICE_KEY | all loaders | confirmed | in .env | — |
| ANTHROPIC_API_KEY | enrichCategories.js | assumed present | unknown | Stop and ask user |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** ANTHROPIC_API_KEY — check `.env` at phase start. If missing, DATA-03 cannot proceed (but DATA-01 and DATA-02 can complete first).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (data loading phases use dry-run + DB verification) |
| Config file | none |
| Quick run command | `node scripts/processCA.js --dry-run --fy 2026` |
| Full suite command | `node scripts/processCA.js --dry-run && node scripts/enrichCategories.js --city "California" --state CA --year 2026 --dry-run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | CA municipality row exists with entity_type='state' | smoke | `node -e "...SELECT from municipalities"` in seeder verification step | ❌ Wave 0 |
| DATA-02 | GF budget loaded for FY2025 and FY2026 | smoke | `node scripts/processCA.js --dry-run --fy 2026` | ❌ Wave 0 |
| DATA-03 | Enrichment uses state-level framing | manual | inspect dry-run output for "state government" framing | ❌ Wave 0 |
| DATA-04 | App renders CA page correctly | manual/e2e | human spot-check at treasurytracker.empowered.vote | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/processCA.js --dry-run --fy 2026`
- **Per wave merge:** full dry-run all FYs + DB verification query
- **Phase gate:** Human spot-check of live app (DATA-04) before writing VERIFICATION.md

### Wave 0 Gaps
- [ ] `scripts/extractCA.py` — covers DATA-02 extraction
- [ ] `scripts/processCA.js` — covers DATA-02 loading
- [ ] `scripts/seedCAState.js` — covers DATA-01 seeding
- [ ] `scripts/enrichCategories.js` (modification) — covers DATA-03

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | Admin scripts run with service role key from .env |
| V5 Input Validation | yes | No user input — Excel file is from official LAO source; validate amount ranges in sanity check |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Python shell injection via PDF path | Tampering | PDF path is hardcoded `docs/California/` directory, not user input (same pattern as processPortland.js T-17-03) |
| Stale Excel file with wrong data | Tampering | Verify total is in [$200B, $260B] sanity range before committing to DB |

---

## Sources

### Primary (HIGH confidence)
- `https://lao.ca.gov/PolicyAreas/state-budget/historical-data` — LAO historical data page, Excel URL confirmed
- Direct openpyxl inspection of `Historical_Expenditures.xlsx` (2026-06-07) — column structure, FY range, GF totals, DOF Agency values all verified
- Live DB query via `supabase.rpc()` — confirmed RPC signature, DB column structure, Phase 32 constraint active
- `C:\treasury-tracker\scripts\enrichCategories.js` — confirmed `buildEntityContext()` lacks 'state' case (lines 291-304)
- `C:\EV-Accounts\backend\src\lib\treasuryService.ts` — confirmed 2-level category tree builder

### Secondary (MEDIUM confidence)
- `https://ebudget.ca.gov/2025-26/pdf/Enacted/BudgetSummary/FullBudgetSummary.pdf` — PDF URL for fallback confirmed via WebSearch
- LAO Pivot Table sheet row 39: `Grand Total 2025-26 = 228,365,858` (thousands) — corroborates Pivot Table Data sheet computation

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Excel structure: HIGH — verified by direct openpyxl inspection
- GF totals and column mapping: HIGH — computed from raw data
- Tree pattern and RPC signature: HIGH — verified against working loaders and live DB
- enrichCategories.js modification: HIGH — code read, gap confirmed
- ebudget PDF fallback: MEDIUM — URL found, not inspected (fallback only)

**Research date:** 2026-06-07
**Valid until:** 2026-09-07 (90 days — Excel is updated annually in August; LAO URL is stable)
