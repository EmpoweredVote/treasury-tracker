# Phase 40: MA County Seeding + City Linking — Research

**Researched:** 2026-06-10
**Domain:** Census county population data, MA county-city FIPS mapping, Supabase county_id FK seeding
**Confidence:** HIGH

---

## Summary

Phase 40 is a pure data-seeding phase: insert 5 MA county rows into `treasury.municipalities` with 2024 Census populations, then UPDATE `county_id` on all MA cities belonging to those counties. Zero frontend changes, zero API changes, zero new packages. The pattern is fully established from Phase 25 (`seedLACountyLinks.js`).

**Critical finding:** The Census sub-est2024_25.csv file (already used in Phase 39 for population loading, same URL) contains a `COUNTY` column (index 2) with the 3-digit county FIPS code for every SUMLEV=061 row. This means `seedMACountyLinks.js` can derive the city-to-county mapping directly from the same Census file — no separate Gazetteer download needed. The county FIPS codes are embedded in the GEOID: `25` + `COUNTY_3_DIGIT` for MA.

**Complete city-to-county mapping is now verified** (see Architectural Responsibility Map and Code Examples sections). All 5 active county city lists have been cross-checked against the DLS DB names — every municipality name matches exactly.

**2024 Census populations verified for all 5 active counties:**
- Barnstable County: 232,570
- Bristol County: 588,593
- Dukes County: 21,061
- Norfolk County: 740,754
- Plymouth County: 542,090

**Primary recommendation:** Write `scripts/seedMACountyLinks.js` following the `seedLACountyLinks.js` pattern. Use hardcoded city lists (derived from Census Gazetteer, verified against DLS DB names). Hardcoding is cleaner and more auditable than dynamic CSV parsing for this use case — there are only 94 total cities across 5 counties, and the list is geographically stable.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COUNTY-01 | 5 MA county municipality rows seeded in DB (entity_type='county', state='MA', population from 2024 Census) | Census co-est2024 county file verified; populations for all 5 active counties confirmed |
| COUNTY-02 | All MA cities in those 5 counties have county_id FK set to corresponding county row | Complete city lists extracted from Census Gazetteer; all names verified against DLS DB names |
| COUNTY-03 | County breadcrumb chip appears on MA city pages for all cities linked via county_id (zero frontend changes) | Verified: wiring from Phase 25 is generic; activates automatically when county_id is non-null |
| UI-01 | CitiesInCountyPanel visible on each of the 5 county pages (zero frontend changes) | Verified: CitiesInCountyPanel is already data-driven from Phase 25 |
| UI-02 | Per-capita displays correctly on county pages using loaded Census 2024 county population | Verified: activates when population > 0; same as city behavior |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| County row INSERT | Script (CLI) | Supabase DB | One-time seeder writes 5 rows to treasury.municipalities |
| City county_id UPDATE | Script (CLI) | Supabase DB | Batch UPDATE by name for each county's city list |
| County breadcrumb display | Frontend (existing) | ev-accounts-api (existing) | Phase 25 already wired generically; no changes needed |
| CitiesInCountyPanel data | Backend (existing) | — | getCities() already filters by county_id |
| Per-capita display | Frontend (existing) | — | PlainLanguageSummary.tsx checks population > 0 |

---

## Standard Stack

### Core — No New Packages Required

All tooling exists. This phase is a script-only data operation.

| Tool | Version | Purpose | Status |
|------|---------|---------|--------|
| `@supabase/supabase-js` | installed | DB writes via service-role key | Already in project |
| `node:util` parseArgs | Node built-in | `--dry-run` flag parsing | Already used in seedLACountyLinks.js |
| Census co-est2024-alldata.csv | public URL | County 2024 populations (verified) | Hardcode from verified values — no download needed |

**No new packages to install.**

### Package Legitimacy Audit

No new packages are installed in this phase. Audit: N/A.

---

## Pre-Existing DB State

[VERIFIED: from Phase 38-02-SUMMARY.md, Phase 39-04-SUMMARY.md, codebase inspection 2026-06-10]

| Entity | Count | Status |
|--------|-------|--------|
| MA municipalities (`state='MA'`, `entity_type='city'`) | 351 | All loaded by Phase 38; FY2002–2025 budget data loaded |
| MA municipalities with `county_id IS NOT NULL` | ~0 MA cities | No MA county_id values set yet |
| `county_id` column in treasury.municipalities | Exists | Added in Phase 25; FK to municipalities.id |
| Existing county rows (state='MA') | 0 | No MA county rows exist yet |
| Massachusetts state entity | 1 | entity_type='state'; population=~7.1M |

**Key constraint:** `county_id UUID REFERENCES treasury.municipalities(id)` — the county rows must be INSERTed before the city UPDATE runs (FK dependency).

---

## Architecture Patterns

### System Architecture Diagram

```
seedMACountyLinks.js
│
├── Step 1: INSERT 5 county rows
│         entity_type='county', state='MA'
│         population = 2024 Census county figure (hardcoded, verified)
│         → Returns new UUIDs for Barnstable, Bristol, Dukes, Norfolk, Plymouth
│         (idempotent: skip if name+state already exists)
│
├── Step 2: UPDATE county_id for cities in each county
│         WHERE state='MA' AND name IN [hardcoded list]
│         county_id = <uuid from Step 1>
│         (15 Barnstable + 20 Bristol + 7 Dukes + 28 Norfolk + 27 Plymouth = 97 cities)
│         Note: 351 - 97 = 254 cities retain county_id=NULL (dissolved counties + Nantucket)
│
└── Step 3: Verify
          SELECT COUNT(*) WHERE state='MA' AND county_id IS NOT NULL → expected 99
          SELECT county_id, COUNT(*) GROUP BY county_id → 5 groups of expected sizes
```

### Recommended Project Structure

```
scripts/
├── seedMACountyLinks.js    # NEW — follows seedLACountyLinks.js pattern exactly
└── seedLACountyLinks.js    # EXISTING — canonical reference implementation
```

### Pattern: seedMACountyLinks.js

**Follows `seedLACountyLinks.js` exactly.** Three sections: constants, Step 1 (INSERT counties), Step 2 (UPDATE city county_ids). Both operations are idempotent. Dry-run mode supported via `--dry-run` flag.

```javascript
// Source: scripts/seedLACountyLinks.js (established pattern)
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

// Step 1: INSERT 5 county rows (skip existing by name+state check)
const COUNTY_ROWS = [
  { name: 'Barnstable County', state: 'MA', entity_type: 'county', population: 232570, population_year: 2024 },
  { name: 'Bristol County',    state: 'MA', entity_type: 'county', population: 588593, population_year: 2024 },
  { name: 'Dukes County',      state: 'MA', entity_type: 'county', population: 21061,  population_year: 2024 },
  { name: 'Norfolk County',    state: 'MA', entity_type: 'county', population: 740754, population_year: 2024 },
  { name: 'Plymouth County',   state: 'MA', entity_type: 'county', population: 542090, population_year: 2024 },
];

// Step 2: City lists for each county (verified against DLS DB names)
const BARNSTABLE_CITIES = [
  'Barnstable', 'Bourne', 'Brewster', 'Chatham', 'Dennis', 'Eastham',
  'Falmouth', 'Harwich', 'Mashpee', 'Orleans', 'Provincetown', 'Sandwich',
  'Truro', 'Wellfleet', 'Yarmouth',
]; // 15 cities

const BRISTOL_CITIES = [
  'Acushnet', 'Attleboro', 'Berkley', 'Dartmouth', 'Dighton', 'Easton',
  'Fairhaven', 'Fall River', 'Freetown', 'Mansfield', 'New Bedford',
  'North Attleborough', 'Norton', 'Raynham', 'Rehoboth', 'Seekonk',
  'Somerset', 'Swansea', 'Taunton', 'Westport',
]; // 20 cities (Note: Nantucket NOT here — no Bristol county for Nantucket)

const DUKES_CITIES = [
  'Aquinnah', 'Chilmark', 'Edgartown', 'Gosnold', 'Oak Bluffs',
  'Tisbury', 'West Tisbury',
]; // 7 cities

const NORFOLK_CITIES = [
  'Avon', 'Bellingham', 'Braintree', 'Brookline', 'Canton', 'Cohasset',
  'Dedham', 'Dover', 'Foxborough', 'Franklin', 'Holbrook', 'Medfield',
  'Medway', 'Millis', 'Milton', 'Needham', 'Norfolk', 'Norwood',
  'Plainville', 'Quincy', 'Randolph', 'Sharon', 'Stoughton', 'Walpole',
  'Wellesley', 'Westwood', 'Weymouth', 'Wrentham',
]; // 28 cities (Note: no 'Braintree' — Gazetteer has 'Braintree Town city', DB has 'Braintree')

const PLYMOUTH_CITIES = [
  'Abington', 'Bridgewater', 'Brockton', 'Carver', 'Duxbury',
  'East Bridgewater', 'Halifax', 'Hanover', 'Hanson', 'Hingham', 'Hull',
  'Kingston', 'Lakeville', 'Marion', 'Marshfield', 'Mattapoisett',
  'Middleborough', 'Norwell', 'Pembroke', 'Plymouth', 'Plympton',
  'Rochester', 'Rockland', 'Scituate', 'Wareham', 'West Bridgewater',
  'Whitman',
]; // 27 cities
```

**Critical naming note:** The Gazetteer uses Census display names like "Barnstable Town city", "Braintree Town city", "Bridgewater Town city", "North Attleborough Town city" — but the DLS DB has `Barnstable`, `Braintree`, `Bridgewater`, `North Attleborough` respectively. The hardcoded lists MUST use the DLS DB names (already verified above).

### Anti-Patterns to Avoid

- **Parsing sub-est CSV to derive county mapping:** The CSV is a valid source, but hardcoding is simpler and more auditable for a one-time seeder. The Gazetteer extraction is already done — just hardcode the lists.
- **Using Census county name (without "County" suffix):** The DB must store "Barnstable County" (not "Barnstable") to avoid slug collision with the city "Barnstable" which already exists. The roadmap explicitly requires this.
- **Setting population=null for county rows:** Unlike the Phase 25 seeder which set population=null (no population loaded at that time for 3 linking-only counties), Phase 40 MUST set population=2024 Census values. UI-02 requires per-capita display, which needs population > 0.
- **Inserting Nantucket:** Nantucket is a consolidated town-county. No Nantucket County row. The existing "Nantucket" city row covers its government. (Same as SF D-06 precedent.)
- **Linking cities in dissolved counties:** The 252 cities in Berkshire, Essex, Franklin, Hampden, Hampshire, Middlesex, Suffolk, Worcester — their county_id must remain NULL. The hardcoded city lists ensure this by omission.

---

## Complete City-to-County Mapping

[VERIFIED: Census Gazetteer 2024_gaz_cousubs_25.txt + DLS DB names cross-checked 2026-06-10]

### Barnstable County (FIPS 001) — 15 cities

| DB Name | Census Name in Gazetteer | Verified |
|---------|--------------------------|---------|
| Barnstable | Barnstable Town city | ✓ |
| Bourne | Bourne town | ✓ |
| Brewster | Brewster town | ✓ |
| Chatham | Chatham town | ✓ |
| Dennis | Dennis town | ✓ |
| Eastham | Eastham town | ✓ |
| Falmouth | Falmouth town | ✓ |
| Harwich | Harwich town | ✓ |
| Mashpee | Mashpee town | ✓ |
| Orleans | Orleans town | ✓ |
| Provincetown | Provincetown town | ✓ |
| Sandwich | Sandwich town | ✓ |
| Truro | Truro town | ✓ |
| Wellfleet | Wellfleet town | ✓ |
| Yarmouth | Yarmouth town | ✓ |

### Bristol County (FIPS 005) — 20 cities

| DB Name | Census Name in Gazetteer | Verified |
|---------|--------------------------|---------|
| Acushnet | Acushnet town | ✓ |
| Attleboro | Attleboro city | ✓ |
| Berkley | Berkley town | ✓ |
| Dartmouth | Dartmouth town | ✓ |
| Dighton | Dighton town | ✓ |
| Easton | Easton town | ✓ |
| Fairhaven | Fairhaven town | ✓ |
| Fall River | Fall River city | ✓ |
| Freetown | Freetown town | ✓ |
| Mansfield | Mansfield town | ✓ |
| New Bedford | New Bedford city | ✓ |
| North Attleborough | North Attleborough Town city | ✓ |
| Norton | Norton town | ✓ |
| Raynham | Raynham town | ✓ |
| Rehoboth | Rehoboth town | ✓ |
| Seekonk | Seekonk town | ✓ |
| Somerset | Somerset town | ✓ |
| Swansea | Swansea town | ✓ |
| Taunton | Taunton city | ✓ |
| Westport | Westport town | ✓ |

### Dukes County (FIPS 007) — 7 cities

| DB Name | Census Name in Gazetteer | Verified |
|---------|--------------------------|---------|
| Aquinnah | Aquinnah town | ✓ |
| Chilmark | Chilmark town | ✓ |
| Edgartown | Edgartown town | ✓ |
| Gosnold | Gosnold town | ✓ |
| Oak Bluffs | Oak Bluffs town | ✓ |
| Tisbury | Tisbury town | ✓ |
| West Tisbury | West Tisbury town | ✓ |

**Note on Gosnold:** This is Cuttyhunk Island (population ~75 per Census 2024). Very small but is a valid MA municipality with DOR code 097. Include in Dukes County linking.

### Norfolk County (FIPS 021) — 28 cities

| DB Name | Census Name in Gazetteer | Verified |
|---------|--------------------------|---------|
| Avon | Avon town | ✓ |
| Bellingham | Bellingham town | ✓ |
| Braintree | Braintree Town city | ✓ |
| Brookline | Brookline town | ✓ |
| Canton | Canton town | ✓ |
| Cohasset | Cohasset town | ✓ |
| Dedham | Dedham town | ✓ |
| Dover | Dover town | ✓ |
| Foxborough | Foxborough town | ✓ |
| Franklin | Franklin Town city | ✓ |
| Holbrook | Holbrook town | ✓ |
| Medfield | Medfield town | ✓ |
| Medway | Medway town | ✓ |
| Millis | Millis town | ✓ |
| Milton | Milton town | ✓ |
| Needham | Needham town | ✓ |
| Norfolk | Norfolk town | ✓ |
| Norwood | Norwood town | ✓ |
| Plainville | Plainville town | ✓ |
| Quincy | Quincy city | ✓ |
| Randolph | Randolph Town city | ✓ |
| Sharon | Sharon town | ✓ |
| Stoughton | Stoughton town | ✓ |
| Walpole | Walpole town | ✓ |
| Wellesley | Wellesley town | ✓ |
| Westwood | Westwood town | ✓ |
| Weymouth | Weymouth Town city | ✓ |
| Wrentham | Wrentham town | ✓ |

### Plymouth County (FIPS 023) — 27 cities

| DB Name | Census Name in Gazetteer | Verified |
|---------|--------------------------|---------|
| Abington | Abington town | ✓ |
| Bridgewater | Bridgewater Town city | ✓ |
| Brockton | Brockton city | ✓ |
| Carver | Carver town | ✓ |
| Duxbury | Duxbury town | ✓ |
| East Bridgewater | East Bridgewater town | ✓ |
| Halifax | Halifax town | ✓ |
| Hanover | Hanover town | ✓ |
| Hanson | Hanson town | ✓ |
| Hingham | Hingham town | ✓ |
| Hull | Hull town | ✓ |
| Kingston | Kingston town | ✓ |
| Lakeville | Lakeville town | ✓ |
| Marion | Marion town | ✓ |
| Marshfield | Marshfield town | ✓ |
| Mattapoisett | Mattapoisett town | ✓ |
| Middleborough | Middleborough town | ✓ |
| Norwell | Norwell town | ✓ |
| Pembroke | Pembroke town | ✓ |
| Plymouth | Plymouth town | ✓ |
| Plympton | Plympton town | ✓ |
| Rochester | Rochester town | ✓ |
| Rockland | Rockland town | ✓ |
| Scituate | Scituate town | ✓ |
| Wareham | Wareham town | ✓ |
| West Bridgewater | West Bridgewater town | ✓ |
| Whitman | Whitman town | ✓ |

**Total cities to link: 15 + 20 + 7 + 28 + 27 = 97 cities**

Note: The Roadmap SC-2 verification query `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND county_id IS NOT NULL` should return 97 after the script runs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| County row INSERT | Manual SQL or new pattern | `seedLACountyLinks.js` pattern | Phase 25 is the canonical implementation; copy structure exactly |
| City-to-county mapping | Census CSV parser at runtime | Hardcoded name lists | Simpler, auditable, geographically stable; no download needed at runtime |
| Slug collision avoidance | Slug-generation logic | "County" suffix in name | "Barnstable County" != "Barnstable"; naming convention handles it |
| FK dependency ordering | Complex transaction handling | Run INSERT before UPDATE | county rows must exist before city UPDATE — just order the steps |
| Idempotency on county INSERT | Complex upsert logic | Fetch existing names, filter missing, insert only new | Same pattern as seedLACountyLinks.js lines 103–149 |

---

## Common Pitfalls

### Pitfall 1: County name without "County" suffix causes slug collision
**What goes wrong:** Inserting county row with name="Barnstable" (without suffix) creates a duplicate for the existing city "Barnstable". The unique constraint on (name, state) or the slug lookup would fail or return wrong data.
**Why it happens:** "Barnstable" is both a city (the county seat) and a county. Same issue exists for "Norfolk" (a town in Norfolk County), "Plymouth" (a town in Plymouth County).
**How to avoid:** Always use "Barnstable County", "Bristol County", etc. — the "County" suffix is required. Already specified in COUNTY-01 requirement.
**Warning signs:** INSERT error `duplicate key value violates unique constraint` or county page resolving to the city instead.

### Pitfall 2: Nantucket mistakenly included
**What goes wrong:** Adding Nantucket to the county rows list would create "Nantucket County" alongside the existing "Nantucket" city row, causing confusion. Nantucket is a consolidated town-county government — the city row IS the government entity.
**Why it happens:** Nantucket County is FIPS 019 and appears in the Gazetteer. Easy to include by mistake.
**How to avoid:** Explicitly exclude FIPS 019 from county row creation. The city "Nantucket" (DOR code 197) has no county_id (remains NULL).
**Warning signs:** Six county rows inserted instead of five; Nantucket city page shows a "Nantucket County" breadcrumb to a duplicate row.

### Pitfall 3: Missing cities due to name normalization differences
**What goes wrong:** Some Census Gazetteer names include " town" or " city" suffix, or "Town city" combo (e.g., "Barnstable Town city", "North Attleborough Town city"). If the script UPDATEs using Census names instead of DLS DB names, no rows match and cities are silently skipped.
**Why it happens:** Census uses display names; DLS data strips the suffix entirely.
**How to avoid:** Use the hardcoded DLS DB names verified in this research document. The UPDATE uses `.in('name', cityList)` with DLS DB names — all 97 names already confirmed to exist in the DLS data.
**Warning signs:** UPDATE returns 0 rows; `SELECT COUNT(*) WHERE county_id IS NOT NULL` is less than 97.

### Pitfall 4: population_year not set on county rows
**What goes wrong:** If `population_year` is null, the PlainLanguageSummary per-capita display may not show (it may check `population_year` in addition to `population > 0`).
**Why it happens:** Phase 25 seeder set population=null and population_year=null for the 3 non-primary county rows. Phase 40 MUST set both.
**How to avoid:** Set `population_year: 2024` on all 5 county rows.
**Warning signs:** County page shows 0 population or no per-capita display despite population being set.

### Pitfall 5: UPDATE matches wrong state's cities
**What goes wrong:** If the UPDATE doesn't filter `state='MA'`, cities in other states with the same name (e.g., "Franklin" exists in many states, "Norfolk" exists in VA and other states) could have their county_id incorrectly set to an MA county.
**Why it happens:** `IN ('Franklin', 'Norfolk', ...)` without a state filter would match any state.
**How to avoid:** Always add `.eq('state', 'MA')` to the UPDATE clause, same pattern as seedLACountyLinks.js Step 2.
**Warning signs:** More than 97 rows updated; cities from other states show wrong county breadcrumbs.

### Pitfall 6: City count verification mismatch — actual is 97, not 351 or some other number
**What goes wrong:** Verification expects wrong count. The total is 97 cities across 5 counties (15+20+7+28+27), NOT 351 (all MA). The other 254 cities remain at county_id=NULL.
**Why it happens:** Confusion about scope — only the 5 active counties get city links.
**How to avoid:** Verify with: `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND county_id IS NOT NULL` — expect 97. Also verify per-county: each should match expected counts above.
**Warning signs:** COUNT returns 251 (missing a county) or 351 (wrongly linked all cities).

---

## Key Facts: 2024 Census County Populations

[VERIFIED: from Census co-est2024-alldata.csv for MA (FIPS 25), via WebFetch 2026-06-10]

| County Name | FIPS | 2024 Population | DB Row Name |
|-------------|------|-----------------|-------------|
| Barnstable County | 001 | 232,570 | "Barnstable County" |
| Bristol County | 005 | 588,593 | "Bristol County" |
| Dukes County | 007 | 21,061 | "Dukes County" |
| Norfolk County | 021 | 740,754 | "Norfolk County" |
| Plymouth County | 023 | 542,090 | "Plymouth County" |

Source: `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv`

---

## Code Examples

### Idempotent County INSERT Pattern

```javascript
// Source: scripts/seedLACountyLinks.js (lines 96–149) — adapt for MA
// Step 1: Insert missing county municipality rows

const { data: existingMA, error: fetchErr } = await supabase
  .schema('treasury')
  .from('municipalities')
  .select('id, name')
  .eq('state', 'MA');

const existingNames = new Set((existingMA || []).map(m => m.name.toLowerCase()));
const missingCounties = COUNTY_ROWS.filter(
  r => !existingNames.has(r.name.toLowerCase())
);

if (missingCounties.length > 0 && !dryRun) {
  const { data: inserted, error: insertErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .insert(missingCounties)
    .select('id, name');
  // Map name → uuid for Step 2
}
```

### City county_id UPDATE Pattern

```javascript
// Source: scripts/seedLACountyLinks.js (lines 160–184) — adapt for MA
// Step 2: Set county_id for each county's cities

const { data: updated, error } = await supabase
  .schema('treasury')
  .from('municipalities')
  .update({ county_id: barnstableCountyId })
  .eq('state', 'MA')
  .in('name', BARNSTABLE_CITIES)
  .select('id, name');

// Repeat for Bristol, Dukes, Norfolk, Plymouth
// Each UPDATE should log count and warn if count != expected (15/20/7/28/27)
```

### DB Verification Queries

```sql
-- COUNTY-01: Verify 5 county rows exist with population
SELECT name, population, population_year
FROM treasury.municipalities
WHERE state='MA' AND entity_type='county'
ORDER BY name;
-- Expected: 5 rows, all population > 0

-- COUNTY-02: Verify city count per county
SELECT m2.name AS county, COUNT(m1.id) AS city_count
FROM treasury.municipalities m1
JOIN treasury.municipalities m2 ON m1.county_id = m2.id
WHERE m1.state = 'MA' AND m1.entity_type = 'city'
GROUP BY m2.name
ORDER BY m2.name;
-- Expected:
-- Barnstable County | 15
-- Bristol County    | 20
-- Dukes County      | 7
-- Norfolk County    | 28
-- Plymouth County   | 27

-- Overall count
SELECT COUNT(*) FROM treasury.municipalities
WHERE state='MA' AND county_id IS NOT NULL;
-- Expected: 97

-- COUNTY-03 / UI-01 / UI-02: Spot-check — open these pages in app:
-- Plymouth city → should show "Plymouth County →" breadcrumb
-- Taunton city → should show "Bristol County →" breadcrumb
-- Edgartown city → should show "Dukes County →" breadcrumb
-- Quincy city → should show "Norfolk County →" breadcrumb
-- Barnstable city → should show "Barnstable County →" breadcrumb
```

---

## Excluded Municipalities — Dissolved Counties (for documentation)

The following 9 MA counties are dissolved / non-functional. Their cities retain `county_id=NULL`.

| County | FIPS | Status |
|--------|------|--------|
| Berkshire | 003 | Dissolved |
| Essex | 009 | Dissolved |
| Franklin | 011 | Dissolved |
| Hampden | 013 | Dissolved |
| Hampshire | 015 | Dissolved |
| Middlesex | 017 | Dissolved |
| Nantucket | 019 | Consolidated town-county — no county row (same as SF D-06) |
| Suffolk | 025 | Dissolved |
| Worcester | 027 | Dissolved |

Cities in these counties (approximately 254 of 351 MA municipalities) remain at county_id=NULL.

---

## Runtime State Inventory

> Rename/refactor trigger: NO — this is a greenfield data seeding phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 351 MA municipalities with county_id=NULL | seedMACountyLinks.js: INSERT 5 county rows, UPDATE 97 city county_id values |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | SUPABASE_SERVICE_KEY required | Confirm in .env before running |
| Build artifacts | None | — |

**Nothing found in remaining categories** — verified by Phase 39-04-SUMMARY.md and STATE.md current position.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | seedMACountyLinks.js | Yes | v24.13.0 | — |
| `@supabase/supabase-js` | DB writes | Yes | installed | — |
| `SUPABASE_SERVICE_KEY` | DB writes | Yes (in .env) | — | — |
| Supabase DB | All DB ops | Yes | kxsdzaojfaibhuzmclfq | — |

**No missing dependencies.** Phase has no external HTTP calls if population values are hardcoded (recommended).

---

## Validation Architecture

> `workflow.nyquist_validation` absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification — no automated test suite for scripts/ |
| Config file | none |
| Quick run command | `node scripts/seedMACountyLinks.js --dry-run` |
| Full suite command | DB verification queries (above) + human spot-check of 5 city pages in app |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| COUNTY-01 | 5 county rows exist with population | DB query | `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND entity_type='county' AND population > 0` | Expected: 5 |
| COUNTY-01 | County populations match Census 2024 | DB query | `SELECT name, population FROM treasury.municipalities WHERE state='MA' AND entity_type='county' ORDER BY name` | Verify values match research doc |
| COUNTY-02 | 97 MA cities have county_id set | DB query | `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND county_id IS NOT NULL` | Expected: 97 |
| COUNTY-02 | Per-county city counts correct | DB query | GROUP BY county JOIN query (see Code Examples) | Expected: 15/20/7/28/27 |
| COUNTY-03 | Breadcrumb visible on linked city pages | manual | Open Plymouth, Taunton, Barnstable city pages in app | Breadcrumb should show county name |
| UI-01 | CitiesInCountyPanel shows linked cities | manual | Open each of 5 county pages in app | Panel should list available cities |
| UI-02 | Per-capita displays on county pages | manual | Open Barnstable County page in app | Should show $/resident |

### Sampling Rate

- **Per task commit:** `node scripts/seedMACountyLinks.js --dry-run` before live run
- **Per wave merge:** Full DB verification queries
- **Phase gate:** All 7 success criteria verified before phase close

### Wave 0 Gaps

- `scripts/seedMACountyLinks.js` — does not exist yet; must be created

*(No test infrastructure gaps beyond the new script)*

---

## Security Domain

This phase makes no changes to authentication, session management, API endpoints, or input validation paths. All operations are Supabase writes via service-role key (same as all other seeders). No new API endpoints, no new user-facing input surfaces.

No ASVS categories apply. Security posture unchanged.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No county structure for MA | 5 active MA county rows with city links | Phase 40 (this phase) | County breadcrumbs and CitiesInCountyPanel activate automatically for all 97 linked cities |
| Phase 25 set population=null for non-primary county rows | Phase 40 sets population from 2024 Census for all county rows | Phase 40 (this phase) | Per-capita activates on county pages immediately |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 2024 Census county populations (232,570 / 588,593 / 21,061 / 740,754 / 542,090) are the 2024 vintage figures from co-est2024-alldata.csv | Key Facts section | If wrong, per-capita figures on county pages would be inaccurate. Mitigate: verified via WebFetch of co-est2024-alldata.csv directory and sample data |
| A2 | All 97 DB municipality names (DLS format, no " town"/" city" suffix) exactly match what was seeded in Phase 38 | City-to-county mapping | If any name was stored differently in DB, the UPDATE would silently skip that city. Mitigate: all 97 names verified against DLS JSON output; script should warn on count mismatch |
| A3 | Gosnold (Dukes County, population ~75) is in the DB as "Gosnold" with entity_type='city' | Dukes county list | If Gosnold is missing or has a different name in DB, UPDATE would skip it. Mitigate: DOR code 097 was in the 351-city bulk load from Phase 38 |
| A4 | The county_id FK constraint allows setting county_id to a UUID that was just inserted in the same transaction scope | Architecture | If FK check is deferred differently in Supabase, INSERT then UPDATE approach may fail. Mitigate: same pattern worked in Phase 25 for LA County; Supabase JS client handles sequential operations correctly |
| A5 | `Nantucket` in the DB has `entity_type='city'` (not 'county') | Excluded municipalities | If Nantucket was somehow seeded as entity_type='county', the script should skip it. Mitigate: REQUIREMENTS.md explicitly states no Nantucket County row |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
A1-A5 are all LOW risk given the direct evidence trail.

---

## Open Questions (RESOLVED)

1. **Gosnold municipality presence in DB**
   - What we know: Gosnold (DOR code 097) is one of 351 MA municipalities in the DLS data loaded in Phase 38. It should be in the DB.
   - What's unclear: Whether Phase 38's bulk load successfully loaded Gosnold (the DLS data includes it, but it's a tiny island municipality that may have had a data scraping issue).
   - RESOLVED: Include Gosnold in the Dukes County city list. Script warns if Dukes UPDATE returns 6 instead of 7 — count=6 is acceptable (non-blocking). A post-run spot-check `SELECT id FROM treasury.municipalities WHERE state='MA' AND name='Gosnold'` confirms DB presence.

2. **Norfolk county city count: 28 or 29?**
   - What we know: The Gazetteer shows 28 unique municipalities for Norfolk County (FIPS 021). The research verification above found 28 cities.
   - What's unclear: Whether Cohasset should be in Norfolk or Plymouth. (Cohasset is in Norfolk County per Gazetteer FIPS 021.)
   - RESOLVED: Trust the Gazetteer — Cohasset is in Norfolk County. Count is 28. The Norfolk city list in NORFOLK_CITIES[] includes Cohasset and counts 28 names exactly.

---

## Sources

### Primary (HIGH confidence)
- `scripts/seedLACountyLinks.js` — Canonical county seeding pattern; read in full (2026-06-10)
- `scripts/loadMAPopulation.js` — Census sub-est CSV format confirmed (SUMLEV, COUNTY columns); normalization pattern (2026-06-10)
- `scripts/output/ma_dls_special-revenue_2025_expenditures.json` — All 351 DLS municipality names verified; cross-checked county city lists against these names (2026-06-10)
- Census sub-est2024_25.csv headers from Phase 39 research (VERIFIED 2026-06-10): SUMLEV(0), STATE(1), COUNTY(2), PLACE(3), COUSUB(4), CONCIT(5), PRIMGEO_FLAG(6), FUNCSTAT(7), NAME(8), STNAME(9)...POPESTIMATE2024(15)
- `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_cousubs_25.txt` — Complete MA county subdivision listing with GEOID county FIPS codes; all 351 municipalities mapped to 14 counties (VERIFIED via WebFetch 2026-06-10)
- `.planning/phases/39-ma-population-state-budget-and-enrichment/39-RESEARCH.md` — Census URL format, SUMLEV analysis, Phase 38 DB state facts
- `.planning/phases/39-ma-population-state-budget-and-enrichment/39-04-SUMMARY.md` — Phase 39 complete; 351 MA cities fully loaded and operational

### Secondary (MEDIUM confidence)
- `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv` — 2024 MA county populations extracted via WebFetch (2026-06-10)
- Census county FIPS codes for MA: confirmed 14 counties (001–027 odd, plus 019 Nantucket)

### Tertiary (LOW confidence)
- None required — all critical findings are HIGH/MEDIUM.

---

## Metadata

**Confidence breakdown:**
- County populations: HIGH — verified from Census co-est2024 file
- City-to-county mapping: HIGH — verified from Census Gazetteer 2024 AND cross-checked against DLS DB names
- Script pattern: HIGH — directly copies seedLACountyLinks.js which is proven in production
- City count (97): HIGH — manually verified per county from Gazetteer
- Gosnold inclusion in DB: MEDIUM — in DLS data, should have loaded in Phase 38

**Research date:** 2026-06-10
**Valid until:** 2027-06-10 (Census Gazetteer data and county boundaries are stable; MA county dissolution status is legally stable)
