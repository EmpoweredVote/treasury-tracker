# Phase 39: MA Population, State Budget, and Enrichment - Research

**Researched:** 2026-06-10
**Domain:** Census population loading, MA state budget upgrade, universal category enrichment
**Confidence:** HIGH (all findings sourced from direct codebase inspection + live Census URL verification)

---

## Summary

Phase 39 has three independent, parallel workstreams:

**MA-04 (Population):** A new `loadMAPopulation.js` script follows the exact pattern of `loadORPopulation.js` and `loadTXPopulation.js`. The Census URL is `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_25.csv` (MA FIPS = 25, confirmed). Critical difference from prior state scripts: MA towns use **SUMLEV=061** (not SUMLEV=162). The sub-est2024_25.csv contains 357 rows at SUMLEV=061 and 49 rows at SUMLEV=162 (all 49 also appear at SUMLEV=061, so use SUMLEV=061 only). One confirmed name mismatch: Census uses "Manchester-by-the-Sea" but DLS uses "Manchester By The Sea." The script must handle normalization of this case explicitly. No frontend changes needed — `PlainLanguageSummary.tsx` already shows per-capita when `entity.population > 0`.

**STATE-01 (MA State Budget):** `loadMaGFExcel.js` already exists (untracked in git) and loads city-level General Fund data from `docs/MA/GenFundExpenditures*.xlsx` files (FY2002–FY2025 already on disk). However, this loads per-city data keyed by DOR code — it is **city-level** data, not MA state government budget data. The existing MA state entity (municipality named "Massachusetts", `entity_type: 'state'`) was seeded by `processMA.js` with hardcoded estimates. STATE-01 requires replacing these estimates with real data. The most practical approach: `loadMaGFExcel.js` is the mechanism for loading city-level GF data for Phase 39's city enrichment support; the MA state government budget upgrade requires either (a) running `processMA.js` with improved real figures from budget.digital.mass.gov, or (b) a separate approach. **This is the one open question that requires planner decision** — see Open Questions.

**ENRICH-01 (Universal Enrichment):** Run `enrichCategories.js` against ONE MA city (e.g., Boston) for 14 categories → produces 14 enrichment rows with that city's `municipality_id`. Then run a SQL UPDATE to set `municipality_id = NULL` on those 14 rows. This converts them to universal enrichments. The `getBudgetById` SQL in ev-accounts-api already has a dual-JOIN: `e_city` (municipality-specific) + `e_univ` (municipality_id IS NULL). Universal enrichments serve all 351 cities via the `e_univ` JOIN without any per-city re-enrichment. Cost: 14 AI calls × $0.0002/call ≈ $0.004 total (well under $5 gate).

**Primary recommendation:** Build three plan tasks: (1) `loadMAPopulation.js` script + run, (2) STATE-01 strategy resolution + execution, (3) enrichment of one MA city + universalize SQL UPDATE. All three are independent and can be planned as parallel wave tasks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Population data load | Script (CLI) | Census.gov CSV | Script downloads CSV, parses SUMLEV=061 rows, UPDATEs municipalities |
| Per-capita display | Frontend (PlainLanguageSummary.tsx) | — | Already implemented; activates when population > 0 |
| MA state budget upgrade | Script (CLI) | Supabase DB via RPC | Either re-run processMA.js with real figures, or new approach |
| Universal category enrichment | Script (CLI) + SQL UPDATE | Anthropic API | enrichCategories.js creates rows; SQL UPDATE sets municipality_id=NULL |
| Enrichment display on city pages | Backend (ev-accounts-api) | — | getBudgetById already JOINs e_univ on name_key with municipality_id IS NULL |

---

## Standard Stack

### Core — No New Packages Required

All tooling needed for Phase 39 already exists:

| Tool | Version | Purpose | Status |
|------|---------|---------|--------|
| `scripts/loadORPopulation.js` | Phase 17 | Template for loadMAPopulation.js | Copy and modify |
| `scripts/enrichCategories.js` | Phase 14+ | AI enrichment pipeline | Ready to run |
| `scripts/processMA.js` | Phase 33 era | MA state entity loader (hardcoded estimates) | Existing — may need update |
| `scripts/loadMaGFExcel.js` | Phase 39 pre-work | MA city GF Excel loader (untracked) | Exists, city-level only |
| `@supabase/supabase-js` | already installed | DB writes | Already imported |
| Census.gov sub-est2024_25.csv | public URL | 2024 MA population by municipality | Verified accessible |

**No new packages to install.**

### Package Legitimacy Audit

No new packages are installed in this phase. Audit: N/A.

---

## Pre-Existing DB State — Critical for Planning

[VERIFIED: from Phase 38-02-SUMMARY.md, direct code inspection 2026-06-10]

| Entity | Count | Status |
|--------|-------|--------|
| MA municipalities (`state='MA'`, `entity_type='city'`) | 351 | All loaded by Phase 38; NO population data (all `population=0`) |
| MA state entity (`entity_type='state'`, `name='Massachusetts'`) | 1 | Has hardcoded budget rows from `processMA.js` (FY2022–FY2026, estimated) |
| MA DLS `data_sources` (operating) | 351 | Loaded in Phase 38; `fiscal_years: [2025,2021,2022,2023,2024]` |
| MA DLS `data_sources` (revenue) | 351 | Loaded in Phase 38; `fiscal_years: [2025,2021,2022,2023,2024]` |
| `treasury.budgets` for MA 351 cities | 1,761 revenue + 1,565 operating | Loaded in Phase 38 |
| MA cities visible in city picker | 351 | Auto-visible since Phase 38 |
| MA `category_enrichment` rows | 0 for MA DLS categories | No enrichment yet |
| MA state entity `category_enrichment` | some | From prior processMA.js runs; will persist unless --force |

**Key consequence for population:** Every MA municipality has `population = 0` and `population_year = NULL`. Per-capita display is suppressed (`PlainLanguageSummary.tsx` shows per-capita only when `entity.population > 0`). The population load is the only blocker for per-capita display.

---

## Architecture Patterns

### System Architecture Diagram

```
MA-04: Population
────────────────────────────────────────────────────────
Census.gov sub-est2024_25.csv (SUMLEV=061, 357 rows)
       |
       | HTTP download (or cached)
       v
scripts/loadMAPopulation.js
       |
       | filter SUMLEV=061, strip " town"/" city" suffix
       | normalize "Manchester-by-the-Sea" → "Manchester By The Sea"
       | match to municipalities.name WHERE state='MA'
       v
treasury.municipalities UPDATE population, population_year=2024
       |
       v
PlainLanguageSummary.tsx: population > 0 → shows per-capita
         "That's roughly $X per person."

STATE-01: MA State Budget Upgrade
────────────────────────────────────────────────────────
[See Open Question 1]
Either: real mass.gov data → revised processMA.js  (hardcoded but accurate)
Or:     GenFundExpenditures xlsx aggregate → MA state entity rows

ENRICH-01: Universal Category Enrichment
────────────────────────────────────────────────────────
enrichCategories.js --city Boston --state MA --year 2025
       |
       | 14 AI calls @ $0.0002/call ≈ $0.004
       v
treasury.category_enrichment (14 rows, municipality_id = Boston's UUID)
       |
       | SQL UPDATE: set municipality_id = NULL for the 14 MA DLS name_keys
       v
treasury.category_enrichment (14 universal rows, municipality_id IS NULL)
       |
       | getBudgetById LEFT JOIN e_univ ON name_key + municipality_id IS NULL
       v
All 351 MA city pages show enrichment descriptions for their categories
```

### Recommended Project Structure

```
scripts/
├── loadMAPopulation.js     # NEW — follows loadORPopulation.js pattern
├── enrichCategories.js     # EXISTING — run against one MA city
├── processMA.js            # EXISTING — MA state entity loader (may update)
├── loadMaGFExcel.js        # EXISTING (untracked) — city GF Excel loader
└── output/
    └── ma_gf_excel_progress.json  # checkpoint for loadMaGFExcel.js runs
docs/
└── MA/
    ├── GenFundExpenditures2002.xlsx .. GenFundExpenditures2025.xlsx  (FY2002-2025)
    └── GenFundRevenues2002.xlsx ...... GenFundRevenues2025.xlsx      (FY2002-2025)
```

### Pattern 1: loadMAPopulation.js (copy of loadORPopulation.js with MA changes)

**What:** Download Census sub-est2024_25.csv, filter SUMLEV=061 rows, normalize names, UPDATE all 351 MA municipalities.

**Key differences from loadORPopulation.js:**
- URL: `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_25.csv`
- SUMLEV filter: `cols[0] === '061'` (NOT '162')
- City list: All 351 MA municipalities (dynamic — query DB for `state='MA'` instead of hardcoded list)
- Name normalization: extend `normalizeCensusName()` to handle "Manchester-by-the-Sea" → "Manchester By The Sea" and strip " town"/" city"
- Validation: Spot-check a few known values (Boston ~695K, Worcester ~215K, Cambridge ~118K)
- State filter: `state='MA'`

```javascript
// Source: scripts/loadORPopulation.js (pattern copy with MA changes)
const CSV_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_25.csv';
const SUMLEV_FILTER = '061'; // MA uses SUMLEV=061 for towns, not 162

function normalizeCensusName(name) {
  return name
    .replace(/ city$/, '')
    .replace(/ town$/, '')
    .replace(/ village$/, '')
    .replace(/-/g, ' ')         // "Manchester-by-the-Sea" → "Manchester by the Sea"
    .replace(/\b\w/g, c => c.toUpperCase())  // title-case after hyphen split
    .trim();
}

// Query all MA municipalities dynamically (don't hardcode 351 names)
const { data: maMunis } = await supabase
  .from('municipalities')
  .select('id, name')
  .eq('state', 'MA');
const dbNames = new Map(maMunis.map(m => [m.name, m.id]));
```

**Scale:** 351 cities × 1 UPDATE each = 351 DB writes. Add a delay or batch if needed; Supabase can handle 351 sequential updates without rate-limiting concern.

### Pattern 2: Universal Enrichment (run + universalize)

**Step 1: Enrich ONE MA city**

```bash
# Source: enrichCategories.js CLI usage (validated pattern)
# Cost: 14 categories × $0.0002/call ≈ $0.004 — no gate needed
node scripts/enrichCategories.js --city "Boston" --state MA --year 2025
```

This creates 14 rows in `treasury.category_enrichment` with `municipality_id = <boston_uuid>`.

Operating categories (from special-revenue report):
- "Federal General Government Grants"
- "Federal Public Safety Grants"
- "Federal Public Works Grants"
- "Federal Education Grants"
- "Federal Emergency Management Agency"
- "Federal Culture and Recreation Grants"
- "Federal Community Development Block Grants"
- "Other Federal Housing and Urban Development Grants"
- "Other Federal Grants"

Revenue categories (from revenue-by-source report):
- "Tax Levy"
- "State Aid"
- "Local Receipts"
- "All Other"
- "Enterprise & CPA Funds"

**Step 2: Universalize the 14 rows**

```sql
-- Source: treasuryService.ts join logic (verified 2026-06-10)
-- Run via Supabase MCP after enrichment completes
UPDATE treasury.category_enrichment
SET municipality_id = NULL
WHERE municipality_id = (
  SELECT id FROM treasury.municipalities WHERE name = 'Boston' AND state = 'MA'
)
AND name_key IN (
  'federal general government grants',
  'federal public safety grants',
  'federal public works grants',
  'federal education grants',
  'federal emergency management agency',
  'federal culture and recreation grants',
  'federal community development block grants',
  'other federal housing and urban development grants',
  'other federal grants',
  'tax levy',
  'state aid',
  'local receipts',
  'all other',
  'enterprise & cpa funds'
);
```

**Step 3: Verify**

```sql
SELECT name_key, plain_name, municipality_id
FROM treasury.category_enrichment
WHERE name_key IN ('tax levy', 'state aid', 'federal general government grants')
ORDER BY name_key;
-- Expected: all 3 rows show municipality_id = NULL
```

### Pattern 3: Per-Capita Display Verification

The per-capita display is **already fully implemented** in `PlainLanguageSummary.tsx` (lines 85–88, 169–177). No frontend changes needed. After `loadMAPopulation.js` runs and sets `population > 0` for each MA city, the frontend automatically shows:
- "That's roughly **$X per person**." (operating tab)
- "That's **$X per resident**" (revenue tab, line 301)

The `entity.population` value is served by `ev-accounts-api`'s `getCities()` query which already selects `m.population` and `m.population_year` from `treasury.municipalities`.

### Anti-Patterns to Avoid

- **Using SUMLEV=162 for MA population:** The prior TX/OR scripts use SUMLEV=162 (incorporated places). MA has 26 official cities at SUMLEV=162, but the other 325 towns are ONLY at SUMLEV=061. Using SUMLEV=162 would populate only 26 of 351 cities.
- **Hardcoding all 351 MA city names:** Unlike TX (12 cities) and OR (3 cities), MA has 351 municipalities. Query the DB for all `state='MA'` rows instead of maintaining a hardcode list.
- **Running enrichCategories.js --all --state MA:** This would enrich ALL 351 MA cities (14 categories each = 4,914 AI calls at $1.40 cost). The correct approach is ONE city + universalize via SQL.
- **Enriching Boston then enriching Worcester separately:** If two cities are enriched before universalizing, both sets of rows will have `municipality_id != NULL`. The universalize SQL UPDATE must run before the progress file reaches 351 cities.
- **Forgetting the universalize SQL step:** If enrichCategories.js runs but the UPDATE to `municipality_id = NULL` is skipped, only Boston (or whatever seed city was used) will show enrichment. All other MA cities show nothing.
- **Hyphen normalization in census name:** "Manchester-by-the-Sea" in Census becomes "Manchester by the Sea" after basic normalization — but DLS has "Manchester By The Sea" (title case, spaces). The normalization function must produce the exact string the DLS loader stored in the DB.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Census CSV download | Custom HTTP downloader | Reuse `downloadFile()` from `loadORPopulation.js` | Already handles redirects, error codes |
| Per-capita calculation | Custom formula | `PlainLanguageSummary.tsx` (already implemented) | Frontend already divides `total / population` |
| AI enrichment pipeline | Custom Anthropic calls | `enrichCategories.js` | Already handles rate limiting, progress, retry |
| Universal enrichment creation | New script | `enrichCategories.js` + SQL UPDATE | Cleanest 2-step approach |
| Name matching: DLS → Census | Fuzzy matching library | Explicit normalization + one-off overrides Map | Only 1-2 known mismatches; fuzzy matching adds a dependency |
| MA state budget: scrape mass.gov | Web scraper | Real numbers from mass.gov PDFs or XLS, re-hard-code with source citation | processMA.js pattern accepts hardcoded-but-real values; scraping is overkill for estimated state totals |

---

## MA-04: Census Data Deep Dive

### Confirmed Census URL

`https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_25.csv`

[VERIFIED: WebFetch to Census directory index, 2026-06-10]

### SUMLEV Analysis (sub-est2024_25.csv)

| SUMLEV | Meaning | MA row count | Use for MA? |
|--------|---------|-------------|------------|
| 040 | State | 1 | No |
| 050 | County | 14 | No |
| 061 | Town/MCD | 357 | YES — all 351 MA municipalities |
| 157 | County subdivision summary | 51 | No |
| 162 | Incorporated city | 49 | No (all 49 also in SUMLEV=061) |
| 071 | City/town summary | 51 | No |

[VERIFIED: WebFetch content analysis 2026-06-10]

SUMLEV=061 has 357 rows. After filtering to named municipalities (excluding county-level aggregates), we expect 351 matches. The 6 extra rows are likely county subdivisions or summary rows that won't match any DB municipality name.

### Name Normalization Required

Standard normalization from prior scripts:
```javascript
name.replace(/ city$/, '').replace(/ town$/, '').replace(/ village$/, '').trim()
```

MA-specific additional normalization needed:
- `"Manchester-by-the-Sea town"` → normalize to `"Manchester By The Sea"`
  (Census uses hyphens; DLS uses spaces + title case)

The normalization function should:
1. Strip trailing ` city`, ` town`, ` village`
2. Replace hyphens with spaces
3. Title-case each word

This handles the one confirmed mismatch. All other 350 MA municipality names are expected to match directly after suffix stripping. [ASSUMED — only Manchester-by-the-Sea confirmed as mismatch; others not individually verified]

### Known-Good Sanity Values (for script validation)

| City | 2024 Pop | Source |
|------|----------|--------|
| Boston | ~695,000 | Census; MA's largest city [ASSUMED — not extracted from CSV directly] |
| Worcester | ~215,000 | Census [ASSUMED] |
| Cambridge | ~118,000 | Census [ASSUMED] |
| Springfield | ~155,000 | Census [ASSUMED] |

The script should verify 4-5 known cities match expected ranges (±5%) to detect CSV format changes.

---

## STATE-01: MA State Budget Upgrade

### Current State in DB

The MA state entity (`municipalities.name = 'Massachusetts'`, `entity_type = 'state'`) has budget rows loaded by `processMA.js` for FY2022–FY2026 with `confidence: 'estimated'`. These are round-number estimates (e.g., FY2025 total = $43B, categories are approximately correct but not authoritative). [VERIFIED: read processMA.js directly 2026-06-10]

### What "Upgrade to Real DLS Data" Means

[ASSUMED — requires planner decision; see Open Questions]

Two interpretations:

**Interpretation A (Correct scope):** "MA DLS" in STATE.md refers to the MA DLS Excel data available in `docs/MA/`. The state entity should aggregate the 351-city GF expenditure totals into a statewide total for each fiscal year. This would use `loadMaGFExcel.js` to load city data, then a separate aggregation query to compute statewide totals for the state entity.

**Interpretation B (More likely intended):** Replace the round-number hardcoded estimates in `processMA.js` with real published figures from the MA Executive Office for Administration and Finance (budget.digital.mass.gov). The categories (MassHealth, Education, Local Aid, etc.) are correct; only the dollar amounts need updating with real enacted budget figures. The `processMA.js` pattern already supports this — update the constants and the `confidence: 'estimated'` label.

**Key constraint:** The `loadMaGFExcel.js` script is designed for CITY-LEVEL data (351 rows, keyed by DOR code). It does NOT aggregate into a single MA-state row. STATE-01 must use a different approach for the state entity.

**Recommended approach for STATE-01 (planner to confirm):** Look up real MA budget figures for FY2021-2025 from budget.digital.mass.gov and update the hardcoded constants in `processMA.js`. This is similar to how CA state was done (Phase 33 used the LAO Excel file). The real MA state budget data is publicly available from the MA Budget website (PDF, XLS, or data portal).

### MA State Government Budget — Known Facts

- MA fiscal year ends June 30 (FY2025 = July 2024 – June 2025)
- MA General Fund actual expenditures FY2023 (final): approximately $38.8B [ASSUMED — from training knowledge; must verify before updating processMA.js]
- MA General Fund FY2024 (final): approximately $41-42B [ASSUMED]
- MA General Fund FY2025 (enacted): approximately $58B (major increase due to MBTA capital) [ASSUMED — verify at budget.digital.mass.gov]
- Source: https://www.mass.gov/lists/budget-information

---

## ENRICH-01: Universal Category Enrichment

### Confirmed Category Names

These are the EXACT column names from the MA DLS data files, verified from JSON output and scrapeMaDLS.js REPORTS[]:

**Operating categories (9) — from `special-revenue` report:**

| name_key (after LOWER/TRIM) | Display name in DLS |
|-----------------------------|---------------------|
| `federal general government grants` | Federal General Government Grants |
| `federal public safety grants` | Federal Public Safety Grants |
| `federal public works grants` | Federal Public Works Grants |
| `federal education grants` | Federal Education Grants |
| `federal emergency management agency` | Federal Emergency Management Agency |
| `federal culture and recreation grants` | Federal Culture and Recreation Grants |
| `federal community development block grants` | Federal Community Development Block Grants |
| `other federal housing and urban development grants` | Other Federal Housing and Urban Development Grants |
| `other federal grants` | Other Federal Grants |

[VERIFIED: from scripts/output/ma_dls_special-revenue_2025_expenditures.json headers 2026-06-10]

**Revenue categories (5) — from `revenue-by-source` report:**

| name_key (after LOWER/TRIM) | Display name in DLS |
|-----------------------------|---------------------|
| `tax levy` | Tax Levy |
| `state aid` | State Aid |
| `local receipts` | Local Receipts |
| `all other` | All Other |
| `enterprise & cpa funds` | Enterprise & CPA Funds |

[VERIFIED: from scripts/output/ma_dls_revenue-by-source_2025.json records 2026-06-10]

**Total: 14 categories (9 operating + 5 revenue)**

### enrichCategories.js Invocation

```bash
# Step 1: Enrich one MA city
# Use Boston — it has the most budget data and will produce the most informative enrichments
node scripts/enrichCategories.js --city "Boston" --state MA --year 2025
# Expected: 14 categories enriched, cost ≈ $0.004, time ≈ 30-60 seconds

# Step 2: Verify the 14 rows were created
# Via Supabase MCP or psql:
SELECT name_key, plain_name, municipality_id
FROM treasury.category_enrichment
WHERE municipality_id = (SELECT id FROM treasury.municipalities WHERE name = 'Boston' AND state = 'MA')
ORDER BY name_key;
-- Expected: 14 rows, all with Boston's municipality_id

# Step 3: Universalize (SQL UPDATE)
UPDATE treasury.category_enrichment
SET municipality_id = NULL
WHERE municipality_id = (SELECT id FROM treasury.municipalities WHERE name = 'Boston' AND state = 'MA')
AND name_key IN (
  'federal general government grants', 'federal public safety grants',
  'federal public works grants', 'federal education grants',
  'federal emergency management agency', 'federal culture and recreation grants',
  'federal community development block grants',
  'other federal housing and urban development grants', 'other federal grants',
  'tax levy', 'state aid', 'local receipts', 'all other', 'enterprise & cpa funds'
);
-- Expected: 14 rows updated

# Step 4: Verify universalization
SELECT COUNT(*) FROM treasury.category_enrichment WHERE municipality_id IS NULL
AND name_key IN ('tax levy', 'state aid', 'federal general government grants');
-- Expected: 3 (confirm name_keys exist as universals)
```

### Enrichment API Join (how display works)

```sql
-- Source: C:\EV-Accounts\backend\src\lib\treasuryService.ts (verified 2026-06-10)
-- The backend already has this dual-JOIN pattern:

-- Municipality-specific enrichment (composite key for subcategories)
LEFT JOIN treasury.category_enrichment e_city
  ON e_city.name_key = LOWER(TRIM(bc.name))
 AND e_city.municipality_id = b.municipality_id
-- Universal enrichment fallback
LEFT JOIN treasury.category_enrichment e_univ
  ON e_univ.name_key = LOWER(TRIM(bc.name))
 AND e_univ.municipality_id IS NULL
-- Final value: prefer e_city over e_univ
COALESCE(e_city.plain_name, e_univ.plain_name) AS enrich_plain_name
```

Once `municipality_id = NULL` rows exist for the 14 name_keys, EVERY MA city page will show enrichment descriptions for those categories — no per-city enrichment needed.

---

## Common Pitfalls

### Pitfall 1: Wrong SUMLEV for MA (SUMLEV=162 instead of 061)
**What goes wrong:** Only 26 of 351 MA cities get population data. The other 325 towns (which in Census vocabulary are "towns", not "incorporated cities") are only at SUMLEV=061.
**Why it happens:** The TX and OR scripts use SUMLEV=162 which works for those states. MA is a New England state where "towns" are the primary governmental unit — most appear only at SUMLEV=061.
**How to avoid:** Filter `cols[0] === '061'` for MA. Verify row count: should produce ~357 rows, with 351 matching DB municipalities.
**Warning signs:** Script reports `Updated: 26, Failed: 0, Missing: 325` — or only large cities get population.

### Pitfall 2: Name mismatch for Manchester-by-the-Sea
**What goes wrong:** Census has "Manchester-by-the-Sea town" but the DB has "Manchester By The Sea" (from DLS data). The name normalization strips " town" but leaves "Manchester-by-the-Sea" which doesn't match.
**Why it happens:** DLS uses spaces; Census uses hyphens.
**How to avoid:** Add hyphen-to-space normalization in `normalizeCensusName()`. Specifically: `name.replace(/-/g, ' ')` after stripping the suffix.
**Warning signs:** Script output shows `Missing: ['Manchester By The Sea']` but no error for any other city.

### Pitfall 3: enrichCategories.js enriches wrong year
**What goes wrong:** Running `--year 2025` for enrichment but some MA cities only have FY2024 budget data (e.g., cities with zero special-revenue grants in FY2025 have no FY2025 operating budget row). Boston has data for all 5 FYs.
**Why it happens:** The script's `getBudgetCategories()` function fetches categories for `fiscal_year = YEAR` — if the city has no budget for that year, it returns 0 categories and logs "No budget categories for year 2025 — skipping."
**How to avoid:** Use Boston specifically — it received federal grants in all 5 FYs and will have FY2025 operating data. Alternatively use `--year 2024` for cities that may not have FY2025 operating data.
**Warning signs:** "No budget categories for year 2025 — skipping" in output.

### Pitfall 4: Enriching 351 cities instead of 1
**What goes wrong:** Running `--all --state MA` enriches every MA city with all 14 categories = 4,914 AI calls ≈ $1.40 cost. This also creates 351 × 14 = 4,914 city-specific enrichment rows that don't benefit from universalization (because each row has its own municipality_id).
**Why it happens:** The `--all` flag exists for batch enrichment.
**How to avoid:** Use `--city Boston --state MA --year 2025` for the initial enrichment. Then universalize via SQL before any other city is enriched.
**Warning signs:** Console shows more than 14 categories being processed.

### Pitfall 5: `null` conflict in category_enrichment unique constraint
**What goes wrong:** If a prior enrichment run already created a universal row for `tax levy` (municipality_id=NULL), the UPDATE from Boston's municipality_id to NULL would violate the `(name_key, municipality_id)` unique constraint.
**Why it happens:** NULL is treated specially in SQL unique constraints (NULL != NULL typically, but some DB configurations treat them differently).
**How to avoid:** Before the UPDATE, check: `SELECT COUNT(*) FROM treasury.category_enrichment WHERE municipality_id IS NULL AND name_key = 'tax levy'`. If > 0, the universal row already exists — skip or delete the Boston row instead of updating it.
**Warning signs:** `ERROR: duplicate key value violates unique constraint "category_enrichment_name_key_municipality_id_key"`

### Pitfall 6: STATE-01 requires knowing MA state budget actual figures
**What goes wrong:** Updating processMA.js with real figures requires sourcing the actual enacted/spent amounts from budget.digital.mass.gov. If the wrong figures are used (e.g., enacted vs. actual, wrong fiscal year), the state entity will show incorrect data.
**Why it happens:** MA FY ends June 30. FY2025 enacted budget ≈ $58B but actual spending may differ. FY2024 actual ≈ $41-42B.
**How to avoid:** Use "Final GAA" (General Appropriations Act) figures from the MA Budget website. Cite the source in the processMA.js comment. Use `confidence: 'actual'` or `confidence: 'enacted'` instead of `'estimated'`.
**Warning signs:** Implausible per-capita figures ($5,000/person is reasonable; $10,000+ or <$3,000 is suspect).

---

## Runtime State Inventory

> This phase is a data load/enrichment phase, not a rename/refactor. Confirming runtime state that this phase will interact with.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 351 MA municipalities with `population=0, population_year=NULL` | loadMAPopulation.js writes population + population_year=2024 |
| Stored data | MA state entity: 1 row with hardcoded estimates (FY2022-2026) | STATE-01: re-run processMA.js with real figures |
| Stored data | 0 MA DLS `category_enrichment` rows | ENRICH-01: create 14 universal rows via enrichCategories.js + SQL UPDATE |
| Live service config | None — no external service registrations | — |
| OS-registered state | None | — |
| Secrets/env vars | `ANTHROPIC_API_KEY` required for enrichCategories.js | Confirm in .env before running |
| Build artifacts | `scripts/loadMaGFExcel.js` untracked in git (git status shows `?? scripts/loadMaGFExcel.js`) | Commit with Phase 39 if used |

**Nothing found in remaining categories** — verified by Phase 38-02-SUMMARY.md runtime state inventory.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | loadMAPopulation.js | Yes | v24.13.0 | — |
| Census.gov sub-est2024_25.csv | MA population load | Yes (confirmed URL accessible) | 2024 vintage | Cache locally if URL changes |
| `@supabase/supabase-js` | DB writes | Yes | installed | — |
| `ANTHROPIC_API_KEY` | enrichCategories.js | Required at runtime | in .env | Without it, enrichment fails |
| `SUPABASE_SERVICE_KEY` | All DB writes | Yes (in .env) | — | — |
| Supabase DB | All load/write ops | Yes | kxsdzaojfaibhuzmclfq | — |
| budget.digital.mass.gov | STATE-01 (if using real figures) | Accessible (public site) | — | Use processMA.js estimates with better research |

**Missing dependencies with no fallback:** `ANTHROPIC_API_KEY` — without it, ENRICH-01 cannot proceed. Confirm before starting enrichment tasks.

**Missing dependencies with fallback:** None blocking.

---

## Validation Architecture

> `workflow.nyquist_validation` absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification — no automated test suite for scripts/ |
| Config file | none |
| Quick run command | `node scripts/loadMAPopulation.js --dry-run` |
| Full suite command | DB count queries + human spot-check of 3 MA cities in app |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| MA-04 | 351 MA cities have population > 0 | DB count | `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND population > 0` | Expected: 351 |
| MA-04 | Per-capita shows on MA city page | manual | Open app → any MA city → check "per person" display | No code change needed |
| STATE-01 | MA state entity shows real budget figures | manual | Open app → Massachusetts state entity → verify totals plausible | Compare to known MA GF figures |
| ENRICH-01 | 14 universal enrichment rows exist | DB count | `SELECT COUNT(*) FROM treasury.category_enrichment WHERE municipality_id IS NULL AND name_key IN (...)` | Expected: 14 |
| ENRICH-01 | Different MA cities show same enrichment | manual | Compare Boston enrichment to Worcester enrichment | Must be identical plain_name/description |

### Sampling Rate

- **Per task commit:** `node scripts/loadMAPopulation.js --dry-run` (for population task)
- **Per wave merge:** Full DB count queries per req map above
- **Phase gate:** All success criteria verified before `/gsd-verify-work`

### Wave 0 Gaps

- `scripts/loadMAPopulation.js` — does not exist yet; must be created (MA-04)
- No test infrastructure gaps beyond the new script

---

## Security Domain

> This phase makes no changes to authentication, session management, API endpoints, or input validation paths. All operations are:
> - Outbound HTTP GET to Census.gov (public, no auth)
> - Supabase writes via service-role key (same as all other loaders)
> - Anthropic API calls (outbound, no new attack surface)
> - No new API endpoints, no new user-facing input surfaces

No ASVS categories apply to this phase. Security posture unchanged.

---

## Open Questions

1. **STATE-01: What exact data source should the MA state entity use?**
   - What we know: The current data is hardcoded estimates in `processMA.js`. The GenFundExpenditures Excel files in `docs/MA/` contain CITY-level data (all 351 cities), not the MA state government's own budget.
   - What's unclear: Whether STATE-01 means (a) update processMA.js with real MA state budget figures from budget.digital.mass.gov, or (b) somehow aggregate city-level data into a state entity view.
   - Recommendation: Interpretation A is correct — update processMA.js with actual figures from the MA Budget website. For FY2025, look up the enacted General Appropriations Act from https://www.mass.gov/lists/budget-information. The categories in processMA.js (Health & Human Services, Education, Local Aid, etc.) are correct; only dollar amounts need updating. This is a 30-minute research task, not a loader build.
   - **[ASSUMED]** — MA state government FY2025 enacted GF budget total is approximately $58B. Planner should verify at budget.digital.mass.gov before updating processMA.js.

2. **Handling SUMLEV=061 rows that don't match any DB municipality**
   - What we know: SUMLEV=061 has 357 rows; we need 351 matches.
   - What's unclear: What the 6 extra rows represent (possibly county-level aggregates or duplicate entries).
   - Recommendation: Script should log "Missing: N cities in Census CSV with no DB match" (not an error) and separately log "Unmatched Census rows: M names not in DB" — allowing the executor to verify 0 missing DB cities.

3. **FEMA category note for enrichment**
   - What we know: "Federal Emergency Management Agency" is a category name, not a general description. The AI enrichment prompt may produce a confusing description if it thinks FEMA is an expenditure recipient.
   - What's unclear: Whether enrichCategories.js has enough context to explain this is "money received FROM FEMA" vs "payments TO FEMA".
   - Recommendation: The enrichCategories.js prompt says "What does this fund pay for?" — since this is a revenue-style category (money received), the AI may need guidance. Consider adding context to the enrichment prompt or accepting a slightly imperfect enrichment and refining manually.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded EXPECTED_CITIES list for population scripts | Dynamic DB query for all `state='MA'` cities | Phase 39 (this phase) | Scales to 351 cities without maintaining a 351-name list |
| Per-city enrichment (all TX/CA cities got their own rows) | Universal enrichment (one row per category, NULL municipality_id) | Phase 39 (this phase) | 14 rows serve all 351 cities; no redundancy |
| MA state entity hardcoded estimates (processMA.js) | Real figures from budget.digital.mass.gov | Phase 39 (this phase) | Citizens see accurate state budget data |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SUMLEV=061 covers all 351 MA municipalities in sub-est2024_25.csv | MA-04 Census Deep Dive | If some MA municipalities are at a different SUMLEV, population load would miss them. Mitigate: verify row count after filtering (expect 351 matches out of 357) |
| A2 | "Manchester By The Sea" is the only name mismatch between Census and DLS | MA-04 Name Normalization | If other names differ (e.g., "Mount Washington"), population load would miss those cities. Mitigate: log all unmatched names and verify the count is close to 351 |
| A3 | Boston has FY2025 operating budget data in the DB | ENRICH-01 invocation | If Boston has no FY2025 operating budget rows, enrichCategories.js would log "No budget categories" and enrich nothing. Use `--year 2024` as fallback. |
| A4 | MA state government FY2025 enacted GF budget ≈ $58B | STATE-01 | If wrong by >20%, the displayed per-capita figure would be misleading. Must verify at budget.digital.mass.gov before updating processMA.js. |
| A5 | The (name_key, municipality_id) unique constraint allows updating municipality_id from a UUID to NULL without conflict | ENRICH-01 SQL UPDATE | If a universal row for 'tax levy' already exists, the UPDATE would violate uniqueness. Mitigate: check for existing universal rows before UPDATE. |
| A6 | Known-good Census population values for spot-check sanity (Boston ~695K, Worcester ~215K) | MA-04 Validation | These are from training knowledge, not verified in this session from the CSV directly. Mitigate: run --dry-run first and verify output values look reasonable. |

---

## Sources

### Primary (HIGH confidence — verified by direct codebase inspection)
- `C:\treasury-tracker\scripts\loadTXPopulation.js` — Census population loading pattern (SUMLEV=162, state FIPS in URL)
- `C:\treasury-tracker\scripts\loadORPopulation.js` — Pattern copy target for loadMAPopulation.js
- `C:\treasury-tracker\scripts\enrichCategories.js` — Full source read; saveEnrichment writes municipality_id; universalize via SQL UPDATE
- `C:\treasury-tracker\scripts\scrapeMaDLS.js` REPORTS[] — Confirmed 14 category column names
- `C:\treasury-tracker\scripts\output\ma_dls_special-revenue_2025_expenditures.json` — 9 operating category names verified
- `C:\treasury-tracker\scripts\output\ma_dls_revenue-by-source_2025.json` — 5 revenue category names verified
- `C:\treasury-tracker\scripts\processMA.js` — MA state entity; hardcoded estimates, FY2022-2026
- `C:\treasury-tracker\scripts\loadMaGFExcel.js` — Exists (untracked), city-level loader, NOT state-level
- `C:\EV-Accounts\backend\src\lib\treasuryService.ts` — Dual-JOIN enrichment SQL (e_city + e_univ) verified
- `C:\treasury-tracker\src\components\dashboard\PlainLanguageSummary.tsx` — Per-capita display logic verified (lines 85-88)
- `C:\treasury-tracker\.planning\phases\38-ma-city-budget-load\38-02-SUMMARY.md` — Phase 38 DB state facts

### Secondary (MEDIUM confidence — WebFetch/WebSearch verified)
- Census.gov directory listing: `sub-est2024_25.csv` confirmed at `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/` [VERIFIED: WebFetch 2026-06-10]
- Census sub-est2024_25.csv SUMLEV analysis: 061=357 rows (towns), 162=49 rows (cities, all duplicated in 061) [VERIFIED: WebFetch content 2026-06-10]
- "Manchester-by-the-Sea town" in Census vs "Manchester By The Sea" in DLS [VERIFIED: WebFetch CSV content 2026-06-10]
- UMass Donahue Institute: Census uses "Annual Estimates of the Resident Population for Minor Civil Divisions" (SUB-MCD-EST2024-POP-25) for MA [CITED: donahue.umass.edu 2026-06-10]
- Census page: `https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-cities-and-towns.html` [CITED: WebFetch 2026-06-10]

### Tertiary (LOW confidence — not needed; all critical findings are HIGH/MEDIUM)
- MA state budget FY2025 approximate figures — from training knowledge [ASSUMED — must verify at budget.digital.mass.gov]

---

## Metadata

**Confidence breakdown:**
- MA-04 population script pattern: HIGH — directly follows existing script pattern; Census URL verified
- SUMLEV=061 requirement: HIGH — verified from CSV content
- Name mismatch (Manchester-by-the-Sea): HIGH — confirmed in CSV content
- ENRICH-01 universal enrichment via SQL UPDATE: HIGH — SQL join pattern verified in treasuryService.ts
- 14 category name_keys: HIGH — verified from live JSON output files
- STATE-01 approach: MEDIUM — current state (hardcoded estimates) verified; specific replacement values ASSUMED
- MA state budget real figures: LOW — from training knowledge only

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (Census CSV URL stable; MA DLS portal structure not expected to change)
