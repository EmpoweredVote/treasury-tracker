---
phase: 35-ca-state-3-level-icicle-pilot
fixed_at: 2026-06-08T00:00:00Z
review_path: .planning/phases/35-ca-state-3-level-icicle-pilot/35-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 35: Code Review Fix Report

**Fixed at:** 2026-06-08
**Source review:** .planning/phases/35-ca-state-3-level-icicle-pilot/35-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (3 Critical, 3 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Root-level D-05 collapse rows are silently discarded

**Files modified:** `scripts/processCA.js`
**Commit:** 2f8e7f9
**Applied fix:** Added `if (levelIdx === 0)` guard inside the `!key` branch of the row loop in `buildNLevelTree`. When a row has a null/blank `dof_agency` (root-level column), it now logs a warning via `console.warn` and skips with `continue`, preventing the `levelCols[-1] = undefined` dereference and the silent data loss that occurred when root-call `collapseItems` were discarded by the `const { nodes } = recurse(rows, 0)` destructuring.

---

### CR-02: Collapsed-row amounts excluded from parent node's `a` field (amount undercount)

**Files modified:** `scripts/processCA.js`
**Commit:** 2f8e7f9
**Applied fix:** Added `collapseSum` and `nodeTotal` computation after the recursive call in the internal-level branch of `buildNLevelTree`. `deepCollapse` items were never accumulated into `g.sum` (the `continue` in the collapse path skipped the `grouped.get(key).sum +=` line), so their amounts were missing from parent node totals. The fix computes `collapseSum = deepCollapse.reduce((s, item) => s + item.a, 0)` and uses `nodeTotal = g.sum + collapseSum` for all emitted nodes, making `node.a` match the true sum of children plus line items.
**Note:** Fix requires human verification — the logic change affects computed node totals and should be validated against known FY totals.

---

### CR-03: Unvalidated `NaN` from `--fy` parsed as string in shell command

**Files modified:** `scripts/processCA.js`
**Commit:** 2f8e7f9
**Applied fix:** Replaced `opts.fy.map(Number)` with an explicit mapping that calls `Number(s)`, checks `Number.isInteger(n) && n >= 1900 && n <= 2100`, and calls `process.exit(1)` with a clear error message if the value is invalid (NaN, non-integer, or out of a plausible fiscal-year range). This prevents `--fy abc` from producing `NaN` or `--fy 0` from silently filtering out all rows.

---

### WR-01: `if not row[COLS['amount']]` silently drops zero-amount rows in Python

**Files modified:** `scripts/extractCA.py`
**Commit:** 2a5e05b
**Applied fix:** Changed `if not row[COLS['amount']]:` to `if row[COLS['amount']] is None:` so that the guard only skips genuinely missing values. Zero-dollar rows (which are falsy but may be legitimate General Fund line items) are no longer silently dropped by this guard.

---

### WR-02: `fy_to_int` silently returns `None` for non-string Excel cell types

**Files modified:** `scripts/extractCA.py`
**Commit:** 2a5e05b
**Applied fix:** Introduced `fy_raw = row[COLS['fiscal_year']]` before the `fy_to_int` call, then added `if fy_raw: print(f'WARNING: unrecognized fiscal_year cell value: {fy_raw!r}', file=sys.stderr)` in the `if not fy:` branch. This surfaces numeric-typed Excel cells (e.g., integer `2026` instead of string `'2025-26'`) that would otherwise cause all rows for that fiscal year to be silently skipped.

---

### WR-03: `muniId` fetched but never passed to `loadFiscalYear`

**Files modified:** `scripts/processCA.js`
**Commit:** 2f8e7f9
**Applied fix:** Removed `let muniId = null` and the `muniId = await ensureMunicipality()` assignment. Changed the call to `await ensureMunicipality()` (discarding the return value) with a clarifying comment that the function is called only for its exit-on-failure side effect. The RPC `treasury_sync_budget_tree` locates the municipality via `ds.id` (data-source-scoped), so `muniId` was dead code.

---

_Fixed: 2026-06-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
