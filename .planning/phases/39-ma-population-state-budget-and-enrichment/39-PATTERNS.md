# Phase 39: MA Population, State Budget, and Enrichment - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 4 (1 new, 2 modify/invoke, 1 invoke-only)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/loadMAPopulation.js` | utility/loader | batch (CSV download → DB UPDATE) | `scripts/loadORPopulation.js` | exact |
| `scripts/processMA.js` | utility/loader | batch (hardcoded data → RPC upsert) | `scripts/processMA.js` (self) | exact — modify in place |
| `scripts/enrichCategories.js` | utility/AI pipeline | request-response (CLI invocation) | `scripts/enrichCategories.js` (self) | exact — invoke as-is |
| `scripts/loadMaGFExcel.js` | utility/loader | batch (Excel → DB upsert) | `scripts/loadMaGFExcel.js` (self) | exact — commit untracked file |

---

## Pattern Assignments

### `scripts/loadMAPopulation.js` (NEW — utility, batch)

**Analog:** `scripts/loadORPopulation.js`
**Copy strategy:** Full copy, then apply the six MA-specific changes listed below.

**Imports pattern** (`scripts/loadORPopulation.js` lines 1–8):
```javascript
#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, createWriteStream, unlinkSync } from 'node:fs';
import { get as httpsGet } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
```

**Constants block — MA-specific values** (replace OR values at lines 9–16):
```javascript
const CSV_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_25.csv';
const CSV_PATH = path.join(tmpdir(), 'sub-est2024_25.csv');
const POP_YEAR = 2024;
// MA has 351 municipalities — do NOT hardcode EXPECTED_CITIES; query DB instead
```

**Supabase init + dynamic city query** (replaces hardcoded EXPECTED_CITIES list):
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
const { data: maMunis, error: muniErr } = await supabase
  .from('municipalities')
  .select('id, name')
  .eq('state', 'MA');
if (muniErr || !maMunis?.length) {
  console.error('ERROR: Could not fetch MA municipalities from DB');
  process.exit(1);
}
const dbNames = new Map(maMunis.map(m => [m.name, m.id]));
// dbNames.size expected: 351
```

**normalizeCensusName — MA-specific extension** (replaces line 25–27 of OR script):
```javascript
function normalizeCensusName(name) {
  return name
    .replace(/ city$/, '')
    .replace(/ town$/, '')
    .replace(/ village$/, '')
    .replace(/-/g, ' ')                        // "Manchester-by-the-Sea" → "Manchester by the Sea"
    .replace(/\b\w/g, c => c.toUpperCase())    // title-case after hyphen split
    .trim();
}
```

**SUMLEV filter — MA uses 061, not 162** (replace line 83 of OR script):
```javascript
// OR/TX use cols[0] !== '162'; MA towns appear ONLY at SUMLEV=061
if (cols[0] !== '061') continue;
```

**downloadFile — use OR's redirect-safe version** (`scripts/loadORPopulation.js` lines 29–48):
```javascript
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const cleanup = () => { try { unlinkSync(dest); } catch (_) {} };
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        res.resume();
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close(); cleanup();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { file.close(); cleanup(); reject(err); });
    }).on('error', (err) => { file.close(); cleanup(); reject(err); });
  });
}
```
Note: The TX script (`loadTXPopulation.js` line 33) has a simpler downloadFile without redirect handling. Use the OR version — it handles Census redirects correctly.

**Core UPDATE loop — adapted for dynamic dbNames Map** (based on `scripts/loadORPopulation.js` lines 123–162):
```javascript
let updated = 0, skipped = 0, failed = 0;
const missingInDb = [];

for (const [censusName, pop] of cityMap.entries()) {
  // censusName is already normalized — check if it matches any DB municipality
  if (!dbNames.has(censusName)) {
    missingInDb.push(censusName);
    continue;
  }
  const muniId = dbNames.get(censusName);

  // Idempotence check (from loadORPopulation.js lines 129–139)
  const { data: current } = await supabase
    .from('municipalities')
    .select('population, population_year')
    .eq('id', muniId)
    .single();

  if (current && current.population === pop && current.population_year === POP_YEAR) {
    skipped++;
    continue;
  }

  const { data: updatedRows, error } = await supabase
    .from('municipalities')
    .update({ population: pop, population_year: POP_YEAR })
    .eq('id', muniId)
    .select('id');

  if (error) {
    console.error(`FAILED ${censusName}: ${error.message}`);
    failed++;
  } else if (!updatedRows || updatedRows.length === 0) {
    console.error(`FAILED ${censusName}: 0 rows matched`);
    failed++;
  } else {
    updated++;
  }
}

// Separate reporting: DB cities with no Census match
const dbMissingFromCensus = [...dbNames.keys()].filter(n => !cityMap.has(n));
if (dbMissingFromCensus.length > 0) {
  console.warn(`\nDB municipalities with no Census match (${dbMissingFromCensus.length}):`);
  for (const n of dbMissingFromCensus) console.warn(`  MISSING: ${n}`);
}
console.log(`\nSummary: Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
console.log(`Census rows not in DB: ${missingInDb.length}, DB cities missing from Census: ${dbMissingFromCensus.length}`);
process.exit(failed > 0 ? 1 : 0);
```

**Dry-run pattern** (`scripts/loadORPopulation.js` lines 113–119):
```javascript
if (dryRun) {
  console.log('\nDRY RUN — no DB updates:');
  for (const [name, pop] of cityMap.entries()) {
    if (dbNames.has(name)) console.log(`  DRY: would UPDATE ${name} → population=${pop}, population_year=${POP_YEAR}`);
  }
  process.exit(0);
}
```

**Error handling / entry point** (`scripts/loadORPopulation.js` line 165):
```javascript
main().catch(err => { console.error(err); process.exit(1); });
```

---

### `scripts/processMA.js` (MODIFY — update hardcoded EXPENDITURES constants)

**Analog:** `scripts/processMA.js` (self — modify in place)
**Modification scope:** Replace the dollar amounts inside the `EXPENDITURES` object (lines 27–188) with real enacted/actual figures sourced from budget.digital.mass.gov. The script structure, validation logic, RPC call pattern, and CLI interface are all preserved exactly.

**What stays the same** (do NOT touch):
- `validate(fy)` function (lines 190–198) — validates category sums match totals
- `buildTree(fy)` function (lines 200–204) — constructs jsonTree for RPC
- `main()` function structure (lines 207–248) — RPC call, data_source upsert/update, loop
- `SUPABASE_URL`, `SUPABASE_KEY`, `STATE_NAME`, `STATE_ABBR`, `POPULATION` constants (lines 23–25)
- Category names (Health and Human Services, Education, Local Government Aid, etc.) — these are correct
- `confidence` field value — change from `'estimated'` to `'enacted'` or `'actual'` as appropriate per year

**What changes:**
- Dollar amounts inside `EXPENDITURES[2022..2026]` — replace with real figures
- `confidence` values — update from `'estimated'` to `'enacted'` (for enacted budget) or `'actual'` (for final audited figures)
- Optionally add a source comment citing the MA Budget website URL

**RPC call pattern** (line 240 — copy unchanged):
```javascript
const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year: fy,
  p_dataset_type: 'operating',
  p_total: total,
  p_tree: jsonTree,
  p_row_count: rowCount,
  p_triggered_by: 'bulk_load'
});
```

**Run command (after updating constants):**
```bash
node scripts/processMA.js --dry-run     # verify totals look correct
node scripts/processMA.js               # load all FY2022-2026
node scripts/processMA.js --fy 2025    # reload single year
```

---

### `scripts/enrichCategories.js` (INVOKE — no code changes)

**Analog:** `scripts/enrichCategories.js` (self — invoke as-is)
**No source modification required.** The script supports `--city`, `--state`, `--year` flags and handles the full enrichment pipeline.

**Invocation pattern** (from RESEARCH.md, validated against script CLI args at lines 64–75):
```bash
# Requires ANTHROPIC_API_KEY in .env
node scripts/enrichCategories.js --city "Boston" --state MA --year 2025
```

**saveEnrichment writes** (`scripts/enrichCategories.js` lines 381–403):
```javascript
async function saveEnrichment(cat, municipality, result) {
  const nameKey = cat.parent_name
    ? `${normalize(cat.parent_name)}|${normalize(cat.name)}`
    : normalize(cat.name);
  const row = {
    name_key: nameKey,
    municipality_id: municipality.id,   // ← will be Boston's UUID; universalize via SQL after
    // ...
  };
  const { error } = await supabase
    .from('category_enrichment')
    .upsert(row, { onConflict: 'name_key,municipality_id' });
}
```

**Post-invocation SQL to universalize** (run via Supabase MCP — `mcp__supabase-local__execute_sql`):
```sql
-- Step 1: Check for pre-existing universal rows (Pitfall 5 guard)
SELECT name_key FROM treasury.category_enrichment
WHERE municipality_id IS NULL
AND name_key IN (
  'federal general government grants', 'federal public safety grants',
  'federal public works grants', 'federal education grants',
  'federal emergency management agency', 'federal culture and recreation grants',
  'federal community development block grants',
  'other federal housing and urban development grants', 'other federal grants',
  'tax levy', 'state aid', 'local receipts', 'all other', 'enterprise & cpa funds'
);
-- If any rows returned: those already exist as universals — DELETE the Boston duplicate
-- If 0 rows returned: safe to run the UPDATE below

-- Step 2: Universalize
UPDATE treasury.category_enrichment
SET municipality_id = NULL
WHERE municipality_id = (
  SELECT id FROM treasury.municipalities WHERE name = 'Boston' AND state = 'MA'
)
AND name_key IN (
  'federal general government grants', 'federal public safety grants',
  'federal public works grants', 'federal education grants',
  'federal emergency management agency', 'federal culture and recreation grants',
  'federal community development block grants',
  'other federal housing and urban development grants', 'other federal grants',
  'tax levy', 'state aid', 'local receipts', 'all other', 'enterprise & cpa funds'
);
-- Expected: 14 rows updated

-- Step 3: Verify
SELECT name_key, plain_name, municipality_id
FROM treasury.category_enrichment
WHERE name_key IN ('tax levy', 'state aid', 'federal general government grants')
ORDER BY name_key;
-- Expected: all 3 show municipality_id = NULL
```

---

### `scripts/loadMaGFExcel.js` (COMMIT — no code changes, just git-add)

**Analog:** `scripts/loadMaGFExcel.js` (self — file exists untracked, git status shows `?? scripts/loadMaGFExcel.js`)
**Action required:** `git add scripts/loadMaGFExcel.js` and commit with Phase 39. No source changes needed.

**Imports pattern** (`scripts/loadMaGFExcel.js` lines 29–41):
```javascript
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'exceljs';
const { Workbook } = pkg;
```

**Run command:**
```bash
node scripts/loadMaGFExcel.js --dry-run           # preview
node scripts/loadMaGFExcel.js --clean             # purge portal-scraped MA rows first
node scripts/loadMaGFExcel.js                     # load all FY2002-2025 Excel files
node scripts/loadMaGFExcel.js --fy 2025           # single year
```

---

## Shared Patterns

### Supabase Client Init
**Source:** `scripts/loadORPopulation.js` lines 121 and `scripts/processMA.js` line 213
**Apply to:** `loadMAPopulation.js`
```javascript
// loadORPopulation.js uses schema: 'treasury' in createClient options
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

// processMA.js uses .schema('treasury').from(...) call-site syntax
await supabase.schema('treasury').from('municipalities').select(...)
```
For `loadMAPopulation.js`, follow the OR pattern: set schema in `createClient` options, then use `.from()` directly (no `.schema()` call-site prefix).

### .env Loading
**Source:** `scripts/processMA.js` lines 17–22 and `scripts/enrichCategories.js` lines 36–53
**Apply to:** `loadMAPopulation.js`

The OR and TX scripts rely on env vars being pre-set (no loadEnv). For consistency with newer scripts, add the `loadEnv()` pattern from `enrichCategories.js`:
```javascript
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch {}
  }
}
loadEnv();
```

### Census CSV Column Validation
**Source:** `scripts/loadORPopulation.js` lines 73–77 and `scripts/loadTXPopulation.js` lines 63–67
**Apply to:** `loadMAPopulation.js`
```javascript
// Both existing scripts use this guard — copy verbatim
if (header[0] !== 'SUMLEV' || header[8] !== 'NAME' || header[15] !== 'POPESTIMATE2024') {
  console.error(`Census CSV format changed — expected POPESTIMATE2024 at column 15`);
  console.error(`Got: col 0=${header[0]}, col 8=${header[8]}, col 15=${header[15]}`);
  process.exit(1);
}
```

### Dry-Run / parseArgs CLI Pattern
**Source:** `scripts/loadORPopulation.js` lines 51–52
**Apply to:** `loadMAPopulation.js`
```javascript
const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean' } } });
const dryRun = flags['dry-run'] || false;
```

### Supabase Key Guard
**Source:** `scripts/loadORPopulation.js` lines 54–57
**Apply to:** `loadMAPopulation.js`
```javascript
if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}
```

---

## No Analog Found

None. All four files have exact analogs in the codebase.

---

## Key Differences: loadMAPopulation.js vs. loadORPopulation.js

| Dimension | OR script | MA script |
|-----------|-----------|-----------|
| State FIPS | 41 (Oregon) | 25 (Massachusetts) |
| SUMLEV filter | `'162'` (incorporated places) | `'061'` (towns/MCDs) |
| City list source | Hardcoded 3-item array | Dynamic DB query (`state='MA'`, 351 rows) |
| normalizeCensusName | Strip suffix only | Strip suffix + hyphen→space + title-case |
| Idempotence check | `.eq('name', city).eq('state', 'OR')` | `.eq('id', muniId)` (use UUID from DB query) |
| Missing city handling | `process.exit(1)` if any missing | Log warning, continue; report summary |
| KNOWN_VALUES | 3 hardcoded spot-checks | Add 3–5 Boston/Worcester/Cambridge spot-checks |

---

## Metadata

**Analog search scope:** `C:\treasury-tracker\scripts\`
**Files scanned:** 4 (loadORPopulation.js, loadTXPopulation.js, processMA.js, enrichCategories.js, loadMaGFExcel.js)
**Pattern extraction date:** 2026-06-10
