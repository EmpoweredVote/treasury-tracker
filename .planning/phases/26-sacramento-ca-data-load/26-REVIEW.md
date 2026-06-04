---
phase: 26-sacramento-ca-data-load
reviewed: 2026-06-04T15:32:12Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - scripts/seedSacramentoCA.js
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-06-04T15:32:12Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

`scripts/seedSacramentoCA.js` is a narrow, well-structured seeder following the established project pattern from `seedCaliforniaCities.js` and `seedLADataSources.js`. The core idempotency logic (select-then-update-or-insert by name, step-through with `process.exit(1)` on hard failures) is sound, and the `county_id` preservation constraint is correctly observed.

One critical issue was found: the `source_registry` insert payload in Step C omits required non-null columns that the plan explicitly required to be introspected before writing. The plan's Task 1 stated "introspect source_registry columns using mcp__supabase-local" before constructing the payload — the seeder skips this and sends only `{ name, url }`. If the table has additional NOT NULL columns without defaults, the insert will fail silently (non-blocking warning path) and attribution will be permanently null in production unless the seeder is re-run after being corrected.

Three warnings cover: a misleading error message in the companion loader that will confuse operators, the hardcoded production Supabase URL fallback creating silent wrong-environment risk, and a missing `fiscal_years` field on the data_source rows (loader works around it, but creates a schema gap vs. other seeders).

---

## Critical Issues

### CR-01: `source_registry` insert payload may be incomplete — required columns not introspected

**File:** `scripts/seedSacramentoCA.js:204-211`
**Issue:** The Step C `source_registry` insert sends only `{ name: 'open-budget-sacramento', url: 'https://openbudgetsac.org' }`. The plan (26-01-PLAN.md Task 1) explicitly required introspecting the `source_registry` table columns via `mcp__supabase-local` before constructing the payload: _"introspect the source_registry table columns... so the insert payload matches required non-null columns."_ This step was skipped. If the table has additional NOT NULL columns without defaults (e.g. `label`, `description`, `license`), the insert will fail with a Postgres NOT NULL constraint violation. Because Step C is non-blocking (failure logs a warning and continues), this failure is silent — the script exits 0, the row is absent, and Sacramento budget rows will have no attribution in the UI. The error only surfaces when checking the warning text in script output, not from the exit code.

Additionally, `source_registry` is noted across Phases 24 and 26 as having restricted PostgREST access. If INSERT is denied by RLS and the response body is empty (no error object), the `srInserted?.id` check on line 216 will hit the "WARNING: source_registry insert returned no row" branch with no diagnostic detail about *why* the insert silently returned nothing.

**Fix:** Before shipping, introspect the table:
```sql
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'treasury' AND table_name = 'source_registry'
ORDER BY ordinal_position;
```
Then add any required columns to the payload. At minimum, log the full `srInsertErr` object (not just `.message`) on failure to surface RLS-denied vs. constraint-violation vs. schema errors:
```js
if (srInsertErr) {
  console.warn(`  WARNING: source_registry insert failed (${srInsertErr.message}) [code=${srInsertErr.code}]. Attribution will be null — non-blocking.`);
}
```

---

## Warnings

### WR-01: Companion loader error message names wrong seeder — will confuse operators

**File:** `scripts/loadSacramentoCSV.js:182`
**Issue:** When `getDataSources()` fails to find the Sacramento data_source rows, it prints:
```
Sacramento data_sources rows not found — run seedCaliforniaCities or the DB setup first
```
The correct seeder for Sacramento is `seedSacramentoCA.js`, not `seedCaliforniaCities`. An operator running the loader after a fresh clone will follow the wrong remediation path. This is in `loadSacramentoCSV.js` (not the file under review), but the seeder phase owns both scripts and the message was not corrected.

**Fix:**
```js
console.error('Sacramento data_sources rows not found — run scripts/seedSacramentoCA.js first');
```

### WR-02: Hardcoded production Supabase URL fallback — silent wrong-environment targeting

**File:** `scripts/seedSacramentoCA.js:55`
**Issue:** `SUPABASE_URL` falls back to the hardcoded production project URL `https://kxsdzaojfaibhuzmclfq.supabase.co` when the env var is unset. The project's `seedLACountyLinks.js` takes the stricter approach of `process.exit(1)` when `SUPABASE_URL` is missing. If `seedSacramentoCA.js` is run without environment variables set (e.g. from a wrong shell, a CI runner, or a developer's machine that has a local `.env` pointing to a test project), it will silently target the production database using whatever `SUPABASE_SERVICE_KEY` was found. The pattern is shared with `seedCaliforniaCities.js` but `seedLACountyLinks.js` represents a safer evolved convention.

**Fix:** Replace the fallback with a hard fail, consistent with `seedLACountyLinks.js`:
```js
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL env var');
  process.exit(1);
}
```

### WR-03: Data source rows missing `fiscal_years` field — schema gap vs. other CA seeders

**File:** `scripts/seedSacramentoCA.js:156-171`
**Issue:** The two Sacramento `data_sources` rows (lines 157–170) do not include a `fiscal_years` array. The loader (`loadSacramentoCSV.js`) has its own hardcoded `ALL_FISCAL_YEARS = [2013..2026]` and does not read `fiscal_years` from the DB row, so the loader functions correctly. However, every other CA CSV data_source row in the project carries `fiscal_years` (e.g. San Diego in `seedCaliforniaCities.js` line 210). If any future tooling (admin UI, auditing script, or RPC) relies on `fiscal_years` from the `data_sources` row to know what years are available for Sacramento, it will find `null`/empty and surface Sacramento as having no data. This creates a schema-level gap that is invisible at load time.

**Fix:** Add `fiscal_years` to both rows:
```js
fiscal_years: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
```

---

## Info

### IN-01: Step A queries `existing.id` but never uses the returned id for data_source municipality_id

**File:** `scripts/seedSacramentoCA.js:119-169`
**Issue:** Step A fetches the Sacramento municipality row (line 119) and selects `id` (line 122), but the returned `existing.id` is never threaded through to the Step B data source payloads (lines 162 and 169). Both data_source rows hardcode `municipality_id: SACRAMENTO_ID` directly. This works because `SACRAMENTO_ID` matches the DB row, but the pattern deviates from how other seeders (e.g. `seedCaliforniaCities.js`) pass the resolved id forward, making the Step A database round-trip partially redundant for this purpose. The existing pattern also removes the safety net of "use the id the DB actually returned" vs. "assume the constant matches."

**Fix:** Store and use the confirmed `id` from Step A:
```js
const confirmedId = existing.id;  // after line 135
// then in dataSources, use: municipality_id: confirmedId
```

### IN-02: Empty `catch {}` in `loadEnv()` silently swallows read errors

**File:** `scripts/seedSacramentoCA.js:43-50`
**Issue:** The `try/catch {}` on lines 43–50 suppresses all errors from `.env` file reads, including unexpected errors (permission denied, disk error) not just "file not found." This is the established project-wide pattern (`loadSacramentoCSV.js` line 46, `enrichCategories.js`, etc.) and not introduced here, but it means a corrupted `.env.local` file will silently result in missing credentials, leading to an unhelpful "Missing SUPABASE_SERVICE_KEY env var" exit rather than a diagnostic about the actual failure.

**Fix (optional, low priority):** Distinguish ENOENT from other errors:
```js
} catch (e) {
  if (e.code !== 'ENOENT') console.warn(`  Warning: could not read ${f}: ${e.message}`);
}
```

---

_Reviewed: 2026-06-04T15:32:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
