---
phase: 35-ca-state-3-level-icicle-pilot
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - scripts/extractCA.py
  - scripts/processCA.js
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two scripts were reviewed: `scripts/extractCA.py` (Python Excel extractor adding the `function` field, D-03) and `scripts/processCA.js` (Node loader replacing `buildCATree` with the recursive `buildNLevelTree`, D-02/D-04/D-05, plus SUPABASE_URL guard D-12).

The SUPABASE_URL guard (D-12) is correctly implemented — no hardcoded fallback URL present, confirmed `kxsdzaojfaibhuzmclfq` is absent. The `* 1000` scaling is preserved. Descending sort is applied at every level. The leaf line-item shape `{ d, a, aa: null, f: null, e: null }` is correct.

Three blockers were found:

1. **Index underflow crash** — `levelCols[levelIdx - 1]` is evaluated unconditionally when `levelIdx` is 0, producing `levelCols[-1]` which is `undefined` in JavaScript (not a wrap-around), making the label `'Unknown'` silently wrong — but if `row[undefined]` were ever to throw in a stricter runtime, or if the `|| 'Unknown'` fallback masks a real bug: the deeper issue is that **the D-05 collapse branch is reachable at `levelIdx === 0`** (a root-level row with no `dof_agency` value). When reached at the root, `levelCols[-1]` is `undefined`, so `row[undefined]` is `undefined`, and the label becomes `'Unknown'`. The node is silently deposited into the top-level `collapseItems` array which `recurse(rows, 0)` returns but **the root call-site discards via destructuring** — those rows are permanently dropped from the tree and from the total.

2. **Amount accounting mismatch on collapsed rows** — When a row has a null/blank key at any level and enters `collapseItems`, its dollars are **not added to `grouped.get(key).sum`** for the parent key, because `continue` is hit before any group accumulation. When that parent node is later emitted as `{ n: key, a: g.sum, ... }`, its `a` field under-counts reality by the sum of all collapsed children. The sanity band check uses `tree.reduce((sum, n) => sum + n.a, 0)` on top-level nodes — if null-`dof_agency` rows also exist, those are silently excluded from the sanity total too (compounding the root-level drop bug above).

3. **Shell injection via unvalidated `--fy` values** — `fiscalYears` values from CLI (`opts.fy.map(Number)`) are passed through template-literal interpolation directly into a shell command (`--fy ${fy}`). If a user passes `--fy "2026; rm -rf /"`, `Number("2026; rm -rf /")` produces `NaN`, and `NaN` is interpolated as the literal string `"NaN"` into the shell command. Python will reject `--fy NaN` with a parse error, so this is not directly exploitable for command injection in practice — but the values are never validated to be finite integers before shell interpolation, violating the security invariant stated in the header comment (T-33-07).

---

## Critical Issues

### CR-01: Root-level D-05 collapse rows are silently discarded

**File:** `scripts/processCA.js:174` and `scripts/processCA.js:209`

**Issue:** When a row has a null/blank `dof_agency` (the root-level column, `levelIdx === 0`), the collapse branch runs:

```javascript
const label = row[levelCols[levelIdx - 1]] || 'Unknown';  // levelCols[-1] = undefined => label = 'Unknown'
collapseItems.push({ d: label, a: amtDollars(row), aa: null, f: null, e: null });
```

These items accumulate in `collapseItems` for the root `recurse(rows, 0)` call. The caller at line 209 destructures only `{ nodes }`:

```javascript
const { nodes } = recurse(rows, 0);
return nodes;
```

`collapseItems` from the root call is silently discarded — any row with a null `dof_agency` is dropped entirely from the returned tree and excluded from every downstream total. The sanity band check will not catch this because those rows were never added to any group sum. This is a silent data-loss defect.

**Fix:** Guard the collapse path at `levelIdx === 0` — either reject rows with no root-level column (log a warning and skip), or propagate root-level collapse items into the returned tree as an explicit catch-all node. The simplest safe fix:

```javascript
for (const row of rows) {
  const key = (row[col] ?? '').toString().trim();
  if (!key) {
    if (levelIdx === 0) {
      // Root-level: no parent to collapse to — log and skip
      console.warn(`Skipping row with null ${col}: dept=${row.department}, amt=${amtDollars(row)}`);
      continue;
    }
    const label = row[levelCols[levelIdx - 1]] || 'Unknown';
    collapseItems.push({ d: label, a: amtDollars(row), aa: null, f: null, e: null });
    continue;
  }
  // ...
}
```

---

### CR-02: Collapsed-row amounts excluded from parent node's `a` field (amount undercount)

**File:** `scripts/processCA.js:169-180` and `scripts/processCA.js:192-201`

**Issue:** When a row enters the `collapseItems` path (null/blank key), `continue` is hit before `grouped.get(key).sum += amtDollars(row)`. The amounts of collapsed rows are **not accumulated into the parent group's sum**. The parent node is then emitted with `{ n: key, a: g.sum, ... }` where `g.sum` is only the sum of non-collapsed rows. The `deepCollapse` items are attached as `i: deepCollapse` on the emitted node, so the line items show correct individual amounts, but the node's `a` field understates its true total. Any upstream consumer (the icicle renderer, the DB `p_total`) will see a node amount that does not equal the sum of its children plus line items.

This bug does not affect the sanity check if all null-function rows are at the `function` level (depth 2) and the department (`g.sum`) is correct at depth 1 — but if collapsed amounts are non-trivial, the icicle tree will visually misrepresent the budget distribution.

**Fix:** Accumulate collapsed row amounts into the parent's group sum before the collapse branch emits them:

The cleanest fix is a two-pass approach: first compute the correct group sums including collapsed amounts, then separate out the items for rendering. Or, add the collapsed amount to the parent group sum after the fact:

```javascript
for (const row of rows) {
  const key = (row[col] ?? '').toString().trim();
  // Always accumulate the parent-level key's sum (for correct node amounts)
  const parentKey = levelIdx > 0 ? (row[levelCols[levelIdx - 1]] ?? '').toString().trim() : null;

  if (!key) {
    if (levelIdx === 0) { /* skip, per CR-01 fix */ continue; }
    const label = parentKey || 'Unknown';
    collapseItems.push({ d: label, a: amtDollars(row), aa: null, f: null, e: null });
    // Note: collapsed rows' amounts must be included in the parent's a field
    // This is handled by including them in the parent-level grouped.get(parentKey).sum
    // when the parent level processes its rows — they were already accumulated there.
    continue;
  }
  if (!grouped.has(key)) grouped.set(key, { sum: 0, rows: [] });
  grouped.get(key).sum += amtDollars(row);
  grouped.get(key).rows.push(row);
}
```

Actually, the cleanest fix: when building each group node at the internal level, add the `deepCollapse` items' amounts to `g.sum` when emitting:

```javascript
const collapseSum = deepCollapse.reduce((s, item) => s + item.a, 0);
const nodeTotal = g.sum + collapseSum;
if (children.length > 0 && deepCollapse.length > 0) {
  nodes.push({ n: key, a: nodeTotal, c: children, i: deepCollapse });
} else if (children.length > 0) {
  nodes.push({ n: key, a: nodeTotal, c: children });
} else {
  nodes.push({ n: key, a: nodeTotal, i: deepCollapse });
}
```

Note: `g.sum` already includes rows that recursed into children (since those rows were accumulated into `grouped.get(key).sum` in the loop). But `deepCollapse` items were **not** accumulated into `g.sum` at the parent level either — they were pulled out via `continue` before accumulation at the child level, so their dollar values are missing from `g.sum` entirely. The `collapseSum` correction above is necessary.

---

### CR-03: Unvalidated `NaN` from `--fy` parsed as string in shell command

**File:** `scripts/processCA.js:107` and `scripts/processCA.js:274`

**Issue:** `opts.fy.map(Number)` converts CLI strings to numbers. If a user passes a non-numeric FY value (e.g., `--fy abc` or `--fy ""`), `Number()` returns `NaN`. `NaN` is then interpolated into the shell command string as the literal text `"NaN"`:

```javascript
const fyArgs = fiscalYears.map(fy => `--fy ${fy}`).join(' ');
// If fiscalYears = [NaN], fyArgs = '--fy NaN'
```

The resulting command is: `python "scripts/extractCA.py" --fy NaN`. Python's `argparse` with `type=int` will reject `NaN` with a parse error, so this is not a command-injection vector. However:
- The script exits with a Python error traceback instead of a clean validation message.
- More critically, `--fy 2026` followed by `--fy 0` would pass `Number("0") = 0` into the list undetected, causing `requested_fys = [0]` in Python which filters out all real FY rows and returns empty — no error, no data loaded, silent no-op.

**Fix:** Validate each FY value after `map(Number)`:

```javascript
const fiscalYears = opts.fy
  ? opts.fy.map(s => {
      const n = Number(s);
      if (!Number.isInteger(n) || n < 1900 || n > 2100) {
        console.error(`Invalid --fy value: ${s}`);
        process.exit(1);
      }
      return n;
    })
  : [2022, 2023, 2024, 2025, 2026];
```

---

## Warnings

### WR-01: `if not row[COLS['amount']]` silently drops zero-amount rows in Python

**File:** `scripts/extractCA.py:111`

**Issue:** The guard `if not row[COLS['amount']]` is falsy for both `None` and `0`. A genuine zero-dollar General Fund line item (which can legitimately occur in budget data) would be silently dropped. The comment says "skip null-amount rows" but the code also skips zero-amount rows. While zero-dollar rows are likely not meaningful for rendering, the behavior should be explicit.

**Fix:** Test only for `None` explicitly if the intent is to skip missing values:

```python
if row[COLS['amount']] is None:
    continue
```

Or, if truly negative/zero amounts are also invalid, document that:

```python
# Skip null or non-positive amounts (zeros are non-renderable)
if not row[COLS['amount']] or row[COLS['amount']] <= 0:
    continue
```

---

### WR-02: `fy_to_int` silently returns `None` for non-string Excel cell types

**File:** `scripts/extractCA.py:114`

**Issue:** `fy_to_int(str(row[COLS['fiscal_year']] or ''))` — when `row[COLS['fiscal_year']]` is `None`, this becomes `fy_to_int('')` which returns `None`, and the row is silently skipped. However, if openpyxl returns the fiscal year as an integer or float (e.g., the Excel cell is numeric rather than text), `str(2026)` = `'2026'` which does not contain a hyphen, so `split('-')` returns `['2026']`, `len(parts) != 2` is True, and `fy_to_int` returns `None`. Any numeric-typed FY cell in the Excel file silently drops all its rows with no warning.

**Fix:** Add a warning log when `fy_to_int` returns `None` for a non-empty cell value:

```python
fy_raw = row[COLS['fiscal_year']]
fy = fy_to_int(str(fy_raw or ''))
if not fy:
    if fy_raw:
        print(f'WARNING: unrecognized fiscal_year cell value: {fy_raw!r}', file=sys.stderr)
    continue
```

---

### WR-03: `muniId` fetched but never passed to `loadFiscalYear`

**File:** `scripts/processCA.js:279-283` and `scripts/processCA.js:329`

**Issue:** `muniId` is retrieved via `ensureMunicipality()` (line 283) and stored, but is never used anywhere downstream. `loadFiscalYear(ds, fiscalYear, tree, total, fyRows.length)` (line 329) does not receive `muniId`. The RPC `treasury_sync_budget_tree` presumably locates the municipality via `ds.id` (the data source is municipality-scoped), so this may be intentional — but the fetched `muniId` is dead code. If a future RPC change requires `p_municipality_id`, the variable exists but is silently ignored, creating a false sense that municipality isolation is enforced at the call site.

**Fix:** Either pass `muniId` to `loadFiscalYear` and include it as `p_municipality_id` in the RPC params if the RPC accepts it, or remove the `let muniId = null` variable and the assignment, keeping only the existence check side-effect:

```javascript
// If municipality existence is the only requirement:
await ensureMunicipality(); // exits if not found; id not needed by RPC
```

---

## Info

### IN-01: `isLastLevel` check is never reached when `collapseItems` path triggers at the leaf level

**File:** `scripts/processCA.js:164-188`

**Issue:** When `levelIdx === levelCols.length - 1` (last level, e.g., `function`) and a row has a blank `function`, the collapse branch runs and the row goes into `collapseItems`. If _all_ rows for a given department key have blank functions, `grouped` will be empty for that key — meaning the `for (const [key, g] of grouped)` loop body never runs for this department, no `{ n, a, i: items }` leaf node is emitted, and `deepCollapse` from the returned `{ nodes: [], collapseItems: [...] }` will be caught by the `else` branch at line 200 emitting `{ n: key, a: g.sum, i: deepCollapse }`. This path is correct in logic but the `isLastLevel` code path (lines 185-188) becomes dead code for those departments. This is a minor clarity issue, not a bug.

**Fix:** No change required for correctness. Consider a clarifying comment noting that at the last level, all blank-key rows go to `collapseItems` at the parent level's `deepCollapse` path.

---

### IN-02: Stale error message references `buildCATree` instead of `buildNLevelTree`

**File:** `scripts/processCA.js:325`

**Issue:** The SCALE MISMATCH error message reads:

```
'  Likely cause: forgot to multiply LAO thousands by 1000 (check buildCATree),'
```

`buildCATree` no longer exists. This is a stale reference introduced in the PATTERNS.md template that was copied verbatim. It will confuse an operator debugging a scale failure.

**Fix:**

```javascript
console.error('  Likely cause: forgot to multiply LAO thousands by 1000 (check buildNLevelTree),');
```

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
