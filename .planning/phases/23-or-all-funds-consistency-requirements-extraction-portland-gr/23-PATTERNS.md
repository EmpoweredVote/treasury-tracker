# Phase 23: OR All Funds Consistency — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/extractGresham.py` (add `extract_requirements()`) | utility | transform | `extract_revenue()` in `scripts/extractGresham.py` lines 170–281 | exact |
| `scripts/extractPortland.py` (add `extract_requirements()`) | utility | transform | `extract_budget()` in `scripts/extractPortland.py` lines 103–215 | role-match |
| `scripts/extractTroutdale.py` (add `extract_requirements()`) | utility | transform | `extract_revenue()` in `scripts/extractTroutdale.py` lines 205–321 | exact |
| `scripts/processGresham.js` (add `--mode requirements`) | service | batch | `processGresham.js` revenue mode, lines 229–299 | exact |
| `scripts/processPortland.js` (add `--mode requirements`) | service | batch | `processPortland.js` lines 232–294, `volSuffix` block lines 309–326 | exact |
| `scripts/processTroutdale.js` (add `--mode requirements`) | service | batch | `processTroutdale.js` revenue mode, lines 245–315 | exact |
| `src/types/budget.ts` (union extension, line 117) | model | — | `src/types/budget.ts` line 117 | exact |
| `src/App.tsx` (dataset detection + data load + prop pass) | component | request-response | `src/App.tsx` lines 146–153, 265–296, 726–733 | exact |
| `src/components/dashboard/PlainLanguageSummary.tsx` (headline + gap label) | component | request-response | `PlainLanguageSummary.tsx` lines 1–296 | exact |
| `src/data/dataLoader.ts` (verify `all_funds_requirements` routes) | utility | request-response | `dataLoader.ts` line 58 | exact — no change needed |

---

## Pattern Assignments

### `scripts/extractGresham.py` — add `extract_requirements()`

**Analog:** `extract_revenue()` in `scripts/extractGresham.py` (lines 170–281)

**Page guard pattern** (lines 191–196 of `extract_revenue()`):
```python
if 'Resources and Requirements' not in text or 'All Funds' not in text:
    continue
if 'Taxes' not in text:  # skip table-of-contents page
    continue
```
Use identical guards for `extract_requirements()` — same page, same TOC guard.

**Fiscal year parse** (lines 198–206):
```python
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
```

**Section gate — Resources version** (lines 209–231):
```python
in_resources = False
for line in lines:
    s = line.strip()
    if not s:
        continue
    s_norm = re.sub(r'\s+', '', s)
    if s_norm == 'Resources' or (
            s.startswith('Resources ') and
            not s.startswith('Resources and')):
        in_resources = True
        continue
    if s_norm == 'Requirements' or s.startswith('Requirements'):
        in_resources = False
        continue
    if not in_resources:
        continue
```
For `extract_requirements()`, flip: gate variable becomes `in_requirements`, set True on `'Requirements'` header, set False on `'Resources'` header.

**Whitelist approach for requirements** — use instead of the SKIP_ROWS blacklist to avoid capturing department rows:
```python
REQUIREMENTS_CATEGORIES = {
    'Capital Improvement', 'Debt Service', 'Transfers', 'Contingency',
    'Other Requirements', 'Unappropriated',
}
# After building category name:
if category not in REQUIREMENTS_CATEGORIES:
    continue
```

**Token split + OCR fix pattern** (lines 231–261, reuse verbatim):
```python
tokens = s.split()
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
if not name_tokens or len(num_tokens) < 6:
    continue
category = re.sub(r'\s+', ' ', ' '.join(name_tokens)).strip()
# OCR split fix (lines 257–261):
adopted_raw = num_tokens[-1]
if (len(num_tokens) >= 2
        and re.match(r'^\d{1,3}$', num_tokens[-2])
        and re.match(r'^\d{1,3},', num_tokens[-1])):
    adopted_raw = num_tokens[-2] + num_tokens[-1]
adopted = parse_money(adopted_raw)
```

**Result append + break pattern** (lines 262–273):
```python
if adopted <= 0:
    continue
results.append({
    'category':       category,
    'adopted_amount': adopted,
    'fiscal_year':    fiscal_year,
    'page_num':       page_num,
})
if results:
    break  # Found real data on this page — done
```

**`__main__` CLI block** (lines 284–293) — extend `choices` to add `'requirements'`:
```python
parser.add_argument('--mode', choices=['operating', 'revenue', 'requirements'], default='operating',
                    help='operating=Requirements depts, revenue=Resources cats, requirements=All Funds Requirements cats')
# dispatch:
if args.mode == 'revenue':
    data = extract_revenue(args.pdf_path)
elif args.mode == 'requirements':
    data = extract_requirements(args.pdf_path)
else:
    data = extract_budget(args.pdf_path)
```

---

### `scripts/extractPortland.py` — add `extract_requirements()`

**Analog:** `extract_budget()` in `scripts/extractPortland.py` (lines 103–215) for page-walk pattern; `extract_revenue()` (lines 243–315) for fiscal year from cover page.

**Page detection pattern** — unlike `extract_budget()` which uses `'Appropriation Schedule'`, `extract_requirements()` targets:
```python
is_data_page = (
    'Total City Budget' in text and
    'Resources and Requirements' in text and
    'Personnel Services' in text   # eliminates TOC false positive
)
```

**Fiscal year detection for Vol 1** — use `detect_fiscal_year(text)` (lines 67–78 of `extractPortland.py`):
```python
def detect_fiscal_year(text):
    m = re.search(r'Appropriation Schedule\s*-\s*(FY\s+\d{4}-\d{2})', text)
    if m:
        return parse_fy(m.group(1))
    m = re.search(r'FY\s+(\d{4})-(\d{2})', text)
    if m:
        century = int(m.group(1)) // 100 * 100
        end_yy = int(m.group(2))
        return century + end_yy
    return None
```

**Table extraction pattern** (Portland uses `extract_tables()`, unlike Gresham text-line parsing):
```python
tables = page.extract_tables()
if not tables:
    continue
for row in tables[0]:
    if not row or not row[0]:
        continue
    name = row[0].replace('\n', ' ').strip()
    if not name or name in PORTLAND_REQUIREMENTS_SKIP:
        continue
    if len(row) < 6 or row[5] is None:
        continue
    adopted = parse_money(row[5])   # Adopted = index [5]
```

**Multi-page continuation pattern** (FY2026 spans pages 116–117):
```python
found_data_page = False
for page_num, page in enumerate(pdf.pages, 1):
    text = page.extract_text() or ''
    is_data_page = (
        'Total City Budget' in text and
        'Resources and Requirements' in text and
        'Personnel Services' in text
    )
    is_continuation = (
        found_data_page and
        'Total City Budget' in text and
        'Resources and Requirements' in text and
        'Personnel Services' not in text
    )
    if not (is_data_page or is_continuation):
        if found_data_page:
            break  # past the table
        continue
    found_data_page = True
```

**`__main__` CLI block** (lines 318–327) — extend `choices`:
```python
parser.add_argument('--mode', choices=['operating', 'revenue', 'requirements'], default='operating')
if args.mode == 'revenue':
    data = extract_revenue(args.pdf_path)
elif args.mode == 'requirements':
    data = extract_requirements(args.pdf_path)
else:
    data = extract_budget(args.pdf_path)
```

---

### `scripts/extractTroutdale.py` — add `extract_requirements()`

**Analog:** `extract_revenue()` in `scripts/extractTroutdale.py` (lines 205–321) — exact mirror with section gate flipped from `RESOURCES` to `REQUIREMENTS`.

**Page guard** (lines 228–235):
```python
if 'ALL FUNDS COMBINED' not in text or 'FUND SUMMARY' not in text:
    continue
if 'ACCOUNT 01.00' in text:
    continue  # Guard: General Fund page — skip it
```
Reuse verbatim in `extract_requirements()`.

**Section gate — Resources version** (lines 251–263):
```python
in_resources = False
for line in lines:
    s = line.strip()
    if not s:
        continue
    if s == 'RESOURCES':
        in_resources = True
        continue
    if s == 'REQUIREMENTS':
        in_resources = False
        continue
    if not in_resources:
        continue
```
For `extract_requirements()`, flip: `in_requirements = False`, set True on `s == 'REQUIREMENTS'`, set False on `s == 'RESOURCES'`.

**Troutdale-specific token split** (lines 271–286) — includes standalone `$` token handling:
```python
name_tokens = []
num_tokens = []
in_nums = False
for t in tokens:
    clean_t = re.sub(r'[\$,]', '', t)
    if not in_nums and (re.match(r'^\d+$', clean_t) or t == '-' or t == '$'):
        in_nums = True
    if in_nums:
        num_tokens.append(t)
    else:
        name_tokens.append(t)
```

**Skip set for requirements** — use a whitelist or skip only sum rows:
```python
REQUIREMENTS_SKIP = {
    'TOTAL REQUIREMENTS',           # sum row
    'RESERVE FOR FUTURE EXPENDITURE',  # $0 row
}
# Collect: PERSONNEL SERVICES, MATERIALS & SERVICES, CAPITAL OUTLAY,
# DEBT SERVICE, TRANSFERS TO OTHER FUNDS, CONTINGENCY, UNAPPROPRIATED
```

**`__main__` CLI block** (lines 324–333) — extend `choices`:
```python
parser.add_argument('--mode', choices=['operating', 'revenue', 'requirements'], default='operating')
if args.mode == 'revenue':
    data = extract_revenue(args.pdf_path)
elif args.mode == 'requirements':
    data = extract_requirements(args.pdf_path)
else:
    data = extract_budget(args.pdf_path)
```

---

### `scripts/processGresham.js` — add `--mode requirements`

**Analog:** `processGresham.js` revenue mode (the entire file, `--revenue` flag pattern)

**CLI parse block** (lines 302–313):
```javascript
const { values: opts } = parseArgs({
  options: {
    'dry-run':      { type: 'boolean', default: false },
    revenue:        { type: 'boolean', default: false },
    pdf:            { type: 'string' },
  },
  strict: false,
});
const dryRun = opts['dry-run'];
const mode   = opts.revenue ? 'revenue' : 'operating';
```
Extend to:
```javascript
options: {
  'dry-run':      { type: 'boolean', default: false },
  revenue:        { type: 'boolean', default: false },
  requirements:   { type: 'boolean', default: false },
  pdf:            { type: 'string' },
},
// mode dispatch:
const mode = opts.requirements ? 'requirements'
           : opts.revenue      ? 'revenue'
           : 'operating';
```

**`extractPDF` function** (lines 73–86) — extend `args` push:
```javascript
function extractPDF(pdfPath, mode = 'operating') {
  const pyScript = path.join(ROOT, 'scripts', 'extractGresham.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const args = [pyScript, pdfPath];
  if (mode === 'revenue') args.push('--mode', 'revenue');
  // Add:
  if (mode === 'requirements') args.push('--mode', 'requirements');
  ...
}
```

**`processPDF` mode labels** (lines 229–246) — extend `isRevenue` pattern:
```javascript
const isRevenue      = mode === 'revenue';
const isRequirements = mode === 'requirements';
const unitLabel   = isRevenue || isRequirements ? 'categories' : 'departments';
const typeLabel   = isRevenue ? 'Revenue' : isRequirements ? 'All Funds Requirements' : 'Operating';
const datasetType = mode === 'requirements' ? 'all_funds_requirements'
                  : mode === 'revenue'      ? 'revenue'
                  : 'operating';
```

**`buildRevenueTree` — reuse for requirements** (lines 130–143): the category-node shape `{ n, a, i[] }` is identical for requirements rows. Call `buildRevenueTree(fyRows)` when `isRequirements`.

**SANITY_MAX gate** (lines 282–285) — requirements mode must be excluded just like revenue:
```javascript
// Sanity check: only applies to operating mode
if (mode === 'operating' && SANITY_MAX[fy] && total > SANITY_MAX[fy]) {
  console.error(`  SANITY FAIL FY${fy}: ...`);
  return;
}
```
No change needed — the existing guard already covers only `mode === 'operating'`.

**`upsertDataSource` label** (lines 164–174) — extend `label`:
```javascript
const label = datasetType === 'revenue'            ? 'Revenue Budget'
            : datasetType === 'all_funds_requirements' ? 'All Funds Requirements'
            : 'Operating Budget';
```

---

### `scripts/processPortland.js` — add `--mode requirements`

**Analog:** `processPortland.js` (the entire file) — `volSuffix` routing is the key difference.

**CLI parse + `volSuffix` block** (lines 297–326):
```javascript
const dryRun = opts['dry-run'];
const mode = opts.revenue ? 'revenue' : 'operating';
const volSuffix = mode === 'revenue' ? 'vol2' : 'vol1';
```
Extend to:
```javascript
const mode = opts.requirements ? 'requirements'
           : opts.revenue      ? 'revenue'
           : 'operating';
// requirements uses vol1, same as operating (D-07 verified):
const volSuffix = mode === 'revenue' ? 'vol2' : 'vol1';
```

**`extractPDF` function** (lines 80–88) — Portland uses `execSync` (not `spawnSync`); extend the `--mode` argument:
```javascript
function extractPDF(pdfPath, mode = 'operating') {
  const pyScript = path.join(ROOT, 'scripts', 'extractPortland.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}" --mode ${mode}`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}
```
No change needed — `--mode requirements` already passes through.

**`PDF_URLS` map** (lines 62–77) — add `requirements` key pointing to Vol 1 URLs (same as `operating`):
```javascript
const PDF_URLS = {
  operating: { 2026: '...vol1...', ... },
  revenue:   { 2026: '...vol2...', ... },
  requirements: { 2026: '...vol1...', ... },  // same Vol 1 URLs as operating
};
```

**`upsertDataSource` URL lookup** (lines 163–178):
```javascript
const urlMap = PDF_URLS[datasetType] ?? PDF_URLS.operating;
```
This already falls back to `PDF_URLS.operating` for unknown types — adding an explicit `requirements` key is cleaner but the fallback covers it.

**`processPDF` mode labels + `datasetType`** (lines 275–280):
```javascript
const isRevenue      = mode === 'revenue';
const isRequirements = mode === 'requirements';
const datasetType = mode === 'requirements' ? 'all_funds_requirements'
                  : mode === 'revenue'      ? 'revenue'
                  : 'operating';
```

**`buildRevenueTree` — reuse for requirements** (lines 101–114): Portland requirements categories use the same `{ n: r.fund/category, a: r.resources_total/adopted_amount, i[] }` shape. Use `buildRevenueTree` for requirements mode but note the field name: Portland `extract_requirements()` returns `adopted_amount` (like Gresham/Troutdale), not `resources_total`. Adjust tree builder accordingly or name it `buildCategoryTree`.

---

### `scripts/processTroutdale.js` — add `--mode requirements`

**Analog:** `processTroutdale.js` revenue mode (the entire file)

**CLI parse** (lines 318–330) — identical pattern to Gresham:
```javascript
const { values: opts } = parseArgs({
  options: {
    'dry-run':      { type: 'boolean', default: false },
    revenue:        { type: 'boolean', default: false },
    requirements:   { type: 'boolean', default: false },  // add
    pdf:            { type: 'string' },
  },
  strict: false,
});
const mode = opts.requirements ? 'requirements'
           : opts.revenue      ? 'revenue'
           : 'operating';
```

**`extractPDF` function** (lines 77–90) — extend `args` push:
```javascript
if (mode === 'revenue') args.push('--mode', 'revenue');
if (mode === 'requirements') args.push('--mode', 'requirements');
```

**SANITY_MAX** (lines 297–300):
```javascript
if (mode === 'operating' && SANITY_MAX[fy] && total > SANITY_MAX[fy]) { ... }
```
No change needed. Troutdale requirements total (~$81M) exceeds the $30M operating cap but the gate already excludes non-operating modes.

**`buildRevenueTree` — reuse** (lines 136–149): requirements rows have the same `{ category, adopted_amount }` shape as revenue rows. Call `buildRevenueTree(fyRows)` when `isRequirements`.

**`upsertDataSource` label** (lines 175–186):
```javascript
const label = datasetType === 'revenue'                ? 'Revenue Budget'
            : datasetType === 'all_funds_requirements' ? 'All Funds Requirements'
            : 'Operating Budget';
```

---

### `src/types/budget.ts` — union type extension (line 117)

**Analog:** `src/types/budget.ts` lines 115–118

**Current pattern** (line 117):
```typescript
available_datasets: Array<{
  fiscal_year: number;
  dataset_type: 'operating' | 'revenue' | 'salaries';
}>;
```

**Change to:**
```typescript
dataset_type: 'operating' | 'revenue' | 'salaries' | 'all_funds_requirements';
```

---

### `src/App.tsx` — dataset detection, data load, prop pass

**Analog:** `src/App.tsx` lines 146–153 (`availableDatasetTypes`), lines 265–296 (dataset detection + Promise.all), lines 726–733 (prop pass to DatasetTabs)

**Dataset detection block** (lines 267–270) — add `hasAllFundsRequirements` alongside existing flags:
```typescript
const hasOperating             = entityDatasets.some(d => d.dataset_type === 'operating');
const hasRevenue               = entityDatasets.some(d => d.dataset_type === 'revenue');
const hasSalaries              = entityDatasets.some(d => d.dataset_type === 'salaries');
// Add:
const hasAllFundsRequirements  = entityDatasets.some(d => d.dataset_type === 'all_funds_requirements');
```

**Promise.all block** (lines 272–282) — add fourth promise:
```typescript
const promises: Promise<BudgetData | null>[] = [
  hasOperating            ? loadBudgetData(yearNum, ..., 'operating')              : Promise.resolve(null),
  hasRevenue              ? loadBudgetData(yearNum, ..., 'revenue')                : Promise.resolve(null),
  hasSalaries             ? loadBudgetData(yearNum, ..., 'salaries')               : Promise.resolve(null),
  hasAllFundsRequirements ? loadBudgetData(yearNum, ..., 'all_funds_requirements') : Promise.resolve(null),
];
// destructure:
.then(([operating, revenue, salaries, allFundsReqs]) => {
  setOperatingBudgetData(operating);
  setRevenueData(revenue);
  setSalariesData(salaries);
  setAllFundsRequirementsData(allFundsReqs);  // new state
})
```

**`availableDatasetTypes` filter** (lines 146–153) — exclude `all_funds_requirements` from tab cards:
```typescript
const availableDatasetTypes = useMemo(() => {
  if (!selectedEntity) return ['operating', 'revenue', 'salaries'];
  return [...new Set(
    selectedEntity.available_datasets
      .filter(d => d.fiscal_year === parseInt(selectedYear))
      .map(d => d.dataset_type)
      .filter(t => t !== 'all_funds_requirements')  // not a selectable tab
  )];
}, [selectedEntity, selectedYear]);
```

**`operatingTotal` prop to DatasetTabs** (line 729) — prefer `all_funds_requirements` total when present:
```typescript
operatingTotal={
  allFundsRequirementsData?.metadata.totalBudget
  ?? operatingBudgetData?.metadata.totalBudget
}
```

**`PlainLanguageSummary` prop pass** — add `allFundsRequirementsData`:
```typescript
<PlainLanguageSummary
  entity={selectedEntity}
  operatingData={operatingBudgetData}
  revenueData={revenueData}
  salariesTotal={salariesData?.metadata.totalBudget}
  allFundsRequirementsData={allFundsRequirementsData}  // new
  fiscalYear={selectedYear}
  ...
/>
```

---

### `src/components/dashboard/PlainLanguageSummary.tsx` — headline + gap label

**Analog:** `PlainLanguageSummary.tsx` lines 1–296 (the full component)

**Props interface extension** (lines 4–20):
```typescript
interface PlainLanguageSummaryProps {
  entity: { ... };
  operatingData: BudgetData | null;
  revenueData: BudgetData | null;
  salariesTotal?: number | null;
  fiscalYear: string;
  isPastYear?: boolean;
  onCategoryClick?: ...;
  onYearClick?: () => void;
  allFundsRequirementsData?: BudgetData | null;  // new optional prop
}
```

**Headline total override** — replace `budgetedTotal` usage with conditional (line 38):
```typescript
// Current:
const budgetedTotal = operatingData.metadata.totalBudget;
// New:
const budgetedTotal = allFundsRequirementsData?.metadata.totalBudget
                    ?? operatingData.metadata.totalBudget;
```

**Gap-explanation label** — insert after the main budget sentence paragraph (after line ~181):
```typescript
{allFundsRequirementsData && operatingData &&
  allFundsRequirementsData.metadata.totalBudget > operatingData.metadata.totalBudget && (
  <p className="text-[13px] text-ev-gray-400 dark:text-ev-gray-500 mt-1 italic">
    This {formatAmount(allFundsRequirementsData.metadata.totalBudget)} total covers all city funds.
    The department breakdown below accounts for{' '}
    <strong className="text-ev-gray-600 dark:text-ev-gray-300">
      {formatAmount(operatingData.metadata.totalBudget)}
    </strong>{' '}
    in departmental operations; the remaining{' '}
    <strong className="text-ev-gray-600 dark:text-ev-gray-300">
      {formatAmount(
        allFundsRequirementsData.metadata.totalBudget - operatingData.metadata.totalBudget
      )}
    </strong>{' '}
    covers debt service, capital projects, and other city-wide requirements.
  </p>
)}
```
Note the guard `allFundsRequirementsData.metadata.totalBudget > operatingData.metadata.totalBudget` — prevents a negative "remainder" display if data is anomalous (anti-pattern from RESEARCH.md).

**Existing `formatAmount` helper** (lines 87–93) — reuse as-is; already handles billion-scale (Portland ~$8.6B):
```typescript
const formatAmount = (n: number) => {
  if (isNonprofit) return `$${n.toLocaleString(...)}`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)} billion`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)} million`;
  ...
};
```

---

### `src/data/dataLoader.ts` — no change required

**Analog:** `dataLoader.ts` line 58

The existing lookup:
```typescript
const budget = budgets.find((b: any) => b.dataset_type === dataset) ?? budgets[0];
```
already routes `'all_funds_requirements'` correctly. Callers pass the string; no special handling needed. Verify only — do not modify.

---

## Shared Patterns

### SANITY_MAX gate (all three loaders)
**Source:** `processGresham.js` lines 282–285, `processTroutdale.js` lines 297–300
**Apply to:** All three Node.js loaders' `requirements` mode — MUST skip the cap
```javascript
// Existing pattern — no change needed; requirements mode already excluded:
if (mode === 'operating' && SANITY_MAX[fy] && total > SANITY_MAX[fy]) {
  console.error(`  SANITY FAIL FY${fy}: total $${total.toLocaleString()} exceeds cap — aborting`);
  return;
}
```

### Idempotency / delete-before-insert (all three loaders)
**Source:** `processGresham.js` lines 203–209, `processPortland.js` lines 206–212, `processTroutdale.js` lines 219–225
**Apply to:** `loadFiscalYear()` in all three loaders — already handles `all_funds_requirements` via `ds.id` isolation
```javascript
const { error: delErr } = await supabase.schema('treasury').from('budgets')
  .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
```

### `upsertDataSource` collision prevention (all three loaders)
**Source:** `processGresham.js` lines 176–195, `processTroutdale.js` lines 187–210
**Apply to:** All three loaders; `dataset_type` filter on the select prevents overwriting operating rows
```javascript
const { data: existing } = await supabase.schema('treasury')
  .from('data_sources')
  .select('id')
  .eq('municipality_id', muniId)
  .eq('api_type', 'pdf_download')
  .eq('dataset_id', `fy${fiscalYear}`)
  .eq('dataset_type', datasetType)   // 'all_funds_requirements' isolates to its own rows
  .maybeSingle();
```

### RPC call (all three loaders)
**Source:** `processGresham.js` lines 211–225, identical in `processPortland.js` and `processTroutdale.js`
**Apply to:** `loadFiscalYear()` in all three loaders — `p_dataset_type: datasetType` already carries `'all_funds_requirements'`; no RPC change needed
```javascript
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   datasetType,    // 'all_funds_requirements'
  p_total:          total,
  p_tree:           tree,
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});
```

### worktree-safe `resolvePdfDir()` (all three loaders)
**Source:** `processGresham.js` lines 39–55, `processTroutdale.js` lines 39–55
**Apply to:** No change needed — already present in all three loaders

### Backward-compatibility guard in frontend
**Source:** `PlainLanguageSummary.tsx` lines 233–268 (`{revenueData && (...)}` pattern)
**Apply to:** All new JSX blocks — gate on `allFundsRequirementsData && ...` so TX/CA cities (which will have `null`) see no change

---

## No Analog Found

None. All eight files have direct analogs in the codebase.

---

## Metadata

**Analog search scope:** `scripts/extract*.py`, `scripts/process*.js`, `src/App.tsx`, `src/types/budget.ts`, `src/components/dashboard/PlainLanguageSummary.tsx`, `src/components/datasets/DatasetTabs.tsx`, `src/data/dataLoader.ts`
**Files read:** 10 source files
**Pattern extraction date:** 2026-06-01
