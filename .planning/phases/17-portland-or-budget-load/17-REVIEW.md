---
phase: 17-portland-or-budget-load
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - scripts/extractPortland.py
  - scripts/processPortland.js
  - scripts/loadORPopulation.js
  - scripts/seedPortlandOregon.js
  - src/components/EntitySwitcher.tsx
  - scripts/_inspect-portland-temp.py
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 17 introduces a Portland, OR budget loader composed of a Python pdfplumber extractor, a Node.js orchestrator, a population loader, a municipality seeder, and a one-line EntitySwitcher update. The code correctly follows the established Fremont/TX population loader patterns in most areas. However, three blockers require fixing before this code ships: (1) a Windows-only hardcoded temp path that will silently fail on any CI/Linux environment; (2) a `dataset_id` collision between the seeder's base row and the per-fiscal-year rows created by the loader, which can cause the idempotent delete-and-reload flow to corrupt previously written data; and (3) HTTP redirect handling is absent in the Census file downloader, which will silently write an HTML redirect body into the cached CSV, causing every subsequent parse attempt to crash.

There are also five warnings covering: unchecked delete errors, a `python` vs `python3` command mismatch that will fail on many Linux hosts, a silent fallback to a wrong PDF URL for unknown fiscal years, a dead function `is_fund_row()` that obscures the extractor's scope, and an HTTP error path that leaves a broken file on disk.

---

## Critical Issues

### CR-01: Hardcoded Windows path for Census CSV cache breaks CI and Linux

**File:** `scripts/loadORPopulation.js:10`
**Issue:** `CSV_PATH = 'C:/tmp/sub-est2024_41.csv'` is a Windows-absolute path. On any Linux/macOS CI runner or developer machine this path either does not exist or resolves to a relative path under `/`, silently creating or failing to create a file in an unexpected location. The same hardcoding exists in the TX analog (`loadTXPopulation.js:10`), but copying the defect does not make it correct.

**Fix:**
```javascript
import { tmpdir } from 'node:os';
import path from 'node:path';

const CSV_PATH = path.join(tmpdir(), 'sub-est2024_41.csv');
```
`os.tmpdir()` returns `C:\Users\...\AppData\Local\Temp` on Windows and `/tmp` on Linux — portable on both without configuration.

---

### CR-02: `dataset_id` collision between seeder's base row and loader's per-FY rows

**File:** `scripts/seedPortlandOregon.js:64` and `scripts/processPortland.js:150`
**Issue:** `seedPortlandOregon.js` inserts a data_source with `dataset_id: 'portland_adopted_budget_vol1'` covering `fiscal_years: [2025, 2026]`. `processPortland.js` then upserts two more rows with `dataset_id: 'fy2025'` and `dataset_id: 'fy2026'` (matching the Fremont pattern). These are three distinct rows in `data_sources` for the same municipality and dataset_type.

The pre-load delete at line 183 of `processPortland.js` only deletes budgets linked to the per-FY `data_source_id`. The seeder's base row (`portland_adopted_budget_vol1`) is never deleted — but it also never has budget rows linked to it, so it will accumulate as a stale orphan. More importantly, the seeder's `upsertDataSourceByName` on line 120 looks up by `name = 'Portland Operating Budget'`, while the loader creates rows named `'Portland Operating Budget FY2025'` / `'Portland Operating Budget FY2026'`. Re-running the seeder after the loader will not find or touch the loader's rows. This inconsistency will cause `treasury_list_source_ids` to return unexpected duplicate-like entries and makes the verification step in the seeder misleading.

All prior Portland loaders use `processFremont.js`-style (loader-only data_source rows, no separate base seeder row). The seeder should either be removed or its data_source row should match the loader's naming/ID convention.

**Fix (option A — remove the base seeder row, let the loader own data_sources):**
```javascript
// In seedPortlandOregon.js: delete Step 2 (upsertDataSourceByName) entirely.
// processPortland.js creates the correct per-FY rows.
// Update Step 3 verification to check for 'Portland Operating Budget FY2026'
// and 'Portland Operating Budget FY2025'.
```

**Fix (option B — align seeder names to loader names):**
Make the seeder skip inserting a data_source row and document that `processPortland.js --dry-run` should be run to verify source rows exist.

---

### CR-03: HTTP redirect not followed in Census CSV downloader — broken file cached silently

**File:** `scripts/loadORPopulation.js:25-32`
**Issue:** The `downloadFile` function uses `node:https` `get()` which does NOT automatically follow HTTP 3xx redirects. Census.gov URLs regularly redirect (HTTP → HTTPS, or temporary redirects). When a redirect is received, `res.pipe(file)` writes the HTML redirect body (a short `<html>` document) to `CSV_PATH`. The file is then cached as "present" by `existsSync`, so every subsequent run re-uses the broken file. The parse step at line 58 will then fail the header check (`header[0]` will be `'<html>'` not `'SUMLEV'`) and `process.exit(1)` with a confusing format-change error — with no way to recover without manually deleting the cached file. This same defect exists in `loadTXPopulation.js` (the analog), but Portland's Census URL is known to be HTTPS and may have additional CDN redirects.

**Fix:**
```javascript
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        // Follow redirect (one level)
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', (err) => { file.close(); reject(err); });
  });
}
```

---

## Warnings

### WR-01: `python` command fails on most Linux systems — should be `python3`

**File:** `scripts/processPortland.js:78`
**Issue:** The extractor is invoked as `python "${pyScript}" "${pdfPath}"`. On most modern Linux distributions and macOS, the `python` binary does not exist; the command is `python3`. The existing Fremont analog (`processFremont.js:51`) also uses `python` — but Portland targets a broader CI surface. On Windows where `py` launcher is installed, `python` often works. On Linux CI (Ubuntu 22+, Debian 12+), `python` is not in PATH by default and `execSync` will throw `ENOENT`, terminating the entire load run.

**Fix:**
```javascript
// Prefer python3, fall back to python (Windows)
const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
  maxBuffer: 8 * 1024 * 1024,
  encoding: 'utf8',
});
```
Or use `python3` unconditionally — `python3` is available on Windows via the Python Launcher and the Microsoft Store Python installs.

---

### WR-02: Silent wrong-URL fallback for unknown fiscal years

**File:** `scripts/processPortland.js:144`
**Issue:** `const baseUrl = PDF_URLS[fiscalYear] || PDF_URLS[2026]`. If a PDF for an unexpected fiscal year (e.g., FY2027, or if the extractor misparses and produces `null`) is processed, the data_source row is silently stamped with the FY2026 URL. This means the `base_url` stored in DB for the new year is wrong — a reader clicking that link will download the wrong PDF. Since `PDF_URLS` only has keys for 2025 and 2026, a third-year PDF would silently get FY2026's URL.

**Fix:**
```javascript
const baseUrl = PDF_URLS[fiscalYear];
if (!baseUrl) {
  console.warn(`  WARNING: No PDF URL configured for FY${fiscalYear} — base_url will be empty`);
}
const src = {
  // ...
  base_url: baseUrl ?? '',
  // ...
};
```
Fail louder so the operator knows a URL must be added.

---

### WR-03: Delete errors silently swallowed before RPC upsert

**File:** `scripts/processPortland.js:182-183`
**Issue:** The pre-load `budgets` delete is `await`ed but its return value is never checked for errors:
```javascript
await supabase.schema('treasury').from('budgets')
  .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
```
If the delete fails (e.g., DB connection issue, RLS policy), the subsequent RPC call proceeds and may produce duplicate rows or fail with a constraint error — and the delete failure is never reported. The Fremont analog has the same omission, but Portland is a new file and should be fixed here.

**Fix:**
```javascript
const { error: delErr } = await supabase.schema('treasury').from('budgets')
  .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
if (delErr) {
  console.error('    Pre-load delete failed:', delErr.message);
  return false;
}
```

---

### WR-04: `is_fund_row()` is defined but never called — dead code obscures scope

**File:** `scripts/extractPortland.py:98-110`
**Issue:** The function `is_fund_row()` is defined and correctly implemented (checks for non-header, non-subtotal rows with a non-zero total in column 5). However, it is never called anywhere in the file. The main `extract_budget()` loop captures only subtotal rows. The dead function implies there was an intent to also capture fund-level line items, which conflicts with the design comment at line 98 ("Fund rows have a non-empty name…"). If fund-level rows are intentionally excluded (design intent is bureau-level only), the function should be deleted to avoid confusion. If fund-level rows are needed (for more granular breakdown), the function should be called.

**Fix (if bureau-level only is intentional):**
Delete `is_fund_row()` at lines 98-110, and add a clarifying comment in `extract_budget()`:
```python
# Design: bureau subtotals only — fund-level rows are excluded.
# To add fund breakdown, see the fund detection logic in _inspect-portland-temp.py.
```

---

### WR-05: `downloadFile` does not handle `file.on('error')` — partial file left on disk

**File:** `scripts/loadORPopulation.js:25-32`
**Issue:** If the write stream emits an error (disk full, permission denied), `file.on('error')` is not handled. The `downloadFile` Promise will never resolve or reject, hanging the process indefinitely. Additionally, the partially-written file remains on disk and `existsSync` will return `true` on re-run, causing the corrupted partial file to be re-used.

**Fix:** See the corrected `downloadFile` in CR-03 above, which includes `file.on('error', reject)`.

---

## Info

### IN-01: `_inspect-portland-temp.py` is a development artifact that should be deleted

**File:** `scripts/_inspect-portland-temp.py`
**Issue:** The script's own docstring says "Safe to delete after Plan 01 is complete." The file is committed to the repository with a name suggesting it is temporary (`_inspect-portland-temp`). Leaving it in the tree adds noise to the scripts directory. It also has no `--max-pages` CLI validation (non-integer input at line 51 would raise an uncaught `ValueError`), though this is acceptable for a throwaway dev tool.

**Fix:** Delete `scripts/_inspect-portland-temp.py` now that the extractor is built and working.

---

### IN-02: `EntitySwitcher.tsx` state grouping has no deterministic type ordering within a state

**File:** `src/components/EntitySwitcher.tsx:147`
**Issue:** The inner `[...typeMap.entries()].map(...)` iterates entity types in insertion order — the order that `grouped` populates them (which is the order that municipalities appear in the `municipalities` array). If the prop order changes between renders, the entity type subheaders within Oregon (or any state) could reorder unexpectedly. This is a cosmetic consistency issue, not a crash.

**Fix:**
```typescript
{[...typeMap.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([type, entities]) => (
```
This is the same `sort` already applied to the state-level entries on line 140.

---

### IN-03: `seedPortlandOregon.js` creates the Supabase client without `.schema('treasury')`

**File:** `scripts/seedPortlandOregon.js:34`
**Issue:** `const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)` — no schema option. All queries chain `.schema('treasury')` which is correct, but this inconsistency with `loadORPopulation.js` (which uses `{ db: { schema: 'treasury' } }` at init-time) may confuse future maintainers. The RPC call on line 183 (`supabase.rpc('treasury_list_source_ids')`) has no `.schema()` chain, which is consistent with the established pattern (RPCs don't need schema scoping), so this is not a bug — just a style inconsistency worth noting.

**Fix:** Either add `{ db: { schema: 'treasury' } }` to the createClient call and remove all `.schema('treasury')` chains, or leave as-is and document the two-style split. Do not mix within a single file.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
