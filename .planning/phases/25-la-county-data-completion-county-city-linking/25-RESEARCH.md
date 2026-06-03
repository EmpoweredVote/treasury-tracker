# Phase 25: LA County Data Completion + County-City Linking — Research

**Researched:** 2026-06-02
**Domain:** Supabase data reload (Socrata), schema migration (FK column), React UI (breadcrumb + panel)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full clean reload — delete all existing LA County `operating` and `revenue` budget rows (and any orphaned data_source rows), then reload FY2021–2025 from the CA State Controller county-government datasets (uctr-c2j8 for operating, emxv-k8xv for revenue). Salaries rows are accurate and must NOT be touched.
- **D-02:** FY2026 — researcher checks the Socrata API for FY2026 county data availability. Include FY2026 if present; cap at FY2025 if not. No preference for one outcome — just be accurate about what's published.
- **D-03:** Population — set `population = 10014009`, `population_year = 2020` (2020 Census figure). Same approach used for all TX and OR municipalities.
- **D-04:** `county_id` is populated for ALL 80+ LA County cities already seeded in the DB — not just those with budget data. The county page should show the full roster of incorporated cities.
- **D-05:** Extend county linking to other CA counties: seed county municipality rows for San Diego County, Sacramento County, and Alameda County (entity_type='county'). Set county_id for San Diego city (→ SD County), Sacramento city (→ Sacramento County), Berkeley and Fremont (→ Alameda County). No budget data loaded for these county rows in this phase — linking only.
- **D-06:** San Francisco is a consolidated city-county government — no separate SF County entity. Leave SF's `county_id = null`. Do not create an SF County municipality row.
- **D-07:** County page layout — budget view comes first (same icicle/Money In/Money Out tabs as any entity), followed by a "Cities in [County Name]" panel below the budget. The county is a government entity with its own budget, not just a container.
- **D-08:** City roster panel — two labeled sections: **"Available now"** (cities with budget data, clickable) and **"Coming soon"** (cities without data, listed but not clickable — signals future coverage).
- **D-09:** City → county navigation — add county name as a clickable breadcrumb above the city name when a city has `county_id` set. Uses the existing `Breadcrumb` component at `src/components/Breadcrumb.tsx` — no new component needed.

### Claude's Discretion

- Where in App.tsx to inject the county breadcrumb item (above vs. prepending to existing breadcrumbItems)
- Where in the entity view layout to inject the CitiesInCountyPanel component
- Component name and file location for the "Cities in [County]" panel
- Whether county_id lookup from the municipalities list is by ID or by separate API call

### Deferred Ideas (OUT OF SCOPE)

- Loading budget data for non-LA County counties (San Diego County, Sacramento County, Alameda County)
- Texas county linking (Collin County, Dallas County)
- Oregon county linking (Multnomah County)
- Multi-county cities modeling
</user_constraints>

---

## Summary

Phase 25 has three independent workstreams: (1) correct data reload for LA County operating and revenue (FY2021–2024 only — FY2025 is not yet published in either county Socrata dataset), (2) a schema migration adding `county_id UUID REFERENCES treasury.municipalities(id)` with population of all 88 LA County cities already in the DB plus 4 cities in other CA counties, and (3) two UI changes — a county breadcrumb chip on city pages and a "Cities in [County]" panel on the county entity page.

**Critical data finding (D-02 resolved):** Both CA State Controller county datasets (uctr-c2j8 for expenditures, emxv-k8xv for revenues) have data only through FY2024. FY2025 returns zero rows. FY2026 returns zero rows. The phase scope is FY2021–2024 for operating and revenue, not FY2021–2025 as originally anticipated.

The current state in the DB is well-understood: all 14 LA County budget rows exist (FY2021–2024 operating, FY2021–2024 revenue, FY2021–2025 salaries, FY2025 operating) but the operating/revenue data was loaded from city-aggregate datasets (ju3w-4gxp, rrtv-rsj9), not the county government datasets. The two data_source rows for LA County reference city-aggregate datasets and must be deleted and replaced. The budget rows reference data_source_ids 382708b3 and 982481b5 which are orphaned (do not exist in treasury.data_sources). The existing loader scripts handle FY2021–2024 correctly using `treasury_sync_city_budget` RPC.

**Primary recommendation:** Three plans in sequence — Plan 01 (data reload), Plan 02 (schema migration + county_id seeding), Plan 03 (UI). Plans 01 and 02 have no UI dependencies. Plan 03 depends on Plan 02 (needs county_id in API response).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data reload (operating FY2021–2024) | Database/Scripts | — | Socrata → Node.js loader → Supabase RPC |
| Data reload (revenue FY2021–2024) | Database/Scripts | — | Socrata → Node.js loader → Supabase RPC |
| Population fix | Database/Scripts | — | Direct UPDATE via Supabase JS client |
| county_id schema migration | Database | — | DDL via mcp__supabase-local__apply_migration |
| county_id seeding (all 88 cities) | Database/Scripts | — | Bulk UPDATE via Supabase JS client |
| Municipality type: `county` | Already exists | — | `entity_type` field already accepts 'county' |
| API: return county_id | Backend API (ev-accounts-api) | — | `/api/treasury/cities` endpoint served by Render service |
| TypeScript type: county_id | Frontend | — | `Municipality` interface in `src/types/budget.ts` |
| City → county breadcrumb | Frontend (App.tsx) | Breadcrumb component | Prepend county item when `municipality.county_id != null` |
| County page: Cities panel | Frontend (new component) | App.tsx | New `CitiesInCountyPanel` injected below budget content |

---

## Standard Stack

### Core (No new packages — phase is pure data + schema + UI with existing tools)

| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.100.1 (installed) | Supabase client for scripts | Already in use across all loaders |
| `treasury_sync_city_budget` RPC | — | Upsert budget rows + data_source_id | Established pattern Phases 15–24 |
| `mcp__supabase-local__apply_migration` | — | DDL migration for county_id column | Project-mandated pattern (MEMORY.md) |
| Node.js `fetch` | Built-in | Socrata SODA API calls | Used in all existing loaders |
| React | ^19.2.0 (installed) | Frontend components | Project standard |

**No new packages to install.** All required tooling is already installed.

---

## Package Legitimacy Audit

> No new external packages are introduced in this phase. All tools are pre-existing project dependencies.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[CA State Controller Socrata API]
        |
        | fetch (entity_name='Los Angeles', fiscal_year=YYYY)
        |
[loadLACountyOperating.js / loadLACountyRevenue.js]
        |
        | treasury_sync_city_budget RPC
        |
[Supabase: treasury.budgets + treasury.budget_categories]
        |
        | ev-accounts-api /api/treasury/cities (SELECT with county_id)
        |
[Frontend: App.tsx]
        |
        +-> county_id != null -> prepend county breadcrumb item
        |
        +-> entity_type == 'county' -> render CitiesInCountyPanel below budget
```

### Recommended Project Structure

No new directories. New file: `src/components/CitiesInCountyPanel.tsx`

New script: `scripts/seedLACountyLinks.js` (county municipality seeder + county_id updater)

### Pattern 1: Clean-delete-reload (Phase 24 pattern applied to LA County)

**What:** Delete stale budget rows by municipality_id + dataset_type, then upsert fresh data via `treasury_sync_city_budget`.

**When to use:** Data was loaded from wrong source and must be replaced entirely.

**Implementation:**
```javascript
// Step 1: Delete stale data_source rows (wrong dataset IDs)
await supabase.schema('treasury').from('data_sources')
  .delete()
  .in('id', ['c68cc1d2-...', '1f2e2694-...']); // city-aggregate source IDs

// Step 2: Delete budget rows (their data_source FKs are already orphaned)
await supabase.schema('treasury').from('budgets')
  .delete()
  .eq('municipality_id', LA_COUNTY_ID)
  .in('dataset_type', ['operating', 'revenue']);

// Step 3: Reload from correct county datasets via existing loaders
// node scripts/loadLACountyOperating.js --fy 2021 --fy 2022 --fy 2023 --fy 2024
// node scripts/loadLACountyRevenue.js --fy 2021 --fy 2022 --fy 2023 --fy 2024
```

**Source:** [VERIFIED: DB query] — budget rows for municipality_id=f3db6f9f reference orphaned data_source_ids 382708b3 and 982481b5 which are not in treasury.data_sources.

### Pattern 2: Schema migration via MCP tool

**What:** DDL changes go through `mcp__supabase-local__apply_migration`, not manual Dashboard paste.

**When to use:** Any DDL (ALTER TABLE, CREATE TABLE, DROP CONSTRAINT).

```sql
-- Migration: add county_id FK to municipalities
ALTER TABLE treasury.municipalities
  ADD COLUMN IF NOT EXISTS county_id UUID
  REFERENCES treasury.municipalities(id)
  ON DELETE SET NULL;

-- Index for lookup performance (county page queries cities by county_id)
CREATE INDEX IF NOT EXISTS idx_municipalities_county_id
  ON treasury.municipalities(county_id)
  WHERE county_id IS NOT NULL;
```

**Source:** [VERIFIED: DB query] — municipalities table has no county_id column; FK is self-referential (counties are also municipalities).

### Pattern 3: Population seeding (established pattern)

**What:** Direct UPDATE on treasury.municipalities.

```javascript
await supabase.schema('treasury').from('municipalities')
  .update({ population: 10014009, population_year: 2020 })
  .eq('id', 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1');
```

**Source:** [VERIFIED: DB query] — LA County row has population=0, population_year=null.

### Pattern 4: Breadcrumb prepend for county context

**What:** When `selectedEntity.county_id != null`, prepend a county item to `breadcrumbItems` in App.tsx.

**When to use:** City entity view when county_id is populated.

```typescript
// In App.tsx breadcrumbItems useMemo:
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
}, [navigationPath, activeDataset, handleBreadcrumbClick, selectedEntity, countyEntity]);
```

**Important:** The `Breadcrumb` component renders when `items.length > 2`. After this change, a city with a county parent and navigation path will always show the breadcrumb (3+ items). A city with county but no navigation (2 items) still does not show the Breadcrumb. Consider: for county-linked cities with NO navigation depth, should the county chip be shown at top level?

**Planner decision point:** The D-09 intent is to always show the county context on city pages — not just during drill-down navigation. This may require changing the render condition from `breadcrumbItems.length > 2` to `breadcrumbItems.length >= 2` OR unconditionally rendering the county chip when `countyEntity != null`.

**Source:** [VERIFIED: codebase] — `src/App.tsx` line 677 `{breadcrumbItems.length > 2 && <Breadcrumb items={breadcrumbItems} />}`.

### Pattern 5: County page "Cities in County" panel

**What:** New `CitiesInCountyPanel` component rendered below budget content when `selectedEntity.entity_type === 'county'`.

```tsx
// src/components/CitiesInCountyPanel.tsx
interface CitiesInCountyPanelProps {
  countyId: string;
  municipalities: Municipality[];
  onCityClick: (city: Municipality) => void;
}

// cities = municipalities.filter(m => m.county_id === countyId && m.entity_type === 'city')
// hasData = city.available_datasets.length > 0
// Split into "Available now" and "Coming soon" sections
```

**Placement in App.tsx:** After `</div>` closing the budget visualization section (below the "How to explore" contextual help block), when `navigationPath.length === 0 && selectedEntity.entity_type === 'county'`.

**Source:** [VERIFIED: codebase] — App.tsx layout; the natural injection point is lines 916–924 (contextual help block).

### Anti-Patterns to Avoid

- **Loading FY2025 from county Socrata:** Both uctr-c2j8 and emxv-k8xv return zero rows for FY2025 (verified via API). Do not attempt FY2025 reload — it does not exist in the source data. Cap at FY2024.
- **Touching salaries rows:** `loadLACountySalaries.js` loaded correct data. The delete step must scope to `dataset_type IN ('operating', 'revenue')` only — never `('salaries')`.
- **Using ju3w-4gxp or rrtv-rsj9:** These are city-aggregate datasets, not county-government data. The correct datasets are uctr-c2j8 (operating) and emxv-k8xv (revenue).
- **Direct SQL DELETE without scoping:** Always scope deletes by both `municipality_id` AND `dataset_type` to avoid touching salaries or other entities.
- **Hardcoding county_id in App.tsx:** Look up county entity from the municipalities list by `county_id` UUID. Never hardcode the LA County municipality ID in frontend code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Budget upsert | Custom INSERT/UPDATE logic | `treasury_sync_city_budget` RPC | Handles FK creation, clear-and-rebuild, row_count tracking |
| Schema migration | Manual SQL in Dashboard | `mcp__supabase-local__apply_migration` | Project mandated; avoids manual paste errors |
| Socrata pagination | Custom paginator | Existing fetch loop in loadLACountyOperating.js | Already handles $limit/$offset; 648–963 rows fit in one page |
| County entity display | New EntitySwitcher group | Existing `county` group in EntitySwitcher | `ENTITY_TYPE_LABELS.county = 'Counties'` already works |

---

## Verified DB State (Researched 2026-06-02)

| Item | Value | Source |
|------|-------|--------|
| LA County municipality ID | `f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1` | [VERIFIED: DB query] |
| LA County population (current) | 0 | [VERIFIED: DB query] |
| LA County population_year (current) | null | [VERIFIED: DB query] |
| Existing budget rows (operating) | FY2021, FY2022, FY2023, FY2024, FY2025 (5 rows) | [VERIFIED: DB query] |
| Existing budget rows (revenue) | FY2021, FY2022, FY2023, FY2024 (4 rows) | [VERIFIED: DB query] |
| Existing budget rows (salaries) | FY2021–FY2025 (5 rows) — DO NOT TOUCH | [VERIFIED: DB query] |
| data_source_id on operating rows | `382708b3-...` (orphaned — not in treasury.data_sources) | [VERIFIED: DB query] |
| data_source_id on revenue rows FY2021–2022 | null | [VERIFIED: DB query] |
| data_source_id on revenue rows FY2023–2024 | `982481b5-...` (orphaned — not in treasury.data_sources) | [VERIFIED: DB query] |
| Registered data_source rows for LA County | 2 rows: city-aggregate datasets (ju3w-4gxp, rrtv-rsj9) — MUST BE REPLACED | [VERIFIED: DB query] |
| FY2025 operating total (current, wrong source) | ~$44.1B | [VERIFIED: DB query] — city-aggregate bleed |
| FY2021 operating total (current, wrong source) | ~$31.9B | [VERIFIED: DB query] |
| county_id column exists on municipalities | NO — migration required | [VERIFIED: DB query] |
| CA municipalities in DB | 95 (includes LA County, Empowered Vote nonprofit) | [VERIFIED: DB query] |
| LA County incorporated cities in DB | 88 cities | [VERIFIED: cross-reference] |

---

## D-02 Resolution: FY Scope

**Finding:** Both CA State Controller county datasets (uctr-c2j8, emxv-k8xv) have data only through FY2024. [VERIFIED: Socrata API]

- uctr-c2j8 (County Expenditures): FY2003–FY2024. FY2025 = 0 rows.
- emxv-k8xv (County Revenues): FY2003–FY2024. FY2025 = 0 rows.

**Resolution:** Load FY2021–FY2024 only (4 years). Do not attempt FY2025 from county datasets — it does not exist.

**Expected totals after reload (from county datasets):**
- Operating: FY2021 ~$32B, FY2022 ~$33B, FY2023 ~$35B, FY2024 ~$38B
- Revenue: FY2021 ~$32B, FY2022 ~$34B, FY2023 ~$36B, FY2024 ~$39B

---

## County-City Linking Scope (D-04, D-05)

**LA County cities in DB (all 88 — all get county_id set):**
Agoura Hills, Alhambra, Arcadia, Artesia, Avalon, Azusa, Baldwin Park, Bell, Bell Gardens, Bellflower, Beverly Hills, Bradbury, Burbank, Calabasas, Carson, Cerritos, Claremont, Commerce, Compton, Covina, Cudahy, Culver City, Diamond Bar, Downey, Duarte, El Monte, El Segundo, Gardena, Glendale, Glendora, Hawaiian Gardens, Hawthorne, Hermosa Beach, Hidden Hills, Huntington Park, Industry, Inglewood, Irwindale, La Canada Flintridge, La Habra Heights, La Mirada, La Puente, La Verne, Lakewood, Lancaster, Lawndale, Lomita, Long Beach, Los Angeles, Lynwood, Malibu, Manhattan Beach, Maywood, Monrovia, Montebello, Monterey Park, Norwalk, Palmdale, Palos Verdes Estates, Paramount, Pasadena, Pico Rivera, Pomona, Rancho Palos Verdes, Redondo Beach, Rolling Hills, Rolling Hills Estates, Rosemead, San Dimas, San Fernando, San Gabriel, San Marino, Santa Clarita, Santa Fe Springs, Santa Monica, Sierra Madre, Signal Hill, South El Monte, South Gate, South Pasadena, Temple City, Torrance, Vernon, Walnut, West Covina, West Hollywood, Westlake Village, Whittier

**Other CA county links (D-05):**
- San Diego County → San Diego city (`1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2`)
- Sacramento County → Sacramento city (`9722596e-1102-4aca-8758-c32fc0c1731d`)
- Alameda County → Berkeley (`61236aa6-7845-49a2-a49a-78ef0050b395`) + Fremont (`eb7e50b1-eab5-4a0d-a9ce-a345109a13f9`)
- San Francisco → county_id = null (consolidated city-county, D-06)

**New county municipality rows to insert (linking-only, no budget data):**
- San Diego County, CA (entity_type='county')
- Sacramento County, CA (entity_type='county')
- Alameda County, CA (entity_type='county')

---

## API Changes Required

**Finding:** The `/api/treasury/cities` endpoint (served by ev-accounts-api on Render) returns municipality objects WITHOUT `county_id`. [VERIFIED: API query to https://ev-accounts-api.onrender.com/api/treasury/cities]

The frontend cannot look up county names without this field. Plan 03 depends on Plan 02's schema migration AND a corresponding backend change to include `county_id` in the SELECT query that powers the cities endpoint.

**The ev-accounts-api is an external Render service, not in this repo.** The planner must address this:

Option A: If the ev-accounts-api SELECT already uses `SELECT *` on municipalities, adding the column to the DB table may be sufficient — the field will appear automatically.

Option B: If the SELECT is explicit (e.g., `SELECT id, name, state, entity_type, population, ...`), the Render service code must be updated.

**Research cannot fully resolve this without access to the ev-accounts-api source code.** Flag as open question for the planner — this is the highest-risk unknown in Plan 03.

---

## Common Pitfalls

### Pitfall 1: FY2025 county data does not exist
**What goes wrong:** Script runs `--fy 2025` against uctr-c2j8 or emxv-k8xv and gets 0 rows. If the script silently continues, FY2025 operating row gets deleted (D-01 clean delete) and not replaced.
**Why it happens:** FY2025 county government filings are not yet published to the CA State Controller Socrata portals as of 2026-06-02.
**How to avoid:** The delete step must explicitly scope to FY2021–2024 only (not a blanket delete of all operating/revenue rows including FY2025). After reload, verify FY count matches expectations.
**Warning signs:** `rows.length === 0` in the loader console output for FY2025.

### Pitfall 2: Deleting the current FY2025 operating row without a replacement
**What goes wrong:** D-01 says "delete all existing operating and revenue" — but FY2025 operating from the county dataset doesn't exist. If deleted, the user sees no FY2025 operating data at all for LA County.
**Why it happens:** The CONTEXT.md scope says FY2021-2025, but FY2025 county data is not published.
**How to avoid:** Scope the delete to `fiscal_year IN (2021, 2022, 2023, 2024)` only. Leave FY2025 operating row intact (it was loaded from city-aggregate data but it's better than nothing). OR accept that FY2025 data was wrong and delete it — confirm with user.
**Decision required:** The planner must decide: keep the wrong-sourced FY2025 operating row, or delete it and leave FY2025 with only salaries? Given D-01 says "delete all" and D-02's resolution is "cap at FY2024," the correct interpretation is: delete FY2021-2024 operating/revenue (reload from county source) and ALSO delete FY2025 operating (no county source exists to replace it). This leaves FY2025 with only salaries data.
**Recommendation:** Delete FY2025 operating. The ~$44B figure was loaded from city-aggregate data and is misleading. An entity with only salaries data is better than an entity with wrong operating data.

### Pitfall 3: county_id self-referential FK with ON DELETE behavior
**What goes wrong:** If LA County municipality row were ever deleted, all 88 city county_id values would become orphaned.
**How to avoid:** Use `ON DELETE SET NULL` (not `ON DELETE CASCADE`) — cities should not be deleted when their county entity is removed.

### Pitfall 4: API does not return county_id — breadcrumb shows nothing
**What goes wrong:** After schema migration and county_id population, the frontend fetches municipalities via `/api/treasury/cities` but gets objects without `county_id`. The county breadcrumb never renders because `selectedEntity.county_id` is always undefined.
**Why it happens:** The ev-accounts-api may have an explicit column SELECT that does not include the new `county_id` column.
**How to avoid:** Verify the API response includes `county_id` BEFORE implementing the frontend breadcrumb. If not present, the Render service code requires an update.
**Warning signs:** `selectedEntity.county_id` is `undefined` (not `null`) in browser devtools after Plan 02 completes.

### Pitfall 5: Breadcrumb render condition hides county chip on top-level views
**What goes wrong:** The existing condition `{breadcrumbItems.length > 2 && <Breadcrumb />}` hides the breadcrumb when there's no navigation depth. A city with a county_id but no drilled-down category would have 2 items (County, City) and the Breadcrumb would not render.
**Why it happens:** The original breadcrumb was built only for drill-down navigation within a budget.
**How to avoid:** When a county context is present, render the Breadcrumb regardless of depth — either change the condition to `countyEntity || breadcrumbItems.length > 2` or render a separate compact "county context chip" element.

### Pitfall 6: CitiesInCountyPanel ordering — budget data vs. no data
**What goes wrong:** A city might be in the DB with `available_datasets = []` but show under "Available now" if the check is incorrect.
**How to avoid:** "Available now" = `municipality.available_datasets.length > 0`. "Coming soon" = `municipality.available_datasets.length === 0`. Both groups filtered from `municipalities.filter(m => m.county_id === countyId && m.entity_type === 'city')`.

---

## Code Examples

### Delete stale LA County operating/revenue rows (FY2021-FY2024 scope)

```javascript
// Source: [VERIFIED: DB query] — identified FY2021-2024 are the rows to replace
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';
const FYS_TO_RELOAD = [2021, 2022, 2023, 2024];

// Delete budget rows for the FYs we're reloading
const { error } = await supabase
  .schema('treasury')
  .from('budgets')
  .delete()
  .eq('municipality_id', LA_COUNTY_ID)
  .in('dataset_type', ['operating', 'revenue'])
  .in('fiscal_year', FYS_TO_RELOAD);

// Delete stale data_source rows (city-aggregate, wrong datasets)
const STALE_SOURCE_IDS = [
  'c68cc1d2-0274-40c7-9953-aa6f9d41f33c', // City Expenditures (ju3w-4gxp)
  '1f2e2694-571d-445b-86f5-3b35d4b0efc3'  // City Revenues (rrtv-rsj9)
];
await supabase.schema('treasury').from('data_sources')
  .delete()
  .in('id', STALE_SOURCE_IDS);
```

### County_id seeding bulk UPDATE

```javascript
// Source: [VERIFIED: DB query] — 88 LA County city IDs confirmed in DB
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';

// LA County city names (all 88)
const LA_COUNTY_CITY_NAMES = [
  'Agoura Hills', 'Alhambra', 'Arcadia', 'Artesia', 'Avalon', 'Azusa',
  'Baldwin Park', 'Bell', 'Bell Gardens', 'Bellflower', 'Beverly Hills',
  'Bradbury', 'Burbank', 'Calabasas', 'Carson', 'Cerritos', 'Claremont',
  'Commerce', 'Compton', 'Covina', 'Cudahy', 'Culver City', 'Diamond Bar',
  'Downey', 'Duarte', 'El Monte', 'El Segundo', 'Gardena', 'Glendale',
  'Glendora', 'Hawaiian Gardens', 'Hawthorne', 'Hermosa Beach', 'Hidden Hills',
  'Huntington Park', 'Industry', 'Inglewood', 'Irwindale', 'La Canada Flintridge',
  'La Habra Heights', 'La Mirada', 'La Puente', 'La Verne', 'Lakewood',
  'Lancaster', 'Lawndale', 'Lomita', 'Long Beach', 'Los Angeles',
  'Lynwood', 'Malibu', 'Manhattan Beach', 'Maywood', 'Monrovia',
  'Montebello', 'Monterey Park', 'Norwalk', 'Palmdale', 'Palos Verdes Estates',
  'Paramount', 'Pasadena', 'Pico Rivera', 'Pomona', 'Rancho Palos Verdes',
  'Redondo Beach', 'Rolling Hills', 'Rolling Hills Estates', 'Rosemead',
  'San Dimas', 'San Fernando', 'San Gabriel', 'San Marino', 'Santa Clarita',
  'Santa Fe Springs', 'Santa Monica', 'Sierra Madre', 'Signal Hill',
  'South El Monte', 'South Gate', 'South Pasadena', 'Temple City',
  'Torrance', 'Vernon', 'Walnut', 'West Covina', 'West Hollywood',
  'Westlake Village', 'Whittier'
];

await supabase.schema('treasury').from('municipalities')
  .update({ county_id: LA_COUNTY_ID })
  .eq('state', 'CA')
  .in('name', LA_COUNTY_CITY_NAMES);
```

### TypeScript Municipality type update

```typescript
// src/types/budget.ts — add county_id field
export interface Municipality {
  id: string;
  name: string;
  state: string;
  entity_type: 'city' | 'county' | 'township' | 'nonprofit';
  population: number;
  population_year?: number | null;
  hero_image_url?: string | null;
  county_id?: string | null;           // NEW — UUID reference to parent county municipality
  available_datasets: Array<{
    fiscal_year: number;
    dataset_type: 'operating' | 'revenue' | 'salaries' | 'all_funds_requirements';
  }>;
}
```

### CitiesInCountyPanel component skeleton

```tsx
// src/components/CitiesInCountyPanel.tsx
import React from 'react';
import type { Municipality } from '../types/budget';

interface CitiesInCountyPanelProps {
  county: Municipality;
  municipalities: Municipality[];
  onCityClick: (city: Municipality) => void;
}

const CitiesInCountyPanel: React.FC<CitiesInCountyPanelProps> = ({
  county, municipalities, onCityClick
}) => {
  const cities = municipalities.filter(
    m => m.county_id === county.id && m.entity_type === 'city'
  );
  const withData = cities.filter(c => c.available_datasets.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const withoutData = cities.filter(c => c.available_datasets.length === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (cities.length === 0) return null;

  return (
    <div className="mt-8 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6">
      <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">
        Cities in {county.name}
      </h2>

      {withData.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 mb-2">
            Available now ({withData.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {withData.map(city => (
              <button key={city.id} onClick={() => onCityClick(city)}
                className="px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] dark:bg-ev-gray-700 hover:bg-ev-muted-blue/10 text-ev-muted-blue border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg transition-colors duration-150">
                {city.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {withoutData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-400 mb-2">
            Coming soon ({withoutData.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {withoutData.map(city => (
              <span key={city.id}
                className="px-3 py-1.5 text-sm text-ev-gray-400 bg-[#F7F7F8] dark:bg-ev-gray-900 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg">
                {city.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CitiesInCountyPanel;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LA County data from city-aggregate (ju3w-4gxp) | County-government data from county dataset (uctr-c2j8) | Phase 25 | Correct attribution; accurate ~$32-38B vs inflated figures |
| No county-city relationship in schema | county_id FK on municipalities | Phase 25 | Enables county page + city breadcrumb |
| County in EntitySwitcher only | County + bidirectional navigation | Phase 25 | County page shows city roster; cities show county link |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ev-accounts-api SELECT `*` from municipalities (auto-includes new county_id column) | API Changes Required | If SELECT is explicit, Plan 03 frontend work is blocked until Render service updated |
| A2 | All 88 identified LA County cities are correct (no city in DB that is misattributed to LA County) | County-City Linking Scope | A city incorrectly linked would show wrong county breadcrumb |

**Both assumptions are LOW risk.** A1 can be verified after Plan 02 by hitting the API and checking the response. A2 uses the official LA County incorporated cities list (88 cities).

---

## Open Questions (RESOLVED)

1. **ev-accounts-api SELECT column list** — RESOLVED: Plan 03 Task 1 is a blocking `checkpoint:human-verify` that requires verifying `curl https://ev-accounts-api.onrender.com/api/treasury/cities | jq '.[0].county_id'` returns a non-undefined value before any frontend code runs. If absent, the Render service SELECT must be updated before proceeding.
   - What we know: The `/api/treasury/cities` endpoint returns municipality objects. The source is Render-hosted ev-accounts-api.
   - What's unclear: Whether the SELECT is explicit (must add `county_id`) or `SELECT *` (automatic).
   - Recommendation: After Plan 02 migration runs, verify the API response includes `county_id` before implementing Plan 03 frontend changes. If missing, create a task in Plan 03 to update the Render service SELECT.

2. **FY2025 operating row disposition** — RESOLVED: Plan 01 Task 1 is a `checkpoint:decision` that puts this choice to the user before any deletes run. Research recommends deletion (the ~$44.1B figure is misleading city-aggregate data); user confirms or overrides at runtime.
   - What we know: The FY2025 operating row (~$44.1B) was loaded from city-aggregate data (wrong source). County data does not have FY2025. D-01 says "delete all existing operating and revenue."
   - What's unclear: Should FY2025 operating be deleted (leaving FY2025 with only salaries) or left intact (keeping wrong-source data)?
   - Recommendation: Delete it. The ~$44B figure is misleading. The county page will show FY2021–2024 operating correctly. If the user prefers to keep it, they should say so before Plan 01 executes.

3. **Breadcrumb render condition for county chip on top-level view** — RESOLVED: Plan 03 Task 3 action step 3 explicitly changes the condition from `breadcrumbItems.length > 2` to `countyEntity != null || breadcrumbItems.length > 2` so the county chip always renders for linked cities.
   - What we know: Line 677 in App.tsx: `{breadcrumbItems.length > 2 && <Breadcrumb items={breadcrumbItems} />}` — hides breadcrumb when only county + city (2 items, no drill-down).
   - What's unclear: D-09 says "add county as a clickable breadcrumb above the city name" — implies it should always show on city pages with county_id, not just during drill-down.
   - Recommendation: Change condition to `(countyEntity != null || breadcrumbItems.length > 2)` so the county breadcrumb always renders for linked cities.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All scripts | ✓ | (project active) | — |
| @supabase/supabase-js | All loaders | ✓ | ^2.100.1 | — |
| SUPABASE_SERVICE_KEY | All DB writes | ✓ | set in .env | — |
| mcp__supabase-local (MCP) | Schema migration | ✓ | (project uses it) | Manual SQL via execute_sql |
| CA State Controller Socrata API | Data reload | ✓ | FY2003–FY2024 | None needed |
| ev-accounts-api (Render) | API response shape | ✓ | External service | — |

---

## Validation Architecture

Plan execution verification (no formal test framework in this project):

### Phase Requirements → Verification Map

| Behavior | Type | Verification Command |
|----------|------|---------------------|
| LA County operating FY2021-2024 reloaded from uctr-c2j8 | Data | `SELECT fiscal_year, total_budget FROM treasury.budgets WHERE municipality_id='f3db6f9f-...' AND dataset_type='operating' ORDER BY fiscal_year` → expect ~32B, 33B, 35B, 38B |
| LA County revenue FY2021-2024 reloaded from emxv-k8xv | Data | Same query for dataset_type='revenue' → expect ~32B, 34B, 36B, 39B |
| LA County population = 10014009 | Data | `SELECT population, population_year FROM treasury.municipalities WHERE id='f3db6f9f-...'` |
| No orphaned data_source_id on budget rows | Data | `SELECT count(*) FROM treasury.budgets WHERE municipality_id='f3db6f9f-...' AND data_source_id IS NULL AND dataset_type IN ('operating','revenue')` → 0 |
| county_id column exists on municipalities | Schema | Supabase JS client SELECT returns county_id field |
| All 88 LA County cities have county_id set | Data | `SELECT count(*) FROM treasury.municipalities WHERE county_id='f3db6f9f-...'` → 88 |
| San Diego city has SD County county_id | Data | SELECT on San Diego row |
| API returns county_id | API | `curl https://ev-accounts-api.onrender.com/api/treasury/cities` → check LA city entry |
| City breadcrumb shows county | UI | Manual — select Los Angeles city, verify county chip above city name |
| County page shows Cities panel | UI | Manual — select LA County, verify "Cities in Los Angeles County" panel |

---

## Security Domain

This phase introduces no authentication changes, no user-facing input, no secrets, and no PII. All data operations use the service role key already in `.env`. No ASVS categories are newly applicable.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: Supabase DB query] — municipalities table schema, LA County row, all CA municipalities
- [VERIFIED: Supabase DB query] — budget rows for LA County with data_source_ids
- [VERIFIED: Supabase DB query] — treasury.data_sources rows for LA County
- [VERIFIED: Socrata API query] — uctr-c2j8 fiscal years available (FY2003–FY2024 only)
- [VERIFIED: Socrata API query] — emxv-k8xv fiscal years available (FY2003–FY2024 only)
- [VERIFIED: Socrata API query] — operating and revenue totals by FY from county datasets
- [VERIFIED: codebase] — src/App.tsx breadcrumb logic, render condition, entity state
- [VERIFIED: codebase] — src/components/Breadcrumb.tsx component interface
- [VERIFIED: codebase] — src/components/EntitySwitcher.tsx county group label
- [VERIFIED: codebase] — src/types/budget.ts Municipality interface (no county_id)
- [VERIFIED: codebase] — scripts/loadLACountyOperating.js and loadLACountyRevenue.js
- [VERIFIED: API query] — https://ev-accounts-api.onrender.com/api/treasury/cities response shape

### Secondary (MEDIUM confidence)
- [ASSUMED] LA County incorporated cities list (88 cities) — cross-referenced against known CA county boundaries; high confidence but not verified against an authoritative government source in this session

---

## Metadata

**Confidence breakdown:**
- Data reload scope (FY): HIGH — directly verified via Socrata API
- DB current state: HIGH — directly queried
- Schema migration pattern: HIGH — established project pattern
- county_id seeding list: HIGH — all 88 cities confirmed in DB via query
- API county_id inclusion: MEDIUM — depends on ev-accounts-api SELECT implementation (open question)
- UI patterns: HIGH — existing Breadcrumb component verified, CitiesInCountyPanel is new

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable datasets; Socrata FY2025 publication could change any time)
