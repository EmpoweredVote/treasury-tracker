# Phase 28: Oakland + San Jose CA Data Load - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 5 new files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/seedOaklandSanJoseCA.js` | utility/seeder | request-response (DB upsert) | `scripts/seedCaliforniaCities.js` | exact |
| `scripts/extractOakland.py` | utility/extractor | batch (PDF → JSON) | `scripts/extractPortland.py` | exact |
| `scripts/processOakland.js` | utility/processor | batch (JSON → DB) | `scripts/processPortland.js` | exact |
| `scripts/extractSanJose.py` | utility/extractor | batch (PDF → JSON) | `scripts/extractFremont.py` | role-match |
| `scripts/processSanJose.js` | utility/processor | batch (JSON → DB) | `scripts/processFremont.js` | exact |

---

## Pattern Assignments

### `scripts/seedOaklandSanJoseCA.js` (utility/seeder, request-response)

**Primary analog:** `scripts/seedCaliforniaCities.js`
**Secondary analog:** `scripts/seedSacramentoCA.js` (single-city per-step structure + verification block)

**Imports pattern** (`scripts/seedCaliforniaCities.js` lines 26–37):
```javascript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**Municipality payload pattern** (`scripts/seedCaliforniaCities.js` lines 40–44):
```javascript
const MUNICIPALITIES = [
  { name: 'San Francisco', state: 'CA', entity_type: 'city', population: 827526, population_year: 2024 },
  { name: 'San Diego',     state: 'CA', entity_type: 'city', population: 1404452, population_year: 2024 },
];
// Phase 28 equivalent:
// { name: 'Oakland',   state: 'CA', entity_type: 'city', population: 444000, population_year: 2024 },
// { name: 'San Jose',  state: 'CA', entity_type: 'city', population: 997000, population_year: 2024 },
```

**Core upsertMunicipality pattern** (`scripts/seedCaliforniaCities.js` lines 47–95):
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
      .schema('treasury').from('municipalities')
      .update(m).eq('id', existing.id).select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
      .schema('treasury').from('municipalities')
      .insert(m).select());
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

**upsertDataSourceByName pattern** (`scripts/seedCaliforniaCities.js` lines 117–164 and `scripts/seedSacramentoCA.js` lines 76–113):
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
    ({ data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existingId).select());
    if (!error) console.log(`  (updated existing row ${existingId})`);
  } else {
    ({ data, error } = await supabase.schema('treasury').from('data_sources')
      .insert(src).select());
    if (!error) console.log(`  (inserted new row)`);
  }

  if (error) {
    console.error(`  ERROR writing "${src.name}": ${error.message}`);
    process.exit(1);
  }
  return data?.[0];
}
```

**data_source payload shape for PDF-loaded cities** (`scripts/processPortland.js` lines 183–218, adapted to seeder pattern from `scripts/processFremont.js` lines 152–180):
```javascript
// pdf_download data_source — the shape processOakland.js will also upsert internally,
// but the seeder must pre-create the rows so treasury_list_source_ids verification works.
{
  name:            'Oakland General Purpose Fund Operating Budget',
  api_type:        'pdf_download',
  dataset_type:    'operating',
  dataset_id:      'oakland-gpf-operating',   // planner decides exact value
  base_url:        'https://cao-94612.s3.us-west-2.amazonaws.com/documents/',
  fiscal_years:    [],                         // processor will set per-FY rows
  municipality_id: oaklandId,
}
```

**Verification pattern** (`scripts/seedCaliforniaCities.js` lines 293–322):
```javascript
console.log('Verifying via treasury_list_source_ids RPC...');
const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
if (listErr) { console.error(`  ERROR: ${listErr.message}`); process.exit(1); }

const expectedNames = [
  'Oakland General Purpose Fund Operating Budget',
  'San Jose General Fund Operating Budget',
  // ... revenue rows
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
  console.error(`\nERROR: one or more expected sources not found in treasury_list_source_ids`);
  process.exit(1);
}
```

**env loading pattern** (`scripts/seedSacramentoCA.js` lines 41–52) — Sacramento seeder added this; Phase 28 should copy it:
```javascript
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

---

### `scripts/extractOakland.py` (utility/extractor, batch PDF→JSON)

**Analog:** `scripts/extractPortland.py` (exact match — biennial per-page FY detection)

**Shebang + imports pattern** (`scripts/extractPortland.py` lines 1–19):
```python
#!/usr/bin/env python3
"""
Oakland Budget PDF Extractor

Extracts department-level operating data from Oakland biennial Adopted Policy
Budget PDFs. Single-pass: detects FY per page and emits rows for both FY N
and FY N+1. Outputs JSON to stdout.

Usage:
  python scripts/extractOakland.py "docs/Oakland/fy2023-25-adopted-budget.pdf"
"""

import sys
import json
import re
import pdfplumber
```

**parse_money pattern** (`scripts/extractPortland.py` lines 22–51) — copy verbatim:
```python
def parse_money(s):
    if s is None:
        return 0
    s = s.strip()
    if not s or s == '-':
        return 0
    # ... (handle doubled-digit PDF artifact if needed)
    neg = s.startswith('(')
    val = re.sub(r'[$()\s,]', '', s)
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0
```

**parse_fy pattern** (`scripts/extractPortland.py` lines 54–66) — copy verbatim for Oakland's "FY YYYY-YY" format:
```python
def parse_fy(token):
    """
    Oakland uses "FY 2023-24" format — same as Portland "FY YYYY-YY".
    Returns ENDING year: "FY 2023-24" → 2024.
    """
    m = re.search(r'FY\s+(\d{4})-(\d{2})', token)
    if m:
        century = int(m.group(1)) // 100 * 100   # e.g. 2000
        end_yy = int(m.group(2))                  # e.g. 24
        return century + end_yy                    # e.g. 2024
    return None
```

**detect_fiscal_year pattern** (`scripts/extractPortland.py` lines 69–80) — adapt section marker for Oakland:
```python
def detect_fiscal_year(text):
    """Detect FY from page text. Portland uses 'Appropriation Schedule'; Oakland
    uses a different section heading — adapt after inspecting the actual PDF."""
    # Primary: Oakland-specific section marker (TBD from PDF inspection)
    # m = re.search(r'<OAKLAND_SECTION_MARKER>\s*-\s*(FY\s+\d{4}-\d{2})', text)
    # if m:
    #     return parse_fy(m.group(1))
    # Fallback: any "FY YYYY-YY" on the page
    m = re.search(r'FY\s+(\d{4})-(\d{2})', text)
    if m:
        century = int(m.group(1)) // 100 * 100
        end_yy = int(m.group(2))
        return century + end_yy
    return None
```

**extract_budget core loop pattern** (`scripts/extractPortland.py` lines 103–217) — structural template:
```python
def extract_budget(pdf_path):
    results = []
    fiscal_year = None

    with pdfplumber.open(pdf_path) as pdf:
        in_budget_section = False

        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue

            # Detect budget section pages (adapt marker to Oakland's actual heading)
            if '<OAKLAND_SECTION_MARKER>' in text:
                in_budget_section = True
                fy = detect_fiscal_year(text)
                if fy:
                    fiscal_year = fy
            elif in_budget_section:
                if any(kw in text for kw in ['<SECTION_END_MARKER_1>', '<SECTION_END_MARKER_2>']):
                    in_budget_section = False
                    continue

            if not in_budget_section:
                continue

            tables = page.extract_tables()
            if not tables:
                continue

            table = tables[0]
            for row in table:
                if not row or not row[0]:
                    continue
                name = row[0].replace('\n', ' ').strip()
                if not name:
                    continue

                # Capture department/bureau subtotal rows
                if is_subtotal_row(row):
                    adopted_amount = parse_money(row[<COL_IDX>]) if row[<COL_IDX>] else 0
                    if adopted_amount == 0:
                        continue
                    results.append({
                        'department': name,
                        'fund':       'General Purpose Fund',
                        'adopted_amount': adopted_amount,
                        'fiscal_year': fiscal_year,
                        'page_num': page_num,
                    })

    # Warn on None fiscal_year rows
    none_fy = [r for r in results if r['fiscal_year'] is None]
    if none_fy:
        print(f'  WARNING: {len(none_fy)} rows have None fiscal_year', file=sys.stderr)

    return results
```

**stdout JSON output / main block** (`scripts/extractPortland.py` lines 536–552):
```python
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Oakland budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    args = parser.parse_args()

    data = extract_budget(args.pdf_path)
    print(json.dumps(data, indent=2))
```

**toFullDollars note:** If Oakland PDF uses "(in thousands)", import and apply `toFullDollars` from `processFremont.js` in the Node.js processor. The Python extractor emits raw parsed integers; conversion is done in the processor, not the extractor. Alternatively, apply a `* 1000` factor inside `parse_money` — confirm approach by checking PDF header during dry-run (Pitfall 5 from RESEARCH.md).

---

### `scripts/processOakland.js` (utility/processor, batch JSON→DB)

**Analog:** `scripts/processPortland.js` (exact match — multi-PDF loop, per-FY grouping, same RPC)

**Imports + ROOT setup pattern** (`scripts/processPortland.js` lines 25–32):
```javascript
import { execSync }        from 'node:child_process';
import { createClient }    from '@supabase/supabase-js';
import { parseArgs }       from 'node:util';
import { readdirSync, existsSync } from 'node:fs';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
```

**resolvePdfDir pattern** (`scripts/processPortland.js` lines 36–55) — copy verbatim, change 'Portland' to 'Oakland':
```javascript
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Oakland');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Oakland');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* ignore */ }

  return candidate;
}
```

**Supabase init pattern** (`scripts/processPortland.js` lines 58–61):
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**extractPDF helper** (`scripts/processPortland.js` lines 92–102) — copy, change script name:
```javascript
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractOakland.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  // Security (T-17-03): PDF path from controlled docs/Oakland/ readdir, not user input
  // Security (T-17-04): maxBuffer 8MB
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

**buildOperatingTree pattern** (`scripts/processPortland.js` lines 136–161):
```javascript
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,    // Oakland: use 'department' key (adapt from Portland's 'bureau')
      a: amount,
      i: [{ d: row.department, a: amount, aa: null, f: 'General Purpose Fund', e: null }],
    });
    total += amount;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}
```

**treasury_sync_budget_tree RPC call** (`scripts/processPortland.js` lines 235–248):
```javascript
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   datasetType,    // 'operating' or 'revenue'
  p_total:          total,
  p_tree:           tree,
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});

if (rpcErr)         { console.error('    RPC error:', rpcErr.message); return false; }
if (rpc?.error)     { console.error('    RPC error (returned):', rpc.error); return false; }
console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
```

**Multi-FY grouping from single PDF** (`scripts/processPortland.js` lines 281–299) — biennial PDFs emit rows for 2 FYs:
```javascript
// Group rows by fiscal year (biennial PDF yields FY N and FY N+1 in one pass)
const fyMap = new Map();
for (const row of rows) {
  const fy = row.fiscal_year;
  if (!fyMap.has(fy)) fyMap.set(fy, []);
  fyMap.get(fy).push(row);
}

// Fallback: if fiscal year is null, infer from filename
if (fyMap.has(null) || fyMap.has(undefined)) {
  const inferred = inferFiscalYearFromFilename(filename);
  if (inferred) {
    const nullRows = fyMap.get(null) || fyMap.get(undefined);
    fyMap.delete(null);
    fyMap.delete(undefined);
    fyMap.set(inferred, nullRows);
    console.warn(`  WARNING: Fiscal year inferred from filename: ${inferred}`);
  }
}
```

**main() CLI pattern** (`scripts/processPortland.js` lines 330–381):
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
      console.error('No PDFs found in docs/Oakland/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Oakland Budget Loader${dryRun ? ' (dry-run)' : ''}`);
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

---

### `scripts/extractSanJose.py` (utility/extractor, batch PDF→JSON)

**Analog:** `scripts/extractFremont.py` (role-match — both are CA city General Fund extractors with targeted page detection and revenue+expenditure from one PDF)

**Shebang + imports** (`scripts/extractFremont.py` lines 1–26) — copy and adapt:
```python
#!/usr/bin/env python3
"""
San Jose Budget PDF Extractor

Extracts General Fund summary data from San Jose Adopted Operating Budget PDFs
using pdfplumber. Filters enterprise funds (Airport, Wastewater, Water) at
extraction time. Outputs JSON to stdout.

Usage:
  python scripts/extractSanJose.py "docs/SanJose/fy2024-25-adopted-operating-budget.pdf"
"""

import sys
import json
import re
import pdfplumber
```

**parse_money** (`scripts/extractFremont.py` lines 28–37) — copy verbatim (simpler than Portland version, adequate for tabular data):
```python
def parse_money(s):
    s = s.strip()
    if not s or s == '-':
        return 0
    neg = s.startswith('(')
    val = re.sub(r'[$()\s,]', '', s)
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0
```

**parse_fy for San Jose's annual format** — San Jose PDFs use fiscal year labels like "FY 2024-25" (same format as Portland/Oakland). Reuse Portland's `parse_fy()` verbatim (`scripts/extractPortland.py` lines 54–66).

**General Fund page detection pattern** (adapted from `scripts/extractFremont.py` lines 63–79):
```python
# Adapt Fremont's page marker check for San Jose's exact PDF labels
GENERAL_FUND_MARKERS = {'General Fund'}
EXCLUDED_FUNDS = {
    'Airport Fund', 'San José-Santa Clara Regional Wastewater Facility Fund',
    'Water Fund', 'Environmental Services Fund',
    # Add more enterprise fund names discovered from actual PDF inspection
}

def extract_budget(pdf_path):
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue

            # Performance: San Jose PDFs are 400+ pages — skip non-General Fund pages early
            # Check first 200 chars for "General Fund" fund-level label
            # (not just the phrase "General Fund" in text — avoids cross-references)
            if 'General Fund' not in text[:200]:
                continue

            # Must have revenue and expenditure markers
            if 'Total Revenues' not in text or 'Total Expenditures' not in text:
                continue

            # Skip enterprise fund pages
            detected_fund = _detect_fund(text)
            if detected_fund in EXCLUDED_FUNDS:
                continue
            if detected_fund not in GENERAL_FUND_MARKERS:
                continue

            # ... parse table (same structure as Fremont)
```

**column header + multi-year parsing** (`scripts/extractFremont.py` lines 86–132) — copy verbatim. San Jose uses the same "Adopted / Est Actual / Proposed" column structure:
```python
# Fremont's header detection handles both old (col-types first) and new (FY tokens first) orderings.
# San Jose may differ — adapt after inspecting one actual PDF year.
KW_PATTERNS = [
    ('adopted',   r'\bAdopted\b'),
    ('revised',   r'\bRevised\b'),
    ('actual',    r'\bActual\b'),
    ('proposed',  r'\bProposed\b'),
    ('projected', r'\bProjected\b'),
]
```

**Revenue + expenditure section parsing** (`scripts/extractFremont.py` lines 161–206) — copy verbatim:
```python
# Parse revenue items between "Revenues" header and "Total Revenues" line
revenue_items = []
in_rev = False
for line in body:
    if re.match(r'^Revenues$', line, re.I):
        in_rev = True
        continue
    if re.match(r'^Total Revenues', line, re.I):
        break
    if not in_rev or not line:
        continue
    row = parse_line(line)
    if row:
        revenue_items.append(row)

# Parse expenditure items between "Expenditures" header and "Total Expenditures" line
expenditure_items = []
in_exp = False
for line in body:
    if re.match(r'^(?:Departmental )?Expenditures$', line, re.I):
        in_exp = True
        continue
    if re.match(r'^Total Expenditures', line, re.I):
        break
    if not in_exp or not line:
        continue
    row = parse_line(line)
    if row:
        expenditure_items.append(row)
```

**stdout output** (`scripts/extractFremont.py` lines 209–215):
```python
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extractSanJose.py <pdf_path>', file=sys.stderr)
        sys.exit(1)

    data = extract_budget(sys.argv[1])
    print(json.dumps(data, indent=2))
```

---

### `scripts/processSanJose.js` (utility/processor, batch JSON→DB)

**Analog:** `scripts/processFremont.js` (exact match — same operating+revenue from one PDF, same column-index logic, same toFullDollars pattern)

**Imports + ROOT** (`scripts/processFremont.js` lines 26–34) — copy verbatim, rename:
```javascript
import { execSync }        from 'node:child_process';
import { createClient }    from '@supabase/supabase-js';
import { parseArgs }       from 'node:util';
import { readdirSync }     from 'node:fs';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
```

**Supabase init** (`scripts/processFremont.js` lines 37–40):
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**extractPDF helper** (`scripts/processFremont.js` lines 49–56) — copy, change script name:
```javascript
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractSanJose.py');
  const raw = execSync(`python "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,   // Security T-17-04
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

**toFullDollars pattern** (`scripts/processFremont.js` lines 59–61) — copy if San Jose PDF uses thousands:
```javascript
// Apply only if San Jose PDF expresses values in thousands (verify during dry-run)
function toFullDollars(thousands) {
  return Math.round(thousands * 1000);
}
```

**buildOperatingTree pattern** (`scripts/processFremont.js` lines 64–82) — copy, set fund to 'General Fund':
```javascript
function buildOperatingTree(expenditureItems, approvedIdx, actualIdx) {
  const nodes = [];
  let total = 0;

  for (const item of expenditureItems) {
    const approved = toFullDollars(item.amounts[approvedIdx]);
    const actual   = actualIdx !== null ? toFullDollars(item.amounts[actualIdx]) : null;

    nodes.push({
      n: item.name,
      a: approved,
      i: [{ d: item.name, a: approved, aa: actual, f: 'General Fund', e: null }],
    });
    total += approved;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}
```

**buildRevenueTree pattern** (`scripts/processFremont.js` lines 85–115) — copy verbatim:
```javascript
function buildRevenueTree(revenueItems, approvedIdx, actualIdx) {
  const taxItems    = [];
  let   taxTotal    = 0;
  const nonTaxItems = [];
  let   nonTaxTotal = 0;

  for (const item of revenueItems) {
    const approved = toFullDollars(item.amounts[approvedIdx]);
    const actual   = actualIdx !== null ? toFullDollars(item.amounts[actualIdx]) : null;
    const lineItem = { d: item.name, a: approved, aa: actual, f: 'General Fund', e: null };

    if (TAX_ITEMS.has(item.name)) {
      taxItems.push(lineItem);
      taxTotal += approved;
    } else {
      nonTaxItems.push(lineItem);
      nonTaxTotal += approved;
    }
  }

  const tree = [];
  if (taxItems.length) tree.push({ n: 'Taxes', a: taxTotal, i: taxItems });
  if (nonTaxItems.length) tree.push({ n: 'Non-Tax Revenue', a: nonTaxTotal, i: nonTaxItems });

  return { tree, total: taxTotal + nonTaxTotal };
}
```

**Per-FY operating + revenue load loop** (`scripts/processFremont.js` lines 255–286):
```javascript
for (const [fy, { approvedIdx, actualIdx }] of fyMap) {
  if (approvedIdx === null) continue;

  // Operating
  const { tree: opTree, total: opTotal } = buildOperatingTree(expenditure_items, approvedIdx, actualIdx);
  console.log(`\n  FY${fy} Operating — $${opTotal.toLocaleString()} total`);
  if (!dryRun && muniId) {
    await loadFiscalYear(muniId, pdfAbsPath, fy, 'operating', opTree, opTotal, expenditure_items.length);
  }

  // Revenue (best-effort per D-05: if revenue_items is empty, skip gracefully)
  if (revenue_items.length > 0) {
    const { tree: revTree, total: revTotal } = buildRevenueTree(revenue_items, approvedIdx, actualIdx);
    console.log(`\n  FY${fy} Revenue — $${revTotal.toLocaleString()} total`);
    if (!dryRun && muniId) {
      await loadFiscalYear(muniId, pdfAbsPath, fy, 'revenue', revTree, revTotal, revenue_items.length);
    }
  } else {
    console.log(`  FY${fy} Revenue — no revenue items found (deferred per D-05)`);
  }
}
```

**main() CLI** (`scripts/processFremont.js` lines 290–327) — copy verbatim, change 'Fremont' → 'SanJose':
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
  const pdfDir = path.join(ROOT, 'docs', 'SanJose');
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) { console.error('No PDFs found in docs/SanJose/'); process.exit(1); }
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`San Jose Budget Loader${dryRun ? ' (dry-run)' : ''}`);
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

---

## Shared Patterns

### Supabase client initialization
**Source:** `scripts/processPortland.js` lines 58–61 and `scripts/seedCaliforniaCities.js` lines 29–37
**Apply to:** All 3 Node.js scripts (seeder, processOakland.js, processSanJose.js)
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

### .env loading
**Source:** `scripts/seedSacramentoCA.js` lines 41–52
**Apply to:** All 3 Node.js scripts
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

### execSync PDF extraction (security pattern)
**Source:** `scripts/processPortland.js` lines 94–101
**Apply to:** processOakland.js, processSanJose.js
```javascript
// Security (T-17-03): PDF path from controlled docs/<City>/ readdir, not user input
// Security (T-17-04): maxBuffer 8MB cap
const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
  maxBuffer: 8 * 1024 * 1024,
  encoding: 'utf8',
});
```

### treasury_sync_budget_tree RPC
**Source:** `scripts/processPortland.js` lines 235–248
**Apply to:** processOakland.js, processSanJose.js (both operating and revenue calls)
```javascript
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   datasetType,    // 'operating' | 'revenue'
  p_total:          total,
  p_tree:           tree,
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});
if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
```

### data_source upsert by (municipality_id, api_type, dataset_id, dataset_type)
**Source:** `scripts/processPortland.js` lines 182–219 and `scripts/processFremont.js` lines 152–180
**Apply to:** processOakland.js, processSanJose.js
```javascript
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
```

### pdfplumber parse_money (Python)
**Source:** `scripts/extractPortland.py` lines 22–51
**Apply to:** extractOakland.py, extractSanJose.py
```python
def parse_money(s):
    if s is None:
        return 0
    s = s.strip()
    if not s or s == '-':
        return 0
    neg = s.startswith('(')
    val = re.sub(r'[$()\s,]', '', s)
    try:
        return int(round(-float(val) if neg else float(val)))
    except ValueError:
        return 0
```

### None fiscal_year warning (Python)
**Source:** `scripts/extractPortland.py` lines 211–214
**Apply to:** extractOakland.py, extractSanJose.py
```python
none_fy = [r for r in results if r['fiscal_year'] is None]
if none_fy:
    print(f'  WARNING: {len(none_fy)} rows have None fiscal_year — check PDF text for FY marker',
          file=sys.stderr)
```

### Dry-run gate in processor
**Source:** `scripts/processPortland.js` lines 321–325 and `scripts/processFremont.js` lines 267–269
**Apply to:** processOakland.js, processSanJose.js
```javascript
if (dryRun) {
  console.log(`  [dry-run] fiscal_year=${fy} row_count=${rowCount} total=$${total.toLocaleString()}`);
} else if (muniId) {
  await loadFiscalYear(muniId, pdfAbsPath, fy, datasetType, tree, total, rowCount);
}
```

### Fatal error handler
**Source:** `scripts/processPortland.js` line 381 and `scripts/processFremont.js` line 327
**Apply to:** All 3 Node.js scripts
```javascript
main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

---

## Oakland-Specific Pattern Notes

**Fund label invariant (D-06):** The string `'General Purpose Fund'` must appear in:
- data_source names: `'Oakland General Purpose Fund Operating Budget'`
- tree node fund field `f`: `'General Purpose Fund'` (not `'General Fund'`)
- Any console log labels referring to Oakland's primary fund

**Biennial multi-FY grouping (D-02):** Oakland's processor must group extractor output rows by `fiscal_year` key (Map-based, same as Portland). Each biennial PDF yields rows for 2 distinct FY values. The `fyMap` loop in `processPortland.js` lines 281–299 handles this correctly — reuse verbatim.

**FY filename inference fallback:** `inferFiscalYearFromFilename()` from `scripts/processPortland.js` lines 106–113 applies if the extractor returns `fiscal_year: null`. Oakland filenames follow `fy2023-25-adopted-budget.pdf` — the function uses the `fy(\d{4})-(\d{2})` pattern and returns the ending year, which is `2025` for `fy2023-25`. This is the LATER of the two biennium years; the earlier year must come from page-level detection in the extractor.

---

## San Jose-Specific Pattern Notes

**Enterprise fund filter (D-03):** Apply in the Python extractor at page-scan time. Do not load then filter in the processor — the filter belongs at extraction time per D-03. Fund names to exclude must be confirmed from actual PDF inspection (Pitfall 4 from RESEARCH.md).

**Large PDF performance (Pitfall 3 from RESEARCH.md):** The `if 'General Fund' not in text[:200]: continue` early-exit pattern (before full page parse) is critical. San Jose PDFs are 400+ pages. Without early exit, extraction may exceed 2 minutes or run out of memory.

**Best-effort revenue (D-05):** `processSanJose.js` must check `revenue_items.length > 0` before attempting to build/load revenue tree. If 0 items, log as deferred and continue — do not fail or exit.

---

## No Analog Found

All Phase 28 files have strong analogs. No files are without a codebase match.

---

## Metadata

**Analog search scope:** `scripts/` directory (all *.js and *.py processor/extractor/seeder files)
**Files scanned:** 6 analog files fully read
**Pattern extraction date:** 2026-06-04
