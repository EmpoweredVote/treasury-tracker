# Phase 31: Anaheim + Santa Ana CA Data Load - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 5 new files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/seedAnaheimSantaAnaCA.js` | service / seeder | CRUD | `scripts/seedFresnoRiversideCA.js` | exact |
| `scripts/extractAnaheim.py` | utility / extractor | file-I/O | `scripts/extractFresno.py` | exact |
| `scripts/processAnaheim.js` | service / processor | batch | `scripts/processFresno.js` | exact |
| `scripts/extractSantaAna.py` | utility / extractor | file-I/O | `scripts/extractFresno.py` | exact |
| `scripts/processSantaAna.js` | service / processor | batch | `scripts/processRiverside.js` | exact |

---

## Pattern Assignments

### `scripts/seedAnaheimSantaAnaCA.js` (service, CRUD)

**Analog:** `scripts/seedFresnoRiversideCA.js`

**Imports pattern** (lines 29–34):
```javascript
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
```

**loadEnv pattern** (lines 38–53): reads `../.env.local` then `../.env`; skips ENOENT silently; warns on unexpected errors; does NOT log key values. Copy verbatim.
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

**Municipality payloads** (lines 72–89): Two-city array. For Phase 31, both `county_id` stay NULL (Orange County not loaded — deferred). Population from Census sub-est2024_06.csv:
```javascript
const MUNICIPALITIES = [
  {
    name:            'Anaheim',
    state:           'CA',
    entity_type:     'city',
    population:      344000,  // Census 2024 annual estimate ~344,521; confirm from sub-est2024_06.csv
    population_year: 2024,
    // county_id stays NULL — Orange County not loaded (deferred)
  },
  {
    name:            'Santa Ana',
    state:           'CA',
    entity_type:     'city',
    population:      312000,  // Census 2024 annual estimate ~312,534; confirm from sub-est2024_06.csv
    population_year: 2024,
    // county_id stays NULL — Orange County not loaded (deferred)
  },
];
```

**Data source rows** — four rows required, names are the contract that processors look up (lines 206–239). Adapt city names and dataset_id prefixes:
```javascript
const dataSources = [
  {
    name:            'Anaheim General Fund Operating Budget',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'anaheim-gf-operating',
    base_url:        'https://www.anaheim.net/271/Operating-Budget-CIP',
    municipality_id: anaheimId,
  },
  {
    name:            'Anaheim General Fund Revenue Budget',
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'anaheim-gf-revenue',
    base_url:        'https://www.anaheim.net/271/Operating-Budget-CIP',
    municipality_id: anaheimId,
  },
  {
    name:            'Santa Ana General Fund Operating Budget',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'santa-ana-gf-operating',
    base_url:        'https://www.santa-ana.org/budget/',
    municipality_id: santaAnaId,
  },
  {
    name:            'Santa Ana General Fund Revenue Budget',
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'santa-ana-gf-revenue',
    base_url:        'https://www.santa-ana.org/budget/',
    municipality_id: santaAnaId,
  },
];
```

**upsertMunicipality pattern** (lines 92–140): SELECT by name+state → INSERT or UPDATE in-place (preserves `id`/`created_at`). Copy verbatim; function is generic. Exits with `process.exit(1)` on any DB error.

**upsertDataSourceByName pattern** (lines 143–185): SELECT by `name` → INSERT or UPDATE in-place. Copy verbatim; function is generic.

**Verification pattern** (lines 252–283): calls `treasury_list_source_ids` RPC and asserts all four expected name strings appear. Exits non-zero if any are missing. Update `expectedNames` array for Phase 31 names.

**main() shape** (lines 188–286): Upsert city A → get ID; upsert city B → get ID; build dataSources array with both IDs; loop upsert; verify. Copy structure verbatim; update log strings and variable names (`fresnoId` → `anaheimId`, `riversideId` → `santaAnaId`).

---

### `scripts/extractAnaheim.py` (utility, file-I/O)

**Analog:** `scripts/extractFresno.py`

**Anaheim is a single-year PDF** — same pattern as Fresno (not biennial like Riverside). One PDF per fiscal year. FY derived from filename.

**Imports pattern** (lines 37–40):
```python
import sys
import json
import re
import pdfplumber
```

**parse_money helper** (lines 44–62): handles `$3,418,795`, `(1,234)`, `4 2,374,186` (space-in-number PDF artifact). Copy verbatim — same artifact handling needed for CA city PDFs.
```python
def parse_money(s):
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

**detect_fy_from_filename pattern** (lines 65–82): four-digit year preferred, two-digit fallback. Adapt Fresno filename regex pattern for Anaheim's naming convention once PDF filenames are confirmed. The core logic is identical:
```python
def detect_fy_from_filename(pdf_path):
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    m4 = re.search(r'fy(\d{4})-', fname)
    if m4:
        return int(m4.group(1))
    m = re.search(r'fy(\d{2})-', fname)
    if m:
        return 2000 + int(m.group(1))
    return None
```

**Extraction-time fund filter pattern** (lines 189–256): The critical D-06 invariant. Only rows within the "General Fund Departments" (or equivalent) section are emitted. Every non-GF section boundary is logged to stderr. Adapt section-entry and section-exit trigger strings to match Anaheim PDF structure (must be confirmed by inspecting the downloaded PDF):
```python
# Detect section entry
if stripped == 'General Fund Departments':   # adjust to actual Anaheim PDF label
    in_gf_section = True
    continue

# Stop at non-GF section boundary
if in_gf_section and any(stripped.startswith(s) for s in [
    'Special Revenue Fund',
    'Enterprise Fund',
    'Internal Service Fund',
    # ... add Anaheim-specific enterprise section headers
]):
    print(f'  [skip] Non-GF section boundary reached: {stripped[:60]}', file=sys.stderr)
    break
```

**Row output shape** (lines 248–255): every emitted row must have this exact shape:
```python
results.append({
    'department':     label,
    'fund':           'General Fund',
    'adopted_amount': amount,
    'fiscal_year':    fiscal_year,
    'page_num':       page_num,
})
```

**deduplication pattern** (lines 299–308): deduplicate by `(department, fiscal_year)` before returning. Copy verbatim.

**argparse/main pattern** (lines 311–329): single positional `pdf_path` arg; `--mode` arg with `operating`/`revenue` choices; revenue mode exits early with empty JSON if revenue is deferred for this city.

**stderr logging convention:** all diagnostic output goes to `sys.stderr`; only the JSON array goes to stdout. This is mandatory — the Node.js processor captures stdout as JSON.

---

### `scripts/processAnaheim.js` (service, batch)

**Analog:** `scripts/processFresno.js`

**Anaheim is a single-year PDF** — follow `processFresno.js` exactly. `processRiverside.js` handles biennial PDFs and is NOT the right analog for Anaheim.

**Imports and module setup** (lines 46–55): identical boilerplate for all processors:
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

**loadEnv pattern** (lines 58–73): identical to seeder; copy verbatim.

**GF sanity band constants** (lines 81–91): update for Anaheim. Per RESEARCH.md:
```javascript
// Anaheim General Fund: ~$360M–$530M across FY2020–FY2026
// Band is wider to accommodate older years and gross dept totals
const GF_BAND_MIN = 350_000_000;  // $350M floor
const GF_BAND_MAX = 550_000_000;  // $550M ceiling (FY2025-26 ~$527M)
```

**resolvePdfDir pattern** (lines 97–111): worktree-safe fallback via `git rev-parse --git-common-dir`. Update city name string from `'Fresno'` to `'Anaheim'`:
```javascript
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Anaheim');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Anaheim');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}
```

**extractPDF pattern** (lines 116–125): runs Python extractor via execSync with 8MB maxBuffer cap and double-quoted paths. Update script name from `extractFresno.py` to `extractAnaheim.py`. Note from RESEARCH.md: Santa Ana PDFs are ~19–20MB — for processSantaAna.js consider raising maxBuffer to `16 * 1024 * 1024`.
```javascript
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractAnaheim.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const modeArg = mode === 'revenue' ? ' --mode revenue' : '';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"${modeArg}`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

**buildTree pattern** (lines 129–153): generic; copy verbatim. Produces `{ tree, total }` where each node is `{ n, a, i[] }`.

**ensureMunicipality pattern** (lines 156–171): SELECT by name+state, exit(2) if missing. Update name strings from `'Fresno'` to `'Anaheim'` and seeder reference:
```javascript
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Anaheim')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Anaheim, CA municipality not found — run seedAnaheimSantaAnaCA.js first');
  process.exit(2);
}
```

**upsertDataSource pattern** (lines 174–204): per-FY data_source row with `dataset_id = 'anaheim-fy${fiscalYear}-${datasetType}'`. Update city prefix from `'fresno'` to `'anaheim'` in name, dataset_id, and base_url.

**loadFiscalYear pattern** (lines 207–227): calls `treasury_sync_budget_tree` RPC with all seven parameters. Copy verbatim.

**sanity band check in processPDF** (lines 275–281): halt with `process.exit(3)` before any DB write if total outside band. Pattern:
```javascript
if (total < GF_BAND_MIN || total > GF_BAND_MAX) {
  console.error(`\n  SCALE MISMATCH WARNING: FY${fy} ${mode} total $${total.toLocaleString()} is outside`);
  console.error(`  expected band $${GF_BAND_MIN.toLocaleString()}-$${GF_BAND_MAX.toLocaleString()}.`);
  console.error('  Possible causes: amounts in wrong units (thousands?), enterprise fund bleed, wrong section parsed.');
  console.error('  HALTING before live load to prevent incorrect data insertion.');
  process.exit(3);
}
```

**main() parseArgs** (lines 292–300): three options: `--dry-run` (boolean), `--pdf` (string), `--revenue` (boolean). Copy verbatim.

**PDF discovery loop** (lines 313–327): `readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'))`, sorted alphabetically. No biennial skipping needed (Anaheim PDFs are single-year).

---

### `scripts/extractSantaAna.py` (utility, file-I/O)

**Analog:** `scripts/extractFresno.py`

**Santa Ana is a single-year PDF** — same structural pattern as Fresno/Anaheim. One PDF per fiscal year. FY derived from filename (Santa Ana filenames are inconsistent — see Pitfall 3 in RESEARCH.md; the extractor must handle varied naming schemes).

All patterns are identical to `extractAnaheim.py` above with these differences:

**detect_fy_from_filename**: Santa Ana PDF filenames do NOT follow a consistent `fy2025-*` pattern (e.g., `FY25-26-Budget-Book-Draft_V26_Compressed.pdf`, `07-30-Budget-Book-Draft_V6_Hyperlinked_Compressed.pdf`). The FY detector must handle multiple patterns or fall back to scanning PDF header text:
```python
def detect_fy_from_filename(pdf_path):
    fname = pdf_path.replace('\\', '/').split('/')[-1].lower()
    # Pattern: "fy25-26" or "fy2025-26"
    m4 = re.search(r'fy(\d{4})-(\d{2,4})', fname)
    if m4:
        return int(m4.group(1)) + 1   # FY2024-25 -> 2025 (ending year)
    m2 = re.search(r'fy(\d{2})-(\d{2})', fname)
    if m2:
        return 2000 + int(m2.group(1)) + 1
    # Fallback: look for year pattern in path components
    m_year = re.search(r'/(20\d{2})/', fname.replace('\\', '/'))
    if m_year:
        return int(m_year.group(1)) + 1  # folder year is FY start; ending year is +1
    return None
```

**Enterprise fund filter**: Santa Ana enterprise funds are Water, Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, Federal Clean Water Protection. The section-boundary strings must be adapted from the actual PDF layout — verify on download.

**Row output shape**: identical to extractAnaheim.py (same schema, `fund='General Fund'`).

**stderr/stdout discipline**: identical. Only JSON array to stdout.

---

### `scripts/processSantaAna.js` (service, batch)

**Analog:** `scripts/processRiverside.js`

**Santa Ana is a single-year PDF** but `processRiverside.js` is listed as the closest analog because it is the most recently written processor at time of Phase 31. Functionally, `processFresno.js` is equally applicable. Use either; the patterns are identical except for city name strings and sanity bands.

**Critical difference from processRiverside.js:** Santa Ana PDFs are single-year (not biennial). The biennial FY-detection code from `extractRiverside.py` / `processRiverside.js` does NOT apply. Follow the `processFresno.js` single-FY-per-PDF approach instead.

**GF sanity band constants**: update for Santa Ana per RESEARCH.md:
```javascript
// Santa Ana General Fund: ~$404M–$424M across FY2022–FY2026
// Band wider to allow for older years and gross dept totals
const GF_BAND_MIN = 350_000_000;  // $350M floor
const GF_BAND_MAX = 450_000_000;  // $450M ceiling (FY2025-26 ~$424M)
```

**resolvePdfDir**: change city string to `'Santa Ana'` (with space — must match directory name exactly):
```javascript
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Santa Ana');
  if (existsSync(candidate)) return candidate;
  // ... git worktree fallback same pattern ...
  return candidate;
}
```

**extractPDF**: update script name to `extractSantaAna.py`. Santa Ana PDFs are ~19–20MB; raise maxBuffer to 16MB:
```javascript
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractSantaAna.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const modeArg = mode === 'revenue' ? ' --mode revenue' : '';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"${modeArg}`, {
    maxBuffer: 16 * 1024 * 1024,   // raised from 8MB: Santa Ana PDFs ~19-20MB
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```

**ensureMunicipality**: change name to `'Santa Ana'`, seeder reference to `seedAnaheimSantaAnaCA.js`.

**upsertDataSource**: change city prefix from `'riverside'` to `'santa-ana'` in `dataset_id` and label strings.

All other patterns (`loadEnv`, `buildTree`, `loadFiscalYear`, `processPDF`, sanity band halt, `main()` structure) copy verbatim from `processFresno.js` / `processRiverside.js` with only city-name string substitutions.

---

## Shared Patterns

### loadEnv (env file loading)
**Source:** `scripts/seedFresnoRiversideCA.js` lines 38–53 / `scripts/processFresno.js` lines 58–73
**Apply to:** All four JS files (`seedAnaheimSantaAnaCA.js`, `processAnaheim.js`, `processSantaAna.js`)
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

### Supabase client initialization
**Source:** `scripts/processFresno.js` lines 76–79
**Apply to:** All three JS scripts
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

### treasury_sync_budget_tree RPC call
**Source:** `scripts/processFresno.js` lines 212–226
**Apply to:** `processAnaheim.js` and `processSantaAna.js` (inside `loadFiscalYear`)
```javascript
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
```

### parse_money (Python)
**Source:** `scripts/extractFresno.py` lines 44–62 / `scripts/extractRiverside.py` lines 35–49
**Apply to:** `extractAnaheim.py` and `extractSantaAna.py`

The Fresno variant (with space-in-number normalization via `re.sub(r'[$()\s,]', '', s)`) is the correct one for CA PDFs that have the leading-digit rendering artifact. Copy from extractFresno.py verbatim.

### Extraction-time fund filter (D-06 invariant)
**Source:** `scripts/extractFresno.py` lines 195–209
**Apply to:** `extractAnaheim.py` and `extractSantaAna.py`

Enterprise rows must NEVER be emitted. The Python extractor is the sole filter gate. Log every skipped section boundary to stderr. The exact section header strings differ per city — must be confirmed by inspecting the downloaded PDFs before finalizing.

### resolvePdfDir worktree-safe helper
**Source:** `scripts/processFresno.js` lines 97–111 / `scripts/processRiverside.js` lines 85–99
**Apply to:** `processAnaheim.js` and `processSantaAna.js`

Copy the full `try/catch` git-common-dir fallback verbatim; change only the city-name string argument (`'Anaheim'` or `'Santa Ana'`).

### Sanity band halt pattern (exit code 3)
**Source:** `scripts/processFresno.js` lines 275–281
**Apply to:** `processAnaheim.js` and `processSantaAna.js`

Always halts with `process.exit(3)` (not 1 or 2) before any DB write if total is outside the band. Exit code 3 signals a data quality failure specifically (distinct from missing env = 2, no files = 1). Copy the four `console.error` lines verbatim; update band constant names.

### stderr/stdout discipline (Python extractors)
**Source:** `scripts/extractFresno.py` (pattern throughout)
**Apply to:** `extractAnaheim.py` and `extractSantaAna.py`

All diagnostic output (`[skip]`, `[dedup]`, `WARNING:`, `[row]`, `[dept]`) goes to `sys.stderr`. Only the final `print(json.dumps(data, indent=2))` goes to stdout. The Node.js processor uses `execSync` and captures stdout — any stray print to stdout will break JSON parsing.

---

## No Analog Found

All five files have close Phase 30 analogs. No files in this phase lack a pattern reference.

---

## Metadata

**Analog search scope:** `scripts/` directory — all five Phase 30 analogs read in full
**Files scanned:** 5
**Pattern extraction date:** 2026-06-05

**Key implementation notes:**
- `extractAnaheim.py` and `extractSantaAna.py` follow the Fresno single-year pattern (not the Riverside biennial pattern)
- `processSantaAna.js` should use `maxBuffer: 16 * 1024 * 1024` (16MB) instead of 8MB due to ~19–20MB Santa Ana PDFs
- The exact General Fund section header strings in both PDFs are UNKNOWN until the PDFs are downloaded; the fund filter logic in both Python extractors must be adapted after PDF inspection
- Both `county_id` fields stay NULL — Orange County has not been loaded; do NOT insert an Orange County municipality row
- Data source name strings defined in the seeder must match character-for-character with what the processor looks up
