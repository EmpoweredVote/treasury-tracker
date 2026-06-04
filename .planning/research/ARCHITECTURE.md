# Architecture Research: v1.6 California City Expansion
**Researched:** 2026-06-03

---

## Phase Decomposition Recommendation

**Total work items:** 7 new CA cities + 2 carry-forwards (Longview TX revenue, STATE_LABELS fix)

**Recommended grouping: 5 phases**

| Phase | Number | Content | Rationale |
|-------|--------|---------|-----------|
| Sacramento | 26 | Sacramento operating + revenue + enrichment | Unique loader (`loadSacramentoCSV.js`) already exists and references a Sacramento data_source — seed first |
| Longview TX Revenue + STATE_LABELS fix | 27 | Longview revenue load + EntitySwitcher.tsx fix | Two carry-forwards; both are small standalone tasks; bundle to minimize phase overhead |
| Long Beach + San Jose | 28 | Operating + revenue + enrichment for both | Pair large CA cities via Socrata SODA API; LA/SF/SD precedent confirms this loader handles them generically |
| Oakland + Fresno | 29 | Operating + revenue + enrichment for both | Mid-size CA cities; batch similar-loader cities together |
| Riverside + Bakersfield | 30 | Operating + revenue + enrichment for both | Remaining CA cities; same Socrata pattern |

**Rationale for city batching (not one city per phase):**
- All 7 new CA cities will use `bulkLoadBudget.js` with Socrata SODA API (same as LA, SF pattern from Phase 15-16)
- Each city pair requires: seed script additions, 2 x `bulkLoadBudget.js` runs, 1 x `enrichCategories.js` run
- Two cities per phase reduces phase count from 9 to 5 without increasing individual phase risk
- Sacramento gets its own phase because `loadSacramentoCSV.js` already exists and uses a different loader (GitHub CSV, not Socrata)

**Phase numbering rationale:**
- Last v1.5 phase was Phase 25 (la-county-data-completion-county-city-linking)
- v1.6 starts at Phase 26

---

## Seeder Pattern

**Recommendation: Extend `seedCaliforniaCities.js` with a new v1.6 companion file**

Do NOT modify `seedCaliforniaCities.js` directly. Create `seedCaliforniaCitiesV16.js`.

**Why a new file, not modification of the existing one:**

`seedCaliforniaCities.js` was written for Phase 16 (SF, SD, LA Revenue). Its `main()` function is hardcoded around those specific cities, its verification step checks exactly those 5 data source names via `treasury_list_source_ids`, and its comments explicitly label it as "Phase 16". Modifying it would break its idempotency guarantees and make re-run auditing harder.

**What the new seeder must replicate:**

The existing seeder pattern (from reading `seedCaliforniaCities.js`) has these structural components:

1. `upsertMunicipality(m)` — select by `name+state`, update in-place if exists, insert if not; returns `id`
2. `getExistingMunicipalityId(name, state)` — read-only lookup for pre-existing cities (e.g., reusing LA from Phase 15)
3. `upsertDataSourceByName(src)` — select by `name` (primary key for idempotency); update if exists, insert if not; returns full row
4. Factory functions per city/type (e.g., `SF_OPERATING(municipalityId)`, `SF_REVENUE(municipalityId)`) — return data_source payloads with `column_mapping`, `fiscal_years`, `municipality_id`
5. Verification pass via `supabase.rpc('treasury_list_source_ids')` — checks all expected names present

**Sacramento exception:** `loadSacramentoCSV.js` line 179 calls `treasury_list_source_ids` and looks for `'Sacramento Operating Budget'` and `'Sacramento Revenue Budget'` by name. This means the Sacramento data_source rows must exist before `loadSacramentoCSV.js` can run. A Phase 26 seeder must create those rows.

**Data to seed per new city:**
- 1 municipality row (`name`, `state: 'CA'`, `entity_type: 'city'`, `population`, `population_year: 2024`)
- 2 data_source rows (operating + revenue), each with `column_mapping`, `fiscal_years`, `municipality_id`

**Population source:** Census `sub-est2024_6.csv`, SUMLEV=162 (same as SF/SD in Phase 16). Values must be researched per city during Phase 26-30 execution.

---

## STATE_LABELS Fix

**Location:** `src/components/EntitySwitcher.tsx`, lines 21-26

**Current code (already correct as of the file read):**

```typescript
const STATE_LABELS: Record<string, string> = {
  IN: 'Indiana',
  CA: 'California',
  TX: 'Texas',
  OR: 'Oregon',
};
```

**Finding: The fix is already implemented.** The `STATE_LABELS` map already contains full state names. Line 144 of EntitySwitcher.tsx renders `{STATE_LABELS[state] || state}` — if a state code is in the map it shows the full name; if not it falls back to the abbreviation.

**No code change is needed** if the goal was only TX/CA/OR. Indiana is also present, which is likely pre-populated for future use.

**Scope:** Frontend-only. No DB touch, no migration, no API change.

**Action for Phase 27:** Verify the fix is already shipped by spot-checking the live app at treasurytracker.empowered.vote. If the EntitySwitcher already shows "Texas", "California", "Oregon" as group headers — close the ticket immediately. If the abbreviations still appear, there may be a stale build or the file on disk differs from what is deployed; in that case, force a redeploy.

---

## Longview TX Revenue

**What is already seeded:**

From `STATE.md` deferred items, quick_task `002-add-longview-tx-revenue` is marked `complete (SUMMARY.md exists; Longview live in app)`. However, `STATE.md` also lists this as a v1.6 active item: "Longview TX revenue data (seeded, revenue missing)". This contradiction requires a DB verification query at phase start.

**What `processLongviewBudget.js` tells us:**

- `insertLongviewMunicipality.js` seeded the municipality row (Longview, TX, id lookup via `ilike('name', 'Longview')`)
- `processLongviewBudget.js` handles **operating** data for FY2026 only (pdftotext pipeline, General Fund departments)
- The operating data_source is `'Longview Operating Budget FY2026'`, `api_type: 'pdf_download'`, `dataset_type: 'operating'`
- **No revenue script exists** — there is no `processLongviewRevenue.js` or equivalent

**What is needed for Longview revenue:**

1. **Research:** Find Longview's revenue data source (City of Longview TX budget documents, likely the same FY2025-26 Master Budget PDF contains a revenue section, or there is a separate CAFR/revenue document)
2. **Script:** A new `processLongviewRevenue.js` or extension of `processLongviewBudget.js` to extract revenue rows from the PDF using pdftotext
3. **Data_source row:** Seed `'Longview Revenue Budget FY2026'` with `dataset_type: 'revenue'`
4. **Enrichment:** Run `enrichCategories.js --city Longview --state TX --year 2026` after revenue load

**Loader choice:** pdftotext (same as operating), since Longview is a small TX city without a Socrata portal and the Master Budget PDF is already cached at `C:/tmp/longview_budget_fy2526.pdf`.

---

## Build Order

```
Phase 26 — Sacramento CA
  Step 1: Seed Sacramento municipality + data_sources (new seedCaliforniaCitiesV16.js)
  Step 2: Load operating + revenue via loadSacramentoCSV.js (already written)
  Step 3: Run enrichCategories.js for Sacramento

Phase 27 — Longview TX Revenue + STATE_LABELS carry-forwards
  Step 1: Verify EntitySwitcher.tsx STATE_LABELS fix is live (may already be done)
  Step 2: Research Longview revenue source (Master Budget PDF or CAFR)
  Step 3: Write processLongviewRevenue.js
  Step 4: Seed Longview revenue data_source row
  Step 5: Load revenue, run enrichment

Phase 28 — Long Beach + San Jose CA
  Step 1: Research Socrata dataset IDs for Long Beach and San Jose
  Step 2: Extend seedCaliforniaCitiesV16.js with Long Beach + San Jose
  Step 3: Seed municipalities + data_sources
  Step 4: Load operating + revenue via bulkLoadBudget.js for each city
  Step 5: Run enrichCategories.js for both

Phase 29 — Oakland + Fresno CA
  (Same 5-step pattern as Phase 28)

Phase 30 — Riverside + Bakersfield CA
  (Same 5-step pattern as Phase 28)
```

**Ordering rationale:**
- Sacramento first: `loadSacramentoCSV.js` already exists, lowest research burden, best path to an early win
- Longview + STATE_LABELS second: both are carry-forwards; closing them early removes backlog debt
- CA city pairs (28-30): batched by size/region; Socrata research for all 6 can be done in Phase 28 research and reused across 29-30

---

## Schema Changes Needed

**None.** The existing schema fully supports v1.6:

- `municipalities` table: accepts new rows with `name`, `state`, `entity_type`, `population`, `population_year`
- `data_sources` table: `column_mapping` JSONB field already handles `fiscal_year_type: 'integer'`, `where_extra`, all Socrata column keys
- `budgets` + `budget_categories` + `budget_line_items`: populated via existing `treasury_sync_budget_tree` RPC; no structural changes needed
- `enrichment` table: populated via existing `enrichCategories.js`; no structural changes needed
- `county_id` FK on municipalities: new CA cities can be optionally linked to their county government if/when CA county data is loaded, but this is not required for v1.6

The `fiscal_years` array on data_source rows will vary per city based on what the source publishes — this is data configuration, not schema.
