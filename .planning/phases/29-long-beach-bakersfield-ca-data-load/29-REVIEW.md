---
phase: 29-long-beach-bakersfield-ca-data-load
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/extractBakersfield.py
  - scripts/extractLongBeach.py
  - scripts/processBakersfield.js
  - scripts/processLongBeach.js
  - scripts/seedLongBeachBakersfieldCA.js
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five scripts were reviewed: two Python PDF extractors (Bakersfield and Long Beach) and three Node.js loaders (processBakersfield, processLongBeach, seedLongBeachBakersfieldCA). The extractors are well-structured with solid PDF-artifact handling. The loaders share a well-known pattern from prior phases. However, three blocking defects were found: a regex order bug that causes year mis-detection for Long Beach's 4-digit filenames, dead sanity-band constants whose wrong values would halt a live load if ever activated, and a revenue `fund` field hardcoded to `'General Fund'` instead of `'General Fund Revenue'` in the Long Beach loader (diverging from the Bakersfield revenue loader and likely breaking downstream category display). Four additional warnings cover a shell-injection surface on the `--pdf` CLI flag, a negative-amount false-negative in revenue extraction, a missing error branch in data_source updates, and a misleading comment left in production code.

---

## Critical Issues

### CR-01: FY detection regex fires on 4-digit filenames before the 4-digit branch (wrong year)

**File:** `scripts/extractLongBeach.py:71-77`

**Issue:** `detect_fy_from_filename` tries the two-digit pattern `r'fy(\d{2})-'` first. A four-digit filename like `fy2025-fund-summary-gp.pdf` also matches this pattern — `re.search` finds `fy20` at position 0 and returns `2000 + 20 = 2020` instead of `2025`. The four-digit branch (line 75) is never reached for such filenames. Any future file named `fy2025-…` would be silently loaded under fiscal year 2020, overwriting or corrupting existing data.

```python
# Current (buggy): two-digit branch matches fy2025 as fy20 -> 2020
m = re.search(r'fy(\d{2})-', fname)   # matches 'fy20' inside 'fy2025-...'
if m:
    return 2000 + int(m.group(1))

# Fix: check four-digit form FIRST
m4 = re.search(r'fy(\d{4})-', fname)
if m4:
    return int(m4.group(1))
m = re.search(r'fy(\d{2})-', fname)
if m:
    return 2000 + int(m.group(1))
return None
```

---

### CR-02: Dead `GF_BAND_MIN`/`GF_BAND_MAX` constants hold the wrong values; if ever activated they would block all Long Beach loads

**File:** `scripts/processLongBeach.js:77-78`

**Issue:** `GF_BAND_MIN = 1_300_000_000` and `GF_BAND_MAX = 1_700_000_000` are declared as module-level `const` values but are never referenced in the sanity-check logic (lines 269-270 correctly use `ACTUAL_BAND_MIN`/`ACTUAL_BAND_MAX`). The comment says "kept for reference," but they are live `const` declarations — not comments — and a future edit that accidentally swaps the variable names (e.g., a copy-paste from the comment) would silently enable a check that always fails for every valid Long Beach load (~$600M–$800M is well outside $1.3B–$1.7B). These should either be removed or converted to comments.

Additionally, the mismatch between the block comment ("Long Beach General Fund: ~$550M–$850M per fiscal year") and the values in `GF_BAND_MIN`/`GF_BAND_MAX` will confuse future maintainers.

```js
// Fix: remove the dead constants entirely, or convert to doc comments
// REMOVED: const GF_BAND_MIN = 1_300_000_000;
// REMOVED: const GF_BAND_MAX = 1_700_000_000;
// Original plan estimate (all-funds): ~$1.3B–$1.7B (incorrect scope)
const ACTUAL_BAND_MIN = 550_000_000;
const ACTUAL_BAND_MAX = 850_000_000;
```

---

### CR-03: `buildTree` in `processLongBeach.js` hardcodes `f: 'General Fund'` for revenue rows

**File:** `scripts/processLongBeach.js:136`

**Issue:** `buildTree` is called for both operating and revenue loads (line 256) but always sets the item fund field to `f: 'General Fund'`. Revenue rows should carry `f: 'General Fund Revenue'` — the same convention used in `processBakersfield.js` (`buildRevenueTree`, line 151) and expected by downstream display logic. When revenue data is loaded via `--revenue`, every item in the tree will be tagged as `'General Fund'` instead of `'General Fund Revenue'`, making revenue and expenditure rows indistinguishable in the database and breaking Money In / Money Out category display.

```js
// Fix: accept datasetType and set f accordingly
function buildTree(rows, datasetType) {
  const fundLabel = datasetType === 'revenue' ? 'General Fund Revenue' : 'General Fund';
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
        f: fundLabel,   // was always 'General Fund'
        e: null,
      }],
    });
    total += amount;
  }
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// Call site (line 256):
const { tree, total } = buildTree(fyRows, datasetType);
```

---

## Warnings

### WR-01: Shell injection surface on `--pdf` CLI flag in both JS loaders

**File:** `scripts/processBakersfield.js:101`, `scripts/processLongBeach.js:114`

**Issue:** When `--pdf` is supplied on the command line, the resolved path is interpolated directly into a shell command string passed to `execSync`:

```js
const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"${revenueFlag}`, { ... });
```

A path containing a double-quote character (e.g., `--pdf 'docs/Bakers"field/x.pdf'`) breaks out of the quoting and allows arbitrary shell execution. While this is a developer-only tool with controlled input, `--pdf` is documented in the usage comment as an accepted flag and its value reaches `execSync` without sanitization. The fix is to pass arguments as an array to `execChild` / `spawnSync` instead of building a shell string.

```js
// Fix: use spawnSync with argument array (no shell interpolation)
import { spawnSync } from 'node:child_process';

function extractPDF(pdfPath, revenue = false) {
  const pyScript = path.join(ROOT, 'scripts', 'extractBakersfield.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const args = [pyScript, pdfPath, ...(revenue ? ['--revenue'] : [])];
  const result = spawnSync(pythonBin, args, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return JSON.parse(result.stdout);
}
```

---

### WR-02: Revenue extraction in `extractBakersfield.py` silently drops negative revenue amounts

**File:** `scripts/extractBakersfield.py:406`

**Issue:** The revenue extraction filter at line 406 requires `amount > 100_000`. The operating extraction (line 292) correctly allows negatives with the comment "negative Non-Departmental transfers are valid." Revenue lines can also be negative (e.g., a contra-revenue or inter-fund transfer offset). The `> 100_000` filter silently discards any negative-value revenue row without logging. This is inconsistent with the operating path and may silently omit valid rows.

```python
# Fix: change to absolute-value threshold, or log when skipping negatives
if not skip and abs(amount) > 100_000 and len(category) > 2:
    results.append({ ... })
```

---

### WR-03: `upsertDataSource` errors on UPDATE are swallowed in both JS loaders

**File:** `scripts/processBakersfield.js:203-209`, `scripts/processLongBeach.js:191-197`

**Issue:** In both `upsertDataSource` functions, the `.update()` path destructures only `{ data }` and ignores `error`:

```js
const { data } = await supabase.schema('treasury').from('data_sources')
  .update(src).eq('id', existing.id).select().single();
return data;
```

If the UPDATE fails (e.g., constraint violation, network error), `data` will be `null` and `error` will be non-null — but the error is silently discarded. The caller then reads `ds?.id`, which is `undefined`, and logs `"data_source upsert failed"` with no actionable detail. The INSERT path in both scripts has the same issue. Compare to `seedLongBeachBakersfieldCA.js` where errors are surfaced and `process.exit(1)` is called.

```js
// Fix: capture and surface the error
const { data, error } = await supabase.schema('treasury').from('data_sources')
  .update(src).eq('id', existing.id).select().single();
if (error) { console.error('    data_source update failed:', error.message); return null; }
return data;
```

---

### WR-04: `extract_from_page` uses `page.page_number` (1-based pdfplumber attribute) inconsistently with `page_idx + 1` in `extract_budget` (Bakersfield)

**File:** `scripts/extractLongBeach.py:200`

**Issue:** In `extractLongBeach.py`, `page_num = page.page_number` is assigned at line 200. The `pdfplumber` `page_number` attribute is 1-based, which is correct. In `extractBakersfield.py`, `page_num = page_idx + 1` is used (also correct). This is not a bug in isolation, but if `pdfplumber` ever provides a 0-based index (version-dependent behavior), Long Beach pages would be off-by-one in the `page_num` field stored in DB rows. The safer pattern is `page.page_number` consistently in both files, or to document the assumption. The inconsistency increases maintenance risk.

---

## Info

### IN-01: Duplicate `path` import in both JS loaders

**File:** `scripts/processBakersfield.js:39-41`, `scripts/processLongBeach.js:44-46`

**Issue:** Both files import `path` twice — once as the default import and once via named destructuring from `node:path`:

```js
import path                      from 'node:path';
import { fileURLToPath }         from 'node:url';
import { resolve, dirname }      from 'node:path';
```

`resolve` and `dirname` are already available as `path.resolve` and `path.dirname` via the default import. The named import from `node:path` is redundant.

---

### IN-02: `parse_last_column` function in `extractLongBeach.py` is defined but never called

**File:** `scripts/extractLongBeach.py:82-148`

**Issue:** `parse_last_column` (lines 82–148) is defined but `extract_from_page` calls only `_extract_label_and_last_value` (line 259). `parse_last_column` is dead code — it was superseded by the improved `_extract_label_and_last_value` implementation. Dead code of this size (67 lines) imposes ongoing maintenance cost and can confuse future contributors about which parsing path is canonical.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
