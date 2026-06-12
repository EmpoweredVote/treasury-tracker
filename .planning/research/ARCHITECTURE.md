# Architecture Patterns — MA County-City Linking

**Domain:** Subsequent milestone on an existing financial transparency app
**Researched:** 2026-06-10
**Overall confidence:** HIGH — all findings verified by direct source code inspection

---

## Q1: Seeding 14 MA County Rows + Linking 351 Cities

### Verdict: New standalone seeder script, modeled on `seedLACountyLinks.js`

**Rationale:** The existing `seedLACountyLinks.js` is the canonical pattern for exactly this
operation. It performs county row INSERT + batch UPDATE of city `county_id` FKs, is idempotent,
supports `--dry-run`, and handles the "county row may already exist" edge case. Copy it and
adapt for MA.

Do not use a one-time SQL migration. Migrations live in `supabase/migrations/` and are for
DDL (schema changes). The `county_id` column already exists — this is pure data seeding. A
Node.js script with Supabase client writes matches every precedent in the codebase.

Do not extend an existing seeder. `seedLACountyLinks.js` is scoped to CA. Creating a parallel
`seedMACountyLinks.js` keeps concerns isolated and follows the one-script-per-state convention
already established (see `seedPortlandOregon.js`, `seedCaliforniaCities.js`, etc.).

**Script design (from LA pattern):**

```
Step 1: INSERT 14 county rows (entity_type='county', state='MA', with Census population)
        — detect already-existing rows, skip, build name→id map
Step 2: UPDATE 351 MA municipalities SET county_id = [county id]
        — keyed by city name IN (...) grouped per county
        — state='MA' guard prevents cross-state contamination
Step 3: Dry-run mode prints what would happen without writes
```

**Critical difference from LA:** LA has 88 cities assigned to one county. MA has 351 cities
spread across 14 counties. The script must encode the city→county mapping either as a
lookup table (Map of county name → city name array) or execute 14 separate UPDATE batches,
one per county. The IN-list UPDATE approach from LA works here; just run it 14 times.

**Key facts to encode in the script:**
- 14 county names (Barnstable, Berkshire, Bristol, Dukes, Essex, Franklin, Hampden,
  Hampshire, Middlesex, Nantucket, Norfolk, Plymouth, Suffolk, Worcester)
- 9 are dissolved/navigation-only (no government budget): Berkshire, Essex, Franklin,
  Hampden, Hampshire, Middlesex, Plymouth, Worcester, and potentially Dukes/Nantucket —
  but all 14 still get `entity_type='county'` rows so city breadcrumbs work
- 2024 Census population for each county
- The city→county assignment for all 351 municipalities (source: MA DLS DOR code data
  or Census TIGER county subdivision)

**Integration point:** `treasury.municipalities` table — direct Supabase client writes,
same schema used by `seedLACountyLinks.js`.

---

## Q2: County Budget Loading — Existing Loaders vs. New Script

### Verdict: New script needed for MA county budgets; existing loaders do not apply

**Why existing loaders don't work:**

| Loader | Why Not |
|--------|---------|
| `bulkLoadBudget.js` | Socrata SODA API only; MA counties do not publish on Socrata |
| `loadMaGFExcel.js` | Reads `docs/MA/GenFundExpenditures{YYYY}.xlsx` files which contain **city-level** data (351 rows per file keyed by DOR code). County government budgets are a separate source. |
| `loadLACountyOperating.js` | CA State Controller dataset (`uctr-c2j8`) — county-specific, California only |
| `scrapeMaDLS.js` | Scrapes city-level DLS portal; the 5 active MA county governments have their own separate budget publications |

**What county budget data looks like:** MA county governments (Barnstable, Bristol, Dukes,
Nantucket, Norfolk) each publish annual budgets as PDFs or Excel files from their own
websites. There is no unified MA county budget portal analogous to the CA State Controller.

**Recommendation:** Use the same PDF pipeline (`bulkLoadPDF.js` + Claude Haiku vision) or
an Excel/CSV approach matching the source format for each of the 5 active counties. Given
that loadMaGFExcel.js already handles Excel parsing + `treasury_sync_budget_tree` RPC calls
for MA cities, a new `loadMACountyBudget.js` script can re-use those same patterns (ExcelJS
or pdftotext) adapted to county-specific source formats.

**The `treasury_sync_budget_tree` RPC is entity-type agnostic.** It takes `p_data_source_id`
(UUID pointing to a municipality row of any entity_type), `p_fiscal_year`, `p_dataset_type`,
`p_total`, `p_tree`, `p_row_count`, `p_triggered_by`. County budget rows insert identically
to city budget rows. No RPC changes needed.

**Data source setup:** Each county needs a `treasury.data_sources` row with
`municipality_id` pointing to the county's municipalities row (created in Q1). The 5 active
county loaders will INSERT these data_source rows on first run, matching the pattern in
`loadMaGFExcel.js` lines 229–268.

**Format research needed per county** before writing the loader:
- Barnstable County: Check barnstablecounty.org for budget PDFs/Excel
- Bristol County: Check bristolcounty.org
- Dukes County: Small — Martha's Vineyard Commission
- Nantucket County: Combined with town of Nantucket (unusual consolidated structure)
- Norfolk County: Check norfolkcounty.org

Nantucket is a consolidated county-town (like San Francisco in CA) — may need special
handling. Plan phase should investigate whether a separate county budget exists or whether
the town budget is the same document. San Francisco was intentionally excluded from county
linking (see `seedLACountyLinks.js` line 14 comment D-06).

---

## Q3: EntitySwitcher — Changes Needed for MA Counties?

### Verdict: No changes needed. Zero-code.

**Confirmed by reading `src/components/EntitySwitcher.tsx` in full:**

Lines 58–95 group municipalities by `state` → `entity_type`. The grouping logic is
fully data-driven:

```typescript
const byState = new Map<string, Map<string, Municipality[]>>();
for (const m of cityEntities) {
  if (!byState.has(m.state)) byState.set(m.state, new Map());
  const stateMap = byState.get(m.state)!;
  const type = m.entity_type;      // string key, no whitelist
  if (!stateMap.has(type)) stateMap.set(type, []);
  stateMap.get(type)!.push(m);
}
```

`ENTITY_TYPE_LABELS` (lines 12–23) already maps `'county'` → `'Counties'`. Any municipality
with `entity_type='county'` will appear under a "Counties" subheader within its state section.

The **only gate** is `getCities()` in ev-accounts-api, which uses
`HAVING COUNT(b.id) > 0` (confirmed line 394 of `treasuryService.ts`). A county entity
only appears in the picker once it has at least one budget row. This means:
- The 5 active county rows appear automatically once county budget data is loaded.
- The 9 navigation-only (dissolved) county rows will NOT appear in the picker because
  they have no budget data — which is correct behavior per out-of-scope spec.

**STATE_NAMES['MA'] = 'Massachusetts'** is already present in `src/utils/wikiImage.ts`
(confirmed in Phase 38 research). MA county entities will appear under the "Massachusetts"
header without any code change.

---

## Q4: CitiesInCountyPanel — Changes Needed for MA Counties?

### Verdict: No changes needed. Zero-code.

**Confirmed by reading `src/components/CitiesInCountyPanel.tsx` in full:**

```typescript
const cities = municipalities.filter(
  m => m.county_id === county.id && m.entity_type === 'city'
);
```

The filter is purely data-driven: it matches any municipality whose `county_id` FK points
to the selected county entity, regardless of state or city count. MA counties with 20–60
cities each are well within the component's rendering capability. The panel already handles
two tiers — "Available now" (cities with budget data) and "Coming soon" (cities without).

For MA, all 351 cities already have budget data (Phase 38 complete), so they will all render
in the "Available now" section. The flex-wrap layout handles any number of city chips.

**App.tsx wiring (lines 454–458, 956–963):**

```typescript
// countyEntity derivation — works for any entity with county_id
const countyEntity = useMemo(() =>
  selectedEntity?.county_id
    ? municipalities.find(m => m.id === selectedEntity.county_id) ?? null
    : null,
  [selectedEntity, municipalities]
);

// County panel render — keyed only on entity_type === 'county'
{navigationPath.length === 0 && selectedEntity?.entity_type === 'county' && (
  <CitiesInCountyPanel ... />
)}
```

Both the county breadcrumb chip and the CitiesInCountyPanel are wired entirely on
`county_id` FK and `entity_type === 'county'` — no state-specific logic anywhere.

However, note one subtlety: `CitiesInCountyPanel` filters `m.entity_type === 'city'`. MA
municipalities are stored with `entity_type='city'` per Phase 38 research (all 351 MA city
rows have entity_type='city'). Town, village, and other MA entity subtypes are stored the
same way. No change needed.

---

## Q5: ev-accounts-api Impact Assessment

### Verdict: No changes needed to getCities(), getBudgetById(), or any API endpoint.

**getCities() (treasuryService.ts lines 380–398):**
The query is a generic `SELECT ... FROM treasury.municipalities` with no state or
entity_type filters. The only filter is `HAVING COUNT(b.id) > 0`. MA county rows appear
automatically once budget data is loaded. `county_id` is already a selected column
(line 383, confirmed).

**getBudgetById() (treasuryService.ts lines 514–670):**
Queries `treasury.budgets WHERE id = $1` — entity-type agnostic. County budgets are stored
in the same `treasury.budgets` table. No changes needed.

**Enrichment join (lines 532–558):**
The LEFT JOIN to `treasury.category_enrichment` uses `e_city.municipality_id = b.municipality_id`
and falls back to `e_univ.municipality_id IS NULL`. MA county budgets can use the same
universal MA enrichment already loaded (14 category descriptions). If county-specific
enrichment is needed later, it can be added as municipality-scoped rows without API changes.

**URL routing:**
`App.tsx` derives the URL slug via `toSlug()` which does
`${m.name.toLowerCase().replace(/\s+/g, '-')}-${m.state.toLowerCase()}`.
"Barnstable County" → `barnstable-county-ma`. This is unique and collision-free.

---

## Build Order and Dependencies

The dependency chain is strict:

```
Step 1: scripts/seedMACountyLinks.js (NEW)
        — INSERT 14 county rows
        — UPDATE 351 city county_id FKs
        — Prerequisite: nothing (county_id column already exists)
        ↓ county UUIDs now exist
Step 2: scripts/loadMACountyBudget.js (NEW, one per county or one multi-county)
        — INSERT data_source rows for 5 active counties
        — Call treasury_sync_budget_tree RPC for each county's budget data
        — Prerequisite: county rows from Step 1
        ↓ budget rows created for 5 active counties
Step 3: Automatic — no code changes
        — getCities() returns the 5 active counties with available_datasets
        — EntitySwitcher shows "Counties" section under Massachusetts
        — County breadcrumb chip appears on MA city pages (county_id set)
        — CitiesInCountyPanel renders city list on county pages
```

Steps 3+ require zero code changes. The entire frontend and API path already works.

---

## Component Boundary Map

| Component | File | Change Needed | Why |
|-----------|------|---------------|-----|
| County row seeder | `scripts/seedMACountyLinks.js` (NEW) | Create | No MA analog exists |
| County budget loader | `scripts/loadMACountyBudget.js` (NEW) | Create | MA county budget format unknown; source format research needed |
| `EntitySwitcher` | `src/components/EntitySwitcher.tsx` | None | Fully data-driven by entity_type |
| `CitiesInCountyPanel` | `src/components/CitiesInCountyPanel.tsx` | None | Fully data-driven by county_id FK |
| `App.tsx` | `src/App.tsx` | None | County breadcrumb and panel wiring already generic |
| ev-accounts-api `getCities()` | `C:/EV-Accounts/backend/src/lib/treasuryService.ts` | None | No entity_type filter; county_id already returned |
| ev-accounts-api `getBudgetById()` | same file | None | Entity-type agnostic |
| `treasury.municipalities` | Supabase DB | Data only (INSERT + UPDATE) | Schema already has county_id, entity_type, population |
| `treasury.budgets` | Supabase DB | Data only (INSERT via RPC) | Same RPC used for all entity types |

**New files to create:** 2 scripts only
**Files to modify:** 0 (frontend, API, DB schema — all already support this pattern)

---

## Data Flow: County Seeding + Linking + Budget Loading

```
scripts/seedMACountyLinks.js
  ├── INSERT 14 county rows into treasury.municipalities
  │     fields: name, state='MA', entity_type='county', population, population_year=2024
  ├── Build name→uuid map from INSERT results + already-existing rows
  └── 14x UPDATE treasury.municipalities SET county_id = [county uuid]
        WHERE state='MA' AND name IN ([city list for that county])

scripts/loadMACountyBudget.js (per county, once source formats confirmed)
  ├── For each of 5 active counties:
  │     ├── Fetch/parse county budget source (Excel/PDF — format TBD per county)
  │     ├── Find or INSERT treasury.data_sources row
  │     │     municipality_id = county uuid from seeder
  │     ├── Build budget tree (same {n, a, i} shape as all other loaders)
  │     └── Call treasury_sync_budget_tree RPC
  └── Print summary

  → treasury.budgets rows created for 5 counties
  → getCities() returns these 5 counties in available_datasets
  → EntitySwitcher shows them under "Massachusetts > Counties"
  → CitiesInCountyPanel renders city list on each county page
  → County breadcrumb chip appears on each linked MA city page
```

---

## Reusable Patterns

### Pattern 1: County Seeder (copy seedLACountyLinks.js)
The entire structure of `seedLACountyLinks.js` is reusable. Key changes for MA:
- Replace `COUNTY_ROWS_TO_INSERT` array with 14 MA counties (with Census population)
- Replace `LA_COUNTY_CITY_NAMES` single-county list with a per-county Map:
  `const MA_COUNTY_CITIES = new Map([['Barnstable County', ['Barnstable', 'Bourne', ...]], ...])`
- Run 14 UPDATE batches instead of 1

### Pattern 2: Budget Loader (copy loadMaGFExcel.js skeleton)
`loadMaGFExcel.js` has the right structure for MA county budget loading:
- Supabase client init with service key (`SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_ROLE_KEY`)
- `--dry-run` parseArgs pattern
- data_source find-or-create + fiscal_years append/dedup (LOAD-03 pattern)
- `treasury_sync_budget_tree` RPC call
- If loading multiple counties/years: progress checkpoint (LOAD-02 pattern)

If source is PDF rather than Excel, use `bulkLoadPDF.js` pattern instead of ExcelJS parsing.

### Pattern 3: Entity-Type Agnostic API
No special casing needed. The entire ev-accounts-api stack treats county, city, state,
and nonprofit entities identically once they have budget rows. This is by design
(confirmed in getCities() and getBudgetById() source).

---

## Confirmed Non-Issues

| Concern | Status |
|---------|--------|
| EntitySwitcher needs MA county section | Not needed — auto-renders via data |
| CitiesInCountyPanel breaks at many cities | Not an issue — flex-wrap handles any count |
| getCities() filters out counties | Not an issue — no entity_type filter in SQL |
| county_id column missing | Already exists — added in v1.5 Phase 25 |
| Breadcrumb chip won't show for MA cities | Will show automatically once county_id is set |
| Budget loading RPC is city-only | RPC is entity-type agnostic |
| API needs county-specific endpoint | Not needed — getCities() + getBudgetById() already serve counties |
| Frontend URL slug collision | "barnstable-county-ma" does not collide with "barnstable-ma" city |

---

## Open Questions (Phase-Specific Research Needed Before Loader Can Be Written)

1. **MA city→county mapping source:** The 351 city assignments need a reliable lookup.
   Best source: MA DLS DOR code table (each DOR code maps to a county) or Census TIGER
   county subdivision file for FIPS 25. The seeder will need to hardcode or derive the mapping.
   The DOR code is parsed by `loadMaGFExcel.js` but is not currently stored in the DB.

2. **MA active county budget sources:** Barnstable, Bristol, Dukes, Nantucket, and Norfolk
   each need a URL and format confirmation before the loader can be written. Dukes and
   Nantucket are small island counties — their budgets may be PDFs only.

3. **Nantucket consolidated status:** Nantucket County and the Town of Nantucket share
   government functions. Determine whether a separate county budget document exists. If not,
   treat as navigation-only (no budget data), same handling as SF County in CA.

4. **Census population for 14 MA counties:** Use the same Census sub-est2024 vintage used
   for MA cities (FIPS 25), but at SUMLEV=050 (county level) rather than SUMLEV=061 (city).

---

## Sources

- `scripts/seedLACountyLinks.js` — canonical county seeder pattern (direct read, full file)
- `scripts/loadMaGFExcel.js` — MA Excel loader pattern (direct read, full file)
- `scripts/loadLACountyOperating.js` — county budget loader pattern (direct read, lines 1–60)
- `src/components/EntitySwitcher.tsx` — entity picker grouping logic (direct read, full file)
- `src/components/CitiesInCountyPanel.tsx` — county panel logic (direct read, full file)
- `src/App.tsx` lines 454–458, 956–963 — county wiring (direct read)
- `C:/EV-Accounts/backend/src/lib/treasuryService.ts` — getCities(), getBudgetById() (direct read, full file)
- `src/types/budget.ts` — Municipality type with county_id (direct read)
- `.planning/phases/38-ma-city-budget-load/38-RESEARCH.md` — MA EntitySwitcher zero-code analysis
- `.planning/PROJECT.md` — milestone definition, existing CA county precedent
