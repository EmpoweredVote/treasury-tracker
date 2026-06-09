---
phase: 36-selective-city-retrofit
reviewed: 2026-06-09T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/extractPortland.py
  - scripts/processPortland.js
  - scripts/bulkLoadBudget.js
  - scripts/buildBudgetTree.mjs
  - supabase/migrations/20260609120000_add_audit_verdict_to_data_sources.sql
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed: one Python PDF extractor, two JS loaders, one extracted tree-builder module, and one SQL migration. The WR-04 fix (no hardcoded Supabase URL fallback) is correctly applied in both `processPortland.js` and `bulkLoadBudget.js` — both fail closed with `process.exit` when `SUPABASE_URL` is absent. The migration SQL is idempotent via `IF NOT EXISTS`. The 3-level `buildOperatingTree()` D-06 null-collapse pattern is structurally sound.

One critical finding: `fetchSocrataCount` does not check HTTP response status before calling `.json()`, which will silently return `0` on any 4xx/5xx, causing the loader to skip data without raising an error. Four warnings cover a command-injection surface in `extractPDF`, a lost-error path in `upsertDataSource`, an ambiguous continuation-page guard in the `extract_service_area_map` two-page logic, and a missing pre-load delete in `bulkLoadBudget.js` (present in `processPortland.js` but absent in the Socrata loader). Two info items cover style/robustness improvements.

---

## Critical Issues

### CR-01: `fetchSocrataCount` silently returns 0 on HTTP errors

**File:** `scripts/bulkLoadBudget.js:44-48`
**Issue:** `fetchSocrataCount` calls `resp.json()` without checking `resp.ok`. If the Socrata API returns a 4xx or 5xx (e.g., invalid `where` filter, dataset ID typo, or rate limit), the response body is a JSON error object whose `[0]?.count` is `undefined`, so `parseInt(undefined || '0')` returns `0`. The caller then logs "(no data for this fiscal year)" and returns `status: 'empty'` — the operation appears to succeed with zero rows. This masks real errors and can silently skip a full fiscal year of data during a production load. By contrast, `fetchSocrataPage` correctly throws on `!resp.ok`.

**Fix:**
```js
async function fetchSocrataCount(baseUrl, datasetId, where) {
  const url = `${baseUrl}/resource/${datasetId}.json?$select=count(*)&$where=${encodeURIComponent(where)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata count ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return parseInt(data[0]?.count || '0');
}
```

---

## Warnings

### WR-01: `extractPDF` — unquoted `--mode` argument enables command injection

**File:** `scripts/processPortland.js:99`
**Issue:** The shell command is assembled as:
```js
`${pythonBin} "${pyScript}" "${pdfPath}" --mode ${mode}`
```
`pdfPath` is double-quoted (safe), but `mode` is interpolated without quoting. The comment at line 94-95 says "controlled string value from this script's parseArgs, not user input," and `parseArgs` does use `choices: ['operating', 'revenue', 'requirements']` — but `parseArgs` with `strict: false` (line 378) does NOT validate unknown options or coerce values; it only skips unknown flags. The `mode` value is derived from `opts.requirements`/`opts.revenue` booleans (lines 383-385), so in the current code paths `mode` is always one of three safe literals. However, if the `extractPDF` function is ever called with a caller-supplied `mode` parameter from a different code path (it accepts `mode` as a parameter), or if `strict: false` ever allows a crafted `--mode` arg through a different route, the unquoted shell insertion becomes exploitable. The fix is a single quote addition.

**Fix:**
```js
const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}" --mode "${mode}"`, {
```
Additionally, consider replacing `strict: false` with `strict: true` on line 378 to reject unknown CLI arguments.

### WR-02: `upsertDataSource` silently returns `undefined` on DB error

**File:** `scripts/processPortland.js:244-251`
**Issue:** Both the `.update()` and `.insert()` branches destructure only `{ data }`, discarding the `error` field from the Supabase response. If either DB call fails (e.g., constraint violation, network error), `data` is `null` and `error` is set, but the error is silently swallowed. The caller at line 257 checks `!ds?.id` and prints "data_source upsert failed" — but gives no diagnostic information because the error was never captured.

**Fix:**
```js
if (existing?.id) {
  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .update(src).eq('id', existing.id).select().single();
  if (error) { console.error('    data_source update error:', error.message); return null; }
  return data;
}
const { data, error } = await supabase.schema('treasury').from('data_sources')
  .insert(src).select().single();
if (error) { console.error('    data_source insert error:', error.message); return null; }
return data;
```

### WR-03: `extract_service_area_map` continuation page is read unconditionally — may pull from a wrong table

**File:** `scripts/extractPortland.py:166-169`
**Issue:** After processing the header page (line 164), the code always reads `header_page_idx + 1` as the continuation page (lines 166-169). The guard `if not table or len(table[0]) < 3` (line 137) rejects pages with fewer than 3 columns, but a page immediately following the managing-agency table could be a different table with 3+ columns (e.g., a fund-type summary table, an adjacent fiscal calendar). If that page's first column happens to have non-empty text matching bureau-name rows, it will silently corrupt the `service_map` with wrong service-area labels. The original design ("immediate continuation page") is brittle across fiscal years — if the table shrinks to one page, `next_idx` points at the next unrelated page. There is no keyword validation on the continuation page to confirm it still belongs to the same table.

**Fix:** Add a confirmation check — only process the continuation page if it does NOT contain the 'Managing Agency' keyword (which would mean it is actually a fresh table header rather than a continuation), AND optionally limit to pages that contain at least one known service-area keyword:
```python
next_idx = header_page_idx + 1
if next_idx < len(pdf.pages):
    next_text = pdf.pages[next_idx].extract_text() or ''
    # Only process as continuation if it does NOT start a new table header
    if 'Managing Agency' not in next_text:
        _process_table_page(next_idx)
```

### WR-04: `bulkLoadBudget.js` has no pre-load delete — depth changes accumulate stale rows

**File:** `scripts/bulkLoadBudget.js` (syncBudgetSource, lines 127-143)
**Issue:** `processPortland.js` explicitly deletes existing `budgets` rows for `(data_source_id, fiscal_year)` before calling the RPC (lines 261-266), implementing the idempotency guarantee documented in 36-01-SUMMARY. `bulkLoadBudget.js` has no equivalent delete — it calls `treasury_sync_budget_tree` directly. If the RPC does not fully replace prior-depth rows on its own (the 36-01 SUMMARY documented this as a risk to investigate), running `bulkLoadBudget.js` with a changed `department_column` will orphan old depth rows. Even if the RPC does replace all rows for the data_source, the asymmetry between the two loaders creates a maintenance risk: a future engineer reading `bulkLoadBudget.js` will not see the pre-delete, and any future RPC behavior change would silently break idempotency here but not in `processPortland.js`.

**Fix:** Add the same pre-load delete pattern before the RPC call:
```js
// Clear existing rows for idempotency (mirrors processPortland.js pattern)
const { error: delErr } = await supabase.schema('treasury').from('budgets')
  .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
if (delErr) {
  console.error(`  Pre-load delete failed: ${delErr.message}`);
  return { rows_fetched: allRows.length, rows_inserted: 0, status: 'error' };
}
```

---

## Info

### IN-01: `treasury_get_data_source_config` RPC error not checked in `bulkLoadBudget.js`

**File:** `scripts/bulkLoadBudget.js:189-190`
**Issue:** The RPC call at line 189 destructures only `{ data: ds }`, discarding the `error` field. If the RPC fails, `ds` will be `null` and the code prints "Config not found" and continues — which looks like a missing record rather than a DB error. Other loaders in the codebase (e.g., `bulkLoadXLSX.js`) capture the `cfgErr` and handle it explicitly.

**Fix:**
```js
const { data: ds, error: cfgErr } = await supabase.rpc('treasury_get_data_source_config', { p_data_source_id: src.id });
if (cfgErr) { console.error(`  RPC error for ${src.name}: ${cfgErr.message}`); continue; }
if (!ds) { console.error(`  Config not found for ${src.name}`); continue; }
```

### IN-02: `buildBudgetTree.mjs` — `total` accumulates `approved` even when `approved === 0` but `actual !== 0`

**File:** `scripts/buildBudgetTree.mjs:65-108`
**Issue:** The zero-drop filter at lines 65-68 correctly skips rows where both `approved` and `actual` are zero. However, `total += approved` at line 107 runs for every kept row, including rows where `approved === 0` and `actual !== 0` (kept because actual is nonzero). The `total` variable is passed to the RPC as `p_total`, which the UI uses as the displayed budget figure. Rows with $0 approved but nonzero actual will be counted as $0 in the total, which is correct — but the intent is the adopted/approved total, and mixing in zero-approved rows could make the tree children's sum exceed `total` when actuals are positive. This is a minor inconsistency rather than an outright bug, but the total passed to the RPC may not match the sum of the tree's leaf `a` values when actuals are involved.

**Fix:** No code change is strictly required, but add a comment clarifying that `total` is the sum of approved amounts (which may be 0 for actuals-only rows), or compute total from the finalized tree rather than the raw accumulation loop.

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
