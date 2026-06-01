# Phase 20: Gresham OR Budget Load - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 4 new/modified files + 1 verified no-change
**Analogs found:** 4 / 4 (all new files have direct Portland analogs)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/seedGreshamOregon.js` | service/seeder | CRUD (upsert) | `scripts/seedPortlandOregon.js` | exact |
| `scripts/extractGresham.py` | utility/extractor | file-I/O + transform | `scripts/extractPortland.py` | role-match (text-line vs. extract_tables) |
| `scripts/processGresham.js` | service/loader | file-I/O → request-response (RPC) | `scripts/processPortland.js` | exact |
| `scripts/loadORPopulation.js` | service/loader | file-I/O → CRUD | `scripts/loadORPopulation.js` (existing) | exact (two-constant edit) |
| `src/components/EntitySwitcher.tsx` | component | — (config constant) | `src/components/EntitySwitcher.tsx` | **NO CHANGE NEEDED** — `OR: 'Oregon'` already at line 25 |

---

## Pattern Assignments

### `scripts/seedGreshamOregon.js` (service/seeder, CRUD)

**Analog:** `scripts/seedPortlandOregon.js` (read in full)

**File header / imports pattern** (lines 1–36):
```javascript
#!/usr/bin/env node
/**
 * Gresham, Oregon Municipality Seeder (Phase 20)
 *
 * Creates (or updates) the municipality row for Gresham, OR.
 * NOTE: data_source rows are owned by processGresham.js (one per fiscal year).
 * This seeder intentionally does NOT create data_source rows.
 *
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedGreshamOregon.js
 *
 * Population source: Census sub-est2024_41.csv, SUMLEV=162, 2024 vintage
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
```
Note: `seedPortlandOregon.js` uses `{ db: { schema: 'treasury' } }` init option — carry this forward. All `.from()` calls then omit `.schema('treasury')`.

**Municipality payload** (lines 40–46 of analog — change to Gresham):
```javascript
// Change from Portland to Gresham:
const GRESHAM = {
  name: 'Gresham',
  state: 'OR',
  entity_type: 'city',
  population: 111507,       // Census sub-est2024_41.csv, SUMLEV=162, "Gresham city", 2024 vintage
  population_year: 2024,
};
```

**Idempotent municipality upsert** (lines 49–91 of analog — copy exactly, update name references):
```javascript
async function upsertMunicipality(m) {
  const { data: existing, error: selectErr } = await supabase
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
      .from('municipalities')
      .update(m)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
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

**Post-seed verification pattern** (lines 106–149 of analog — adapt expected names and population check):
```javascript
// Adapt these two lines from Portland:
const expectedNames = ['Gresham Operating Budget FY2023', 'Gresham Operating Budget FY2024',
                       'Gresham Operating Budget FY2025', 'Gresham Operating Budget FY2026'];
// ...
if (mc.population !== 111507) {
  console.error(`  WARNING: expected population 111507, got ${mc.population}`);
}
```

**Main wiring** (lines 94–152 of analog — copy structure, update labels):
```javascript
async function main() {
  console.log('Seeding Gresham, OR (Phase 20) — municipality only...\n');
  console.log('NOTE: data_source rows are created by processGresham.js (one per FY).\n');

  console.log(`Upserting municipality: ${GRESHAM.name}, ${GRESHAM.state}`);
  const muniId = await upsertMunicipality(GRESHAM);
  console.log(`  id: ${muniId}\n`);
  // ... verification via treasury_list_source_ids ...
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
```

---

### `scripts/extractGresham.py` (utility/extractor, file-I/O + transform)

**Analog:** `scripts/extractPortland.py` — but extraction strategy is fundamentally different.

**Critical difference:** Portland uses `page.extract_tables()` on "Appropriation Schedule" pages (lines 145–207 of analog). Gresham's All Funds page returns `Tables found: 0` from `extract_tables()`. Use `page.extract_text()` + line-by-line parsing instead. Do NOT copy the `extract_tables()` block.

**Shared structural patterns from analog** (copy these from `extractPortland.py`):

**File header and imports** (lines 1–18 of analog):
```python
#!/usr/bin/env python3
"""
Gresham Budget PDF Extractor

Extracts department-level operating budget from the 'Resources and Requirements
— All Funds' page using pdfplumber text-line parsing (NOT extract_tables).

Usage:
  python scripts/extractGresham.py "docs/Gresham/fy2025-26.pdf"
"""

import sys
import json
import re
import pdfplumber
```

**parse_money function** — Gresham version handles OCR space artifacts (differs from Portland's `parse_money` at lines 20–48 of analog):
```python
def parse_money(s):
    """Handle OCR spacing artifacts in older PDFs: '3 5,569,000' -> 35569000."""
    if not s or not s.strip() or s.strip() == '-':
        return 0
    # Remove ALL whitespace, $, parens, commas — handles OCR spaces inside numbers
    cleaned = re.sub(r'[\$\(\)\s,]', '', s.strip())
    neg = s.strip().startswith('(')
    try:
        return int(round(float(cleaned) * (-1 if neg else 1)))
    except ValueError:
        return 0
```

**Fiscal year parser** — Gresham-specific (NOT Portland's `parse_fy` at lines 51–64 of analog — Gresham uses `2025/26` format, no "FY" prefix, and older PDFs use `2020/2021`):
```python
def parse_fy_from_header(header_line):
    """
    Parse fiscal year from column header line.
    Handles: '2022/23 2023/24 2024/25 2025/26 2025/26 2025/26'
             '2019/20 2020/2021 2021/2022 2022/2023 2022/2023 2022/2023'
    Returns ending year integer of the LAST pattern (= Adopted column).
    """
    # Match YYYY/YYYY (4+4) or YYYY/YY (4+2, not followed by digit)
    matches = re.findall(r'\d{4}/(?:\d{4}|\d{2})(?!\d)', header_line)
    if not matches:
        return None
    last = matches[-1]
    m4 = re.match(r'(\d{4})/(\d{4})', last)
    if m4:
        return int(m4.group(2))
    m2 = re.match(r'(\d{4})/(\d{2})', last)
    if m2:
        return int(m2.group(1)) // 100 * 100 + int(m2.group(2))
    return None
```

**Skip-rows set** (unique to Gresham — Portland has no equivalent):
```python
SKIP_ROWS = {
    # Totals
    'Operating Total', 'Non-Operating Total', 'Total Requirements', 'Total Resources',
    # Non-operating requirements
    'Capital Improvement', 'Debt Service', 'Transfers', 'Contingency',
    'Other Requirements', 'Unappropriated',
    # Resources (revenue) rows — exclude from operating load
    'Taxes', 'Licenses & Permits', 'Intergovernmental', 'Charges for Services',
    'Utility License Fees', 'Miscellaneous Income', 'Internal Payments',
    'Interfund Transfers', 'Internal Svc Chrg', 'Internal Service Charges',
    'Financing Proceeds', 'Beginning Balance',
}
```

**Core text-line extraction function** (no analog in extractPortland.py — this is the Gresham-specific pattern from RESEARCH.md):
```python
def extract_budget(pdf_path):
    """
    Extract department-level operating budget from Gresham All Funds page.
    Returns list of: { department, adopted_amount, fiscal_year, page_num }
    """
    results = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            if 'Resources and Requirements' not in text or 'All Funds' not in text:
                continue
            # Parse fiscal year from column headers (first 8 lines of page)
            fiscal_year = None
            lines = text.split('\n')
            for line in lines[:8]:
                fy = parse_fy_from_header(line)
                if fy:
                    fiscal_year = fy
                    break
            if not fiscal_year:
                print(f'  WARNING: Could not parse fiscal year on page {page_num}', file=sys.stderr)
                continue
            # Extract department rows from Requirements section only
            in_requirements = False
            for line in lines:
                s = line.strip()
                if not s:
                    continue
                if s == 'Requirements':
                    in_requirements = True
                    continue
                if not in_requirements:
                    continue
                # Each data line: "Dept Name  num  num  num  num  num  ADOPTED"
                tokens = s.split()
                if len(tokens) < 2:
                    continue
                # Split: name tokens (no commas/dashes) vs number tokens
                name_tokens = []
                num_tokens = []
                in_nums = False
                for t in tokens:
                    if not in_nums and (re.match(r'^[\d,]+$', t) or t == '-'):
                        in_nums = True
                    if in_nums:
                        num_tokens.append(t)
                    else:
                        name_tokens.append(t)
                if not name_tokens or not num_tokens:
                    continue
                dept = ' '.join(name_tokens)
                dept_normalized = re.sub(r'\s+', ' ', dept).strip()
                if dept_normalized in SKIP_ROWS:
                    continue
                # Adopted = last numeric token (column 6)
                adopted = parse_money(num_tokens[-1])
                if adopted <= 0:
                    print(f'  [skipped] Zero/negative amount: {dept}', file=sys.stderr)
                    continue
                results.append({
                    'department': dept_normalized,
                    'adopted_amount': adopted,
                    'fiscal_year': fiscal_year,
                    'page_num': page_num,
                })
            break  # Only one All Funds page per PDF
    return results
```

**JSON output pattern** (lines 318–327 of analog — copy exactly, adapt script name and mode arg):
```python
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extractGresham.py <pdf_path>', file=sys.stderr)
        sys.exit(1)
    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
```
Note: No `--mode` argument needed for Phase 20 (operating only). Simpler `sys.argv` pattern instead of `argparse`.

**Post-validation pattern** (lines 208–215 of analog — copy the none_fy warning):
```python
# After extract_budget() loop, add:
none_fy = [r for r in results if r['fiscal_year'] is None]
if none_fy:
    print(f'  WARNING: {len(none_fy)} rows have None fiscal_year — check PDF header',
          file=sys.stderr)
```

---

### `scripts/processGresham.js` (service/loader, file-I/O → RPC)

**Analog:** `scripts/processPortland.js` (read in full — 344 lines)

**Imports and Supabase setup** (lines 22–58 of analog — copy with path/name updates):
```javascript
import { execSync }        from 'node:child_process';
import { createClient }    from '@supabase/supabase-js';
import { parseArgs }       from 'node:util';
import { readdirSync, existsSync } from 'node:fs';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```
Note: `processPortland.js` uses `.schema('treasury')` chain on each query (not init option) — carry forward the same pattern.

**PDF URL map** (lines 62–77 of analog — replace with Gresham URLs, single-level not operating/revenue):
```javascript
// Gresham: single PDF per FY, no vol1/vol2 split
const PDF_URLS = {
  2026: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/fy-2025-26-adopted-budget.pdf',
  2025: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy24-25.pdf',
  2024: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy-2023-24.pdf',
  2023: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/adopted-budget-for-fiscal-year-2022-23.pdf',
};
```

**Python extractor invocation** (lines 80–88 of analog — change script name to extractGresham.py, drop `--mode` arg):
```javascript
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractGresham.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

**Filename-to-FY inference** (lines 91–99 of analog — copy exactly, same `fy2025-26.pdf → 2026` pattern):
```javascript
function inferFiscalYearFromFilename(filename) {
  const m = filename.match(/fy(\d{4})-(\d{2})/i);
  if (m) {
    const century = Math.floor(parseInt(m[1], 10) / 100) * 100;
    return century + parseInt(m[2], 10);
  }
  return null;
}
```

**Operating tree builder** (lines 119–142 of analog — change `row.bureau` to `row.department`):
```javascript
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,    // 'department' field (Gresham) vs 'bureau' (Portland)
      a: amount,
      i: [{
        d: row.department,
        a: amount,
        aa: null,
        f: null,
        e: null,
      }],
    });
    total += amount;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}
```

**Municipality lookup** (lines 145–160 of analog — change 'Portland' to 'Gresham'):
```javascript
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Gresham')     // changed from 'Portland'
    .eq('state', 'OR')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Gresham, OR municipality not found — run seedGreshamOregon.js first');
  process.exit(2);
}
```

**data_source upsert** (lines 163–198 of analog — remove revenue branch, update label/name):
```javascript
async function upsertDataSource(muniId, fiscalYear) {
  const src = {
    name:            `Gresham Operating Budget FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      `fy${fiscalYear}`,
    base_url:        PDF_URLS[fiscalYear] ?? '',
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fy${fiscalYear}`)
    .eq('dataset_type', 'operating')
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

**treasury_sync_budget_tree RPC call** (lines 201–229 of analog — copy exactly):
```javascript
async function loadFiscalYear(muniId, fiscalYear, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, fiscalYear);
  if (!ds?.id) { console.error('    data_source upsert failed'); return false; }
  console.log(`    data_source: ${ds.id}`);

  // Clear existing rows for idempotency
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  if (delErr) {
    console.error('    Pre-load delete failed:', delErr.message);
    return false;
  }

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'operating',
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

**PDF discovery and main** (lines 297–343 of analog — simplify: no `--revenue` flag, no `volSuffix` filter, use `docs/Gresham/`):
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
  const pdfDir = path.join(ROOT, 'docs', 'Gresham');  // changed from 'Portland'

  let pdfPaths;
  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));  // no volSuffix filter needed
    if (!files.length) {
      console.error('No PDFs found in docs/Gresham/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Gresham Budget Loader${dryRun ? ' (dry-run)' : ''} [operating]`);
  console.log(`PDFs to process: ${pdfPaths.length}`);

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

**Note on `resolvePdfDir` worktree helper** (lines 36–52 of analog): Portland added this for git-worktree robustness. Carry it forward as `docs/Gresham/` for Gresham.

---

### `scripts/loadORPopulation.js` (service/loader, file-I/O → CRUD) — MODIFY EXISTING FILE

**This is a two-constant edit to an existing file. Do NOT rewrite the file.**

**Current state** (lines 16–21 of existing file):
```javascript
const EXPECTED_CITIES = ['Portland'];

const KNOWN_VALUES = {
  Portland: 635749,
};
```

**Required change** — add Gresham to both arrays:
```javascript
const EXPECTED_CITIES = ['Portland', 'Gresham'];

const KNOWN_VALUES = {
  Portland: 635749,
  Gresham: 111507,   // Census sub-est2024_41.csv, SUMLEV=162, "Gresham city" → 111507 (2024)
};
```

**All other code stays exactly the same.** The existing `normalizeCensusName` (line 23) already strips ` city` suffix. The existing `.eq('state', 'OR')` filter (lines 126 and 136) already covers both cities.

**Verification that no other changes are needed:**
- Line 80: `if (cols[0] !== '162') continue;` — SUMLEV=162 filter already correct for Gresham
- Line 70: CSV column header validation (`POPESTIMATE2024` at col 15) — unchanged
- Line 114: `createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } })` — unchanged

---

### `src/components/EntitySwitcher.tsx` — NO CHANGE NEEDED

**Verified:** `OR: 'Oregon'` is already present at line 25. This was added in Phase 17.

```typescript
// Line 25 — already present:
OR: 'Oregon',
```

No task required for this file.

---

## Shared Patterns

### Supabase Client Initialization
**Source:** `scripts/seedPortlandOregon.js` line 36 / `scripts/processPortland.js` line 58
**Apply to:** `seedGreshamOregon.js`, `processGresham.js`

`seedGreshamOregon.js` — use init-option schema (matches seedPortlandOregon.js):
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
```

`processGresham.js` — use chain-schema (matches processPortland.js):
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// then chain .schema('treasury') on every non-RPC query
```

### Error Handling Convention
**Source:** `scripts/processPortland.js` lines 224–225 + line 343
**Apply to:** `processGresham.js`, `seedGreshamOregon.js`
```javascript
// RPC errors: check both thrown and returned
if (rpcErr)         { console.error('    RPC error:', rpcErr.message); return false; }
if (rpc?.error)     { console.error('    RPC error (returned):', rpc.error); return false; }

// Fatal exit pattern at bottom of all scripts
main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

### Dry-Run CLI Flag
**Source:** `scripts/processPortland.js` lines 298–308 / `scripts/loadORPopulation.js` lines 48–49
**Apply to:** `processGresham.js` (loadORPopulation.js already has it)
```javascript
const { values: opts } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    pdf:       { type: 'string' },
  },
  strict: false,
});
const dryRun = opts['dry-run'];
```

### PDF Directory Convention
**Source:** `scripts/processPortland.js` lines 37–52 (resolvePdfDir) + lines 318–326
**Apply to:** `processGresham.js`
```javascript
// PDFs live in docs/Gresham/ (create this directory before downloading PDFs)
const pdfDir = path.join(ROOT, 'docs', 'Gresham');
const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
if (!files.length) { console.error('No PDFs found in docs/Gresham/'); process.exit(1); }
files.sort();
const pdfPaths = files.map(f => path.join(pdfDir, f));
```

### treasury_sync_budget_tree RPC Parameters
**Source:** `scripts/processPortland.js` lines 214–222
**Apply to:** `processGresham.js`
All six parameters are required — exact same shape as Portland:
```javascript
await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,    // integer: 2023/2024/2025/2026
  p_dataset_type:   'operating',   // always 'operating' for Phase 20
  p_total:          total,         // sum of department amounts (NOT $897M Total Requirements)
  p_tree:           tree,          // array of { n, a, i[] } nodes
  p_row_count:      rowCount,      // tree.length
  p_triggered_by:   'bulk_load',
});
```

---

## Key Differences: Gresham vs. Portland

These are the points where copying Portland patterns verbatim would produce incorrect results:

| Property | Portland | Gresham | Impact |
|----------|----------|---------|--------|
| PDF structure | Vol 1 (operating) + Vol 2 (revenue) | Single PDF per FY | No vol1/vol2 suffix filter in PDF discovery |
| Extraction method | `extract_tables()` on "Appropriation Schedule" pages | `extract_text()` + line-by-line on "Resources and Requirements — All Funds" | Do NOT use extract_tables() |
| Row field name | `row.bureau` | `row.department` | buildOperatingTree uses `row.department` |
| Fiscal year format | `FY 2025-26` (dash, "FY" prefix) | `2025/26` (slash, no prefix); older: `2020/2021` | Use `parse_fy_from_header()` not `parse_fy()` |
| `--revenue` flag | Present (Phase 19 adds revenue) | NOT present in Phase 20 (operating only) | Omit revenue branch from processGresham.js |
| Operating total | ~$6B (Portland) | ~$330M (Gresham FY2026) | `p_total` > $500M = error |
| municipality name | 'Portland' | 'Gresham' | All `.eq('name', ...)` lookups |

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns only.

The `extractGresham.py` is the only file where the analog (`extractPortland.py`) provides structural/boilerplate patterns but NOT the core extraction logic. The text-line parsing logic comes from RESEARCH.md code examples (verified against actual PDFs 2026-05-31).

---

## Metadata

**Analog search scope:** `scripts/`, `src/components/`
**Files read:** `seedPortlandOregon.js` (153 lines), `processPortland.js` (344 lines), `extractPortland.py` (328 lines), `loadORPopulation.js` (155 lines), `EntitySwitcher.tsx` (grep only)
**Pattern extraction date:** 2026-05-31

**Critical implementation notes for planner:**
1. `docs/Gresham/` directory must be created and all 4 PDFs downloaded before running `processGresham.js`
2. `extractGresham.py` must be a new file — do NOT call `extractPortland.py` for Gresham PDFs (wrong page markers, wrong extraction strategy)
3. The operating total validation check: `p_total` for Gresham should be ~$269M–$330M depending on year; anything > $500M indicates the wrong row set was summed
4. `loadORPopulation.js` edit is two constants only — all other logic (SUMLEV filter, normalizeCensusName, column validation) is already correct for Gresham
5. Run `seedGreshamOregon.js` → download PDFs → `processGresham.js` → `loadORPopulation.js` → `enrichCategories.js` (in that order)
