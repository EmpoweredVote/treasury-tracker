# Phase 37: MA Loader Hardening - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 1 modified file (scrapeMaDLS.js) with 3 independent code changes + 1 config change
**Analogs found:** 2 / 4 (partial matches only — LOAD-02 and LOAD-03 patterns are new to this codebase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/scrapeMaDLS.js` (LOAD-01: REPORTS[] update) | config | request-response | `scripts/scrapeMaDLS.js` itself — `REPORTS[0]` special-revenue entry | self-reference (exact shape) |
| `scripts/scrapeMaDLS.js` (LOAD-02: checkpoint read/write) | utility | file-I/O | `scripts/processEnrichmentQueue.js` — `readFileSync` env loader | role-mismatch (file I/O pattern only) |
| `scripts/scrapeMaDLS.js` (LOAD-03: fiscal_years append) | service | CRUD | `scripts/processPortland.js` — `upsertDataSource` with `maybeSingle()` | partial-match (same query structure, but existing-row branch never updates fiscal_years) |
| `.gitignore` (add `scripts/output/`) | config | — | `.gitignore` itself — existing `EV/`, `/data/`, `cache/` exclusion lines | exact |

---

## Pattern Assignments

### LOAD-01: `REPORTS[]` array entry for `gf-expenditures`

**Analog:** `scripts/scrapeMaDLS.js` lines 53–68 (the `special-revenue` entry, immediately above)

**Shape to copy** (lines 53–68, `scrapeMaDLS.js`):
```javascript
{
  name: 'special-revenue',
  label: 'Schedule A — Special Revenue Funds',
  rdreport: 'ScheduleA.Special_Rev_Funds.SpecialRevFunds',
  tableID: 'xtFedGrants',
  exportFilename: 'fedgrants',
  datasetType: 'operating',
  supportsType: true,
},
```

**Current gf-expenditures entry to update** (lines 62–69, `scrapeMaDLS.js`):
```javascript
{
  name: 'gf-expenditures',
  label: 'General Fund Expenditures by Function',
  rdreport: 'ScheduleA.GF.ExpendituresByFunctionMain',  // best guess — verify with --explore
  tableID: 'xtGFExp',
  exportFilename: 'gfexp',
  datasetType: 'operating',
  supportsType: false,
},
```

**Action:** Replace `rdreport` value (and possibly `tableID`) after the human confirms the correct value via `--explore`. Remove the `// best guess — verify with --explore` comment once confirmed. No structural changes to the entry shape.

**Known-working rdreport format examples in same file:**
- `'ScheduleA.Special_Rev_Funds.SpecialRevFunds'` (lines 55)
- `'RevenueBySource.RBS.RevbySource2'` (line 76)

---

### LOAD-02: Checkpoint file read/write in `loadToSupabase()`

**No exact analog exists in this codebase.** The closest pattern is `readFileSync` used for env file loading in `scripts/processEnrichmentQueue.js` (lines 28–44) — same import, same try/catch-with-empty-catch idiom. That idiom transfers directly to the progress file read.

**Import pattern already present in scrapeMaDLS.js** (lines 31–32):
```javascript
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
```
No new imports needed.

**Env-load idiom from `scripts/processEnrichmentQueue.js`** (lines 28–36) — model for try/catch fallback-to-default:
```javascript
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env.local');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    // ...
  } catch {}  // silent failure → returns default
}
```

**Progress file constant placement** — follow the OUTPUT_DIR constant already at line 38 of `scrapeMaDLS.js`:
```javascript
const OUTPUT_DIR = join(__dirname, 'output');
// Add immediately after:
const PROGRESS_FILE = join(OUTPUT_DIR, 'ma_dls_progress.json');
```

**Checkpoint helper functions** (new, no analog — place after line 46 `DELAY_MS` constant block):
```javascript
function readProgress() {
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}
```

**Integration into `loadToSupabase()` — placement relative to existing code:**

Before the `for (const record of records)` loop (currently at line 563), add:
```javascript
const progress = readProgress();
const progressKey = `${report.name}:${fiscalYear}`;
const alreadyLoaded = new Set(progress[progressKey] || []);
let checkpointSkipped = 0;
```

First check inside the loop, before the `municId` lookup (currently line 564):
```javascript
if (alreadyLoaded.has(record.dorCode)) {
  checkpointSkipped++;
  continue;
}
```

After the successful `treasury_sync_budget_tree` call (currently the `else { loaded++; ... }` branch at line 631):
```javascript
alreadyLoaded.add(record.dorCode);
progress[progressKey] = [...alreadyLoaded];
writeProgress(progress);
```

After the loop summary line (currently line 637 `console.log`), add:
```javascript
if (checkpointSkipped > 0) {
  console.log(`    Skipped ${checkpointSkipped} already loaded (checkpoint)`);
}
```

**Error/skip pattern to mirror** (existing at lines 565–569, 600, 630):
```javascript
if (skipped === 0) console.log(`    ⚠️  No DB record for "${record.municipality}" — run --seed first`);
skipped++;
continue;
// and:
console.log(`    ❌ ${record.municipality}: ${error.message}`); skipped++;
```
Checkpoint skips are silent (no console.log per record) — only the end-of-run count line.

---

### LOAD-03: `fiscal_years` array append in the existing-row branch

**No exact analog for append-with-dedup exists in this codebase.** All other loaders either always INSERT with `fiscal_years: [fiscalYear]` (e.g., `processPortland.js` line 231) or never touch `fiscal_years` on updates.

**Existing INSERT path (correct, unchanged)** — `scrapeMaDLS.js` lines 584–595:
```javascript
const { data: newDs, error: dsErr } = await supabase
  .schema('treasury')
  .from('data_sources')
  .insert({
    municipality_id: municId,
    name: `${record.municipality} — MA DLS ${report.label}`,
    api_type: 'ma-dls',
    dataset_type: report.datasetType,
    base_url: BASE_URL,
    column_mapping: { rdreport: report.rdreport, tableID: report.tableID },
    fiscal_years: [fiscalYear],   // ← already correct; no change
  })
  .select('id')
  .single();
```

**Existing-row query to change** — `scrapeMaDLS.js` lines 572–579:
```javascript
// BEFORE (current):
const { data: existingDs } = await supabase
  .schema('treasury')
  .from('data_sources')
  .select('id')              // ← only fetches id; fiscal_years not available
  .eq('municipality_id', municId)
  .eq('api_type', 'ma-dls')
  .eq('dataset_type', report.datasetType)
  .maybeSingle();
```

Change to:
```javascript
// AFTER:
const { data: existingDs } = await supabase
  .schema('treasury')
  .from('data_sources')
  .select('id, fiscal_years') // ← also fetch fiscal_years
  .eq('municipality_id', municId)
  .eq('api_type', 'ma-dls')
  .eq('dataset_type', report.datasetType)
  .maybeSingle();
```

**New existing-row branch** (replaces the implicit fall-through after line 581 `let dsId = existingDs?.id`):
```javascript
let dsId = existingDs?.id;

if (!dsId) {
  // INSERT path — unchanged (lines 583–605)
} else {
  // Append fiscalYear to existing array if not already present
  const existingFiscalYears = Array.isArray(existingDs.fiscal_years)
    ? existingDs.fiscal_years
    : [];
  if (!existingFiscalYears.includes(fiscalYear)) {
    const { error: fyErr } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update({ fiscal_years: [...existingFiscalYears, fiscalYear] })
      .eq('id', dsId);
    if (fyErr) console.log(`    ⚠️  ${record.municipality} fiscal_years update: ${fyErr.message}`);
  }
}
```

**`maybeSingle()` pattern source** — already used twice in `scrapeMaDLS.js` at lines 525 and 579. Same schema-qualified Supabase client call pattern applies.

**Warning log pattern to mirror** (line 535):
```javascript
console.log(`    ⚠️  ${name}: ${error.message}`);
```

---

### `.gitignore` addition

**Analog:** `.gitignore` lines 43–46 (data file exclusions block):
```
# Static data files — all data served from Supabase via API
public/data/
src/data/processedBudget.json
/data/
```

**Add after line 46** (or alongside existing data exclusions):
```
# MA DLS scraper output — large JSON files and progress ledger
scripts/output/
```

---

## Shared Patterns

### Supabase schema-qualified queries
**Source:** `scripts/scrapeMaDLS.js` throughout `loadToSupabase()` and `seedMunicipalities()`
**Apply to:** All new Supabase calls added in LOAD-03
```javascript
await supabase
  .schema('treasury')
  .from('data_sources')
  .select('id, fiscal_years')
  .eq(...)
  .maybeSingle();
```
All queries in this file use `.schema('treasury')` — do not omit it.

### Error logging format
**Source:** `scripts/scrapeMaDLS.js` lines 535, 566, 600, 630
**Apply to:** LOAD-03 `fyErr` log and any LOAD-02 skip messages
```javascript
console.log(`    ❌ ${record.municipality}: ${error.message}`);  // fatal skip
console.log(`    ⚠️  ${name}: ${error.message}`);               // non-fatal warning
```
`fiscal_years` update failure uses `⚠️` (non-fatal) — the RPC call must still proceed.

### `writeFileSync` for crash-safe I/O
**Source:** `scripts/scrapeMaDLS.js` line 459 (`exploreReport`) — `writeFileSync(htmlFile, html)`
**Apply to:** LOAD-02 `writeProgress()` function
Use `writeFileSync` (synchronous), not `fs.writeFile` (async). Guarantees file is written before moving to the next record. See RESEARCH.md Pitfall 1 for rationale.

### `try { ... } catch { return default; }` file read idiom
**Source:** `scripts/processEnrichmentQueue.js` lines 28–44
**Apply to:** LOAD-02 `readProgress()` function
```javascript
try {
  return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
} catch {
  return {};  // file missing or malformed → fresh start
}
```

---

## No Analog Found

| Change | Role | Data Flow | Reason |
|--------|------|-----------|--------|
| Checkpoint `Set`-based lookup (LOAD-02) | utility | file-I/O | No loader in the codebase has a resume/checkpoint pattern. This is new infrastructure for scrapeMaDLS.js. |
| `fiscal_years` array deduplication and UPDATE (LOAD-03) | service | CRUD | All other loaders that write `fiscal_years` use INSERT-only paths or `dataset_id`-keyed upserts (one row per FY). The multi-FY-on-one-row pattern with append-dedup is unique to MA DLS. |

---

## Metadata

**Analog search scope:** `scripts/` (all `.js` files), `.gitignore`
**Files scanned:** `scripts/scrapeMaDLS.js` (748 lines, full read), `scripts/bulkLoadStateController.js`, `scripts/processEnrichmentQueue.js`, `scripts/processPortland.js`, `scripts/processMA.js`, `scripts/bulkLoadBudget.js`, `.gitignore`
**Grep searches:** `fiscal_years` across all scripts, `readFileSync`/`writeFileSync`/`progress`/`checkpoint`, `maybeSingle`, `fiscal_years` append/spread patterns
**Pattern extraction date:** 2026-06-09
