# Phase 29: Long Beach + Bakersfield CA Data Load - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 5 new scripts
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/seedLongBeachBakersfieldCA.js` | seeder | CRUD | `scripts/seedOaklandSanJoseCA.js` | exact |
| `scripts/extractLongBeach.py` | utility | file-I/O | `scripts/extractOakland.py` | exact |
| `scripts/processLongBeach.js` | service | batch | `scripts/processOakland.js` | exact |
| `scripts/extractBakersfield.py` | utility | file-I/O | `scripts/extractOakland.py` | exact |
| `scripts/processBakersfield.js` | service | batch | `scripts/processOakland.js` | exact |

---

## Pattern Assignments

### `scripts/seedLongBeachBakersfieldCA.js` (seeder, CRUD)

**Analog:** `scripts/seedOaklandSanJoseCA.js`

**File header / purpose comment** (lines 1-26):
```javascript
#!/usr/bin/env node
/**
 * Long Beach + Bakersfield CA Data Sources Seeder (Phase 29)
 *
 * Performs the following (all idempotent):
 *   A. Upsert Long Beach municipality row (population=451000, population_year=2024, county_id=LA_COUNTY_ID)
 *   B. Upsert Bakersfield municipality row (population=417000, population_year=2024)
 *   C. Upsert four data_source rows:
 *        - 'Long Beach General Fund Operating Budget'   (api_type='pdf_download', dataset_type='operating')
 *        - 'Long Beach General Fund Revenue Budget'     (api_type='pdf_download', dataset_type='revenue')
 *        - 'Bakersfield Operating Budget'               (api_type='pdf_download', dataset_type='operating')
 *        - 'Bakersfield Revenue Budget'                 (api_type='pdf_download', dataset_type='revenue')
 *   D. Verification: calls treasury_list_source_ids RPC and asserts all four names appear.
 * ...
 */
```

**Imports + env loading** (lines 28-48):
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
    } catch {}
  }
}
loadEnv();
```

**Config** (lines 50-59):
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**Municipality payloads — key difference: Long Beach gets county_id directly** (lines 61-68 adapted):
```javascript
// Populations from Census sub-est2024_06.csv (SUMLEV=162, CA sub-county estimates)
// POPUL-01: Long Beach ~451K, Bakersfield ~417K, both population_year=2024
// Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01)
// Long Beach IS in LA County 88-city list (Phase 25); set county_id directly (verified line 63 seedLACountyLinks.js)
// county_id for Bakersfield: stays NULL — Kern County not loaded (deferred per CONTEXT.md)
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';  // verified: seedLACountyLinks.js line 36

const MUNICIPALITIES = [
  {
    name: 'Long Beach',
    state: 'CA',
    entity_type: 'city',
    population: 451000,
    population_year: 2024,
    county_id: LA_COUNTY_ID,   // Long Beach IS in LA County; set directly (don't rely on Phase 25 re-run)
  },
  {
    name: 'Bakersfield',
    state: 'CA',
    entity_type: 'city',
    population: 417000,
    population_year: 2024,
    // county_id stays NULL — Kern County not loaded (deferred)
  },
];
```

**`upsertMunicipality()` — idempotent SELECT → INSERT or UPDATE** (lines 71-119):
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

**`upsertDataSourceByName()` — idempotent SELECT → INSERT or UPDATE** (lines 122-164):
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

**Data source payloads** (lines 187-220 adapted):
```javascript
const dataSources = [
  {
    name:            'Long Beach General Fund Operating Budget',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'longbeach-gf-operating',
    base_url:        'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/',
    municipality_id: longBeachId,
  },
  {
    name:            'Long Beach General Fund Revenue Budget',
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'longbeach-gf-revenue',
    base_url:        'https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/',
    municipality_id: longBeachId,
  },
  {
    name:            'Bakersfield Operating Budget',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'bakersfield-operating',
    base_url:        'https://docs.bakersfieldcity.us/',
    municipality_id: bakersfieldId,
  },
  {
    name:            'Bakersfield Revenue Budget',
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'bakersfield-revenue',
    base_url:        'https://docs.bakersfieldcity.us/',
    municipality_id: bakersfieldId,
  },
];
```

**Verification via treasury_list_source_ids** (lines 233-263):
```javascript
console.log('Verifying via treasury_list_source_ids RPC...');
const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
if (listErr) {
  console.error(`  ERROR: ${listErr.message}`);
  process.exit(1);
}

const expectedNames = [
  'Long Beach General Fund Operating Budget',
  'Long Beach General Fund Revenue Budget',
  'Bakersfield Operating Budget',
  'Bakersfield Revenue Budget',
];

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
  console.error('\nERROR: one or more expected sources not found in treasury_list_source_ids');
  process.exit(1);
}
```

**Fatal error handler** (line 267):
```javascript
main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

---

### `scripts/extractLongBeach.py` (utility, file-I/O)

**Analog:** `scripts/extractOakland.py`

**Imports + docstring pattern** (lines 1-25):
```python
#!/usr/bin/env python3
"""
Long Beach Budget PDF Extractor

Extracts department-level General Fund expenditure data from Long Beach
General Fund Summary PDFs (fund-summary-gp section) using pdfplumber.

Long Beach FY runs Oct 1 – Sep 30. FY is derived from PDF filename:
  fy25-fund-summary-gp.pdf -> FY 2025 (stored as integer 2025, ending-year convention D-01)
  fy22-fund-summary-gp.pdf -> FY 2022

Port of Long Beach (~$760M) is in Enterprise/Tidelands funds — NOT in General Fund
summary PDFs (fund-summary-gp). Enterprise fund exclusion is automatic by targeting
the correct PDF section. Port departments must never appear in output.

Amount scale: verify during dry-run against ~$1.5B target. Oakland/SanJose use
full dollars; Fremont uses thousands. Verify Long Beach before live-loading.

Usage:
  python scripts/extractLongBeach.py "docs/Long Beach/fy25-fund-summary-gp.pdf"
"""

import sys
import json
import re
import pdfplumber
```

**Money parsing — copy from extractOakland.py lines 28-43**:
```python
def parse_money(s):
    """Parse dollar string like '$3,418,795' or '(1,234)' -> integer."""
    if s is None:
        return 0
    s = str(s).strip()
    if not s or s == '-' or s == '$0':
        return 0
    neg = s.startswith('(') or s.startswith('-$') or (
        s.startswith('-') and not s[1:2].startswith('$')
    )
    val = re.sub(r'[$()\s,]', '', s).lstrip('-')
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0
```

**FY detection from filename — new pattern for Long Beach**:
```python
def detect_fy_from_filename(pdf_path):
    """
    Extract fiscal year (ending-year convention, D-01) from Long Beach fund summary filename.
    fy25-fund-summary-gp.pdf -> 2025
    fy22-fund-summary-gp.pdf -> 2022
    fy2025-fund-summary-gp.pdf -> 2025 (if 4-digit form used)
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    # Two-digit year: fy25 -> 2025, fy22 -> 2022
    m = re.search(r'fy(\d{2})-', fname)
    if m:
        return 2000 + int(m.group(1))
    # Four-digit year: fy2025 -> 2025
    m4 = re.search(r'fy(\d{4})-', fname)
    if m4:
        return int(m4.group(1))
    return None
```

**Core extract_budget() structure — modeled on extractOakland.py lines 132-311**:
```python
def extract_budget(pdf_path):
    """
    Parse Long Beach General Fund Summary PDF.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if not text.strip():
                continue

            # Look for department table rows: "DeptName $amount" pattern
            # Long Beach GF summary lists departments with adopted amounts
            for line in text.split('\n'):
                line = line.strip()
                if not line:
                    continue
                # Parse: dept name + adopted amount columns
                # Adapt regex to match actual PDF layout during dry-run
                m = re.match(r'^(.+?)\s+\$?([\d,]+)\s*$', line)
                if m:
                    dept = m.group(1).strip()
                    amount = parse_money(m.group(2))
                    if amount > 0 and len(dept) > 2:
                        results.append({
                            'department':     dept,
                            'fund':           'General Fund',
                            'adopted_amount': amount,
                            'fiscal_year':    fiscal_year,
                            'page_num':       page_num,
                        })

    # Deduplicate by (department, fiscal_year) — same pattern as extractOakland.py lines 295-309
    seen = set()
    deduped = []
    for row in results:
        key = (row['department'], row['fiscal_year'])
        if key not in seen:
            seen.add(key)
            deduped.append(row)
        else:
            print(f'  [dedup] Skipping duplicate: {row["department"]} FY{row["fiscal_year"]}',
                  file=sys.stderr)

    return deduped
```

**Main entrypoint — copy from extractOakland.py lines 351-358**:
```python
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Long Beach budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    args = parser.parse_args()

    data = extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
```

---

### `scripts/processLongBeach.js` (service, batch)

**Analog:** `scripts/processOakland.js`

**Imports** (lines 33-42):
```javascript
import { execSync }              from 'node:child_process';
import { createClient }          from '@supabase/supabase-js';
import { parseArgs }             from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                      from 'node:path';
import { fileURLToPath }         from 'node:url';
import { resolve, dirname }      from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
```

**Sanity band — key adaptation from RESEARCH.md Pattern 3**:
```javascript
// Long Beach General Fund: ~$1.3B-$1.7B per fiscal year (D-01 ending-year convention)
// Target: ~$1.5B General Fund per REQUIREMENTS.md DATA-04
// If total falls outside this band, halt — Port bleed or scale error
const GF_BAND_MIN = 1_300_000_000;   // $1.3B
const GF_BAND_MAX = 1_700_000_000;   // $1.7B
```

**resolvePdfDir() — adapt from processOakland.js lines 74-88**:
```javascript
// Checks both 'Long Beach' (with space) — no no-space variant needed for LB
// (processSanJose.js checks both 'SanJose' and 'San Jose' — same worktree-safe pattern)
function resolvePdfDir() {
  for (const dirName of ['Long Beach']) {
    const candidate = path.join(ROOT, 'docs', dirName);
    if (existsSync(candidate)) return candidate;
  }

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    for (const dirName of ['Long Beach']) {
      const mainCandidate = path.join(mainRoot, 'docs', dirName);
      if (existsSync(mainCandidate)) return mainCandidate;
    }
  } catch (_) { /* not in git repo or no main worktree */ }

  return path.join(ROOT, 'docs', 'Long Beach');
}
```

**extractPDF() — copy from processOakland.js lines 93-101, change script name**:
```javascript
// Security (T-28-04): maxBuffer 8MB cap
// Security (T-28-05): PDF path from controlled docs/Long Beach/ readdir, double-quoted
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractLongBeach.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

**buildOperatingTree() — copy from processOakland.js lines 106-129, change fund name**:
```javascript
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,
      a: amount,
      i: [{
        d: row.department,
        a: amount,
        aa: null,
        f: 'General Fund',    // Long Beach uses "General Fund" label
        e: null,
      }],
    });
    total += amount;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}
```

**ensureMunicipality() — copy from processOakland.js lines 132-147, change city name**:
```javascript
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Long Beach')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Long Beach, CA municipality not found — run seedLongBeachBakersfieldCA.js first');
  process.exit(2);
}
```

**upsertDataSource() — copy from processOakland.js lines 165-195, change labels**:
```javascript
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const label = datasetType === 'revenue' ? 'General Fund Revenue Budget'
              : 'General Fund Operating Budget';
  const src = {
    name:            `Long Beach ${label} FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `fy${fiscalYear}`,
    base_url:        'file://' + pdfAbsPath.replace(/\\/g, '/'),
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fy${fiscalYear}`)
    .eq('dataset_type', datasetType)
    .maybeSingle();

  if (existing?.id) {
    const { data } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    return data;
  }
  const { data } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  return data;
}
```

**loadFiscalYear() — copy verbatim from processOakland.js lines 198-218**:
```javascript
async function loadFiscalYear(muniId, pdfAbsPath, fiscalYear, datasetType, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath);
  if (!ds?.id) { console.error('    data_source upsert failed'); return false; }
  console.log(`    data_source: ${ds.id}`);

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   datasetType,
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)         { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error)     { console.error('    RPC error (returned):', rpc.error); return false; }

  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
  return true;
}
```

**processPDF() sanity band — adapt from processOakland.js lines 263-270**:
```javascript
// Sanity check: Long Beach GF band $1.3B-$1.7B
if (total < GF_BAND_MIN || total > GF_BAND_MAX) {
  console.error(`\n  SCALE MISMATCH WARNING: FY${fy} GF total $${total.toLocaleString()} is outside`);
  console.error(`  expected band $${GF_BAND_MIN.toLocaleString()}-$${GF_BAND_MAX.toLocaleString()}.`);
  console.error('  Possible causes: amounts in wrong units (thousands?), Port bleed, wrong section parsed.');
  console.error('  HALTING before live load to prevent incorrect data insertion.');
  process.exit(3);
}
```

**main() parseArgs + PDF discovery — copy from processOakland.js lines 281-325**:
```javascript
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      pdf:       { type: 'string' },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      console.error('No PDFs found in docs/Long Beach/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Long Beach GF Budget Loader${dryRun ? ' (dry-run)' : ''}`);
  // ...

  let muniId = null;
  if (!dryRun) {
    muniId = await ensureMunicipality();
  }

  for (const p of pdfPaths) {
    await processPDF(p, muniId, dryRun);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

---

### `scripts/extractBakersfield.py` (utility, file-I/O)

**Analog:** `scripts/extractOakland.py`

**Key difference from extractLongBeach.py:** Bakersfield target is ALL operating funds (~$765M, not just General Fund). The extractor must find a cross-fund department summary table rather than a single-fund section. Structure is unknown until PDF is inspected; adapt pattern during Plan 3.

**Imports + docstring** (analogous to extractOakland.py lines 1-20):
```python
#!/usr/bin/env python3
"""
Bakersfield Budget PDF Extractor

Extracts department-level operating expenditure data from Bakersfield
Adopted Budget PDFs using pdfplumber.

Target: ALL operating funds (~$765M per REQUIREMENTS.md DATA-07), NOT just General Fund.
$765M = General Fund (~$287M) + PUBSAF 1% Sales Tax (~$130M) + Equipment + Refuse + others.

The extractor must target the all-funds operating summary table or equivalent
cross-fund department view. Inspect PDF table of contents / search for
"all funds", "department summary", or "operating summary" sections.

FY is detected from PDF filename:
  fy2024-25-adopted-budget.pdf -> 2025 (ending-year convention)
  fy2025-26-adopted-budget.pdf -> 2026

Usage:
  python scripts/extractBakersfield.py "docs/Bakersfield/fy2024-25-adopted-budget.pdf"
"""

import sys
import json
import re
import pdfplumber
```

**FY detection from filename — new pattern for Bakersfield**:
```python
def detect_fy_from_filename(pdf_path):
    """
    Extract fiscal year (ending-year convention) from Bakersfield PDF filename.
    fy2024-25-adopted-budget.pdf -> 2025
    fy2025-26-adopted-budget.pdf -> 2026
    """
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    # Pattern: fy2024-25 -> ending year 25 -> 2025
    m = re.search(r'fy(\d{4})-(\d{2})', fname)
    if m:
        century = (int(m.group(1)) // 100) * 100
        return century + int(m.group(2))
    return None
```

**parse_money() — copy verbatim from extractOakland.py lines 28-43** (identical to Long Beach extractor).

**extract_budget() — adapt from extractOakland.py lines 132-311**:
```python
def extract_budget(pdf_path):
    """
    Parse Bakersfield Adopted Budget PDF for all-funds operating totals.
    Target: ~$765M across all operating funds.
    Returns list of dicts: { department, fund, adopted_amount, fiscal_year, page_num }

    NOTE: The exact section name and table format must be verified by inspecting
    the FY2024-25 adopted budget PDF before writing the final regex patterns.
    Look for: "All Funds Operating Summary", "Department Summary", or similar.
    """
    fiscal_year = detect_fy_from_filename(pdf_path)
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        in_operating_summary = False
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if not text.strip():
                continue

            # Detect the all-funds operating summary section
            # Marker text must be verified against actual PDF — placeholder here:
            if 'ALL FUNDS' in text.upper() and 'OPERATING' in text.upper():
                in_operating_summary = True
            elif in_operating_summary and page_num > 0:
                # Stop after operating section ends — refine boundary during dry-run
                pass

            if not in_operating_summary:
                continue

            for line in text.split('\n'):
                line = line.strip()
                if not line:
                    continue
                # Parse department rows — adapt regex to actual PDF layout
                m = re.match(r'^(.+?)\s+([\d,]+)\s*$', line)
                if m:
                    dept = m.group(1).strip()
                    amount = parse_money(m.group(2))
                    if amount > 100_000 and len(dept) > 2:
                        results.append({
                            'department':     dept,
                            'fund':           'All Operating Funds',
                            'adopted_amount': amount,
                            'fiscal_year':    fiscal_year,
                            'page_num':       page_num,
                        })

    # Deduplicate — same pattern as extractOakland.py lines 295-309
    seen = set()
    deduped = []
    for row in results:
        key = (row['department'], row['fiscal_year'])
        if key not in seen:
            seen.add(key)
            deduped.append(row)

    return deduped
```

---

### `scripts/processBakersfield.js` (service, batch)

**Analog:** `scripts/processOakland.js`

**Key differences from processLongBeach.js:**
- City name: `'Bakersfield'`
- PDF dir: `'Bakersfield'`
- Extractor script: `extractBakersfield.py`
- Sanity band: `$600M-$900M` (target ~$765M all-funds per REQUIREMENTS.md DATA-07)
- Data source name prefix: `'Bakersfield'`
- Fund label in tree: `'All Operating Funds'`

**Sanity band — adapt from processOakland.js lines 64-68**:
```javascript
// Bakersfield ALL operating funds: ~$600M-$900M per fiscal year
// Target: ~$765M operating per REQUIREMENTS.md DATA-07
// If total falls outside this band, halt — wrong section or scale error
const OP_BAND_MIN = 600_000_000;   // $600M
const OP_BAND_MAX = 900_000_000;   // $900M
```

**resolvePdfDir() — adapt from processOakland.js lines 74-88**:
```javascript
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Bakersfield');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Bakersfield');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}
```

**All other functions** (loadEnv, config, ensureMunicipality, upsertDataSource, loadFiscalYear, main) follow identical structure to processLongBeach.js with `'Long Beach'` replaced by `'Bakersfield'` and `extractLongBeach.py` replaced by `extractBakersfield.py`.

---

## Shared Patterns

### Env Loading (Security T-28-06 — SUPABASE_SERVICE_KEY never logged)
**Source:** `scripts/processOakland.js` lines 45-56, `scripts/seedOaklandSanJoseCA.js` lines 37-48
**Apply to:** All three JS files (`seedLongBeachBakersfieldCA.js`, `processLongBeach.js`, `processBakersfield.js`)
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

### Supabase Client Init (key never logged)
**Source:** `scripts/processOakland.js` lines 59-62
**Apply to:** All three JS files
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

### treasury_sync_budget_tree RPC Call
**Source:** `scripts/processOakland.js` lines 203-215
**Apply to:** `processLongBeach.js`, `processBakersfield.js`
```javascript
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   datasetType,  // 'operating' or 'revenue'
  p_total:          total,
  p_tree:           tree,
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});

if (rpcErr)         { console.error('    RPC error:', rpcErr.message); return false; }
if (rpc?.error)     { console.error('    RPC error (returned):', rpc.error); return false; }
```

### execSync Python Invocation (Security T-28-04 + T-28-05)
**Source:** `scripts/processOakland.js` lines 93-101 and `scripts/processSanJose.js` lines 95-103
**Apply to:** `processLongBeach.js`, `processBakersfield.js`
```javascript
// maxBuffer 8MB cap (T-28-04); path from controlled readdir not user input (T-28-05)
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extract{CityName}.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

### Sanity Band Halt (Security T-28-07)
**Source:** `scripts/processOakland.js` lines 263-270
**Apply to:** `processLongBeach.js` (band $1.3B-$1.7B), `processBakersfield.js` (band $600M-$900M)
```javascript
if (total < BAND_MIN || total > BAND_MAX) {
  console.error(`\n  SCALE MISMATCH WARNING: FY${fy} total $${total.toLocaleString()} is outside`);
  console.error(`  expected band $${BAND_MIN.toLocaleString()}-$${BAND_MAX.toLocaleString()}.`);
  console.error('  Possible causes: amounts in wrong units, Port bleed, wrong section parsed.');
  console.error('  HALTING before live load to prevent incorrect data insertion.');
  process.exit(3);
}
```

### Fatal Error Handler
**Source:** `scripts/processOakland.js` line 325, `scripts/seedOaklandSanJoseCA.js` line 267
**Apply to:** All three JS files
```javascript
main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

### Python parse_money()
**Source:** `scripts/extractOakland.py` lines 28-43
**Apply to:** `extractLongBeach.py`, `extractBakersfield.py` (copy verbatim)
```python
def parse_money(s):
    """Parse dollar string like '$3,418,795' or '(1,234)' -> integer."""
    if s is None:
        return 0
    s = str(s).strip()
    if not s or s == '-' or s == '$0':
        return 0
    neg = s.startswith('(') or s.startswith('-$') or (
        s.startswith('-') and not s[1:2].startswith('$')
    )
    val = re.sub(r'[$()\s,]', '', s).lstrip('-')
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0
```

### Python dedup by (department, fiscal_year)
**Source:** `scripts/extractOakland.py` lines 295-309
**Apply to:** `extractLongBeach.py`, `extractBakersfield.py`
```python
seen = set()
deduped = []
for row in results:
    key = (row['department'], row['fiscal_year'])
    if key not in seen:
        seen.add(key)
        deduped.append(row)
    else:
        print(f'  [dedup] Skipping duplicate: {row["department"]} FY{row["fiscal_year"]} '
              f'(page {row["page_num"]})', file=sys.stderr)
return deduped
```

### Worktree-Safe resolvePdfDir()
**Source:** `scripts/processOakland.js` lines 74-88 (single variant), `scripts/processSanJose.js` lines 64-82 (multi-variant with space/no-space)
**Apply to:** `processLongBeach.js` (use `['Long Beach']`), `processBakersfield.js` (use `['Bakersfield']`)
**Note:** Long Beach directory name has a space — only one variant needed, unlike San Jose.

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Critical Phase-Specific Notes for Planner

### Long Beach FY Convention (D-01)
- FY ending-year: `fy25-fund-summary-gp.pdf` → store as integer `2025`
- Document in seeder comment: `// Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01)`
- The `detect_fy_from_filename()` in `extractLongBeach.py` must emit the ending year

### Long Beach county_id in Seeder
- `LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1'` (verified: `seedLACountyLinks.js` line 36)
- Long Beach IS in `LA_COUNTY_CITY_NAMES` (verified: `seedLACountyLinks.js` line 63)
- Set `county_id = LA_COUNTY_ID` directly in the MUNICIPALITIES array for Long Beach
- Do NOT set county_id for Bakersfield (Kern County deferred)

### Port of Long Beach Exclusion
- Target ONLY `fund-summary-gp` PDFs — Port/Enterprise funds are in separate `fund-summary-ef` section
- Add sanity band halt at $1.7B in processLongBeach.js: if total exceeds $1.7B, Port data leaked in
- extractor must never produce rows with department names containing "Harbor" or "Port"

### Bakersfield All-Funds Scope
- Target is ~$765M across ALL operating funds — NOT just General Fund (~$287M)
- Extractor must find the cross-fund summary table; exact marker TBD by PDF inspection in Plan 3
- Sanity band in processBakersfield.js: halt if total < $600M (fund-only) or > $900M

### Amounts Scale (Verify During Dry-Run)
- Oakland/SanJose: full dollars — `processOakland.js` line 8: "amounts in FULL DOLLARS"
- Fremont: thousands — `processFremont.js` uses `toFullDollars(thousands * 1000)`
- Long Beach and Bakersfield: UNKNOWN — verify by comparing dry-run total to target (~$1.5B / ~$765M)
- If total is ~$1,500 for Long Beach dry-run → amounts in thousands → multiply by 1000

### Enrichment (Plan 4, no file changes)
**Source:** `scripts/enrichCategories.js` — fully reusable, no modifications needed
**Usage:**
```bash
# Estimate first — combined gate is $0.10 (D-08), tighter than project-wide $5 gate
node scripts/enrichCategories.js --city "Long Beach" --state CA --year 2025 --dry-run
node scripts/enrichCategories.js --city Bakersfield  --state CA --year 2025 --dry-run
# Only proceed if combined estimate < $0.10
```

---

## Metadata

**Analog search scope:** `scripts/` directory — all seed*, extract*, process* files
**Files scanned:** `seedOaklandSanJoseCA.js`, `processOakland.js`, `processSanJose.js`, `extractOakland.py`, `extractSanJose.py`, `extractFremont.py` (first 100 lines)
**Pattern extraction date:** 2026-06-05
