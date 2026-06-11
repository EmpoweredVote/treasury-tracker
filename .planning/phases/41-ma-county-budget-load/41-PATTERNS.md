# Phase 41: MA County Budget Load — Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 2 (new files to create)
**Analogs found:** 2 / 2

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/extractMACounties.py` | utility (PDF extractor) | batch / transform | `scripts/extractGresham.py` | exact |
| `scripts/loadMACountyBudget.js` | utility (DB loader) | CRUD / batch | `scripts/processGresham.js` | exact |

---

## Pattern Assignments

### `scripts/extractMACounties.py` (utility, batch / transform)

**Analog:** `scripts/extractGresham.py`

**Imports pattern** (lines 1–18):
```python
#!/usr/bin/env python3
"""
MA County Budget PDF Extractor

Supports per-county extraction modes: barnstable, bristol, dukes, norfolk, plymouth.
Each county has a different PDF format — use --county flag to select.

Usage:
  python scripts/extractMACounties.py docs/MA-Counties/plymouth-fy25.pdf --county plymouth
  python scripts/extractMACounties.py docs/MA-Counties/norfolk-fy26.pdf --county norfolk
"""

import sys
import json
import re
import pdfplumber
```

**CLI entrypoint pattern** (lines 399–417 of extractGresham.py):
```python
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='MA County budget PDF extractor')
    parser.add_argument('pdf_path', help='Path to PDF file')
    parser.add_argument('--county',
                        choices=['barnstable', 'bristol', 'dukes', 'norfolk', 'plymouth'],
                        required=True,
                        help='Which county extraction mode to use')
    args = argparse.ArgumentParser()
    # dispatch: call extract_<county>(args.pdf_path)
    data = DISPATCH[args.county](args.pdf_path)
    print(json.dumps(data, indent=2))
```

**parse_money helper** (lines 34–45 of extractGresham.py — copy verbatim):
```python
def parse_money(s):
    """Handle OCR artifacts: '3 5,569,000' -> 35569000, '4 ,197,000' -> 4197000.
    Strips all whitespace, $, parens, commas — handles OCR spaces inside numbers.
    """
    if not s or not s.strip() or s.strip() == '-':
        return 0
    cleaned = re.sub(r'[\$\(\)\s,]', '', s.strip())
    neg = s.strip().startswith('(')
    try:
        return int(round(float(cleaned) * (-1 if neg else 1)))
    except ValueError:
        return 0
```

**Output row schema** (all extractors must emit this exact shape — matches processGresham.js expectations):
```python
# Each extraction function must return a list of dicts:
{
    'department': str,    # department/category name
    'amount':     float,  # full dollars (no thousands multiplier)
    'fiscal_year': int,   # e.g. 2025 for FY25
}
# DO NOT use 'adopted_amount' — the loader reads 'amount'
# (processGresham.js uses 'adopted_amount' internally but that is Gresham-specific)
```

**Per-county extraction function — Plymouth (cleanest, pdfplumber table)** (from RESEARCH.md Pattern 4 + 6):
```python
def extract_plymouth(pdf_path, fiscal_year=2025):
    """Page 3 (index 2) has the multi-year summary table."""
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[2]
        text = page.extract_text() or ''
        fy_str = str(fiscal_year)[2:]  # '25' from 2025
        for line in text.split('\n'):
            # Pattern: "01 Account Name  $ 43,175.00  ...  $ 11,868.xx"
            # FY25 Approved = last dollar-amount column
            m = re.match(
                r'^\d{2}\s+(.+?)\s+(?:\$\s*[\d,]+\.?\d*\s+){4}\$\s*([\d,]+\.?\d*)',
                line
            )
            if m:
                name = m.group(1).strip()
                if 'Total All' in name:
                    continue
                amount = float(m.group(2).replace(',', ''))
                if amount > 0:
                    rows.append({'department': name, 'amount': amount,
                                 'fiscal_year': fiscal_year})
    return rows
```

**Per-county extraction function — Norfolk (text-line, "Totals X" regex)** (from RESEARCH.md Pattern 5):
```python
def extract_norfolk(pdf_path, fiscal_year=2026):
    """Pages 5-12 (index 4-11). FY26 REQUEST is column index 4 (0=desc, 1=FY23, 2=FY24, 3=FY25, 4=FY26req)."""
    rows = []
    fy_col_index = {'2026': 4, '2025': 3, '2024': 2, '2023': 1}
    col_idx = fy_col_index.get(str(fiscal_year), 4)
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[4:12]:
            text = page.extract_text() or ''
            for line in text.split('\n'):
                m = re.match(
                    r'^Totals?\s+(.+?)\s+([0-9,.\-]+(?:\s+[0-9,.\-]+){3,5})\s*$',
                    line.strip()
                )
                if m:
                    amounts = re.findall(r'[\d,]+\.?\d{0,2}', m.group(2))
                    if col_idx < len(amounts):
                        amount = float(amounts[col_idx].replace(',', ''))
                        rows.append({'department': m.group(1).strip(),
                                     'amount': amount, 'fiscal_year': fiscal_year})
    return rows
```

**Per-county extraction function — Dukes (audit p66, pdfplumber text-line)** (from RESEARCH.md Pattern 6):
```python
def extract_dukes(pdf_path, fiscal_year=2024):
    """FY2024 audit: page 66 (index 65) = county ops, page 67 (index 66) = registry.
    Columns: Original Budget | Final Budget | Actual | Variance to Final.
    Use column 3 (Actual Budgetary Amounts) as the expenditure figure."""
    rows = []
    page_map = {2024: [65, 66]}
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx in page_map.get(fiscal_year, [65]):
            page = pdf.pages[page_idx]
            text = page.extract_text() or ''
            for line in text.split('\n'):
                m = re.match(
                    r'^([A-Za-z][A-Za-z/\s,()]+?)\s+([\d,]+\.?\d{0,2})\s+([\d,]+\.?\d{0,2})\s+([\d,]+\.?\d{0,2})',
                    line.strip()
                )
                if m and 'TOTAL' not in m.group(1).upper():
                    dept = m.group(1).strip()
                    actual = float(m.group(4).replace(',', ''))
                    if actual > 0:
                        rows.append({'department': dept, 'amount': actual,
                                     'fiscal_year': fiscal_year})
    return rows
```

**Per-county extraction function — Barnstable (category fallback from p29)** (from RESEARCH.md Pattern 7):
```python
def extract_barnstable(pdf_path, fiscal_year=2025):
    """Fallback: load 4 high-level categories from p29 (confirmed from pdftotext).
    Pages 17-18 are infographic charts — no text extractable from them.
    If discovery task finds per-dept data, upgrade this function."""
    HARDCODED = {
        2025: [
            {'department': 'Salaries',           'amount': 10658349},
            {'department': 'Operating Expenses',  'amount': 7548763},
            {'department': 'Fringe Benefits',     'amount': 6487989},
            {'department': 'Capital',             'amount': 58000},
        ]
    }
    return [dict(r, fiscal_year=fiscal_year) for r in HARDCODED.get(fiscal_year, [])]
```

**Error handling pattern** (lines 93–94 of extractGresham.py — emit to stderr, return empty list):
```python
# Warnings go to stderr (loader reads stdout as JSON)
print(f'  WARNING: Could not parse fiscal year on page {page_num}', file=sys.stderr)
# On total extraction failure, return [] — loader will warn and skip
return rows
```

---

### `scripts/loadMACountyBudget.js` (utility, CRUD / batch)

**Analog:** `scripts/processGresham.js`

**Imports pattern** (lines 28–36 of processGresham.js — copy verbatim, adjust description):
```javascript
import { spawnSync }        from 'node:child_process';
import { createClient }     from '@supabase/supabase-js';
import { parseArgs }        from 'node:util';
import { existsSync }       from 'node:fs';
import path                 from 'node:path';
import { fileURLToPath }    from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
```

**loadEnv pattern** (lines 14–25 of seedMACountyLinks.js — this is the CORRECT MA-phase loadEnv that strips inline comments):
```javascript
// Load .env / .env.local before reading process.env
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');   // strip inline comments
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore missing files */ }
  }
}
loadEnv();
```
Note: `seedMACountyLinks.js` version (lines 33–46) is preferred over `loadMAPopulation.js` version — it strips inline comments (`rawVal.replace(/\s+#.*$/, '')`).

**Supabase client init pattern** (lines 61–64 of processGresham.js):
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

**COUNTY_CONFIG map and --county parseArgs pattern** (from RESEARCH.md Code Examples):
```javascript
const { values: args } = parseArgs({
  options: {
    county:    { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
  strict: false,
});

const COUNTY_CONFIG = {
  barnstable: { name: 'Barnstable County', pdf: 'barnstable-fy25.pdf', fy: 2025, sanityMax: 30_000_000 },
  bristol:    { name: 'Bristol County',    pdf: 'bristol-fy25.pdf',    fy: 2025, sanityMax: 20_000_000 },
  dukes:      { name: 'Dukes County',      pdf: 'dukes-fy24-audit.pdf',fy: 2024, sanityMax:  5_000_000 },
  norfolk:    { name: 'Norfolk County',    pdf: 'norfolk-fy26.pdf',    fy: 2026, sanityMax: 50_000_000 },
  plymouth:   { name: 'Plymouth County',  pdf: 'plymouth-fy25.pdf',   fy: 2025, sanityMax: 20_000_000 },
};
```

**Python extractor invocation pattern** (lines 76–90 of processGresham.js):
```javascript
function extractPDF(pdfPath, countyKey) {
  const pyScript = path.join(ROOT, 'scripts', 'extractMACounties.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const result = spawnSync(pythonBin, [pyScript, pdfPath, '--county', countyKey], {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`extractMACounties.py failed (exit ${result.status}): ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}
```

**ensureMunicipality pattern** (lines 150–165 of processGresham.js — adapted for county lookup):
```javascript
async function ensureMunicipality(countyName) {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', countyName)
    .eq('state', 'MA')
    .eq('entity_type', 'county')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error(`  ${countyName} not found — run seedMACountyLinks.js first`);
  process.exit(2);
}
```

**buildBudgetTree pattern** (lines 108–131 of processGresham.js — adapted for `amount` field):
```javascript
function buildBudgetTree(rows) {
  const nodes = rows
    .filter(r => r.amount > 0)
    .map(r => ({
      n: r.department,
      a: r.amount,
      i: [{ d: r.department, a: r.amount, aa: null, f: null, e: null }],
    }));
  nodes.sort((a, b) => b.a - a.a);
  const total = nodes.reduce((s, n) => s + n.a, 0);
  return { tree: nodes, total };
}
```
Note: processGresham.js uses `row.adopted_amount` — the MA county extractor emits `row.amount`. Adjust the field name here.

**upsertDataSource pattern** (lines 168–201 of processGresham.js — copy with county name substitution):
```javascript
async function upsertDataSource(muniId, countyName, fiscalYear, pdfUrl) {
  const src = {
    name:            `${countyName} Operating Budget FY${fiscalYear}`,
    api_type:        'pdf_download',      // NOT 'ma-dls' — county PDFs are not DLS data
    dataset_type:    'operating',
    dataset_id:      `fy${fiscalYear}`,
    base_url:        pdfUrl ?? '',
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
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) console.error('  data_source update error:', error.message);
    return data;
  }
  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) console.error('  data_source insert error:', error.message);
  return data;
}
```

**loadFiscalYear / treasury_sync_budget_tree RPC call pattern** (lines 204–232 of processGresham.js):
```javascript
async function loadFiscalYear(muniId, countyName, fiscalYear, pdfUrl, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, countyName, fiscalYear, pdfUrl);
  if (!ds?.id) { console.error('    data_source upsert failed'); return false; }
  console.log(`    data_source: ${ds.id}`);

  // Idempotency: clear existing rows before re-inserting
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  if (delErr) { console.error('    Pre-load delete failed:', delErr.message); return false; }

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'operating',
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
  return true;
}
```

**main() pattern with --county dispatch and sanity check** (from RESEARCH.md Code Examples skeleton):
```javascript
async function main() {
  const countyKey = args.county?.toLowerCase();
  if (!countyKey || !COUNTY_CONFIG[countyKey]) {
    console.error('Usage: node loadMACountyBudget.js --county <barnstable|bristol|dukes|norfolk|plymouth>');
    process.exit(1);
  }

  const config  = COUNTY_CONFIG[countyKey];
  const pdfPath = path.join(ROOT, 'docs', 'MA-Counties', config.pdf);

  if (!existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  const dryRun = args['dry-run'] ?? false;
  const muniId = dryRun ? null : await ensureMunicipality(config.name);

  let rows;
  try {
    rows = extractPDF(pdfPath, countyKey);
  } catch (e) {
    console.error('Extract failed:', e.message.slice(0, 200));
    process.exit(1);
  }

  if (!rows.length) {
    console.warn('No rows extracted — check extractor');
    process.exit(1);
  }

  const { tree, total } = buildBudgetTree(rows);

  // Sanity check — warn in dry-run, abort in live
  if (total > config.sanityMax) {
    console.error(`SANITY FAIL: $${total.toLocaleString()} exceeds cap $${config.sanityMax.toLocaleString()}`);
    if (!dryRun) process.exit(1);
  }

  console.log(`\n${config.name} FY${config.fy} — $${total.toLocaleString()} total (${rows.length} depts)`);
  for (const n of tree.slice(0, 8)) console.log(`  ${n.n}: $${n.a.toLocaleString()}`);
  if (tree.length > 8) console.log(`  … +${tree.length - 8} more`);

  if (dryRun) {
    console.log(`[dry-run] No DB writes`);
  } else {
    await loadFiscalYear(muniId, config.name, config.fy, config.pdfUrl ?? '', tree, total, tree.length);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
```

---

## Shared Patterns

### loadEnv (inline comment stripping)
**Source:** `scripts/seedMACountyLinks.js` lines 33–46
**Apply to:** `scripts/loadMACountyBudget.js`

Use the `seedMACountyLinks.js` version of `loadEnv`, NOT the `loadMAPopulation.js` version. The difference: `rawVal.replace(/\s+#.*$/, '')` strips inline comments like `KEY=value # comment`. This was a Phase 40 fix (WR-03).

```javascript
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore missing files */ }
  }
}
```

### spawnSync Python extractor invocation
**Source:** `scripts/processGresham.js` lines 76–90
**Apply to:** `scripts/loadMACountyBudget.js`

Always use `spawnSync` with an args array (not `execSync` with a shell string) to prevent shell injection. Use `process.platform === 'win32' ? 'python' : 'python3'` for cross-platform compatibility.

```javascript
const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(pythonBin, [pyScript, pdfPath, '--county', countyKey], {
  maxBuffer: 8 * 1024 * 1024,
  encoding: 'utf8',
});
```

### parse_money helper (Python)
**Source:** `scripts/extractGresham.py` lines 34–45
**Apply to:** `scripts/extractMACounties.py`

Copy verbatim — handles OCR whitespace artifacts inside numbers (e.g., `'3 5,569,000'`), negative values in parens, and gracefully returns 0 for empty/dash strings.

### treasury_sync_budget_tree RPC parameter names
**Source:** `scripts/processGresham.js` lines 217–226
**Apply to:** `scripts/loadMACountyBudget.js`

Parameter names are exact — do not rename:
- `p_data_source_id`, `p_fiscal_year`, `p_dataset_type`, `p_total`, `p_tree`, `p_row_count`, `p_triggered_by`

`p_triggered_by` must be `'bulk_load'` for script-driven loads.

### stderr for warnings, stdout for JSON (Python)
**Source:** `scripts/extractGresham.py` throughout
**Apply to:** `scripts/extractMACounties.py`

All warning/diagnostic output goes to `sys.stderr`. The loader reads `result.stdout` as JSON. Mixing print statements into stdout will break JSON.parse in the loader.

---

## No Analog Found

No files in Phase 41 lack analogs. Both new files have exact-match analogs in the codebase.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

---

## Key Anti-Pattern Notes (from RESEARCH.md)

These are copy-errors that the planner must guard against in plan actions:

1. **`api_type: 'ma-dls'` instead of `'pdf_download'`** — County PDFs are not DLS data. All 5 county loaders must use `api_type: 'pdf_download'`.

2. **Hardcoded municipality UUIDs** — Always look up by `name + state='MA' + entity_type='county'` at runtime. UUIDs confirmed in RESEARCH.md are reference-only.

3. **`row.adopted_amount` in buildBudgetTree** — processGresham.js uses `adopted_amount`; the MA county extractor emits `amount`. The loader's `buildBudgetTree` must read `r.amount`.

4. **Norfolk: use REQUEST column (index 4), not COMMISSION APPROVED (index 5–6)** — Cols 5-6 are blank in the approved PDF.

5. **Barnstable pages 17–18 are infographic charts** — Skip them. Use page 29 category totals as fallback.

6. **Bristol PDF download** — Cannot be fetched via HTTP due to apostrophe in filename. Discovery task must confirm manual download before extraction can proceed. Check `existsSync(pdfPath)` before calling extractor.

---

## Metadata

**Analog search scope:** `scripts/process*.js`, `scripts/extract*.py`, `scripts/loadMA*.js`, `scripts/seedMACountyLinks.js`
**Files scanned:** 4 analog files read in full (processGresham.js, extractGresham.py, seedMACountyLinks.js, loadMAPopulation.js partial)
**Pattern extraction date:** 2026-06-11
