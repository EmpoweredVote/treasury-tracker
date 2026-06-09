---
phase: 36-selective-city-retrofit
fixed_at: 2026-06-09T00:00:00Z
review_path: .planning/phases/36-selective-city-retrofit/36-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 36: Code Review Fix Report

**Fixed at:** 2026-06-09
**Source review:** .planning/phases/36-selective-city-retrofit/36-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `fetchSocrataCount` silently returns 0 on HTTP errors

**Files modified:** `scripts/bulkLoadBudget.js`
**Commit:** 4ef298e
**Applied fix:** Added `if (!resp.ok) throw new Error(...)` guard before calling `resp.json()` in `fetchSocrataCount`. HTTP 4xx/5xx responses now throw with the status code and response body instead of silently returning 0 rows.

### WR-01: `extractPDF` — unquoted `--mode` argument enables command injection

**Files modified:** `scripts/processPortland.js`
**Commit:** 22a366f
**Applied fix:** Added double-quotes around `${mode}` in the `execSync` template literal: `--mode "${mode}"`. The `mode` value is controlled, but quoting defends against any future caller-supplied value reaching this code path.

### WR-02: `upsertDataSource` silently returns `undefined` on DB error

**Files modified:** `scripts/processPortland.js`
**Commit:** d061b20
**Applied fix:** Both the `.update()` and `.insert()` branches now destructure `{ data, error }` from the Supabase response. Each branch logs a diagnostic message (`data_source update error:` / `data_source insert error:`) and returns `null` on error, so the caller's `!ds?.id` check receives a meaningful null rather than silently undefined data.

### WR-03: `extract_service_area_map` continuation page is read unconditionally

**Files modified:** `scripts/extractPortland.py`
**Commit:** d7bc937
**Applied fix:** Added a guard before processing the continuation page: extract the next page's text and skip `_process_table_page` if `'Managing Agency'` is present — which indicates the page is a fresh table header, not a continuation. This prevents a wrong-table page from silently corrupting `service_map`.

### WR-04: `bulkLoadBudget.js` has no pre-load delete — depth changes accumulate stale rows

**Files modified:** `scripts/bulkLoadBudget.js`
**Commit:** 98ed10c
**Applied fix:** Added pre-load delete of `budgets` rows for `(data_source_id, fiscal_year)` before calling the `treasury_sync_budget_tree` RPC in `syncBudgetSource`, mirroring the idempotency pattern already present in `processPortland.js`. Delete failures return `status: 'error'` immediately.

---

_Fixed: 2026-06-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
