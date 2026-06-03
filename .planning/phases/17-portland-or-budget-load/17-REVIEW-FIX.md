---
phase: 17-portland-or-budget-load
fixed_at: 2026-05-31T00:00:00Z
review_path: .planning/phases/17-portland-or-budget-load/17-REVIEW.md
iteration: 2
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-05-31
**Source review:** .planning/phases/17-portland-or-budget-load/17-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 11 (3 Critical + 5 Warning + 3 Info; fix_scope=all)
- Fixed: 11
- Skipped: 0

## Fixed Issues

### CR-01: Hardcoded Windows path for Census CSV cache breaks CI and Linux

**Files modified:** `scripts/loadORPopulation.js`
**Commit:** 46bc188
**Applied fix:** Added `import { tmpdir } from 'node:os'` and `import path from 'node:path'`. Replaced `CSV_PATH = 'C:/tmp/sub-est2024_41.csv'` with `CSV_PATH = path.join(tmpdir(), 'sub-est2024_41.csv')`. Returns `C:\Users\...\AppData\Local\Temp\sub-est2024_41.csv` on Windows and `/tmp/sub-est2024_41.csv` on Linux/macOS.

---

### CR-02: `dataset_id` collision between seeder's base row and loader's per-FY rows

**Files modified:** `scripts/seedPortlandOregon.js`
**Commit:** 1d8e62f
**Applied fix:** Removed the `PORTLAND_OPERATING()` factory function, the `upsertDataSourceByName()` helper, and the entire Step 2 data_source upsert block. Updated file header comment to document that data_source rows are owned by `processPortland.js`. Step 3 verification (formerly Step 2) now checks for FY-specific names `'Portland Operating Budget FY2025'` and `'Portland Operating Budget FY2026'` rather than the former base name `'Portland Operating Budget'`, and treats missing rows as informational (they may not exist before first load) rather than a fatal error.

---

### CR-03: HTTP redirect not followed in Census CSV downloader — broken file cached silently

**Files modified:** `scripts/loadORPopulation.js`
**Commit:** 46bc188 (same commit as CR-01)
**Applied fix:** Rewrote `downloadFile()` to inspect `res.statusCode` before piping. On 3xx with a `Location` header, closes the file and recursively calls `downloadFile()` to follow the redirect. On non-200 non-redirect, closes the file and rejects with a descriptive `HTTP {N} downloading {url}` error. On 200, pipes as before. This prevents HTML redirect bodies from being cached as valid CSV files.

---

### WR-01: `python` command fails on most Linux systems — should be `python3`

**Files modified:** `scripts/processPortland.js`
**Commit:** 07d722b
**Applied fix:** Added `const pythonBin = process.platform === 'win32' ? 'python' : 'python3'` before the `execSync` call in `extractPDF()`. Substituted `pythonBin` into the template string. On Windows the py launcher maps `python` correctly; on Linux/macOS `python3` is the standard binary name.

---

### WR-02: Silent wrong-URL fallback for unknown fiscal years

**Files modified:** `scripts/processPortland.js`
**Commit:** 07d722b (same commit as WR-01)
**Applied fix:** Removed `|| PDF_URLS[2026]` fallback in `upsertDataSource()`. `baseUrl` is now `PDF_URLS[fiscalYear]` (possibly `undefined`). Added a `console.warn` when `baseUrl` is falsy. Changed `base_url: baseUrl` to `base_url: baseUrl ?? ''` in the src object so the field is never `undefined`. Unknown fiscal years now emit a visible warning and store an empty string rather than silently storing the wrong FY2026 URL.

---

### WR-03: Delete errors silently swallowed before RPC upsert

**Files modified:** `scripts/processPortland.js`
**Commit:** 07d722b (same commit as WR-01)
**Applied fix:** Changed `await supabase...delete()...` to `const { error: delErr } = await supabase...delete()...` and added an early `return false` with `console.error` if `delErr` is set. The RPC call is not reached when the pre-load delete fails.

---

### WR-04: `is_fund_row()` is defined but never called — dead code obscures scope

**Files modified:** `scripts/extractPortland.py`
**Commit:** d308115
**Applied fix:** Deleted the `is_fund_row()` function (lines 97-110 in original). Added a clarifying comment above `extract_budget()`: "Design: bureau subtotals only — fund-level rows are excluded. To add fund breakdown, see the fund detection logic in _inspect-portland-temp.py."

---

### WR-05: `downloadFile` does not handle `file.on('error')` — partial file left on disk

**Files modified:** `scripts/loadORPopulation.js`
**Commit:** 46bc188 (covered by CR-03 fix)
**Applied fix:** The CR-03 rewrite of `downloadFile()` includes `file.on('error', reject)` in the 200-OK branch. A write stream error now rejects the Promise immediately rather than hanging the process indefinitely.

---

### IN-01: `_inspect-portland-temp.py` is a development artifact that should be deleted

**Files modified:** `scripts/_inspect-portland-temp.py` (deleted)
**Commit:** 4f63954
**Applied fix:** Deleted the file via `git rm`. The script's own docstring confirmed it was safe to delete after Plan 01 is complete. The file added noise to the scripts directory and had no further purpose once `extractPortland.py` was built.

---

### IN-02: `EntitySwitcher.tsx` state grouping has no deterministic type ordering within a state

**Files modified:** `src/components/EntitySwitcher.tsx`
**Commit:** 0e60df7
**Applied fix:** Added `.sort(([a], [b]) => a.localeCompare(b))` before `.map()` on the inner `[...typeMap.entries()]` call (line 147). Entity type subheaders within each state group now render in stable alphabetical order regardless of municipality insertion order in the prop array. This matches the same sort already applied to state-level entries on line 140.

---

### IN-03: `seedPortlandOregon.js` creates the Supabase client without `.schema('treasury')`

**Files modified:** `scripts/seedPortlandOregon.js`
**Commit:** b7dbb56
**Applied fix:** Added `{ db: { schema: 'treasury' } }` as the third argument to `createClient()` (line 36). Removed all four per-query `.schema('treasury')` chains from `upsertMunicipality()` and Step 3 verification. The RPC call (which correctly had no `.schema()` chain) was left untouched. Style is now consistent with `loadORPopulation.js`.

---

## Skipped Issues

None — all in-scope findings were successfully fixed.

---

_Fixed: 2026-05-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
