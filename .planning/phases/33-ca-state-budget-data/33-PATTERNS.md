# Phase 33: CA State Budget Data — Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 4 (3 new, 1 modified)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/extractCA.py` | utility (extractor) | file-I/O / transform | `scripts/extractBakersfield.py` | role-match (openpyxl vs pdfplumber, but same emit-JSON-to-stdout pattern) |
| `scripts/processCA.js` | service (loader) | file-I/O + request-response (RPC) | `scripts/processBakersfield.js` | exact (Node.js, execSync extractor, buildTree, upsertDataSource, RPC) |
| `scripts/seedCAState.js` | utility (seeder) | CRUD | `scripts/seedAnaheimSantaAnaCA.js` | exact (same upsertMunicipality + upsertDataSourceByName pattern) |
| `scripts/enrichCategories.js` | service (modifier) | event-driven (AI pipeline) | self (lines 291–304, switch block) | self-modification |

---

## Pattern Assignments

### `scripts/extractCA.py` (utility, file-I/O / transform)

**Analog:** `scripts/extractBakersfield.py` (structure) and RESEARCH.md Pattern 1 (column map)

The CA extractor is simpler than any PDF extractor — the LAO Excel is a flat, clean table. The structural skeleton (shebang + docstring + argparse + `print(json.dumps(...))` to stdout) matches all existing Python extractors. Key difference: uses `openpyxl` instead of `pdfplumber`; no page detection needed.

**Shebang + docstring pattern** (from `extractBakersfield.py` lines 1-27):
```python
#!/usr/bin/env python3
"""
extractCA.py — California LAO General Fund extractor

Reads 'Pivot Table Data' sheet from Historical_Expenditures.xlsx.
Filters Fund == 'General Fund', maps FY string to ending-year int,
groups by DOF Agency (top-level) -> Department (second-level).
Emits JSON array to stdout for processCA.js to consume.

Usage:
  python scripts/extractCA.py [--fy 2026] [--dry-run]
"""
```

**Imports pattern** (openpyxl variant — no existing analog uses openpyxl, derive from RESEARCH.md Pattern 1):
```python
import sys
import json
import argparse
import openpyxl
```

**FY string-to-int helper** (derived from RESEARCH.md Pattern 1; same century arithmetic as `extractPortland.py` lines 63-66):
```python
def fy_to_int(fy_str):
    """'2025-26' -> 2026 (ending calendar year = app fiscal_year)"""
    parts = fy_str.split('-')
    if len(parts) != 2:
        return None
    century = (int(parts[0]) // 100) * 100
    return century + int(parts[1])
```

**Core extraction pattern** (from RESEARCH.md Pattern 1 — verified against live Excel inspection):
```python
XLSX_PATH = 'docs/California/Historical_Expenditures.xlsx'
SHEET = 'Pivot Table Data'
COLS = {
    'dept_code': 0, 'department': 1, 'function': 2,
    'fiscal_year': 3, 'fund': 4, 'dof_agency': 5,
    'debt_service': 6, 'amount': 7
}

wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
ws = wb[SHEET]
rows_out = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[COLS['fund']] != 'General Fund':
        continue
    if not row[COLS['amount']]:          # skip null-amount rows (Pitfall 4)
        continue
    fy = fy_to_int(row[COLS['fiscal_year']] or '')
    if not fy:
        continue
    rows_out.append({
        'fiscal_year':     fy,
        'dof_agency':      row[COLS['dof_agency']],
        'department':      row[COLS['department']],
        'amount_thousands': row[COLS['amount']],   # THOUSANDS — processCA.js multiplies by 1000
    })
print(json.dumps(rows_out))
```

**argparse / main block pattern** (from `extractBakersfield.py` lines 431-444):
```python
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='California LAO General Fund extractor')
    parser.add_argument('--fy', type=int, action='append',
                        help='Fiscal year(s) to extract (e.g. --fy 2026). Default: all.')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print row count and total only; do not print full JSON')
    args = parser.parse_args()

    data = extract_budget(args.fy, args.dry_run)
    if not args.dry_run:
        print(json.dumps(data))
```

---

### `scripts/processCA.js` (service, file-I/O + RPC)

**Analog:** `scripts/processBakersfield.js` (closest exact match — single canonical data_source, execSync, tree builder, sanity band, RPC call shape all apply)

**Imports pattern** (from `processBakersfield.js` lines 35-42):
```javascript
import { execSync }              from 'node:child_process';
import { createClient }          from '@supabase/supabase-js';
import { parseArgs }             from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import path                      from 'node:path';
import { fileURLToPath }         from 'node:url';
import { resolve, dirname }      from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
```

**loadEnv pattern** (from `processBakersfield.js` lines 47-58, identical in all loaders):
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

**Supabase client init** (from `processBakersfield.js` lines 61-64):
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**execSync Python extractor call** (from `processBakersfield.js` lines 97-106):
```javascript
function extractExcel(fiscalYears, dryRun = false) {
  const pyScript = path.join(ROOT, 'scripts', 'extractCA.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fyArgs = fiscalYears.map(fy => `--fy ${fy}`).join(' ');
  const dryFlag = dryRun ? ' --dry-run' : '';
  const raw = execSync(`${pythonBin} "${pyScript}" ${fyArgs}${dryFlag}`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

**2-level tree builder** (from RESEARCH.md Pattern 2 — no existing analog builds DOF Agency -> Department grouping; Sacramento's `buildBudgetTree` in `loadSacramentoCSV.js` lines 131-168 is the closest structural match for a 2-level tree with `c` children):
```javascript
// NOTE: LAO amounts are in THOUSANDS — multiply by 1000 for absolute dollars
function buildCATree(rows) {
  const agencyMap = new Map();
  for (const row of rows) {
    const amtDollars = (row.amount_thousands || 0) * 1000;   // CRITICAL: x1000
    if (!agencyMap.has(row.dof_agency)) agencyMap.set(row.dof_agency, new Map());
    const deptMap = agencyMap.get(row.dof_agency);
    deptMap.set(row.department, (deptMap.get(row.department) || 0) + amtDollars);
  }
  const tree = [];
  for (const [agency, depts] of agencyMap) {
    let agencyTotal = 0;
    const children = [];
    for (const [dept, amt] of depts) {
      agencyTotal += amt;
      children.push({ n: dept, a: amt, i: [{ d: dept, a: amt, aa: null, f: null, e: null }] });
    }
    children.sort((a, b) => b.a - a.a);
    tree.push({ n: agency, a: agencyTotal, c: children });
  }
  tree.sort((a, b) => b.a - a.a);
  return tree;
}
```

**ensureMunicipality pattern** (from `processBakersfield.js` lines 162-177 — look up by name+state, exit with seeder hint):
```javascript
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'California')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  California, CA municipality not found — run seedCAState.js first');
  process.exit(2);
}
```

**upsertDataSource pattern** (processCA uses a SINGLE canonical data_source row, not per-FY rows — follow `loadSacramentoCSV.js` pattern of looking up by name, NOT `processBakersfield.js`'s per-FY dataset_id pattern):
```javascript
// Look up the single canonical data_source seeded by seedCAState.js
async function getDataSource() {
  const { data: sources, error } = await supabase.rpc('treasury_list_source_ids');
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

  const ds = (sources || []).find(s => s.name === 'California General Fund Operating Budget');
  if (!ds) {
    console.error('Data source not found — run seedCAState.js first');
    process.exit(1);
  }
  return ds;
}
```

**RPC call pattern** (from `processBakersfield.js` lines 218-233 — exact shape confirmed by RESEARCH.md):
```javascript
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,       // integer e.g. 2026
  p_dataset_type:   'operating',
  p_total:          total,            // sum in dollars (NOT thousands)
  p_tree:           tree,             // 2-level JSON array
  p_row_count:      rows.length,      // source rows before tree aggregation
  p_triggered_by:   'bulk_load',
});

if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
```

**Sanity band check** (from `processBakersfield.js` lines 279-287 — adapt bounds for CA GF):
```javascript
// CA GF sanity: FY2024-25=$233.6B, FY2025-26=$228.4B — allow $150B-$300B
const SANITY_MIN = 150_000_000_000;
const SANITY_MAX = 300_000_000_000;

if (total < SANITY_MIN || total > SANITY_MAX) {
  console.error(`\n  SCALE MISMATCH: FY${fy} total $${total.toLocaleString()} outside [$150B, $300B].`);
  console.error('  Likely cause: forgot to multiply LAO thousands by 1000, or wrong Fund filter.');
  process.exit(3);
}
```

**parseArgs / main pattern** (from `processBakersfield.js` lines 339-385):
```javascript
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      fy:        { type: 'string', multiple: true },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  const fiscalYears = opts.fy ? opts.fy.map(Number) : [2022, 2023, 2024, 2025, 2026];

  console.log(`CA State Budget Loader${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Fiscal years: ${fiscalYears.join(', ')}`);

  let muniId = null;
  let ds = null;
  if (!dryRun) {
    muniId = await ensureMunicipality();
    ds = await getDataSource();
  }

  const rows = extractExcel(fiscalYears, dryRun);
  // group by fiscal_year, build tree per FY, call RPC per FY
  // ...

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

---

### `scripts/seedCAState.js` (utility, CRUD)

**Analog:** `scripts/seedAnaheimSantaAnaCA.js` — exact pattern match

**Imports + loadEnv pattern** (from `seedAnaheimSantaAnaCA.js` lines 29-53):
```javascript
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`  loadEnv: unexpected error reading ${f}: ${e.message}`);
      }
    }
  }
}
loadEnv();
```

**Supabase init + config** (from `seedAnaheimSantaAnaCA.js` lines 56-64):
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**Municipality payload** (from RESEARCH.md Pattern 3 — note `entity_type: 'state'` and null county_id):
```javascript
const CALIFORNIA = {
  name:            'California',
  state:           'CA',
  entity_type:     'state',        // Phase 32 CHECK constraint accepts 'state'
  population:      39500000,       // 2024 Census estimate
  population_year: 2024,
  // county_id stays NULL — states don't belong to a county
};
```

**upsertMunicipality function** (copy verbatim from `seedAnaheimSantaAnaCA.js` lines 92-140 — select by name+state, UPDATE if exists, INSERT if not):
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

  if (error) {
    console.error(`  ERROR writing municipality "${m.name}": ${error.message}`);
    process.exit(1);
  }

  const row = data?.[0];
  if (!row) {
    console.error(`  ERROR: no row returned for municipality "${m.name}"`);
    process.exit(1);
  }

  return row.id;
}
```

**upsertDataSourceByName function** (copy verbatim from `seedAnaheimSantaAnaCA.js` lines 143-185 — select by name, UPDATE if exists, INSERT if not):
```javascript
async function upsertDataSourceByName(src) {
  const { data: existingByName, error: selectErrByName } = await supabase
    .schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('name', src.name)
    .maybeSingle();

  if (selectErrByName) {
    console.error(`  ERROR selecting "${src.name}": ${selectErrByName.message}`);
    process.exit(1);
  }

  const existingId = existingByName?.id;
  let data, error;

  if (existingId) {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update(src)
      .eq('id', existingId)
      .select());
    if (!error) console.log(`  (updated existing row ${existingId})`);
  } else {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .insert(src)
      .select());
    if (!error) console.log(`  (inserted new row)`);
  }

  if (error) {
    console.error(`  ERROR writing "${src.name}": ${error.message}`);
    process.exit(1);
  }

  return data?.[0];
}
```

**data_source payload** (from RESEARCH.md Pattern 3 — single canonical row, not per-FY):
```javascript
// Built after caStateId is obtained from upsertMunicipality()
const DATA_SOURCE = {
  name:            'California General Fund Operating Budget',
  api_type:        'xlsx_download',
  dataset_type:    'operating',
  dataset_id:      'ca-lao-gf-operating',
  base_url:        'https://lao.ca.gov/sections/state-budget/econ_fiscal/Historical_Expenditures.xlsx',
  municipality_id: caStateId,
  fiscal_years:    [2022, 2023, 2024, 2025, 2026],
};
```

**Verification via treasury_list_source_ids** (from `seedAnaheimSantaAnaCA.js` lines 253-281 — same RPC call pattern):
```javascript
const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
if (listErr) {
  console.error(`  ERROR: ${listErr.message}`);
  process.exit(1);
}

const expectedNames = ['California General Fund Operating Budget'];
let allFound = true;
for (const name of expectedNames) {
  const hit = (listing || []).find(r => r.name === name);
  if (hit) {
    console.log(`  OK: ${name} (api_type=${hit.api_type}, type=${hit.dataset_type})`);
  } else {
    console.log(`  MISSING: ${name}`);
    allFound = false;
  }
}

if (!allFound) {
  console.error('\nERROR: expected source not found in treasury_list_source_ids');
  process.exit(1);
}
```

**main function structure** (from `seedAnaheimSantaAnaCA.js` lines 188-286 — single municipality, single data_source):
```javascript
async function main() {
  console.log('Seeding California state (Phase 33) — municipality + data_source...\n');

  console.log('Upserting municipality: California, CA');
  const caStateId = await upsertMunicipality(CALIFORNIA);
  console.log(`  id: ${caStateId}\n`);

  const dataSources = [{ ...DATA_SOURCE, municipality_id: caStateId }];

  console.log('Upserting data_source rows...');
  for (const src of dataSources) {
    console.log(`  Upserting: ${src.name}`);
    const row = await upsertDataSourceByName(src);
    if (!row) {
      console.error(`  ERROR: no row returned for "${src.name}"`);
      process.exit(1);
    }
    console.log(`  id=${row.id}  api_type=${row.api_type}  dataset_type=${row.dataset_type}\n`);
  }

  // Verification ...
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

---

### `scripts/enrichCategories.js` (MODIFIED — add `'state'` case)

**Analog:** Self — the existing `buildEntityContext()` switch at lines 291–304

**Current switch block** (from `enrichCategories.js` lines 291–304 — read directly):
```javascript
function buildEntityContext(municipality) {
  const entityType = municipality.entity_type || 'city';
  switch (entityType) {
    case 'township':
      return `This is a township government. Township governments in Indiana are administered by a township trustee. They commonly fund township assistance (poor relief), fire protection districts, cemetery maintenance, and general township administration.`;
    case 'county':
      return `This is a county government. County governments are overseen by a county council and board of commissioners. They commonly fund the county sheriff, county health department, courts, county clerk, assessor, recorder, and public works.`;
    case 'school_district':
      return `This is a school district. School districts focus on per-pupil spending, state tuition support (basic grant), debt service on building bonds, referendum levies, extracurricular activities, and special education.`;
    case 'city':
    default:
      return `This is a city government with a mayor and city council.`;
  }
}
```

**Required modification — insert before `case 'city':` at line 300** (from RESEARCH.md Pattern 4):
```javascript
    case 'state':
      return `This is a state government budget. The California state budget covers
policy programs funded through the General Fund — primarily K-12 and higher education,
health and human services (Medi-Cal), corrections and rehabilitation, and government
operations. Programs are organized by the Department of Finance's agency groupings.
Amounts are in the hundreds of millions to tens of billions of dollars. Frame
descriptions as state policy programs visible to residents statewide, not as
local city departments.`;
```

**Insertion point:** After line 299 (`return \`This is a school district...`;`) and before line 300 (`case 'city':`).

**No other changes needed.** The CLI pattern `node scripts/enrichCategories.js --city "California" --state CA --year 2026` already works because `getMunicipality('California', 'CA')` will return the row with `entity_type='state'`, and `buildEntityContext()` is already called with the full municipality object at line 307.

---

## Shared Patterns

### Env Loading
**Source:** `scripts/seedAnaheimSantaAnaCA.js` lines 36–53 (identical in all scripts)
**Apply to:** `seedCAState.js`, `processCA.js`
```javascript
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`  loadEnv: unexpected error reading ${f}: ${e.message}`);
      }
    }
  }
}
loadEnv();
```

### Supabase Schema Prefix
**Source:** `scripts/seedAnaheimSantaAnaCA.js` line 96, 112, 114 (all tables require `.schema('treasury')`)
**Apply to:** `seedCAState.js`, `processCA.js`
```javascript
supabase.schema('treasury').from('municipalities')
supabase.schema('treasury').from('data_sources')
// NOTE: supabase.rpc() does NOT use .schema() — RPC calls are at root level
```

### RPC Error Handling
**Source:** `scripts/processBakersfield.js` lines 228–230
**Apply to:** `processCA.js`
```javascript
if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
```

### Python Binary Selection (Windows)
**Source:** `scripts/processBakersfield.js` line 99, `scripts/processPortland.js` line 97
**Apply to:** `processCA.js`
```javascript
const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
```

### Process Exit Codes
**Source:** All loaders — consistent convention
**Apply to:** `processCA.js`, `seedCAState.js`
- `process.exit(1)` — configuration/env error (missing key, seed missing)
- `process.exit(2)` — fatal runtime error (RPC failed, no municipality)
- `process.exit(3)` — sanity band violation (scale mismatch, halts before DB write)

---

## No Analog Found

No files in Phase 33 are without any analog. All 4 files have close matches.

The only structurally novel element is `extractCA.py`'s use of `openpyxl` — no existing extractor uses openpyxl (all use `pdfplumber`). The column-map and emit-JSON-to-stdout pattern is the same; only the library call changes. RESEARCH.md Pattern 1 provides the openpyxl-specific code.

---

## Metadata

**Analog search scope:** `scripts/*.py`, `scripts/*.js`
**Files scanned:** 13 Python extractors, ~65 JS scripts (read 6 in full)
**Analogs read in full:**
- `scripts/extractSanJose.py` — Python extractor structure reference
- `scripts/extractBakersfield.py` — closest Python extractor analog (shebang, argparse, detect_fy, emit JSON)
- `scripts/extractPortland.py` — FY string-to-int century arithmetic
- `scripts/processBakersfield.js` — exact JS loader analog (execSync, tree builder, sanity band, RPC)
- `scripts/processPortland.js` — loadFiscalYear + upsertDataSource per-FY variant (reference only)
- `scripts/loadSacramentoCSV.js` — canonical data_source lookup pattern + 2-level tree builder shape
- `scripts/seedAnaheimSantaAnaCA.js` — exact seeder analog (upsertMunicipality + upsertDataSourceByName)
- `scripts/enrichCategories.js` lines 283–315 — switch block to modify

**Pattern extraction date:** 2026-06-07
