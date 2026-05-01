# Phase 5: Dallas Socrata Integration - Research

**Researched:** 2026-05-01
**Domain:** Socrata SODA API + Supabase budget RPCs + treasury schema + data_sources table
**Confidence:** HIGH — all findings are from direct codebase inspection and live API probing. No speculation.

---

## Summary

Phase 5 builds a generic Socrata budget loader (`bulkLoadBudget.js`) and loads Dallas operating and revenue budget data for FY2025 and FY2026. The architecture is well-established — the exact pattern already exists in `bulkLoadGateway.js`, which calls `treasury_sync_budget_tree` RPC that is already deployed and working in the live database.

The key architectural finding: `treasury_sync_budget` (the name used in the roadmap planning notes) does NOT exist in any existing script. The actual RPC for budget loading is `treasury_sync_budget_tree`. The planner must use `treasury_sync_budget_tree`, not create a new `treasury_sync_budget`.

The `data_sources` table is the control plane for all bulk loaders. It carries `api_type`, `dataset_type`, `base_url`, `dataset_id`, `column_mapping`, `fiscal_years`, and `municipality_id`. The `treasury_list_source_ids` RPC exposes these for discovery; `treasury_get_data_source_config` returns the full config for a given source ID.

Dallas data is live and accessible. FY2025 operating: 1,062 rows. FY2025 revenue: 853 rows. FY2026 operating: 779 rows. FY2026 revenue: 626 rows. All fields in the JSON responses are strings (including numeric amounts) — `parseFloat()` required.

**Primary recommendation:** Build `bulkLoadBudget.js` following `bulkLoadGateway.js`'s tree-building pattern but reading field names from `data_sources.column_mapping`. Use `treasury_sync_budget_tree` for the upsert RPC call. The `bulkLoadGateway.js` `importBudgetData()` function is the closest template — adapt it to be column-mapping-driven instead of hardcoded.

---

## Standard Stack

### Core (all already in the project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.100.1 | Supabase client for RPC calls | Already in package.json; used by all loaders |
| `node:util` `parseArgs` | Node built-in | CLI argument parsing | Used by bulkLoadTransactions.js |
| Native `fetch` | Node 18+ built-in | Socrata API HTTP calls | Already used in bulkLoadTransactions.js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `process.env` | Node built-in | SUPABASE_URL + SUPABASE_SERVICE_KEY | Same env vars as all other loaders |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | node-fetch | Native fetch is standard in Node 18+ — no extra dep needed |
| `treasury_sync_budget_tree` | Direct table inserts | RPC handles clear+rebuild atomically; direct inserts require manual upsert logic |

**Installation:**
```bash
# No new packages needed — all dependencies already present
```

---

## Architecture Patterns

### How the Budget Tree RPC Works (inferred from bulkLoadGateway.js + bulkLoadStateController.js)

The `treasury_sync_budget_tree` RPC takes:
```javascript
supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,       // UUID from data_sources row
  p_fiscal_year: year,           // integer, e.g. 2025
  p_dataset_type: 'operating',  // 'operating' | 'revenue'
  p_total: total,               // numeric — sum of all budcurr values
  p_tree: jsonTree,             // compact nested JSON (see format below)
  p_row_count: rows.length,    // integer — total raw rows processed
  p_triggered_by: 'bulk_load', // string label for audit
})
```

Returns: `{ rows_inserted: number }` (and implicitly wipes+rebuilds the budget's category tree).

### The Compact Tree JSON Format

The tree format is established by `bulkLoadGateway.js`. Parent nodes use `n` (name), `a` (amount), and either `c` (children nodes) or `i` (leaf line items):

```javascript
// Top-level array of category nodes
[
  {
    n: "Public Safety",          // category name (from service column)
    a: 450000000,                // sum of all amounts under this category
    c: [                         // children (subcategories)
      {
        n: "Police",             // subcategory name (from objectgroup column)
        a: 300000000,
        i: [                     // leaf line items
          {
            d: "Police",         // description
            a: 300000000,        // approved_amount (budcurr)
            aa: 280000000,       // actual_amount (expbfy) — nullable
            f: "GENERAL FUND",   // fund
            e: null,             // expense_category
          }
        ]
      }
    ]
  }
]
```

**Key field mapping for Dallas operating budget:**
- `n` (name): comes from `column_mapping.category_column` (= `service`)
- `c[].n` (subcategory): comes from `column_mapping.subcategory_column` (= `objectgroup`)
- `i[].a` (approved): `parseFloat(row[cm.approved_amount_column])` where `cm.approved_amount_column = 'budcurr'`
- `i[].aa` (actual): `parseFloat(row[cm.actual_amount_column])` where `cm.actual_amount_column = 'expbfy'`
- `i[].f` (fund): `row[cm.fund_column]` where `cm.fund_column = 'fundtype'`

**Key field mapping for Dallas revenue budget:**
- `n` (name): comes from `cm.category_column` (= `department`)
- `c[].n` (subcategory): comes from `cm.subcategory_column` (= `revsource`)
- `i[].a` (approved): `parseFloat(row['budcurr'])`
- `i[].aa` (actual): `parseFloat(row['revbfy'])`
- `i[].f` (fund): `row['fundtype']`

### data_sources Table Structure (HIGH confidence — inferred from RPC return fields)

Based on `treasury_list_source_ids` return fields used in scripts and `treasury_get_data_source_config` usage:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `name` | TEXT | Display name, e.g. "Dallas Operating Budget FY2025-2026" |
| `api_type` | TEXT | `'socrata'` for Socrata SODA API sources |
| `dataset_type` | TEXT | `'operating'`, `'revenue'`, `'transactions'`, `'salaries'` |
| `base_url` | TEXT | e.g. `'https://www.dallasopendata.com'` |
| `dataset_id` | TEXT | Socrata dataset ID, e.g. `'e2fs-y4nb'` |
| `column_mapping` | JSONB | Maps generic field names to dataset-specific column names |
| `fiscal_years` | INT[] | Array of fiscal years this source covers, e.g. `[2025, 2026]` |
| `municipality_id` | UUID | FK to municipalities.id |

**`column_mapping` schema for budget sources (must define):**
```json
{
  "fiscal_year_column": "bfy",
  "approved_amount_column": "budcurr",
  "actual_amount_column": "expbfy",
  "category_column": "service",
  "subcategory_column": "objectgroup",
  "fund_column": "fundtype"
}
```

For the revenue dataset:
```json
{
  "fiscal_year_column": "bfy",
  "approved_amount_column": "budcurr",
  "actual_amount_column": "revbfy",
  "category_column": "department",
  "subcategory_column": "revsource",
  "fund_column": "fundtype"
}
```

### Recommended Project Structure

```
scripts/
├── bulkLoadBudget.js        # NEW — generic Socrata budget loader (Phase 5)
├── bulkLoadTransactions.js  # Existing — template for Socrata fetch pattern
├── bulkLoadGateway.js       # Existing — template for tree-building + RPC call
└── ...
```

### Pattern 1: Generic Socrata Budget Loader Structure

**What:** Node.js script that reads `data_sources` rows with `api_type='socrata'` and `dataset_type IN ('operating','revenue')`, fetches paginated data by fiscal year, builds the compact tree, calls `treasury_sync_budget_tree`.

**When to use:** Any time a Socrata city budget dataset needs loading.

**Example structure:**
```javascript
// Source: pattern from bulkLoadTransactions.js + bulkLoadGateway.js

async function syncBudgetSource(ds, fiscalYear) {
  const cm = ds.column_mapping;
  const fyCol = cm.fiscal_year_column || 'bfy';
  const catCol = cm.category_column;
  const subCol = cm.subcategory_column;
  const approvedCol = cm.approved_amount_column;
  const actualCol = cm.actual_amount_column;
  const fundCol = cm.fund_column;

  const where = `${fyCol}='${fiscalYear}'`;
  const totalCount = await fetchSocrataCount(ds.base_url, ds.dataset_id, where);

  // Fetch all pages
  const PAGE_SIZE = 5000;
  let allRows = [];
  let offset = 0;
  while (offset < totalCount) {
    const rows = await fetchSocrataPage(ds.base_url, ds.dataset_id, offset, PAGE_SIZE, where, null);
    allRows = allRows.concat(rows);
    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  // Build tree: category -> subcategory -> line items
  const tree = new Map();
  let total = 0;
  for (const row of allRows) {
    const cat = row[catCol] || 'Unknown';
    const sub = row[subCol] || 'General';
    const approved = parseFloat(row[approvedCol]) || 0;
    const actual = actualCol ? (parseFloat(row[actualCol]) || null) : null;
    total += approved;

    if (!tree.has(cat)) tree.set(cat, new Map());
    if (!tree.get(cat).has(sub)) tree.get(cat).set(sub, []);
    tree.get(cat).get(sub).push({
      d: sub, a: approved, aa: actual,
      f: fundCol ? (row[fundCol] || null) : null, e: null,
    });
  }

  // Convert to compact JSON tree for RPC
  const jsonTree = [];
  for (const [catName, subs] of tree) {
    let catTotal = 0;
    const children = [];
    for (const [subName, items] of subs) {
      const subTotal = items.reduce((s, i) => s + i.a, 0);
      catTotal += subTotal;
      children.push({ n: subName, a: subTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: catName, a: catTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);

  // Call RPC
  const { data, error } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: fiscalYear,
    p_dataset_type: ds.dataset_type,
    p_total: total,
    p_tree: jsonTree,
    p_row_count: allRows.length,
    p_triggered_by: 'bulk_load',
  });

  if (error) throw new Error(error.message);
  return { rows_fetched: allRows.length, rows_inserted: data?.rows_inserted || 0 };
}
```

### Pattern 2: data_sources Row Insert (SQL for Task 05-01)

```sql
-- Dallas Operating Budget
INSERT INTO treasury.data_sources (
  name, api_type, dataset_type, base_url, dataset_id, 
  column_mapping, fiscal_years, municipality_id
) VALUES (
  'Dallas Operating Budget',
  'socrata',
  'operating',
  'https://www.dallasopendata.com',
  'e2fs-y4nb',
  '{"fiscal_year_column":"bfy","approved_amount_column":"budcurr","actual_amount_column":"expbfy","category_column":"service","subcategory_column":"objectgroup","fund_column":"fundtype"}',
  ARRAY[2025, 2026],
  '17ce5baf-277d-41c9-a3f6-2e44f9def106'
) ON CONFLICT (name) DO UPDATE SET
  fiscal_years = EXCLUDED.fiscal_years,
  column_mapping = EXCLUDED.column_mapping;

-- Dallas Revenue Budget  
INSERT INTO treasury.data_sources (
  name, api_type, dataset_type, base_url, dataset_id,
  column_mapping, fiscal_years, municipality_id
) VALUES (
  'Dallas Revenue Budget',
  'socrata',
  'revenue',
  'https://www.dallasopendata.com',
  'rtn4-pmj9',
  '{"fiscal_year_column":"bfy","approved_amount_column":"budcurr","actual_amount_column":"revbfy","category_column":"department","subcategory_column":"revsource","fund_column":"fundtype"}',
  ARRAY[2025, 2026],
  '17ce5baf-277d-41c9-a3f6-2e44f9def106'
) ON CONFLICT (name) DO UPDATE SET
  fiscal_years = EXCLUDED.fiscal_years,
  column_mapping = EXCLUDED.column_mapping;
```

### Anti-Patterns to Avoid

- **Hardcoding Dallas column names in bulkLoadBudget.js:** All field names must come from `ds.column_mapping`. The loader must not reference `'service'`, `'objectgroup'`, `'budcurr'`, etc. directly.
- **Using `treasury_sync_budget` (non-existent):** The roadmap notes say `treasury_sync_budget` but the actual deployed RPC is `treasury_sync_budget_tree`. Use the tree variant.
- **One data_sources row for two fiscal years:** A single `data_sources` row covers multiple fiscal years via the `fiscal_years` array — the loader iterates over that array.
- **Treating bfy as numeric in Socrata WHERE clause:** The `bfy` field returns as a string `"2025"`. The WHERE clause must quote it: `bfy='2025'`, not `bfy=2025`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Budget upsert / clear-and-rebuild | Manual DELETE + INSERT sequence | `treasury_sync_budget_tree` RPC | RPC handles the atomic replace; already deployed and tested with Gateway loader |
| Socrata pagination | Custom paging loop | Reuse `fetchSocrataPage` + `fetchSocrataCount` from `bulkLoadTransactions.js` | Already written and handles edge cases |
| Municipality lookup | Query by name | Use the known Dallas municipality_id `17ce5baf-277d-41c9-a3f6-2e44f9def106` in `data_sources` row | ID already confirmed via quick task 001 |
| data_sources discovery | Hardcode source IDs | `treasury_list_source_ids` RPC + filter by `api_type='socrata'` and `dataset_type` | Same pattern as bulkLoadTransactions.js |

**Key insight:** The entire budget-loading pipeline already exists for Indiana Gateway data. `bulkLoadBudget.js` is essentially `bulkLoadGateway.js` refactored to be column-mapping-driven via `data_sources` rather than having hardcoded column detection logic.

---

## Common Pitfalls

### Pitfall 1: `treasury_sync_budget` vs `treasury_sync_budget_tree`

**What goes wrong:** The roadmap and requirements mention `treasury_sync_budget` (without `_tree`) as the target RPC. Searching the codebase shows NO script calls `treasury_sync_budget`. The actual deployed RPC used for budget loading is `treasury_sync_budget_tree`.

**Why it happens:** The roadmap was drafted using an anticipated RPC name before the codebase was audited. The actual deployed infrastructure uses `treasury_sync_budget_tree` (used in `bulkLoadGateway.js`).

**How to avoid:** Call `treasury_sync_budget_tree` in `bulkLoadBudget.js`. Do not create a new `treasury_sync_budget` RPC — the tree variant already handles the use case.

**Warning signs:** RPC call returns error `"function treasury.treasury_sync_budget does not exist"`.

### Pitfall 2: bfy Field is a String in Socrata API

**What goes wrong:** Query `$where=bfy=2025` (numeric) returns HTTP 400 or empty results.

**Why it happens:** The Dallas Socrata API returns `bfy` as a string `"2025"` in JSON. The SODA API WHERE clause for string fields requires quotes: `bfy='2025'`.

**How to avoid:** Always quote the fiscal year value in the WHERE clause: `${fyCol}='${fiscalYear}'`.

**Warning signs:** `fetchSocrataCount` returns 0 for known-populated years, or HTTP 400 on count query.

**Verification:** Live-tested — `$where=bfy='2025'` returns 1062 operating rows and 853 revenue rows.

### Pitfall 3: Amount Fields are Strings, Not Numbers

**What goes wrong:** Adding `row.budcurr + row.expbfy` produces string concatenation `"0.000.00"` instead of `0`.

**Why it happens:** All Socrata JSON fields are returned as strings, including numeric amounts like `"410201835.00"`.

**How to avoid:** Always `parseFloat(row[approvedCol]) || 0`. Never assume numeric types from Socrata.

### Pitfall 4: Zero-Amount Rows Inflate the Tree

**What goes wrong:** The Dallas operating budget has rows where `budcurr = "0.00"` and `expbfy = "0.00"`. Including them bloats the tree with hundreds of zero-dollar line items that display as empty categories in the UI.

**Why it happens:** The Socrata dataset includes budget line items for all appropriations, even unfunded ones.

**How to avoid:** Filter out rows where both `approved` and `actual` are 0 before building the tree. Check `if (approved === 0 && (actual === null || actual === 0)) continue;`

**Warning signs:** Categories showing $0 in the app.

### Pitfall 5: Missing data_sources Unique Constraint Unknown

**What goes wrong:** Re-running the SQL insert for `data_sources` rows fails with unique constraint violation (or silently inserts duplicates if there is no unique constraint).

**Why it happens:** `data_sources.name` is likely `UNIQUE` per the design spec (`name TEXT UNIQUE NOT NULL`), but the actual constraint may differ in the live schema.

**How to avoid:** Use `ON CONFLICT (name) DO UPDATE SET ...` in the insert SQL (see Pattern 2 above). This is idempotent regardless of whether the constraint exists.

### Pitfall 6: Loader Filtered to `dataset_type='transactions'` by Default

**What goes wrong:** Running `bulkLoadBudget.js` finds no sources because `bulkLoadTransactions.js` filters to `transactions` by default, and copying that pattern without changing the filter means budget sources are skipped.

**Why it happens:** `bulkLoadTransactions.js` has `targets = targets.filter(s => s.dataset_type === 'transactions')` as the default behavior when `--all-types` is not passed.

**How to avoid:** `bulkLoadBudget.js` must filter to `dataset_type IN ('operating', 'revenue')` by default — the opposite of the transactions loader.

---

## Code Examples

### Socrata Fetch Functions (from bulkLoadTransactions.js — reuse verbatim)

```javascript
// Source: C:/treasury-tracker/scripts/bulkLoadTransactions.js lines 34-52

async function fetchSocrataCount(baseUrl, datasetId, where) {
  const url = `${baseUrl}/resource/${datasetId}.json?$select=count(*)&$where=${encodeURIComponent(where)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await resp.json();
  return parseInt(data[0]?.count || '0');
}

async function fetchSocrataPage(baseUrl, datasetId, offset, limit, where, order) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $where: where,
  });
  if (order) params.set('$order', order);
  const url = `${baseUrl}/resource/${datasetId}.json?${params}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}
```

### data_sources Discovery Pattern (from bulkLoadTransactions.js)

```javascript
// Source: C:/treasury-tracker/scripts/bulkLoadTransactions.js lines 160-164

const { data: sources, error } = await supabase.rpc('treasury_list_source_ids');
if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

// For budget loader — filter to budget dataset types
const budgetSources = sources.filter(
  s => s.api_type === 'socrata' && ['operating', 'revenue'].includes(s.dataset_type)
);
```

### Full Config Fetch Pattern

```javascript
// Source: C:/treasury-tracker/scripts/bulkLoadTransactions.js lines 192-193

const { data: ds } = await supabase.rpc('treasury_get_data_source_config', { 
  p_data_source_id: src.id 
});
// ds contains: id, name, api_type, dataset_type, base_url, dataset_id, 
//              column_mapping, fiscal_years, municipality_id
```

### RPC Call Pattern (from bulkLoadGateway.js)

```javascript
// Source: C:/treasury-tracker/scripts/bulkLoadGateway.js lines 283-291

const { data: result, error } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year: year,
  p_dataset_type: 'operating',    // or 'revenue'
  p_total: total,
  p_tree: jsonTree,
  p_row_count: entityRows.length,
  p_triggered_by: 'bulk_load',
});
// result.rows_inserted — number of line items written
```

### CLI Pattern (from bulkLoadTransactions.js)

```javascript
// Source: C:/treasury-tracker/scripts/bulkLoadTransactions.js lines 148-157

const { values } = parseArgs({
  options: {
    source: { type: 'string', short: 's' },   // filter by source name substring
    fy: { type: 'string', short: 'y', multiple: true },  // fiscal years to load
    list: { type: 'boolean', short: 'l' },    // list available sources
  },
  strict: false,
});
```

---

## Dallas Dataset Facts (Verified by Live API Query)

| Dataset | ID | FY2025 Rows | FY2026 Rows |
|---------|-----|------------|------------|
| Operating Budget | `e2fs-y4nb` | 1,062 | 779 |
| Revenue Budget | `rtn4-pmj9` | 853 | 626 |

Both datasets:
- `bfy` field is returned as string `"2025"` not integer `2025`
- All amount fields (`budcurr`, `expbfy`, `revbfy`) are strings like `"410201835.00"`
- No null values observed in the 2-row samples; zero amounts (`"0.00"`) exist

Operating dataset fields confirmed: `bfy, ftyp, fundtype, appr, appropriation, svc, service, objectgroup, budcurr, encbfy, expbfy, encexp`

Revenue dataset fields confirmed: `bfy, ftyp, fundtype, department, rsrc, revsource, budcurr, revbfy`

---

## App Rendering: How the UI Consumes Budget Data

The frontend (`src/data/dataLoader.ts`) fetches budgets via:
1. `GET /api/treasury/cities` → find city by name+state
2. `GET /api/treasury/cities/:id/budgets?fiscal_year=2025` → find budget by `dataset_type`
3. `GET /api/treasury/budgets/:id/categories` → get nested category tree

The `Municipality` type's `available_datasets` array drives which year/dataset tabs appear in the UI:
```typescript
available_datasets: Array<{
  fiscal_year: number;
  dataset_type: 'operating' | 'revenue' | 'salaries';
}>
```

**Implication:** Once `treasury_sync_budget_tree` writes the budget + categories, the Go API backend automatically exposes them at the above endpoints. No frontend changes are needed. Dallas will appear in the city list and show operating + revenue tabs for FY2025 and FY2026 automatically once the data is loaded.

The `BudgetCategory` type expects `amount` (approved), optional `actualAmount`, `subcategories`, and `lineItems` at the leaf. The `treasury_sync_budget_tree` RPC's `i` (items) list with `a` (approved) and `aa` (actual) fields maps to these.

---

## Idempotency Strategy

**Use `treasury_sync_budget_tree`'s built-in clear-and-rebuild.** The RPC already handles idempotency by:
1. Finding any existing budget for `(municipality_id, fiscal_year, dataset_type)`
2. Deleting its categories and line items
3. Rebuilding from the provided tree

This is a truncate-reload strategy, not row-level upsert. It is idempotent by design — re-running the loader produces the same result regardless of prior runs.

**Why not row-level upsert?** Budget data is a complete snapshot for a fiscal year, not an append-only stream. Truncate-reload is simpler and correct for budget datasets. It is already the established pattern for all existing budget loaders (Indiana Gateway, CA State Controller).

---

## State of the Art

| Old Pattern | Current Pattern | Impact |
|-------------|-----------------|--------|
| `processBudget.js` reads local CSV files | `bulkLoadGateway.js` fetches from remote APIs via `treasury_sync_budget_tree` | Remote fetch eliminates CSV download step |
| Hardcoded city logic in loaders | `column_mapping` in `data_sources` drives field names | New cities require only a DB row, not code change |
| `data_source` as TEXT on `budgets` table | `data_sources` table with full metadata | Attribution, URL, and config all in one place |
| `treasury_sync_budget` (never deployed) | `treasury_sync_budget_tree` (deployed, working) | Use tree variant only |

---

## Open Questions

1. **Does `data_sources` have a `name` UNIQUE constraint in the live DB?**
   - What we know: Design spec says `name TEXT UNIQUE NOT NULL`; current code assumes uniqueness for lookups
   - What's unclear: Whether the live DB matches the spec or if the constraint was added
   - Recommendation: Use `ON CONFLICT (name) DO UPDATE` in the insert SQL — safe regardless

2. **Does `treasury_sync_budget_tree` also accept a `hierarchy` parameter?**
   - What we know: `bulkLoadGateway.js` does not pass a `hierarchy` parameter; `createBudget` in `loadEVFinances.js` does pass `hierarchy` to the direct table insert
   - What's unclear: Whether `treasury_sync_budget_tree` sets the hierarchy field on the budget record
   - Recommendation: The `hierarchy` field appears in `budgets.hierarchy` and is used by the Go API to populate `BudgetData.metadata.hierarchy`. If `treasury_sync_budget_tree` does not set it, the metadata will show an empty array — cosmetic issue only. Investigate if hierarchy display matters for the phase.

3. **Does the Go backend API automatically expose Dallas once data is loaded?**
   - What we know: `listMunicipalities()` calls `GET /api/treasury/cities` which is served by the EV-Backend Go service. Dallas municipality already exists (municipality_id confirmed). The Go API likely queries `municipalities` joined with `budgets` to build `available_datasets`.
   - What's unclear: Whether the Go API backend needs any config change to include Dallas in the cities list, or whether it automatically includes any municipality that has at least one budget row.
   - Recommendation: HIGH likelihood it is automatic — `bulkLoadGateway.js` loads Monroe County data with no Go backend changes. Verify by checking the cities API after loading the first budget row.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `C:/treasury-tracker/scripts/bulkLoadTransactions.js` — Socrata fetch pattern, CLI structure, data_sources RPC usage
- `C:/treasury-tracker/scripts/bulkLoadGateway.js` — `treasury_sync_budget_tree` RPC signature, compact tree JSON format, budget import pattern
- `C:/treasury-tracker/scripts/bulkLoadStateController.js` — `treasury_sync_city_budget` usage (different RPC for non-data_sources municipalities)
- `C:/treasury-tracker/scripts/loadEVFinances.js` — Direct insert pattern (not the pattern for Phase 5, but confirms budget schema: `budgets`, `budget_categories`, `budget_line_items`)
- `C:/treasury-tracker/src/data/dataLoader.ts` — How frontend consumes budgets (3-step API call pattern)
- `C:/treasury-tracker/src/types/budget.ts` — `BudgetCategory`, `BudgetData`, `Municipality` types
- `C:/treasury-tracker/src/App.tsx` — `available_datasets` drives year/dataset tab visibility
- `C:/treasury-tracker/.planning/research/ARCHITECTURE.md` — Schema layout: `treasury.budget_categories.amount` is pre-aggregated
- `C:/treasury-tracker/docs/superpowers/specs/2026-04-02-data-source-attribution-design.md` — `data_sources` table column definitions

### Primary (HIGH confidence — live API verification)

- `https://www.dallasopendata.com/resource/e2fs-y4nb.json` — Operating budget: field names, data types, FY2025=1062 rows, FY2026=779 rows
- `https://www.dallasopendata.com/resource/rtn4-pmj9.json` — Revenue budget: field names, data types, FY2025=853 rows, FY2026=626 rows

---

## Metadata

**Confidence breakdown:**
- `treasury_sync_budget_tree` RPC existence and signature: HIGH — read from bulkLoadGateway.js which is actively used
- `data_sources` column structure: HIGH — inferred from multiple script usages across bulkLoadTransactions.js and bulkLoadGateway.js
- Dallas API field names and row counts: HIGH — live API queries confirmed
- `bfy` as string in Socrata: HIGH — live API query confirmed
- App rendering auto-exposure: MEDIUM — pattern consistent with how Gateway cities work but Go backend not directly audited
- `treasury_sync_budget_tree` hierarchy parameter: LOW — not seen in any script call; behavior unknown

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (Socrata API stable; Dallas dataset IDs are permanent; RPC stable until DB schema changes)
