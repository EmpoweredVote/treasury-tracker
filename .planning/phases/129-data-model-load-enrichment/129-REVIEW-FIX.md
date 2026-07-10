---
phase: 129-data-model-load-enrichment
fixed_at: 2026-07-10T00:00:00Z
review_path: .planning/phases/129-data-model-load-enrichment/129-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 129: Code Review Fix Report

**Fixed at:** 2026-07-10
**Source review:** .planning/phases/129-data-model-load-enrichment/129-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Critical + Warning; Info findings IN-01/IN-02 excluded per fix_scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Ephemeral `data_sources` row is not cleaned up on any per-FY failure

**Files modified:** `scripts/processTucson.js`
**Commit:** 55f359a
**Applied fix:** Wrapped the per-FY `for` loop in `processMode()` in a `try/finally` block. Converted the six internal hard-fail `process.exit(2)` calls inside the loop (missing PDF, extractor failure, tie-delta guard, mapped-total mismatch, sanity-ceiling breach, `loadFiscalYear` failure) to thrown `Error`s. The `finally` block now always runs `deleteEphemeralDataSource()` regardless of how the loop exits, restoring the "0 residue" WR-05/LOAD-01 guarantee for multi-year runs that fail partway through. `main()`'s existing top-level `main().catch(e => { console.error('Fatal:', e); process.exit(2); })` supplies the non-zero process exit code once cleanup has completed. Verified with `node --check` (syntax OK) and a full re-read of the modified region — no live load was run.

### WR-01: Pre-load delete in `loadFiscalYear` is dead code — it can never match a row

**Files modified:** `scripts/processTucson.js`
**Commit:** 30aa388
**Applied fix:** Replaced the pre-load delete keyed on `data_source_id` (which is never set by `treasury_sync_budget_tree` — the column FKs `source_registry`, not `data_sources`, and is always `NULL`) with a delete keyed on `(municipality_id, fiscal_year, dataset_type)` — the columns that actually identify the target row. Updated the stale comment to explain why the old key could never match. This gives the loader a real, defense-in-depth pre-clear ahead of the RPC's own upsert logic. Verified with `node --check` (syntax OK).

### WR-02: `seedTucsonArizona.js` verification failures don't produce a non-zero exit code

**Files modified:** `scripts/seedTucsonArizona.js`
**Commit:** 3adef39
**Applied fix:** Added a `verifyOk` flag tracked across all four postcondition checks (Tucson population, Tucson county_id link, Pima County row-count, Pima County population). Each check now sets `verifyOk = false` on mismatch (in addition to the existing `console.error('  WARNING: ...')`), and the script now calls `process.exit(1)` with a `FAILED:` message before the final `console.log('\nDone.')` if any check failed. A broken seed against the shared production table with a service-role key now fails loudly instead of exiting 0. Verified with `node --check` (syntax OK).

### WR-03: `loadTucsonEnrichment.mjs` has no sanity guard for zero live keys

**Files modified:** `scripts/loadTucsonEnrichment.mjs`
**Commit:** 1e6bc57
**Applied fix:** Added a guard immediately after `liveKeys` is derived from `d0`/`d1`: if `liveKeys` is empty despite Tucson's budgets already being confirmed loaded (`bids.length` checked earlier at line 99), the script now prints an `ABORT:` message and calls `process.exit(1)` rather than silently proceeding to report a false-positive "0/0 covered" success. Verified with `node --check` (syntax OK — `.mjs` ESM syntax check).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
