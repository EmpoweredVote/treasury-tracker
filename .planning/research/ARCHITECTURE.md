# Architecture: v1.8 MA DLS City Budget Loading

**Domain:** Bulk loading 351 MA municipalities × 2 data types from MA DLS portal
**Researched:** 2026-06-09
**Confidence:** HIGH — derived from direct inspection of scrapeMaDLS.js, bulkLoadBudget.js, enrichCategories.js, and the two existing scraped output files

---

## Critical Finding (Read First)

**The scraper (scrapeMaDLS.js) already exists and already works.** FY2025 output files for both reports are already on disk (`scripts/output/ma_dls_special-revenue_2025_expenditures.json` and `scripts/output/ma_dls_revenue-by-source_2025.json`), each with exactly 351 records. The "702 sequential requests" framing in the milestone description is misleading: the MA DLS portal returns ALL 351 cities in **one HTTP session** per report (all municipality checkboxes are sent in a single POST). This milestone is not a concurrency problem — it is a pipeline completion problem.

The missing pieces are:
1. Progress tracking in the `loadToSupabase` function (no resume if it dies at city 200)
2. Multi-year FY support (scraper only scrapes one FY at a time; no multi-year loop)
3. Population data for 351 MA cities
4. MA shown in the city picker (city picker STATE_LABELS map)
5. Enrichment (14 universal category names — trivially cheap)

---

## Question 1: New bulkLoadMA.js vs extending bulkLoadBudget.js

**Answer: Keep scrapeMaDLS.js. Do NOT extend bulkLoadBudget.js.**

Rationale:
- `bulkLoadBudget.js` is for Socrata SODA API sources. MA DLS is an ASP.NET form-scraping portal. The fetch mechanics, session management, rdDataCache, Excel export, and HTML pagination fallback are all MA-DLS-specific. Injecting this into bulkLoadBudget.js would break its clean `api_type: 'socrata'` contract.
- `scrapeMaDLS.js` already handles the full pipeline: scrape → seed → load. It already creates `data_source` rows with `api_type: 'ma-dls'` on first run.
- The correct approach is to **extend scrapeMaDLS.js** with: (a) a progress file for the load phase, (b) a `--multi-year` flag that loops FYs, and (c) a batch-insert path for data_source creation.

The `api_type: 'ma-dls'` convention is already in the code and correctly signals to `bulkLoadBudget.js`'s filter that these sources should not be picked up by the Socrata loader.

---

## Question 2: Concurrency / Rate-Limiting for 702 Requests

**Answer: The 702 number applies to DB load calls, not HTTP requests. HTTP is already handled.**

### HTTP Layer (scrape phase): ~6 requests total per FY

The MA DLS scraper sends ALL 351 city checkboxes in a single form POST per report. The portal returns all data in one Excel export (fastest path) or via paginated HTML (fallback). For `--scrape --all --fy 2025`:

| Step | Requests |
|------|----------|
| GET initial page (special-revenue) | 1 |
| POST Excel export (special-revenue) | 1 |
| GET initial page (revenue-by-source) | 1 |
| POST form filter (revenue-by-source) | 1 |
| POST Excel export or HTML pages (revenue-by-source) | 1–8 |
| **Total** | **5–12** |

DELAY_MS = 1500ms between steps is already implemented and appropriate. No concurrency strategy is needed at the HTTP layer. Rate-limiting is trivially handled by the existing 1.5s sleeps.

### DB Layer (load phase): 351 sequential RPC calls per report

The `loadToSupabase` function iterates 351 records sequentially. Each city makes:
- 1 SELECT on `municipalities` (uses a pre-loaded Map, so 1 query total for all cities)
- 1 SELECT on `data_sources` (per city, to check if it exists)
- 1 INSERT on `data_sources` (per city, first run only)
- 1 RPC call to `treasury_sync_budget_tree` (per city)

Total: ~1053 DB calls per report, ~2106 for both. These are supabase-js client calls (HTTPS to Supabase), so they are NOT local. At ~100–300ms per call, 2106 calls takes **3.5–10 minutes** to complete.

**No parallelism is needed or recommended.** The bottleneck is Supabase request rate, not script CPU. Sequential is correct here — easier to reason about, easier to resume from a progress file if one city fails.

**Recommended concurrency: 1 (sequential, as currently implemented)**. The enrichment phase (14 calls total) uses concurrency=3 from enrichCategories.js, which is more than sufficient.

---

## Question 3: Partial Failure Strategy

**Answer: Skip-and-continue with progress file. Never abort.**

The existing `loadToSupabase` already skips individual cities with `skipped++` on error. However it has no progress file — if the process is killed at city 200, it restarts from city 1. The existing data is idempotent (treasury_sync_budget_tree deletes existing rows before insert), so reloading a city already loaded is safe but wasteful.

### Recommended pattern (extend scrapeMaDLS.js):

```javascript
// At top of loadToSupabase, load a JSON progress file
const progressFile = join(OUTPUT_DIR, `load_progress_${report.name}_${fiscalYear}.json`);
const loaded = new Set(loadProgress(progressFile));

for (const record of records) {
  if (loaded.has(record.dorCode)) { skipped++; continue; }
  // ... load ...
  if (success) {
    loaded.add(record.dorCode);
    saveProgress(progressFile, [...loaded]);
  }
}
```

The DOR Code (001–351) is the natural resume key. Save after each successful city. This makes the load resumable at city-granularity with zero re-work on cities already loaded.

**Error categories and responses:**

| Error | Response |
|-------|----------|
| `municipality not found in DB` | Skip (log warning) — needs `--seed` run first |
| `Supabase RPC error` | Skip + log. Retry on next run via progress file |
| `data_source insert conflict` | Should not happen (uses SELECT first) |
| `network timeout` | Skip + log (idempotent, safe to rerun) |
| `rdDataCache missing` (scrape phase) | Abort scrape — page structure changed, needs investigation |
| Excel parse error (scrape phase) | Auto-falls back to HTML pagination — no abort |

---

## Question 4: Fiscal Year Strategy

**Answer: Load FY2025 first. Add multi-year (FY2021–FY2025) in a second pass.**

### FY2025 first

The scraper already has `scripts/output/ma_dls_special-revenue_2025_expenditures.json` and `scripts/output/ma_dls_revenue-by-source_2025.json` on disk with full 351-city data. The pilot can use these cached files directly with `--load --file`. No additional HTTP requests needed.

### Multi-year path

The MA DLS portal `--list` comment documents "Years: 2002–2025". The form discovers available years dynamically. A multi-year run would loop: for fy in [2021, 2022, 2023, 2024, 2025]: scrape(fy) → load(fy).

At 5 FYs × 2 reports = 10 scrape sessions and 10 load phases. Each load phase is ~3.5–10 minutes. Total: 35–100 minutes of sequential work. This is fine for a one-time load script run by an operator. No async queue infrastructure is needed.

**Recommended phase scope:**
- Phase A: FY2025 only. Validates the pipeline end-to-end. Gets MA into the city picker.
- Phase B (subsequent): Multi-year (FY2021–FY2025) for historical depth, once FY2025 is verified.

---

## Question 5: MA DLS Tree Structure → treasury_sync_budget_tree p_tree Format

**Answer: Already solved in scrapeMaDLS.js. Structure is flat-column → single-level tree.**

### What MA DLS data looks like (per city per report)

**special-revenue (operating):**
```json
{
  "dorCode": "001",
  "municipality": "Abington",
  "fiscalYear": 2025,
  "Federal General Government Grants": 1475095,
  "Federal Public Safety Grants": 63142,
  "Federal Education Grants": 1053037,
  "Federal Community Development Block Grants": 104102,
  "Other Federal Grants": 2864
}
```

**revenue-by-source (revenue):**
```json
{
  "dorCode": "001",
  "municipality": "Abington",
  "fiscalYear": 2025,
  "Tax Levy": 42906155,
  "State Aid": 17614336,
  "Local Receipts": 5692102,
  "All Other": 2332700,
  "Enterprise & CPA Funds": 10170340
}
```

### How scrapeMaDLS.js converts this to p_tree

The `loadToSupabase` function already builds the compact tree:

```javascript
// One top-level node per non-zero amount column
tree.push({ n: col, a: amount, i: [{ d: col, a: amount, aa: null, f: 'General Fund', e: null }] });
```

This produces a **1-level tree** (no subcategories — each column becomes both the category name and its single line item). Example for Abington special-revenue FY2025:

```json
[
  { "n": "Federal Education Grants",          "a": 1053037, "i": [{ "d": "Federal Education Grants",          "a": 1053037, "aa": null, "f": "General Fund", "e": null }] },
  { "n": "Federal General Government Grants", "a": 1475095, "i": [{ "d": "Federal General Government Grants", "a": 1475095, "aa": null, "f": "General Fund", "e": null }] },
  { "n": "Federal Public Safety Grants",      "a": 63142,   "i": [...] },
  { "n": "Federal Community Development Block Grants", "a": 104102, "i": [...] },
  { "n": "Other Federal Grants",              "a": 2864,    "i": [...] }
]
```

This is a valid 2-level-compatible tree (root node → single line item). The `treasury_sync_budget_tree` RPC handles it. Zero-amount columns are dropped before building the tree.

**No RPC changes are needed for MA DLS.** The existing 2-level RPC is sufficient. MA DLS data does not have subcategory depth — each column IS the category.

---

## Question 6: Build Order

**Answer: Seed → Pilot 3 cities → Bulk load → Population → Enrichment → City picker.**

### Dependency graph

```
Step 1 — Seed 351 MA municipalities
  node scripts/scrapeMaDLS.js --seed --file scripts/output/ma_dls_special-revenue_2025.json
  Creates municipalities rows (MA, entity_type: 'city')
  → Unblocks: Step 2

Step 2 — Pilot load: 3 cities FY2025 (--dry-run first, then live)
  node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2025_expenditures.json --dry-run
  Confirm tree shape, amounts, city picker shows MA cities
  → Unblocks: Step 3

Step 3 — Bulk load FY2025 both reports (add progress file first)
  Extend scrapeMaDLS.js: progress file for loadToSupabase
  node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2025_expenditures.json
  node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json
  → Unblocks: Step 4 and Step 5 (parallel)

Step 4 — MA population data
  351 cities need population for per-capita display
  Script: extend existing loadXXXPopulation.js pattern or new loadMAPopulation.js
  Source: US Census Bureau 2024 population estimates (CSV download)
  → Can run in parallel with Step 5

Step 5 — Enrichment (14 API calls, ~$0.004 total)
  node scripts/enrichCategories.js --state MA --year 2025
  All 14 MA DLS category names are universal (same for all 351 cities)
  Use --skip-universal after first run so re-runs are instant
  → Trivial cost, can run with FY2025 data present

Step 6 — Add MA to city picker STATE_LABELS
  Confirm STATE_LABELS['MA'] = 'Massachusetts' in app

Step 7 — Multi-year scrape + load (FY2021–FY2024)
  Separate from Step 3; add --fy loop to scrapeMaDLS.js or run 4× manually
  → Deferred to Phase B after FY2025 is verified in production
```

### Critical path

Steps 1 → 2 → 3 → 6 (MA appears in city picker with data)

Steps 4 and 5 are parallel with Step 6 (no per-capita display and no enrichment descriptions until those complete, but data is visible).

Step 7 is deferred (historical depth is a nice-to-have, not MVP).

---

## System Architecture: Where MA DLS Fits

```
MA DLS Portal (dls-gw.dor.state.ma.us)
  ↓  1 HTTP session per report per FY
  ↓  GET initial page (discover 351 city checkboxes + available FYs)
  ↓  POST all 351 checkboxes (or GET Excel export via rdDataCache)
  ↓  Parse Excel or HTML → 351-row flat table
  ↓  Write JSON to scripts/output/ma_dls_<report>_<fy>.json

scrapeMaDLS.js --seed
  ↓  INSERT 351 rows into treasury.municipalities (MA, entity_type: 'city')
  ↓  (skip if already exists — idempotent)

scrapeMaDLS.js --load
  ↓  For each of 351 records:
  ↓    Find municipality_id by name
  ↓    Find or CREATE data_source (api_type: 'ma-dls', dataset_type: 'operating'|'revenue')
  ↓    Build compact tree: { n: col, a: amount, i: [{...}] } for each non-zero column
  ↓    Call treasury_sync_budget_tree RPC
  ↓    (no changes to RPC needed)
  ↓  → 351 budget rows + budget_categories + budget_line_items

enrichCategories.js --state MA
  ↓  14 unique category names across all 351 cities
  ↓  14 Claude Haiku API calls (~$0.004 total)
  ↓  → 14 rows in treasury.category_enrichment (universal, municipality_id = NULL)

loadMAPopulation.js (new, ~50 lines)
  ↓  Census 2024 estimate CSV → UPDATE treasury.municipalities SET population WHERE state='MA'
  ↓  → Per-capita display enabled in app
```

---

## Component Changes Required

| Component | Change | Scope | Notes |
|-----------|--------|-------|-------|
| `scrapeMaDLS.js` | Add progress file to `loadToSupabase` | Small | 20–30 lines; prevents restart from zero |
| `scrapeMaDLS.js` | Add `--fy` multi-value loop (optional) | Small | Deferred to Phase B |
| `loadMAPopulation.js` | New script | Small (~50 lines) | Copies loadTXPopulation.js pattern |
| STATE_LABELS in app | Add `'MA': 'Massachusetts'` | Tiny | 1 line in city picker config |
| `enrichCategories.js` | No changes needed | — | `--state MA` already works |
| `treasury_sync_budget_tree` RPC | No changes needed | — | 1-level tree is valid 2-level |
| DB schema | No changes needed | — | 'city' entity_type already exists |

---

## Enrichment Scope and Cost

**This is the most important number for the quality gate.**

The MA DLS data has flat column structure — every city in MA has the same category names (the column headers are uniform across all 351 cities). This means enrichment is **universal**, not per-city.

| Report | Category names | All universal? |
|--------|---------------|----------------|
| special-revenue (operating) | 9 columns | Yes — same 9 names for all 351 cities |
| revenue-by-source (revenue) | 5 columns | Yes — same 5 names for all 351 cities |
| **Total** | **14 unique names** | |

**Enrichment API calls: 14** (not 351 × 14 = 4,914).

At Claude Haiku pricing (~$0.0003/call): **~$0.004 total**. Well below the $5 approval threshold.

Note: On average, only 2.5 of 9 special-revenue columns are non-zero per city (most small towns receive only 2–3 federal grant types). For revenue-by-source, the average is ~4.9 of 5 non-zero columns. The enrichment should cover all 14 possible names (even if a specific city's value is zero today, it may be non-zero in another FY). Run with `--skip-universal` on re-runs.

---

## Pitfalls for Phase Execution

### Municipality name mismatches (seed vs load)

The MA DLS portal uses official DOR-registered municipality names. Some may differ slightly from Census or colloquial names. The `seedMunicipalities` function uses `name` as written in the DLS data. The `loadToSupabase` function looks up by exact name match. If a city was manually inserted with a different spelling (e.g., "Attleborough" vs "Attleboro"), the load will skip it silently. **Prevention:** run `--seed` from the same data file used for `--load`; never manually insert MA city names before running seed.

### Missing `--seed` before `--load`

`loadToSupabase` looks up `municipality_id` by name. If the municipality row does not exist, it logs a warning and skips. The count of skipped cities in the final summary reveals this. **Prevention:** always run `--seed` before `--load` on first run.

### `fiscal_years` not updated on second FY load

When `loadToSupabase` finds an existing `data_source` for a city, it uses the existing `dsId` without updating the `fiscal_years` array. So if you load FY2025 first (data_source created with `fiscal_years: [2025]`), then load FY2024, the `fiscal_years` column still shows `[2025]`. **Prevention:** add an `UPDATE data_sources SET fiscal_years = array_append(fiscal_years, $fy) WHERE id = $dsId AND NOT ($fy = ANY(fiscal_years))` after finding an existing dsId. This is a small gap in the current script.

### City picker not showing MA

The `STATE_LABELS` map in the frontend must include `'MA': 'Massachusetts'`. If it is missing, MA cities will be in the DB but not visible in the city picker. **Prevention:** verify `STATE_LABELS` after loading the first batch of MA cities.

### No progress file = full restart on failure

The current `loadToSupabase` has no progress tracking. If it fails at city 200 of 351, it restarts from city 1. Since `treasury_sync_budget_tree` is idempotent (deletes before insert), this is safe but wastes 5–10 minutes of DB calls. **Prevention:** add a progress file keyed by `dorCode` before running the bulk 351-city load.

---

## Phase Count Recommendation

**This milestone fits cleanly in 2 phases:**

**Phase A — MA DLS FY2025 Pilot + Bulk Load**
- Extend `scrapeMaDLS.js` with progress file
- Seed 351 municipalities
- Load FY2025 (both reports) using existing cached output files
- Add `MA` to STATE_LABELS
- Run enrichment (14 calls, ~$0.004)
- Load MA population data
- Verify in app: 351 MA cities visible, FY2025 data showing, per-capita working

**Phase B — Multi-Year Historical Depth (FY2021–FY2024)**
- Add `--fy` looping to `scrapeMaDLS.js`
- Scrape and load FY2021–FY2024 for both reports
- ~4 scrape sessions + 4 load sessions per report
- Population data already in DB; no enrichment re-run needed (universals already exist)

Phase A is self-contained and delivers a shippable milestone. Phase B adds historical depth and can be done independently.
