# Phase 11: Population Schema, Census Data Load, and Per-Capita Display - Research

**Researched:** 2026-05-21
**Domain:** PostgreSQL schema migration, Census CSV parsing, Node.js data loader, frontend display update
**Confidence:** HIGH — all findings verified against live codebase and downloaded Census CSV

---

## Summary

Phase 11 adds `population_year` to `treasury.municipalities`, loads 2024 Census vintage population data for 12 TX cities, and updates the frontend per-capita label to include the population source year.

The work touches **three codebases** and one data file:
1. **Supabase DB** — `ALTER TABLE` migration via numbered SQL file in `EV-Accounts/backend/migrations/`
2. **treasury-tracker** — new `loadPopulation.js` loader script using the established Supabase-direct pattern
3. **EV-Accounts backend** — update `getCities()` query in `treasuryService.ts` to SELECT `population_year`; update `TreasuryCity` and `CityRow` types; update `mapCity()` to include `population_year` in the response
4. **treasury-tracker frontend** — update `QuickFactsRow` per-capita label from "Based on X residents" to "Based on X residents (2024 est.)"

**Primary recommendation:** Keep the loader script in `treasury-tracker/scripts/` using `@supabase/supabase-js` direct writes (the same pattern used by `insertLongviewMunicipality.js` and all budget loaders). The Census CSV is at `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_48.csv` — unauthenticated download confirmed working.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.100.1 | Direct DB writes from loader script | Already in package.json; all loaders use this |
| Node.js built-in `https` | N/A | Download Census CSV | No external dependency needed |
| Node.js built-in `fs` | N/A | Read downloaded CSV | Standard |
| Node.js built-in `readline` | N/A | Stream-parse large CSV | Avoids loading 325K file fully into memory (optional — file is small enough for `fs.readFileSync`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:util` `parseArgs` | N/A | `--dry-run` flag | Already used by all other loaders (Garland, Wylie, Longview) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/supabase-js` direct write | `pool.query()` via EV-Accounts | Loader lives in treasury-tracker repo, which has supabase-js installed; pool is only in EV-Accounts |
| Manual CSV parse | `csv-parse` library | File is simple comma-separated with no embedded commas in relevant fields; manual split is fine |

**Installation:** No new packages needed — `@supabase/supabase-js` is already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
treasury-tracker/
├── scripts/
│   └── loadPopulation.js      # NEW — Census CSV parser + DB writer
EV-Accounts/
├── backend/
│   ├── migrations/
│   │   └── 194_population_year.sql   # NEW — adds population_year column
│   └── src/lib/
│       └── treasuryService.ts       # UPDATE — add population_year to getCities query + types
treasury-tracker/
└── src/components/dashboard/
    └── QuickFactsRow.tsx            # UPDATE — change per-capita subtext label
```

### Pattern 1: Migration File (EV-Accounts)

**What:** Numbered SQL file in `EV-Accounts/backend/migrations/` — the single authoritative pattern for all schema changes in this project.

**When to use:** Any time a column is added, renamed, or removed from any `treasury.*` table.

**Example:**
```sql
-- 194_population_year.sql
-- Add population_year column to treasury.municipalities
-- Tracks the vintage year of the Census population estimate stored in the population column.

ALTER TABLE treasury.municipalities
  ADD COLUMN IF NOT EXISTS population_year INTEGER;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'treasury'
  AND table_name = 'municipalities'
  AND column_name IN ('population', 'population_year');
```

**How applied:** Via Supabase Dashboard → SQL Editor. Migration files are NOT auto-applied — they are documentation and a runnable script. The `IF NOT EXISTS` guard makes it idempotent.

**Next migration number:** The highest existing migration is `193_ca_federal_officials.sql` (there is also `191_politician_sources_source_type.sql`). Use `194_population_year.sql`.

### Pattern 2: Loader Script (treasury-tracker/scripts/)

**What:** Node.js ESM script using `@supabase/supabase-js` to download a data file, parse it, and UPDATE existing rows in the DB.

**When to use:** All data loads in this project.

**Key conventions from existing loaders:**
- `#!/usr/bin/env node` shebang
- ESM (`import` not `require`) — `"type": "module"` in package.json
- `process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co'` hardcoded fallback
- `process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY`
- `createClient(url, key, { db: { schema: 'treasury' } })`
- `parseArgs` from `node:util` for `--dry-run`
- Explicit "already set" skip logic for idempotence
- Cache downloaded file to `C:/tmp/` path

**Example (UPDATE pattern, not INSERT):**
```javascript
// Source: insertLongviewMunicipality.js pattern adapted for batch UPDATE
const { error } = await supabase
  .from('municipalities')
  .update({ population: 113746, population_year: 2024 })
  .eq('name', 'Allen')
  .eq('state', 'TX');
```

### Pattern 3: EV-Accounts Service Layer Update

**What:** When a DB column is added, the EV-Accounts `treasuryService.ts` must be updated in three places:
1. The `CityRow` interface (raw DB row shape)
2. The `TreasuryCity` interface (public API shape)
3. The `mapCity()` function (DB → API transformation)
4. All SQL SELECT statements that read from `treasury.municipalities` (`getCities()`, `getCityById()`)

**Why:** The service uses `pool.query()` with explicit column SELECTs — it never does `SELECT *`. New columns are invisible until added to the query.

**Example update to `getCities()`:**
```sql
SELECT m.id, m.name, m.state, m.entity_type, m.population, m.population_year,
       m.hero_image_url, m.created_at, m.updated_at, ...
FROM treasury.municipalities m
```

**Note:** `population_year` will be `null` for most non-TX cities initially — the `TreasuryCity.population_year` type must be `number | null`.

### Pattern 4: Frontend Label Update

**What:** `QuickFactsRow.tsx` currently shows `subtext={`Based on ${population.toLocaleString()} residents`}`. The `entity` prop has `population: number` but needs `population_year: number | null` added to display the label.

**Current code (line 71):**
```tsx
subtext={`Based on ${population.toLocaleString()} residents`}
```

**Target code:**
```tsx
subtext={populationYear
  ? `Based on ${population.toLocaleString()} residents (${populationYear} est.)`
  : `Based on ${population.toLocaleString()} residents`}
```

The `entity` prop shape in `QuickFactsRow` must gain `population_year?: number | null`.

### Anti-Patterns to Avoid

- **Don't use `supabase.schema('treasury').from('municipalities').update()`** — The existing DB query in `insertLongviewMunicipality.js` uses this pattern (`supabase.schema('treasury')`), but note that `createClient(..., { db: { schema: 'treasury' } })` and `.schema('treasury')` chaining are both valid — use the `createClient` config approach (consistent with all other loaders).
- **Don't SELECT * in the service layer** — EV-Accounts treasuryService uses explicit column lists. Never add `SELECT *`.
- **Don't write to EV-Accounts DB from the treasury-tracker loader** — The loader uses Supabase-js directly (service role key), which bypasses the API entirely. This is the correct approach for bulk admin loads.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Census CSV download | Custom download manager | Node.js built-in `https.get()` pipe to `fs.createWriteStream()` | Already used in processGarlandBudget.js, processLongviewBudget.js |
| CSV parsing | Custom parser | Simple `line.split(',')` on header-parsed row | CSV has no embedded commas in NAME/STNAME fields |
| Name normalization | Complex fuzzy matching | Simple string replace: strip ` city`, ` town` suffix, trim | Only two suffix variants needed; all 12 cities confirmed in CSV |
| Migration runner | Custom apply script | Supabase Dashboard → SQL Editor | Established project pattern for all 193 prior migrations |

**Key insight:** This phase is simpler than it appears. The "hard" work (per-capita display UI) is already built. The loader is a batch UPDATE of 12 rows, not a complex import pipeline.

---

## Common Pitfalls

### Pitfall 1: Missing `population_year` in EV-Accounts Response
**What goes wrong:** After DB migration + data load, frontend still shows "Based on X residents" with no year, or `population_year` is `undefined` in the API response.
**Why it happens:** The EV-Accounts `getCities()` SQL query uses explicit column SELECT — new columns are silently invisible until added to the query string.
**How to avoid:** After running the migration, update `treasuryService.ts` (CityRow interface, TreasuryCity interface, mapCity() function, getCities() SQL, getCityById() SQL). Then redeploy EV-Accounts.
**Warning signs:** API response has `population` but not `population_year`; frontend shows no year label even after data is loaded.

### Pitfall 2: Census Name Mismatch
**What goes wrong:** Loader script fails to find "Prosper" or "Celina" because the Census uses "Prosper town" and "Celina city".
**Why it happens:** Census NAME column includes the legal place type suffix (city/town/village).
**How to avoid:** Strip the suffix before matching. The normalization rule is: remove ` city` or ` town` (space + suffix) from the end of the Census NAME string, then match against `municipalities.name`.
**Confirmed mappings from live CSV:**
```
"Allen city"       → "Allen"
"Celina city"      → "Celina"
"Frisco city"      → "Frisco"
"Garland city"     → "Garland"
"McKinney city"    → "McKinney"
"Murphy city"      → "Murphy"
"Plano city"       → "Plano"
"Princeton city"   → "Princeton"
"Prosper town"     → "Prosper"        ← NOTE: "town" not "city"
"Richardson city"  → "Richardson"
"Sachse city"      → "Sachse"
"Wylie city"       → "Wylie"
```

### Pitfall 3: `population_year` NULL for Non-TX Cities Breaks TypeScript
**What goes wrong:** TypeScript compilation fails because `QuickFactsRow` entity prop doesn't allow `population_year: null`.
**Why it happens:** Only TX cities will have `population_year` set; all other cities will have `null`.
**How to avoid:** Add `population_year?: number | null` to the entity prop interface (not `population_year: number`).

### Pitfall 4: Loader Writes to Wrong Schema
**What goes wrong:** `supabase.from('municipalities')` without schema specification fails or updates wrong table.
**Why it happens:** The Supabase client defaults to `public` schema.
**How to avoid:** Always use `createClient(url, key, { db: { schema: 'treasury' } })` as in all other loaders. Confirmed: all existing loaders set this schema option.

### Pitfall 5: EV-Accounts Needs Redeployment
**What goes wrong:** The `population_year` column is in the DB and loaded, but the frontend never shows the year.
**Why it happens:** EV-Accounts (Node.js API on Render) has its code cached — a deploy is needed after `treasuryService.ts` changes.
**How to avoid:** Commit and push EV-Accounts changes; Render auto-deploys on push (autoDeploy: true in render.yaml).

---

## Code Examples

### Census CSV Download + Parse (confirmed working pattern)
```javascript
// Source: downloaded and verified C:/tmp/sub-est2024_48.csv 2026-05-21
// URL: https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_48.csv
// No authentication required.

// Header row (verified):
// SUMLEV,STATE,COUNTY,PLACE,COUSUB,CONCIT,PRIMGEO_FLAG,FUNCSTAT,NAME,STNAME,
// ESTIMATESBASE2020,POPESTIMATE2020,POPESTIMATE2021,POPESTIMATE2022,POPESTIMATE2023,POPESTIMATE2024

// Filter: SUMLEV === '162' (incorporated places)
// Column index 0 = SUMLEV, index 8 = NAME, index 15 = POPESTIMATE2024

const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
const header = lines[0].split(',');
const sumlevIdx = 0;  // always
const nameIdx = 8;    // verified
const pop2024Idx = 15; // verified POPESTIMATE2024

for (const line of lines.slice(1)) {
  const cols = line.split(',');
  if (cols[sumlevIdx] !== '162') continue;
  const censusName = cols[nameIdx];         // e.g. "Prosper town"
  const population = parseInt(cols[pop2024Idx], 10);
  const dbName = normalizeCensusName(censusName); // strip suffix
}

function normalizeCensusName(name) {
  return name
    .replace(/ city$/, '')
    .replace(/ town$/, '')
    .replace(/ village$/, '')
    .trim();
}
```

### Confirmed 2024 Population Values for 12 TX Cities
```
Allen          → 113,746  (POPESTIMATE2024)
Celina         →  51,661
Frisco         → 235,208
Garland        → 250,431
McKinney       → 227,526
Murphy         →  21,109
Plano          → 293,286
Princeton      →  37,019
Prosper        →  44,503
Richardson     → 118,221
Sachse         →  33,008
Wylie          →  62,954
```
Source: `sub-est2024_48.csv` downloaded 2026-05-21 from census.gov, SUMLEV=162 rows.

### Supabase UPDATE Pattern (from insertLongviewMunicipality.js)
```javascript
// Source: scripts/insertLongviewMunicipality.js — established project pattern
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

const { error } = await supabase
  .from('municipalities')
  .update({ population: 113746, population_year: 2024 })
  .eq('name', 'Allen')
  .eq('state', 'TX');

if (error) {
  console.error(`Failed to update Allen: ${error.message}`);
}
```

### EV-Accounts Type Update (treasuryService.ts)
```typescript
// Source: C:\EV-Accounts\backend\src\lib\treasuryService.ts — current state (no population_year)
// Add population_year to these locations:

// 1. CityRow interface (raw DB row)
interface CityRow {
  // ... existing fields ...
  population_year: string | null; // smallint returned as string by pg driver
}

// 2. TreasuryCity interface (public shape)
export interface TreasuryCity {
  // ... existing fields ...
  population_year: number | null;
}

// 3. mapCity() function
function mapCity(row: CityRow): TreasuryCity {
  return {
    // ... existing fields ...
    population_year: row.population_year !== null ? Number(row.population_year) : null,
  };
}

// 4. getCities() SQL — add m.population_year to SELECT
`SELECT m.id, m.name, m.state, m.entity_type, m.population, m.population_year,
        m.hero_image_url, m.created_at, m.updated_at, ...`
// Same addition needed in getCityById() SQL.
```

---

## Current Schema State

### `treasury.municipalities` — Verified Columns (2026-05-21)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | NO | Primary key |
| name | text | NO | |
| state | text | NO | |
| entity_type | text | NO | default 'municipality' |
| population | integer | YES | Exists but NULL for all 12 TX cities |
| population_year | — | — | **DOES NOT EXIST YET** — must be added |
| hero_image_url | text | YES | |
| created_at | timestamptz | NO | |
| updated_at | timestamptz | NO | |

**Key finding:** `population` column already exists in the table. Only `population_year` needs to be added. Both `population` and `population_year` need values loaded for the 12 TX cities.

### Exact DB Names for the 12 TX Cities

| DB `name` | DB `id` | Current `population` |
|-----------|---------|---------------------|
| Allen | 9f031b8b-9740-4583-89d3-c63f27c41ef6 | NULL |
| Celina | 7bb0a0e7-9be3-44bf-9676-b5af67de0d2a | NULL |
| Frisco | 264035bb-5d59-4954-ae44-324d0c2e8a42 | NULL |
| Garland | fd659c24-4870-455f-936c-815ea516dce2 | NULL |
| McKinney | a7e3459c-cb55-4f74-9ba9-f40e23323767 | NULL |
| Murphy | 1bddfc90-01cb-4f6b-89c3-ac011c0bd532 | NULL |
| Plano | e02a955e-74af-4643-8f69-aa203d4f315b | NULL |
| Princeton | 43f10ae9-6789-47d0-9ddc-8078192062d2 | NULL |
| Prosper | 35bbfa9d-63a5-4d08-8c4b-f609db54e9d9 | NULL |
| Richardson | 515912fb-38cc-4afe-856d-7f412e90c568 | NULL |
| Sachse | bc67db4a-cfc0-4d76-b053-1e4ca69f0b85 | NULL |
| Wylie | 13c35569-f44d-4354-86f0-28f578c32669 | NULL |

Source: Live DB query 2026-05-21 via `@supabase/supabase-js`.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Population hardcoded in loader scripts (e.g. Longview: 83000) | Census CSV download + parse | This phase moves from ad-hoc to systematic |
| No `population_year` tracking | `population_year: integer` column | New in this phase |
| Frontend shows "Based on X residents" | Frontend shows "Based on X residents (2024 est.)" | Label update in QuickFactsRow |

**Deprecated/outdated:**
- Hardcoded population values in loader scripts (Longview uses `population: 83000`): This phase establishes the Census-sourced approach, but the Longview value was already manually set. The loader should not overwrite Longview — it should only process the 12 TX cities in scope.

---

## Open Questions

1. **EV-Accounts deployment coordination**
   - What we know: Render autoDeploys on push to main. The EV-Accounts changes are in a separate repo (`C:\EV-Accounts`).
   - What's unclear: Is there a deploy gate/review process, or can we push directly?
   - Recommendation: Treat as a standard code commit + push. Document the multi-repo change clearly in the PLAN.

2. **`population_year` data type**
   - What we know: The locked decision says `integer`. The Census vintage year (2024) fits in SMALLINT too.
   - What's unclear: Should it be `SMALLINT` (2 bytes) or `INTEGER` (4 bytes)?
   - Recommendation: Use `INTEGER` as specified. Consistency with other integer columns; negligible storage difference for a table with hundreds of rows.

3. **Frontend prop threading for `population_year`**
   - What we know: `QuickFactsRow` receives an `entity` prop. The entity is assembled in `App.tsx` or a parent component from the `Municipality` type.
   - What's unclear: Whether `population_year` needs to be added to the `Municipality` type in `budget.ts` and threaded through `App.tsx`, or if it can be added only to the component prop interface.
   - Recommendation: Add `population_year?: number | null` to the `Municipality` interface in `src/types/budget.ts`, the `listMunicipalities()` return type, and the `QuickFactsRow`/`PlainLanguageSummary` entity prop shapes. This is a mechanical 4-file change.

---

## Sources

### Primary (HIGH confidence)
- Live DB query via `@supabase/supabase-js` — municipalities schema and 12 TX city names/IDs verified 2026-05-21
- `C:\EV-Accounts\backend\src\lib\treasuryService.ts` — full API layer code read directly
- `C:\EV-Accounts\backend\src\routes\treasury.ts` — route structure verified
- `C:\EV-Accounts\backend\migrations\` — migration naming pattern verified (001–193)
- `C:\treasury-tracker\src\components\dashboard\QuickFactsRow.tsx` — per-capita gate and label verified
- `C:\treasury-tracker\src\components\dashboard\PlainLanguageSummary.tsx` — per-capita display verified
- `C:\treasury-tracker\src\types\budget.ts` — Municipality and BudgetData types verified
- `C:/tmp/sub-est2024_48.csv` downloaded 2026-05-21 from `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_48.csv` — all 12 TX cities confirmed present with POPESTIMATE2024 values

### Secondary (MEDIUM confidence)
- `C:\treasury-tracker\scripts\insertLongviewMunicipality.js` — loader pattern (direct source, HIGH)
- `C:\treasury-tracker\scripts\processGarlandBudget.js` — CSV download + parse pattern (direct source, HIGH)
- `C:\treasury-tracker\.planning\phases\03-webhook-backend\schema-migration.sql` — migration style (ALTER TABLE IF NOT EXISTS with verify query)

---

## Metadata

**Confidence breakdown:**
- Current DB schema: HIGH — live query confirmed
- 12 TX city DB names + IDs: HIGH — live query
- Census CSV format + 12 city values: HIGH — file downloaded and parsed
- EV-Accounts API layer: HIGH — source code read directly
- Frontend per-capita gate: HIGH — source code read directly
- Migration pattern: HIGH — 193 prior examples in EV-Accounts
- Loader script pattern: HIGH — 15+ examples in treasury-tracker/scripts/
- EV-Accounts redeployment impact: MEDIUM — autoDeploy confirmed in render.yaml; actual deploy timing not tested

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable — Census CSV doesn't change; schema is static)
