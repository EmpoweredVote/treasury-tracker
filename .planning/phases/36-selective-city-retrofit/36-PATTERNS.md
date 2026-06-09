# Phase 36: Selective City Retrofit - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 5 (3 modified scripts + 1 new planning doc + 1 DB migration)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/extractPortland.py` | utility (extractor) | transform (PDF → JSON) | `scripts/extractPortland.py` itself (lines 105-217) | self — add new function + populate existing `service_area` field |
| `scripts/processPortland.js` | utility (loader) | batch / transform | `scripts/processCA.js` `buildNLevelTree()` (lines 159-220) | exact role+data-flow — Portland 3-level builder follows same recursive pattern |
| `scripts/bulkLoadBudget.js` | utility (loader) | batch / transform | `scripts/bulkLoadBudget.js` `buildBudgetTree()` itself (lines 67-127) | self — add `department_column` 3-level path to existing 2-level function |
| `.planning/AUDIT-FRAMEWORK.md` | documentation | N/A | `scripts/enrichCategories.js` (format reference only) | no code analog — content driven by RESEARCH.md §Audit Framework |
| DB migration: `add_audit_verdict_to_data_sources` | migration | CRUD | `supabase/migrations/20260602031258_add_all_funds_requirements_dataset_type.sql` | role-match — ALTER TABLE with safe DROP/ADD pattern |

---

## Pattern Assignments

### `scripts/extractPortland.py` — Add `extract_service_area_map()` + populate `service_area` field

**Analog:** `scripts/extractPortland.py` (self — in-place modification)

**Existing `service_area` placeholder** (lines 203-208):
```python
results.append({
    'bureau': bureau_name,
    'service_area': '',   # service area grouping not in this table
    'adopted_amount': adopted_amount,
    'fiscal_year': fiscal_year,
    'page_num': page_num,
})
```

**New function to add** — insert before `extract_budget()` (around line 103). Mirrors the `pdfplumber` table-extraction idiom already used throughout this file (pages, extract_tables, row iteration with None-guard):
```python
def extract_service_area_map(pdf):
    """
    Returns dict: { bureau_name: service_area_name }
    Reads the 'Managing Agency | Fund | Service Area | Fund Type' table
    from pages 12-13 (0-indexed: 11-12) of Portland Vol 1 PDF.
    Uses keyword search for 'Managing Agency'+'Service Area' to locate
    the table rather than hardcoding page index (pitfall 1 guard).
    """
    service_map = {}
    current_bureau = None
    # Search pages 9-20 (0-indexed) for the mapping table (pitfall 1: page may shift)
    for page_idx in range(9, 20):
        if page_idx >= len(pdf.pages):
            break
        page = pdf.pages[page_idx]
        text = page.extract_text() or ''
        if 'Managing Agency' not in text or 'Service Area' not in text:
            continue
        tables = page.extract_tables()
        if not tables:
            continue
        for row in tables[0]:
            if not row or len(row) < 3:
                continue
            agency = (row[0] or '').strip()
            service_area = (row[2] or '').strip()
            if service_area in ('Service Area', 'SERVICE AREA', ''):
                if agency:
                    current_bureau = agency
                continue
            if agency and service_area:
                current_bureau = agency
                service_map[agency] = service_area
            elif not agency and current_bureau and service_area:
                # Continuation row: same bureau, different fund — preserve existing SA
                if current_bureau not in service_map:
                    service_map[current_bureau] = service_area
    return service_map
```

**Modified `extract_budget()` signature and service_area population** — change lines 105-116 to accept an optional map:
```python
def extract_budget(pdf_path, service_area_map=None):
    """
    ...existing docstring...
    service_area_map: optional dict { bureau_name: service_area } built from pages 12-13.
    If None or bureau not found, service_area defaults to '' (D-06: null collapse at loader).
    """
    results = []
    fiscal_year = None

    with pdfplumber.open(pdf_path) as pdf:
        # Build service area map from this PDF if not supplied
        if service_area_map is None:
            service_area_map = extract_service_area_map(pdf)
            print(f'  Service area map: {len(service_area_map)} bureaus', file=sys.stderr)
        # ... rest of existing logic unchanged ...
```

**Updated `service_area` assignment** — change line 205 from `'service_area': ''` to:
```python
'service_area': service_area_map.get(bureau_name, ''),
```

**Warning guard** — add after the results loop (near line 211), following the existing `none_fy` warning pattern:
```python
unmapped = [r for r in results if not r['service_area']]
if unmapped:
    print(f'  WARNING: {len(unmapped)} bureaus have no service_area mapping: '
          f'{[r["bureau"] for r in unmapped]}', file=sys.stderr)
```

**Imports/top-of-file:** No new imports needed — `pdfplumber`, `sys`, `re`, `json` already imported (lines 19-21).

---

### `scripts/processPortland.js` — Replace `buildOperatingTree()` with 3-level service-area builder

**Analog:** `scripts/processCA.js` `buildNLevelTree()` (lines 159-220) — reference implementation for recursive N-level tree.

**Current `buildOperatingTree()` pattern** (lines 138-161) — flat 1-level, replace entirely:
```javascript
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.bureau,
      a: amount,
      i: [{ d: row.bureau, a: amount, aa: null, f: null, e: null }],
    });
    total += amount;
  }
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}
```

**Target pattern** — 3-level: service_area (depth-0) → bureau (depth-1) → line item (depth-2).
Follows the `buildNLevelTree()` Map-accumulate → sort → emit pattern from processCA.js:
```javascript
// Replace buildOperatingTree entirely with this implementation
function buildOperatingTree(rows) {
  // Group by service_area → bureau
  const saMap = new Map(); // service_area → Map(bureau → { sum, items[] })

  for (const row of rows) {
    const sa = row.service_area || '';   // '' means no service area mapping
    const bureau = row.bureau;
    const amount = row.adopted_amount;

    if (!sa) {
      // D-06: bureau with no service area — log and collapse to flat depth-0 leaf
      // This matches processCA.js CR-01 pattern (log + skip at root level).
      console.warn(`  [D-06] Bureau with no service_area: "${bureau}" ($${amount.toLocaleString()}) — emitted as standalone depth-0 leaf`);
    }

    const saKey = sa || `__no_sa__${bureau}`;  // unique key prevents merging unmapped bureaus
    if (!saMap.has(saKey)) saMap.set(saKey, { displayName: sa || bureau, bureaus: new Map() });
    const saEntry = saMap.get(saKey);
    if (!saEntry.bureaus.has(bureau)) saEntry.bureaus.set(bureau, 0);
    saEntry.bureaus.set(bureau, saEntry.bureaus.get(bureau) + amount);
  }

  const nodes = [];
  let total = 0;

  for (const [saKey, saEntry] of saMap) {
    const isUnmapped = saKey.startsWith('__no_sa__');
    let saTotal = 0;
    const bureauNodes = [];

    for (const [bureau, amt] of saEntry.bureaus) {
      bureauNodes.push({
        n: bureau,
        a: amt,
        i: [{ d: bureau, a: amt, aa: null, f: null, e: null }],
      });
      saTotal += amt;
    }
    bureauNodes.sort((a, b) => b.a - a.a);

    if (isUnmapped) {
      // D-06: standalone depth-0 leaf (single bureau, no SA grouping)
      nodes.push({ n: saEntry.displayName, a: saTotal, i: bureauNodes[0]?.i || [] });
    } else {
      // Normal: SA node with bureau children
      nodes.push({ n: saEntry.displayName, a: saTotal, c: bureauNodes });
    }
    total += saTotal;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}
```

**SUPABASE_URL fix** — line 58 currently has hardcoded fallback (WR-04 pattern not applied here):
```javascript
// CURRENT (line 58) — HAS hardcoded fallback — MUST FIX:
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';

// TARGET — copy from processCA.js lines 61-62:
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(2); }
```

**RPC call pattern** (lines 235-244) — already correct; no change needed:
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
```

**Dry-run output** (lines 315-319) — update to show service area count:
```javascript
// After building tree, before the if (dryRun) check — add:
const saCount = tree.filter(n => n.c).length;   // nodes with children = service area nodes
const bureauCount = tree.reduce((s, n) => s + (n.c ? n.c.length : 1), 0);
console.log(`\n  FY${fy} ${typeLabel} — $${total.toLocaleString()} total (${saCount} service areas, ${bureauCount} bureaus)`);
```

---

### `scripts/bulkLoadBudget.js` — Add `department_column` support to `buildBudgetTree()`

**Analog:** `scripts/bulkLoadBudget.js` `buildBudgetTree()` (lines 67-127) — self, in-place extension.

**Current function signature + column setup** (lines 67-78):
```javascript
function buildBudgetTree(rows, cm) {
  const catCol = cm.category_column;
  const subCol = cm.subcategory_column;
  const approvedCol = cm.approved_amount_column;
  const actualCol = cm.actual_amount_column || null;
  const fundCol = cm.fund_column || null;

  if (!catCol || !approvedCol) {
    throw new Error('column_mapping must define category_column and approved_amount_column');
  }
```

**Target pattern** — add `deptCol` extraction (one line after line 71), strictly gated:
```javascript
function buildBudgetTree(rows, cm) {
  const deptCol = cm.department_column || null;  // NEW: optional depth-0 grouping above category
  const catCol = cm.category_column;
  const subCol = cm.subcategory_column;
  const approvedCol = cm.approved_amount_column;
  const actualCol = cm.actual_amount_column || null;
  const fundCol = cm.fund_column || null;

  if (!catCol || !approvedCol) {
    throw new Error('column_mapping must define category_column and approved_amount_column');
  }
```

**Current tree accumulation loop** (lines 83-109) — add 3-level path gated by `deptCol`:
```javascript
  // Replace the existing loop body for rows. When deptCol is set, build:
  //   dept → cat → sub (3-level)
  // When deptCol is absent, the existing cat → sub path is UNCHANGED.
  for (const row of rows) {
    const approved = parseAmount(row[approvedCol]);
    const actual = actualCol ? parseAmount(row[actualCol]) : null;

    if (approved === 0 && (actual === null || actual === 0)) {
      droppedZero++;
      continue;
    }

    if (deptCol) {
      // ── 3-level path (NEW) ──────────────────────────────────────────
      const dept = row[deptCol] || 'Unknown';
      const cat  = row[catCol]  || 'Unknown';
      const sub  = subCol ? (row[subCol] || 'General') : 'General';

      if (!tree.has(dept)) tree.set(dept, new Map());
      if (!tree.get(dept).has(cat)) tree.get(dept).set(cat, new Map());
      if (!tree.get(dept).get(cat).has(sub)) tree.get(dept).get(cat).set(sub, []);

      tree.get(dept).get(cat).get(sub).push({
        d: sub,
        a: approved,
        aa: actual,
        f: fundCol ? (row[fundCol] || null) : null,
        e: null,
      });
    } else {
      // ── 2-level path (UNCHANGED) ────────────────────────────────────
      const cat = row[catCol] || 'Unknown';
      const sub = subCol ? (row[subCol] || 'General') : 'General';

      if (!tree.has(cat)) tree.set(cat, new Map());
      if (!tree.get(cat).has(sub)) tree.get(cat).set(sub, []);

      tree.get(cat).get(sub).push({
        d: sub,
        a: approved,
        aa: actual,
        f: fundCol ? (row[fundCol] || null) : null,
        e: null,
      });
    }

    total += approved;
    kept++;
  }
```

**Current tree-to-JSON conversion** (lines 111-126) — add 3-level conversion after the existing 2-level block:
```javascript
  // Convert Maps to compact JSON tree
  if (deptCol) {
    // ── 3-level conversion (NEW) ────────────────────────────────────────
    const jsonTree = [];
    for (const [deptName, cats] of tree) {
      let deptTotal = 0;
      const catNodes = [];
      for (const [catName, subs] of cats) {
        let catTotal = 0;
        const subNodes = [];
        for (const [subName, items] of subs) {
          const subTotal = items.reduce((s, i) => s + i.a, 0);
          catTotal += subTotal;
          subNodes.push({ n: subName, a: subTotal, i: items });
        }
        subNodes.sort((a, b) => b.a - a.a);
        catTotal += 0;  // already accumulated
        catNodes.push({ n: catName, a: catTotal, c: subNodes });
        deptTotal += catTotal;
      }
      catNodes.sort((a, b) => b.a - a.a);
      jsonTree.push({ n: deptName, a: deptTotal, c: catNodes });
    }
    jsonTree.sort((a, b) => b.a - a.a);
    return { jsonTree, total, kept, droppedZero };
  }

  // ── 2-level conversion (UNCHANGED from original) ──────────────────────
  const jsonTree = [];
  for (const [catName, subs] of tree) {
    let catTotal = 0;
    const children = [];
    for (const [subName, items] of subs) {
      const subTotal = items.reduce((s, i) => s + i.a, 0);
      catTotal += subTotal;
      children.push({ n: subName, a: subTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: catName, a: catTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);

  return { jsonTree, total, kept, droppedZero };
```

**SUPABASE_URL fix** — line 28 has same hardcoded fallback as processPortland.js:
```javascript
// CURRENT (line 28) — HAS hardcoded fallback — MUST FIX:
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';

// TARGET — same guard pattern as processCA.js:
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL env var'); process.exit(1); }
```

**Dry-run output update** (lines 180-185) — extend to show dept count when 3-level:
```javascript
  if (opts.dryRun) {
    console.log('  (dry run — skipping RPC call)');
    for (const c of jsonTree.slice(0, 3)) {
      const childCount = c.c ? c.c.length : 0;
      const label = deptCol ? 'services' : 'subcategories';
      console.log(`    ${c.n}: $${Math.round(c.a).toLocaleString()} (${childCount} ${label})`);
    }
    return { rows_fetched: allRows.length, rows_inserted: 0, status: 'dry_run' };
  }
```

---

### DB migration: `add_audit_verdict_to_data_sources`

**Analog:** `supabase/migrations/20260602031258_add_all_funds_requirements_dataset_type.sql` (lines 1-13) and `supabase/migrations/20260606000000_add_state_entity_type.sql`

**Pattern — safe ALTER TABLE with idempotent guard:**
```sql
-- Analog: 20260602031258 uses DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT pattern
-- This phase follows the same pattern for adding a JSONB column.

-- Add audit_verdict JSONB column to treasury.data_sources
-- Stores per-city audit results: { recommended_depth, evidence, last_audited, auditor, status }
-- NULL until audited; consistent with existing column_mapping JSONB pattern on same table.
ALTER TABLE treasury.data_sources
  ADD COLUMN IF NOT EXISTS audit_verdict JSONB DEFAULT NULL;

COMMENT ON COLUMN treasury.data_sources.audit_verdict IS
  'Per-city audit verdict: { recommended_depth: N, evidence: string, '
  'last_audited: ISO8601, auditor: string, status: retrofit_recommended|depth_confirmed_current|audit_deferred }';
```

**Migration filename pattern:** `YYYYMMDDHHMMSS_add_audit_verdict_to_data_sources.sql`
Use `mcp__supabase-local__apply_migration` to apply; verify with `execute_sql` query on `information_schema.columns`.

---

### `.planning/AUDIT-FRAMEWORK.md` — New documentation file

**Analog:** No code analog. Content is fully specified in `36-RESEARCH.md` §Audit Framework (lines 539-570). The file is a human-readable guide; no code pattern applies.

**Location:** `C:\treasury-tracker\.planning\AUDIT-FRAMEWORK.md`

**Content source:** Copy the framework verbatim from `36-RESEARCH.md` §Audit Framework (lines 539-570), plus add:
- Preamble linking it to D-02/D-04 decisions
- A "Phase 36 Verdicts" section recording the 3 pilot city outcomes
- Pointers to DB (`data_sources.audit_verdict`) as the machine-readable source of truth

---

## Shared Patterns

### Supabase Client Setup (No-Fallback URL Guard)
**Source:** `scripts/processCA.js` lines 61-65
**Apply to:** `scripts/processPortland.js` (line 58) AND `scripts/bulkLoadBudget.js` (line 28) — both still have the hardcoded fallback that must be removed as WR-04 fix
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(2); }
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

### treasury_sync_budget_tree RPC Call
**Source:** `scripts/processCA.js` lines 256-269 AND `scripts/processPortland.js` lines 235-244
**Apply to:** Both Portland and Dallas loaders — this is the only DB write path for tree data
```javascript
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   'operating',   // or ds.dataset_type
  p_total:          total,
  p_tree:           tree,
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});
if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
```

### N-Level Tree Node Shape
**Source:** `scripts/processCA.js` `buildNLevelTree()` lines 159-220
**Apply to:** All new tree-building code in Portland and Dallas loaders
- Branch node (has children): `{ n: string, a: number, c: [...] }` — `c` is children array
- Leaf node (has items): `{ n: string, a: number, i: [...] }` — `i` is line items array
- Mixed node (D-05 partial coverage): `{ n: string, a: number, c: [...], i: [...] }` — both `c` and `i`
- Line item shape: `{ d: string, a: number, aa: number|null, f: string|null, e: null }`
- Sort order: nodes sorted by `a` descending at every level

### D-06 Null Collapse (Partial Coverage Rows)
**Source:** `scripts/processCA.js` `buildNLevelTree()` lines 168-181
**Apply to:** Portland service-area mapper (bureaus with blank SA) AND Dallas `NONE`-service rows
```javascript
// From processCA.js — rows where the current level's column is null/empty
// collapse as line items at the parent node, NOT as new "Unknown" nodes
if (!key) {
  if (levelIdx === 0) {
    console.warn(`Skipping row with null ${col}: ...`);
    continue;
  }
  // D-05: collapse to line item at parent level
  const label = row[levelCols[levelIdx - 1]] || 'Unknown';
  collapseItems.push({ d: label, a: amtDollars(row), aa: null, f: null, e: null });
  continue;
}
```

### Enrichment name_key Format
**Source:** `scripts/enrichCategories.js` `saveEnrichment()` lines 381-395
**Apply to:** Any enrichment run after Portland/Dallas reload — do NOT change this format
```javascript
const nameKey = cat.parent_name
  ? `${normalize(cat.parent_name)}|${normalize(cat.name)}`  // subcategory: "parent|child"
  : normalize(cat.name);                                      // root: "name"
```
After Portland retrofit: bureau nodes will have `parent_name = service_area_name`, so their keys change from `normalize(bureau)` to `normalize(service_area)|normalize(bureau)`. Old keys remain in DB as orphans (D-11).

### pdfplumber Table Extraction
**Source:** `scripts/extractPortland.py` `extract_budget()` lines 116-210
**Apply to:** New `extract_service_area_map()` function — same open/iterate/extract_tables pattern
```python
with pdfplumber.open(pdf_path) as pdf:
    for page_num, page in enumerate(pdf.pages, 1):
        text = page.extract_text()
        if not text:
            continue
        # keyword guard before table extraction (avoids scanning irrelevant pages)
        if 'KeywordA' not in text or 'KeywordB' not in text:
            continue
        tables = page.extract_tables()
        if not tables:
            continue
        for row in tables[0]:
            if not row or not row[0]:
                continue
            # ... process row ...
```

### DB Migration — Safe ALTER TABLE
**Source:** `supabase/migrations/20260606000000_add_state_entity_type.sql` lines 1-14
**Apply to:** `audit_verdict` JSONB column migration
```sql
-- Pattern: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT (or ADD COLUMN IF NOT EXISTS)
ALTER TABLE treasury.data_sources
  ADD COLUMN IF NOT EXISTS audit_verdict JSONB DEFAULT NULL;
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `scripts/` (all .py and .js files), `supabase/migrations/` (all .sql files)
**Files scanned:** 5 source files read in full; 2 migration files read in full
**Key insight from analog search:** The Phase 35 `buildNLevelTree()` in `processCA.js` is the canonical reference for recursive N-level tree building. Portland's `buildOperatingTree()` should mirror its Map-accumulate → recurse → sort-descending pattern. The `enrichCategories.js` `saveEnrichment()` name_key format is the contract that must not change.
**Pattern extraction date:** 2026-06-09
