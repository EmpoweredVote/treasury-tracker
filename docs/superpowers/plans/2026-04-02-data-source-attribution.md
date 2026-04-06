# Data Source Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show citizens where budget data comes from via a footnote in PlainLanguageSummary, backed by a `data_sources` registry table with display names and URLs.

**Architecture:** New `treasury.data_sources` table with canonical source names, display labels, and URLs. `budgets.data_source_id` FK links each budget to its source. Backend JOINs on fetch to return `data_source_info` alongside the budget. Frontend deduplicates sources from operating + revenue data and renders a footnote with linked source names.

**Tech Stack:** PostgreSQL migration, TypeScript (ev-accounts backend), React/TypeScript (treasury-tracker frontend)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `ev-accounts/backend/migrations/048_data_sources.sql` | Create `data_sources` table, add FK to `budgets`, seed + normalize |
| Modify | `ev-accounts/backend/src/lib/treasuryService.ts` | Add `data_source_info` to budget interfaces, queries, and mappers |
| Modify | `treasury-tracker/src/types/budget.ts` | Add `dataSourceInfo` to `BudgetData.metadata` |
| Modify | `treasury-tracker/src/data/dataLoader.ts` | Pass `data_source_info` through to metadata |
| Modify | `treasury-tracker/src/components/dashboard/PlainLanguageSummary.tsx` | Render footnote |

---

### Task 1: Migration — Create `data_sources` table, FK, seed, and normalize

**Files:**
- Create: `ev-accounts/backend/migrations/048_data_sources.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 048: Data source registry for attribution footnotes

-- 1. Create registry table
CREATE TABLE treasury.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Seed canonical sources
INSERT INTO treasury.data_sources (name, display_name, url) VALUES
  ('indiana-gateway',          'Indiana Gateway',          'https://gateway.ifionline.org'),
  ('bloomington-open-data',    'Bloomington Open Data',    'https://data.bloomington.in.gov'),
  ('ca-state-controller',      'CA State Controller',      'https://bythenumbers.sco.ca.gov'),
  ('la-city-open-data',        'LA City Open Data',        'https://data.lacity.org'),
  ('la-county-open-data',      'LA County Open Data',      'https://data.lacounty.gov'),
  ('west-hollywood-open-data', 'West Hollywood Open Data', 'https://www.weho.org/city-government/city-budget/open-checkbook');

-- 3. Add FK column to budgets
ALTER TABLE treasury.budgets
  ADD COLUMN data_source_id UUID REFERENCES treasury.data_sources(id);

-- 4. Normalize: map existing data_source text to data_source_id
-- Indiana Gateway (explicit + township/county disbursement reports)
UPDATE treasury.budgets SET data_source_id = (SELECT id FROM treasury.data_sources WHERE name = 'indiana-gateway')
WHERE data_source = 'Indiana Gateway'
   OR data_source LIKE '%Budget & Disbursements';

-- Bloomington Open Data
UPDATE treasury.budgets SET data_source_id = (SELECT id FROM treasury.data_sources WHERE name = 'bloomington-open-data')
WHERE data_source IN ('bloomington-open-data', 'data/checkbook-all.csv', 'Bloomington Annual Compensation', 'Bloomington Public Contracts');

-- CA State Controller
UPDATE treasury.budgets SET data_source_id = (SELECT id FROM treasury.data_sources WHERE name = 'ca-state-controller')
WHERE data_source LIKE 'CA State Controller%';

-- LA City Open Data
UPDATE treasury.budgets SET data_source_id = (SELECT id FROM treasury.data_sources WHERE name = 'la-city-open-data')
WHERE data_source IN ('LA City Budget & Expenditures', 'LA City Checkbook', 'LA City Payroll')
   OR data_source LIKE 'Socrata:%';

-- LA County Open Data
UPDATE treasury.budgets SET data_source_id = (SELECT id FROM treasury.data_sources WHERE name = 'la-county-open-data')
WHERE data_source LIKE 'ArcGIS:%';

-- West Hollywood Open Data
UPDATE treasury.budgets SET data_source_id = (SELECT id FROM treasury.data_sources WHERE name = 'west-hollywood-open-data')
WHERE data_source LIKE 'West Hollywood Demand Register%';
```

- [ ] **Step 2: Apply migration**

```bash
cd /Users/chrisandrews/Documents/GitHub/ev-accounts && source backend/.env && export DATABASE_URL && psql "$DATABASE_URL" -f backend/migrations/048_data_sources.sql
```

Verify:
```bash
psql "$DATABASE_URL" -c "SELECT name, display_name FROM treasury.data_sources ORDER BY name;"
psql "$DATABASE_URL" -c "SELECT count(*) as linked, (SELECT count(*) FROM treasury.budgets) as total FROM treasury.budgets WHERE data_source_id IS NOT NULL;"
```

Expected: 6 sources seeded. Most budgets linked (some may remain NULL if their `data_source` text didn't match any pattern — that's OK).

- [ ] **Step 3: Commit**

```bash
git add ev-accounts/backend/migrations/048_data_sources.sql
git commit -m "feat(treasury): create data_sources registry and normalize budget links"
```

---

### Task 2: Backend — Return `data_source_info` with budgets

**Files:**
- Modify: `ev-accounts/backend/src/lib/treasuryService.ts`

Four changes:

- [ ] **Step 1: Add `data_source_info` to `TreasuryBudget` interface**

Find `TreasuryBudget` (around line 43). Add after `data_source`:

```typescript
export interface TreasuryBudget {
  id: string;
  municipality_id: string;
  fiscal_year: number;
  dataset_type: string;
  total_budget: number;
  data_source: string | null;
  data_source_info: { displayName: string; url: string } | null;
  hierarchy: string[] | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add joined fields to `BudgetRow` interface**

Find `BudgetRow` (around line 127). Add after `data_source`:

```typescript
interface BudgetRow {
  id: string;
  municipality_id: string;
  fiscal_year: string;
  dataset_type: string;
  total_budget: string;
  data_source: string | null;
  ds_display_name: string | null;
  ds_url: string | null;
  hierarchy: string[] | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Update `mapBudget` to include `data_source_info`**

Find `mapBudget` (around line 220). Add after `data_source: row.data_source,`:

```typescript
function mapBudget(row: BudgetRow): TreasuryBudget {
  return {
    id: row.id,
    municipality_id: row.municipality_id,
    fiscal_year: Number(row.fiscal_year),
    dataset_type: row.dataset_type,
    total_budget: Number(row.total_budget),
    data_source: row.data_source,
    data_source_info: row.ds_display_name ? {
      displayName: row.ds_display_name,
      url: row.ds_url!,
    } : null,
    hierarchy: row.hierarchy,
    generated_at: row.generated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
```

- [ ] **Step 4: Update all budget SELECT queries to LEFT JOIN `data_sources`**

There are 3 SELECT queries that read from `treasury.budgets` and return `BudgetRow`:

**In `getBudgetsByCityId` (around line 331):** Update both the filtered and unfiltered queries. Change:
```sql
SELECT id, municipality_id, fiscal_year, dataset_type, total_budget,
        data_source, hierarchy, generated_at, created_at, updated_at
FROM treasury.budgets
WHERE ...
```
To:
```sql
SELECT b.id, b.municipality_id, b.fiscal_year, b.dataset_type, b.total_budget,
        b.data_source, ds.display_name AS ds_display_name, ds.url AS ds_url,
        b.hierarchy, b.generated_at, b.created_at, b.updated_at
FROM treasury.budgets b
LEFT JOIN treasury.data_sources ds ON ds.id = b.data_source_id
WHERE ...
```

Make sure to update the WHERE clause column references to use the `b.` prefix (e.g., `b.municipality_id = $1`). Apply this to both queries in the function (the one with `AND fiscal_year = $2` and the one without).

**In `getBudgetById` (around line 404):** Same change:
```sql
SELECT b.id, b.municipality_id, b.fiscal_year, b.dataset_type, b.total_budget,
        b.data_source, ds.display_name AS ds_display_name, ds.url AS ds_url,
        b.hierarchy, b.generated_at, b.created_at, b.updated_at
FROM treasury.budgets b
LEFT JOIN treasury.data_sources ds ON ds.id = b.data_source_id
WHERE b.id = $1
```

- [ ] **Step 5: Commit**

```bash
git add ev-accounts/backend/src/lib/treasuryService.ts
git commit -m "feat(treasury): return data_source_info from budget API"
```

---

### Task 3: Frontend types and data loader

**Files:**
- Modify: `treasury-tracker/src/types/budget.ts`
- Modify: `treasury-tracker/src/data/dataLoader.ts`

- [ ] **Step 1: Add `dataSourceInfo` to `BudgetData.metadata`**

In `treasury-tracker/src/types/budget.ts`, find the `BudgetData` interface `metadata` block (around line 122). Add after `dataSource`:

```typescript
    dataSource: string;
    dataSourceInfo?: { displayName: string; url: string } | null;
    datasetType?: string;
```

- [ ] **Step 2: Pass `data_source_info` through in `transformAPIResponse`**

In `treasury-tracker/src/data/dataLoader.ts`, find `transformAPIResponse` (around line 113). Add after the `dataSource` line:

```typescript
      dataSource: budget.data_source || budget.dataSource || 'API',
      dataSourceInfo: budget.data_source_info || budget.dataSourceInfo || null,
      datasetType: budget.dataset_type || budget.datasetType
```

- [ ] **Step 3: Commit**

```bash
cd /Users/chrisandrews/Documents/GitHub/treasury-tracker
git add src/types/budget.ts src/data/dataLoader.ts
git commit -m "feat(treasury): pass dataSourceInfo through to frontend"
```

---

### Task 4: PlainLanguageSummary — Render attribution footnote

**Files:**
- Modify: `treasury-tracker/src/components/dashboard/PlainLanguageSummary.tsx`

- [ ] **Step 1: Compute deduplicated sources**

After the existing variable declarations (after the `topCategories` block, around line 52), add:

```typescript
  // Collect unique data sources across operating + revenue
  const sourceMap = new Map<string, { displayName: string; url: string }>();
  if (operatingData?.metadata.dataSourceInfo) {
    const s = operatingData.metadata.dataSourceInfo;
    sourceMap.set(s.displayName, s);
  }
  if (revenueData?.metadata.dataSourceInfo) {
    const s = revenueData.metadata.dataSourceInfo;
    sourceMap.set(s.displayName, s);
  }
  const dataSources = [...sourceMap.values()];
```

- [ ] **Step 2: Render the footnote**

Find the closing `</div>` for the `space-y-4` content div (after the revenue paragraph, around line 175). Add the footnote just before it:

```tsx
          {dataSources.length > 0 && (
            <p className="text-[11px] text-ev-gray-400 pt-2 border-t border-ev-gray-100 mt-4">
              Data sourced from{' '}
              {dataSources.map((source, i) => (
                <span key={source.displayName}>
                  {i > 0 && i === dataSources.length - 1 && ' and '}
                  {i > 0 && i < dataSources.length - 1 && ', '}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-ev-gray-300 underline-offset-2 hover:text-ev-gray-600 transition-colors"
                  >
                    {source.displayName}
                  </a>
                </span>
              ))}
            </p>
          )}
```

This handles 1 source ("Data sourced from X"), 2 sources ("Data sourced from X and Y"), and 3+ sources ("Data sourced from X, Y, and Z") correctly.

- [ ] **Step 3: Commit**

```bash
cd /Users/chrisandrews/Documents/GitHub/treasury-tracker
git add src/components/dashboard/PlainLanguageSummary.tsx
git commit -m "feat(treasury): add data source attribution footnote to summary"
```
