# Phase 25: LA County Data Completion + County-City Linking — Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/loadLACountyOperating.js` | script/loader | batch (Socrata → Supabase RPC) | `scripts/loadLACountyRevenue.js` | exact |
| `scripts/loadLACountyRevenue.js` | script/loader | batch (Socrata → Supabase RPC) | `scripts/loadLACountyOperating.js` | exact |
| `scripts/seedLACountyLinks.js` | script/seeder | batch (Supabase CRUD) | `scripts/seedCollinCountyMunicipalities.js` | role-match |
| `src/components/CitiesInCountyPanel.tsx` | component | request-response (prop-driven) | `src/components/LinkedTransactionsPanel.tsx` | role-match |
| `src/App.tsx` (modify) | app shell | request-response | self (existing file) | exact |
| `src/types/budget.ts` (modify) | type definition | — | self (existing file) | exact |

---

## Pattern Assignments

### `scripts/loadLACountyOperating.js` (script/loader, batch)

**Status:** File already exists. Phase 25 task is to extend the delete-before-reload logic so it explicitly scopes the delete to FY2021–2024 (not FY2025) and then calls the loader for those four years.

**Analog:** `scripts/loadLACountyRevenue.js` (mirror script — identical pattern)

**Imports pattern** (`scripts/loadLACountyOperating.js` lines 20–26):
```javascript
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**Socrata fetch pattern** (`scripts/loadLACountyOperating.js` lines 34–48):
```javascript
async function fetchAllForYear(year) {
  const where = `entity_name='Los Angeles' AND fiscal_year=${year}`;
  const params = new URLSearchParams({
    $where: where,
    $limit: String(PAGE_SIZE),
    $offset: '0',
    $order: 'category,subcategory_1,subcategory_2',
  });
  const url = `${SOCRATA_BASE}/resource/${DATASET_ID}.json?${params}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  console.log(`  ${rows.length} rows fetched for FY${year}`);
  return rows;
}
```

**RPC sync pattern** (`scripts/loadLACountyOperating.js` lines 122–134):
```javascript
const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
  p_municipality_id:  municipalityId,
  p_fiscal_year:      year,
  p_dataset_type:     'operating',
  p_total:            total,
  p_tree:             jsonTree,
  p_row_count:        rows.length,
  p_data_source_name: 'CA State Controller - County Expenditures',
});

if (error) { console.error(`  RPC error: ${error.message}`); return; }
console.log(`  Synced (${data?.rows_inserted ?? '?'} rows reported)`);
```

**Pre-reload delete pattern** (new logic to add — from RESEARCH.md Pattern 1):
```javascript
// Delete stale data_source rows (city-aggregate, wrong datasets)
const STALE_SOURCE_IDS = [
  'c68cc1d2-0274-40c7-9953-aa6f9d41f33c', // City Expenditures (ju3w-4gxp)
  '1f2e2694-571d-445b-86f5-3b35d4b0efc3'  // City Revenues (rrtv-rsj9)
];
await supabase.schema('treasury').from('data_sources')
  .delete()
  .in('id', STALE_SOURCE_IDS);

// Delete budget rows scoped to FY2021-2024 only — DO NOT touch FY2025 or salaries
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';
const FYS_TO_RELOAD = [2021, 2022, 2023, 2024];
await supabase
  .schema('treasury')
  .from('budgets')
  .delete()
  .eq('municipality_id', LA_COUNTY_ID)
  .in('dataset_type', ['operating', 'revenue'])
  .in('fiscal_year', FYS_TO_RELOAD);
```

**Main loop pattern** (`scripts/loadLACountyOperating.js` lines 138–172):
```javascript
async function main() {
  const { values } = parseArgs({
    options: {
      fy:        { type: 'string', short: 'y', multiple: true },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  const fiscalYears = values.fy ? values.fy.map(Number) : [2022, 2021];
  const dryRun      = values['dry-run'] ?? false;

  // Ensure/lookup municipality via RPC
  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: 'Los Angeles County', p_state: 'CA',
    p_entity_type: 'county', p_population: 10014009,
  });
  if (munErr) { console.error('Municipality error:', munErr.message); process.exit(1); }

  for (const fy of fiscalYears) {
    console.log(`FY${fy}`);
    const rows = await fetchAllForYear(fy);
    if (rows.length === 0) { console.log('  No data\n'); continue; }
    await syncYear(municipalityId, fy, rows, dryRun);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
```

---

### `scripts/loadLACountyRevenue.js` (script/loader, batch)

**Status:** File already exists. Same scope extension as operating loader — delete FY2021–2024 revenue rows, reload from `emxv-k8xv`. Pattern is identical to `loadLACountyOperating.js`.

**Analog:** `scripts/loadLACountyOperating.js` (mirror script)

The delete + reload + RPC patterns are identical to the operating loader above. See operating loader section for all concrete excerpts. Only difference is `DATASET_ID = 'emxv-k8xv'`, `p_dataset_type: 'revenue'`, and `p_data_source_name: 'CA State Controller - County Revenues'`.

---

### `scripts/seedLACountyLinks.js` (script/seeder, batch CRUD)

**Status:** New file. Performs three operations:
1. Insert county municipality rows for San Diego County, Sacramento County, Alameda County
2. Set `county_id` for all 88 LA County cities and 4 other CA city-to-county links
3. Set `population = 10014009, population_year = 2020` for LA County

**Analog:** `scripts/seedCollinCountyMunicipalities.js`

**Imports + client pattern** (`scripts/seedCollinCountyMunicipalities.js` lines 21–30):
```javascript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
```

**Idempotent select-before-insert pattern** (`scripts/seedCaliforniaCities.js` lines 47–80):
```javascript
async function upsertMunicipality(m) {
  const { data: existing, error: selectErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id')
    .eq('name', m.name)
    .eq('state', m.state)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting municipality "${m.name}, ${m.state}": ${selectErr.message}`);
    process.exit(1);
  }

  let data, error;
  if (existing?.id) {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update(m)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('municipalities')
      .insert(m)
      .select());
    if (!error) console.log(`  (inserted new municipality row)`);
  }
}
```

**Bulk update by name pattern** (from RESEARCH.md Pattern — county_id seeding):
```javascript
// Set county_id for all 88 LA County cities by name
await supabase.schema('treasury').from('municipalities')
  .update({ county_id: LA_COUNTY_ID })
  .eq('state', 'CA')
  .in('name', LA_COUNTY_CITY_NAMES);

// Set county_id for specific cities in other CA counties (by known UUID)
await supabase.schema('treasury').from('municipalities')
  .update({ county_id: SD_COUNTY_ID })
  .eq('id', '1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2'); // San Diego city

// Population update pattern
await supabase.schema('treasury').from('municipalities')
  .update({ population: 10014009, population_year: 2020 })
  .eq('id', 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1'); // LA County
```

**Diff + batch insert pattern** (`scripts/seedCollinCountyMunicipalities.js` lines 52–108):
```javascript
const { data: existing, error: fetchError } = await supabase
  .from('municipalities')
  .select('id, name, state')
  .eq('state', 'CA');

const existingNames = new Set((existing || []).map(m => m.name.toLowerCase()));
const missing = COUNTY_ROWS.filter(m => !existingNames.has(m.name.toLowerCase()));

if (missing.length === 0) {
  console.log('\nNothing to insert — counties already seeded.');
  return;
}

const { data: inserted, error: insertError } = await supabase
  .from('municipalities')
  .insert(missing)
  .select('id, name');

if (insertError) {
  console.error('Insert failed:', insertError.message);
  process.exit(1);
}
```

---

### `src/components/CitiesInCountyPanel.tsx` (component, request-response)

**Status:** New file. Renders the "Cities in [County]" panel with "Available now" / "Coming soon" sections.

**Analog:** `src/components/LinkedTransactionsPanel.tsx` (closest existing panel component with sections and typed props)

**Imports + props interface pattern** (`src/components/LinkedTransactionsPanel.tsx` lines 1–12):
```typescript
import { useState, useCallback } from 'react';
import type { LinkedTransactionSummary } from '../types/budget';

interface LinkedTransactionsPanelProps {
  linkedTransactions: LinkedTransactionSummary;
  categoryName: string;
  linkKey?: string;
  fiscalYear?: number;
}
```

**For CitiesInCountyPanel, use this interface** (from RESEARCH.md Pattern 5):
```typescript
// src/components/CitiesInCountyPanel.tsx
import React from 'react';
import type { Municipality } from '../types/budget';

interface CitiesInCountyPanelProps {
  county: Municipality;
  municipalities: Municipality[];
  onCityClick: (city: Municipality) => void;
}
```

**Card/panel container styling** — copy from `src/components/LinkedTransactionsPanel.tsx` pattern or the RESEARCH.md skeleton using established Tailwind tokens:
```tsx
// Panel wrapper — matches other cards in App.tsx layout
<div className="mt-8 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6">
  <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">
    Cities in {county.name}
  </h2>
  // ... sections
</div>
```

**Section header styling** (consistent with existing "How to explore" section at App.tsx line 919):
```tsx
// "Available now" section header
<h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 mb-2">
  Available now ({withData.length})
</h3>

// "Coming soon" section header
<h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-400 mb-2">
  Coming soon ({withoutData.length})
</h3>
```

**Clickable city chip** — modeled on existing button pattern in App.tsx EntitySwitcher:
```tsx
<button
  key={city.id}
  onClick={() => onCityClick(city)}
  className="px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] dark:bg-ev-gray-700 hover:bg-ev-muted-blue/10 text-ev-muted-blue border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg transition-colors duration-150"
>
  {city.name}
</button>
```

**Non-clickable "coming soon" chip**:
```tsx
<span
  key={city.id}
  className="px-3 py-1.5 text-sm text-ev-gray-400 bg-[#F7F7F8] dark:bg-ev-gray-900 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg"
>
  {city.name}
</span>
```

**Data split logic**:
```typescript
const cities = municipalities.filter(
  m => m.county_id === county.id && m.entity_type === 'city'
);
const withData = cities
  .filter(c => c.available_datasets.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));
const withoutData = cities
  .filter(c => c.available_datasets.length === 0)
  .sort((a, b) => a.name.localeCompare(b.name));

if (cities.length === 0) return null;
```

---

### `src/App.tsx` (modify — breadcrumb + CitiesInCountyPanel injection)

**Status:** Existing file. Two changes:
1. Prepend county item to `breadcrumbItems` useMemo when `selectedEntity.county_id` is set
2. Inject `<CitiesInCountyPanel>` below contextual help block when `entity_type === 'county'`
3. Fix breadcrumb render condition to show county chip on top-level city views

**Analog:** Self (this is the file being modified)

**Current breadcrumbItems useMemo** (`src/App.tsx` lines 446–468):
```typescript
const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
  const items: BreadcrumbItem[] = [
    {
      label: selectedEntity?.name ?? 'City',
      onClick: navigationPath.length > 0 ? () => setNavigationPath([]) : undefined
    },
    {
      label: getDatasetLabel(activeDataset),
      onClick: navigationPath.length > 0 ? () => handleBreadcrumbClick(1) : undefined
    }
  ];

  navigationPath.forEach((category, index) => {
    items.push({
      label: category.enrichment?.plainName || category.name,
      onClick: index < navigationPath.length - 1
        ? () => handleBreadcrumbClick(index + 2)
        : undefined
    });
  });

  return items;
}, [navigationPath, activeDataset, handleBreadcrumbClick, selectedEntity]);
```

**Modified breadcrumbItems useMemo** — prepend county item when county_id is set (from RESEARCH.md Pattern 4):
```typescript
// Add countyEntity derived value (near selectedEntity usage)
const countyEntity = useMemo(() =>
  selectedEntity?.county_id
    ? municipalities.find(m => m.id === selectedEntity.county_id)
    : null,
  [selectedEntity, municipalities]
);

const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
  const items: BreadcrumbItem[] = [];

  // County prefix — only for cities with county_id
  if (countyEntity) {
    items.push({
      label: countyEntity.name,
      onClick: () => handleEntityChange(countyEntity)
    });
  }

  items.push({
    label: selectedEntity?.name ?? 'City',
    onClick: navigationPath.length > 0 ? () => setNavigationPath([]) : undefined
  });

  items.push({
    label: getDatasetLabel(activeDataset),
    onClick: navigationPath.length > 0 ? () => handleBreadcrumbClick(items.length - 1) : undefined
  });

  navigationPath.forEach((category, index) => {
    items.push({
      label: category.enrichment?.plainName || category.name,
      onClick: index < navigationPath.length - 1
        ? () => handleBreadcrumbClick(index + items.length - navigationPath.length + index)
        : undefined
    });
  });

  return items;
}, [navigationPath, activeDataset, handleBreadcrumbClick, selectedEntity, countyEntity, municipalities]);
```

**Current breadcrumb render condition** (`src/App.tsx` line 677):
```tsx
{breadcrumbItems.length > 2 && <Breadcrumb items={breadcrumbItems} />}
```

**Modified condition** — always show when county context present (RESEARCH.md Pitfall 5 + Open Question 3):
```tsx
{(countyEntity != null || breadcrumbItems.length > 2) && <Breadcrumb items={breadcrumbItems} />}
```

**CitiesInCountyPanel injection point** — after contextual help block (`src/App.tsx` lines 918–924):
```tsx
{/* Contextual help — subtle, not preachy */}
{navigationPath.length === 0 && budgetData && (
  <div className="mt-6 p-4 ...">How to explore...</div>
)}

{/* Cities in County panel — rendered below budget for county entities */}
{navigationPath.length === 0 && selectedEntity?.entity_type === 'county' && (
  <CitiesInCountyPanel
    county={selectedEntity}
    municipalities={municipalities}
    onCityClick={handleEntityChange}
  />
)}
```

---

### `src/types/budget.ts` (modify — add county_id to Municipality)

**Status:** Existing file. Single field addition to `Municipality` interface.

**Current Municipality interface** (`src/types/budget.ts` lines 107–119):
```typescript
/** Municipality with available dataset metadata — matches ListMunicipalities API response */
export interface Municipality {
  id: string;
  name: string;
  state: string;
  entity_type: 'city' | 'county' | 'township' | 'nonprofit';
  population: number;
  population_year?: number | null;
  hero_image_url?: string | null;
  available_datasets: Array<{
    fiscal_year: number;
    dataset_type: 'operating' | 'revenue' | 'salaries' | 'all_funds_requirements';
  }>;
}
```

**Modified Municipality interface** — add `county_id` after `hero_image_url`:
```typescript
export interface Municipality {
  id: string;
  name: string;
  state: string;
  entity_type: 'city' | 'county' | 'township' | 'nonprofit';
  population: number;
  population_year?: number | null;
  hero_image_url?: string | null;
  county_id?: string | null;           // UUID reference to parent county municipality row
  available_datasets: Array<{
    fiscal_year: number;
    dataset_type: 'operating' | 'revenue' | 'salaries' | 'all_funds_requirements';
  }>;
}
```

---

## Shared Patterns

### Supabase Client Initialization
**Source:** `scripts/loadLACountyOperating.js` lines 23–26
**Apply to:** All scripts in this phase
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

### Schema-qualified Supabase queries
**Source:** `scripts/seedCollinCountyMunicipalities.js` line 30 (uses `db: { schema: 'treasury' }`) vs `scripts/loadLACountyOperating.js` line 122 (uses `.schema('treasury')` per-call)
**Apply to:** All scripts — use `.schema('treasury')` chained on each call (loader pattern), consistent with loader scripts
```javascript
// Per-call schema qualification (used in all loaders):
await supabase.schema('treasury').from('municipalities').update(...);
// Alternative client-level schema (seedCollinCounty pattern):
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
```

### Error guard pattern (scripts)
**Source:** `scripts/seedCollinCountyMunicipalities.js` lines 57–60
**Apply to:** `scripts/seedLACountyLinks.js`
```javascript
if (fetchError) {
  console.error('Failed to fetch existing municipalities:', fetchError.message);
  process.exit(1);
}
```

### Tailwind design tokens (component)
**Source:** `src/components/LinkedTransactionsPanel.tsx` + App.tsx throughout
**Apply to:** `src/components/CitiesInCountyPanel.tsx`
- Card background: `bg-white dark:bg-ev-gray-800`
- Card border: `border border-[#E2EBEF] dark:border-ev-gray-700`
- Card rounding: `rounded-xl`
- Text primary: `text-[#1C1C1C] dark:text-ev-gray-100`
- Text muted: `text-ev-gray-500`
- Interactive accent: `text-ev-muted-blue hover:bg-ev-muted-blue/10`
- Transition: `transition-colors duration-150`

### Schema migration
**Apply to:** Plan 02 DDL step only. Use `mcp__supabase-local__apply_migration` (project-mandated, per MEMORY.md). Never paste into Dashboard.
```sql
ALTER TABLE treasury.municipalities
  ADD COLUMN IF NOT EXISTS county_id UUID
  REFERENCES treasury.municipalities(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_municipalities_county_id
  ON treasury.municipalities(county_id)
  WHERE county_id IS NOT NULL;
```

---

## No Analog Found

None. All five files have close analogs in the codebase.

---

## Critical Anti-Patterns to Avoid

| Anti-Pattern | Correct Pattern | Source |
|---|---|---|
| Delete all operating/revenue rows including FY2025 | Scope delete to `IN (2021, 2022, 2023, 2024)` only | RESEARCH.md Pitfall 1 + 2 |
| Touch salaries rows in the delete step | Always scope to `dataset_type IN ('operating', 'revenue')` | RESEARCH.md anti-patterns |
| `breadcrumbItems.length > 2` hides county chip at top level | Use `countyEntity != null || breadcrumbItems.length > 2` | RESEARCH.md Pitfall 5 |
| Hardcode LA County municipality ID in App.tsx | Look up from `municipalities` by `county_id` UUID | RESEARCH.md anti-patterns |
| Assume API returns county_id automatically | Verify API response includes county_id after Plan 02 before Plan 03 | RESEARCH.md Open Question 1 |

---

## Metadata

**Analog search scope:** `scripts/`, `src/components/`, `src/types/`, `src/App.tsx`
**Files scanned:** 12 (8 scripts, 3 components, 1 type file)
**Pattern extraction date:** 2026-06-02
