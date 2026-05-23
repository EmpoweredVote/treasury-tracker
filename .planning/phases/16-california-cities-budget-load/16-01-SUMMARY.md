---
phase: 16-california-cities-budget-load
plan: 01
subsystem: api
tags: [socrata, soda, bulkLoadBudget, where-clause, column_mapping, fiscal_year_type, where_extra]

# Dependency graph
requires:
  - phase: 15-los-angeles-socrata-budget-load
    provides: Los Angeles operating budget loaded via bulkLoadBudget.js Socrata pipeline
provides:
  - bulkLoadBudget.js extended with fiscal_year_type and where_extra column_mapping keys
  - LA Revenue (vvm4-a2zu, integer fiscal_year) can now use the generic loader
  - SF Budget (xdgd-c79v, needs spending/revenue filter) can now use the generic loader
affects:
  - 16-02 (SF data_source seed + load)
  - 16-03 (LA revenue data_source seed + load)
  - 16-04 (San Diego CSV loader)
  - Any future Socrata city with non-string fiscal_year or multi-type datasets

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "column_mapping opt-in extensions: new keys in data_sources.column_mapping drive WHERE clause shape without code changes"
    - "fiscal_year_type: 'integer' branch for Socrata datasets where fiscal year is stored as a number (not a string)"
    - "where_extra: verbatim WHERE fragment — caller supplies leading AND; used for datasets that merge spending and revenue into one endpoint"

key-files:
  created: []
  modified:
    - scripts/bulkLoadBudget.js

key-decisions:
  - "where_extra caller supplies the leading AND — more flexible (allows OR, parentheses); matches how column_mapping is per-dataset"
  - "fiscal_year_type defaults to 'string' (backward-compatible); only 'integer' triggers the unquoted branch"
  - "No new CLI flags — these are column_mapping runtime keys, not operator options"

patterns-established:
  - "column_mapping extension pattern: add optional key, read with || default, use in WHERE builder — no function signature change"

# Metrics
duration: 5min
completed: 2026-05-22
---

# Phase 16 Plan 01: bulkLoadBudget.js WHERE Clause Extensions Summary

**bulkLoadBudget.js extended with opt-in `fiscal_year_type` and `where_extra` column_mapping keys, enabling LA Revenue (integer fiscal_year) and SF Budget (spending/revenue filter) without any new loaders**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-23T00:16:00Z
- **Completed:** 2026-05-23T00:21:48Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `fiscal_year_type: 'integer'` support — Socrata datasets where fiscal year is an integer (not a string) now get an unquoted WHERE clause (`fiscal_year=2025` vs `fiscal_year='2025'`)
- Added `where_extra` support — arbitrary WHERE clause fragment appended verbatim after the year filter, enabling dataset-type discrimination (e.g., SF's combined spending+revenue endpoint)
- Regression-verified: Dallas Operating FY2025 dry-run still fetches 1,062 rows with exit 0 — default branch is byte-identical to pre-change behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fiscal_year_type and where_extra support to bulkLoadBudget.js WHERE clause builder** - `78981f6` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `scripts/bulkLoadBudget.js` - WHERE clause builder in `syncBudgetSource` extended with two opt-in column_mapping keys; 255 → 271 lines

## Modified WHERE-builder Block (exact lines inserted)

```javascript
const cm = ds.column_mapping || {};
const fyCol = cm.fiscal_year_column || 'bfy';
const fyType = cm.fiscal_year_type || 'string';
const whereExtra = cm.where_extra || '';

// column_mapping extensions (both optional):
//   fiscal_year_type: 'integer' -> WHERE fiscal_year=2025 (no quotes; for LA revenue vvm4-a2zu)
//                     anything else / absent -> WHERE bfy='2025' (default, matches TX cities)
//   where_extra:      additional WHERE clause fragment appended after the year filter.
//                     Caller supplies the leading 'AND' (e.g., "AND revenue_or_spending='Spending'").
//                     Used by SF Budget (xdgd-c79v) to filter combined spending/revenue dataset.

// Build base WHERE — integer columns must NOT be quoted (e.g., LA Revenue vvm4-a2zu)
// String columns (default) match the prior behavior exactly
const baseWhere =
  fyType === 'integer'
    ? `${fyCol}=${fiscalYear}`
    : `${fyCol}='${fiscalYear}'`;

// Append where_extra verbatim if provided (e.g., SF xdgd-c79v needs
// "AND revenue_or_spending='Spending'"). Caller supplies the leading AND.
const where = whereExtra ? `${baseWhere} ${whereExtra}` : baseWhere;
```

## Dallas Operating FY2025 Dry-Run Output (regression confirmation)

```
Loading 1 Socrata budget source(s)...

Dallas Operating Budget FY2025: 1,062 total rows
  fetched 1,062/1,062
  built tree: 887 kept, 175 zero-amount rows dropped, total $4,383,213,618
  top-level categories: 200
  (dry run — skipping RPC call)
    Water (Debt Service) Capital Funding: $390,330,360 (4 subcategories)
    Police Field Patrol: $350,478,902 (4 subcategories)
    Dallas Convention Center: $308,930,370 (7 subcategories)

--- Summary ---
  Dallas Operating Budget FY2025: dry_run — 1062 rows fetched, 0 inserted
```

Default branch (no `fiscal_year_type`, no `where_extra`) produces `bfy='2025'` — behavior is unchanged.

## Final File Line Count

**271 lines** (was 255; net +16 lines from 3 new `const` assignments, 7 comment lines, 5 WHERE-builder lines, 1 blank line)

## URLSearchParams Encoding of where_extra (note for Plan 16-04)

`fetchSocrataPage` builds the URL via `URLSearchParams`:

```javascript
const params = new URLSearchParams({
  $limit: String(limit),
  $offset: String(offset),
  $where: where,           // <-- where_extra is already part of `where` here
});
```

`URLSearchParams` percent-encodes the full `$where` value — including the appended `where_extra` fragment. Single quotes in the fragment (e.g., `AND revenue_or_spending='Spending'`) become `%27`. This is correct and expected: Socrata's SODA API accepts percent-encoded $where parameters. Plan 16-02 and 16-03 should store the raw (unencoded) string in `column_mapping.where_extra` (e.g., `"AND revenue_or_spending='Spending'"`) — the loader handles encoding automatically.

`fetchSocrataCount` passes `where` through `encodeURIComponent` in a manually constructed URL string — same behavior, correctly encodes the appended fragment.

## Decisions Made
- `where_extra` caller supplies the leading `AND` — more flexible (allows `OR`, parentheses, complex expressions) and matches the existing convention that `column_mapping` is a dataset-level contract
- `fiscal_year_type` defaults to `'string'` via `|| 'string'` — any column_mapping without this key gets the original quoted behavior
- No new CLI flags added — these are per-data_source configuration keys, not operator options

## Deviations from Plan

None - plan executed exactly as written. The 16 lines added are within the "~10-15" estimate; slight overcount is due to added blank line and comment block.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `bulkLoadBudget.js` is ready to drive SF operating/revenue (xdgd-c79v) and LA Revenue (vvm4-a2zu) loads
- Plan 16-02: seed SF data_source rows with `fiscal_year_type` and/or `where_extra` in column_mapping
- Plan 16-03: seed LA Revenue data_source row with `fiscal_year_type: 'integer'`
- Store `where_extra` as the raw unencoded string — URL encoding is handled by the loader

---
*Phase: 16-california-cities-budget-load*
*Completed: 2026-05-22*
