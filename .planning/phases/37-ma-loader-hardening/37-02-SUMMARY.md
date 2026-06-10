---
phase: 37-ma-loader-hardening
plan: "02"
subsystem: scripts/scrapeMaDLS.js
tags: [loader, checkpoint, fiscal-years, ma-dls, hardening]
requirements: [LOAD-02, LOAD-03]
dependency_graph:
  requires: ["37-01"]
  provides: ["checkpoint resume", "fiscal_years dedup append", "scripts/output/ gitignored"]
  affects: ["Phase 38 bulk load safety"]
tech_stack:
  added: []
  patterns:
    - "Set-based checkpoint lookup keyed by report.name:fiscalYear"
    - "writeFileSync per-record crash-safe ledger"
    - "Array.isArray guard + .includes() dedup before JSONB array UPDATE"
key_files:
  created: []
  modified:
    - scripts/scrapeMaDLS.js
    - .gitignore
decisions:
  - "Checkpoint key format: ${report.name}:${fiscalYear} — includes report name to prevent gf-expenditures/revenue-by-source collision (Pitfall 2)"
  - "writeFileSync (synchronous) used in writeProgress — crash-safe guarantee per Pitfall 1"
  - "Progress file is never auto-deleted — permanent load ledger (D-04)"
  - "fiscal_years update is non-fatal: fyErr logs warning but RPC call still proceeds"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-10"
  tasks_completed: 3
  files_modified: 2
---

# Phase 37 Plan 02: MA Loader Hardening — Checkpoint and fiscal_years Dedup Summary

Hardened `loadToSupabase()` in `scripts/scrapeMaDLS.js` with crash-safe checkpoint recovery (LOAD-02) and fiscal_years append-with-deduplication (LOAD-03), enabling Phase 38's 351-city bulk load to resume after failure and accumulate fiscal years correctly.

## Tasks Completed

| # | Task | Commit | Result |
|---|------|--------|--------|
| 1 | Add progress checkpoint (LOAD-02) | 6ce2691 | readProgress/writeProgress helpers + Set-based skip logic in loadToSupabase |
| 2 | Fix fiscal_years append-with-dedup (LOAD-03) + .gitignore | dbfd325 | .select('id, fiscal_years') + else branch with Array.isArray guard; scripts/output/ gitignored |
| 3 | SC-4 dry-run validation (no code) | dbfd325 | Dry-run against 351-record JSON exits 0; Tax Levy $42.9M Abington confirmed |

## What Was Built

### LOAD-02: Progress Checkpoint

**Checkpoint file format:** `scripts/output/ma_dls_progress.json`

```json
{
  "revenue-by-source:2025": ["001", "002", "003", ...],
  "special-revenue:2025": ["001", "002", ...]
}
```

Keys are `"${report.name}:${fiscalYear}"` strings. Values are arrays of successfully-loaded DOR codes (insertion order preserved — never sorted).

**Insertion points in loadToSupabase:**
1. Before records loop: `readProgress()` → build `Set(alreadyLoaded)`
2. First check in loop: `alreadyLoaded.has(record.dorCode)` → `checkpointSkipped++; continue`
3. After successful RPC: `alreadyLoaded.add(dorCode); writeProgress(progress)` (synchronous — crash-safe)
4. After loop: `if (checkpointSkipped > 0) console.log("Skipped N already loaded (checkpoint)")`

### LOAD-03: fiscal_years Append-with-Dedup

**Change:** `.select('id')` → `.select('id, fiscal_years')` in the existing-row query.

**New else branch:**
```javascript
const existingFiscalYears = Array.isArray(existingDs.fiscal_years) ? existingDs.fiscal_years : [];
if (!existingFiscalYears.includes(fiscalYear)) {
  await supabase.schema('treasury').from('data_sources')
    .update({ fiscal_years: [...existingFiscalYears, fiscalYear] }).eq('id', dsId);
}
```

The `Array.isArray` guard prevents `[...null]` TypeError on rows that pre-date this fix (Pitfall 3).

The INSERT path (`fiscal_years: [fiscalYear]`) is unchanged (D-08).

### .gitignore

Added after line 46 (alongside existing data-exclusion block):
```
# MA DLS scraper output — large JSON files and progress ledger
scripts/output/
```

### SC-4 Dry-Run Validation

```
Loading: General Fund Revenue by Source, FY2025, 351 records
(dry run)
Sample: [{ dorCode: "001", municipality: "Abington", fiscalYear: 2025,
           "Tax Levy": 42906155, "State Aid": 17614336, ... }]
```

All four SC-4 acceptance criteria satisfied:
- Exit 0 and `(dry run)` printed ✓
- "351 records" in loading line (non-zero) ✓
- Recognizable DLS names ("Tax Levy", "State Aid", "Local Receipts") with non-zero amounts ✓
- No `Loaded:` / `Skipped:` summary line (dry-run never calls loadToSupabase) ✓

## Manual Verification Steps for Phase 38 Executor

These steps cannot be automated before the bulk load runs but should be confirmed after the first Phase 38 run:

### Resume test (LOAD-02)

```bash
# 1. Run --load against a JSON file (will write to DB — use a test city or small file)
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json

# 2. Kill mid-run (Ctrl+C)

# 3. Re-run
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json

# Expected: "Skipped N already loaded (checkpoint)" in output
# N = number of cities that completed before kill
```

### Inspect checkpoint file

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('scripts/output/ma_dls_progress.json', 'utf8')); console.log(Object.keys(p)); console.log(Object.values(p).map(v => v.length));"
# Expected: ["revenue-by-source:2025"] [N]  (where N = cities loaded so far)
```

### fiscal_years append test (LOAD-03)

After loading FY2022 JSON then FY2023 JSON for any city:

```sql
-- Via Supabase MCP or psql:
SELECT fiscal_years FROM treasury.data_sources
WHERE api_type = 'ma-dls' AND municipality_id = <id>;
-- Expected: [2022, 2023]
-- NOT: [2023] (overwrite bug) or [2022, 2022, 2023] (duplicate bug)
```

## Deviations from Plan

**1. [Clarification] Task 1 and Task 2 scrapeMaDLS.js changes landed in same commit**

- **Found during:** Task 2 commit
- **Issue:** Both tasks modified `scripts/scrapeMaDLS.js`. Since git stages the entire file, the LOAD-03 edits (select change + else branch) were staged alongside LOAD-02 changes in the first commit.
- **Fix:** No fix needed — all changes are committed. Task 2 commit (dbfd325) captures only .gitignore; Task 1 commit (6ce2691) captures all scrapeMaDLS.js changes including LOAD-03.
- **Impact:** None — both requirements are fully implemented and verifiable by grep.

No other deviations from plan.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-37-04 | readProgress() wraps JSON.parse in try/catch returning {} — malformed ledger triggers fresh start, never crash |
| T-37-05 | Array.isArray guard + .includes(fiscalYear) dedup — no overwrite, no [2022,2022] |
| T-37-06 | Per-city writeProgress after each success — durable permanent load ledger |
| T-37-07 | scripts/output/ added to .gitignore — JSON files and progress ledger stay out of git |
| T-37-08 | writeFileSync accepted as ~1-2ms per write vs DELAY_MS=1500 HTTP delay — negligible |

## Known Stubs

None. All functionality is wired end-to-end.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- scripts/scrapeMaDLS.js exists and contains all required patterns:
  - PROGRESS_FILE defined via join(OUTPUT_DIR, 'ma_dls_progress.json') ✓
  - readProgress with try/catch returning {} ✓
  - writeProgress using writeFileSync ✓
  - progressKey built from ${report.name}:${fiscalYear} ✓
  - alreadyLoaded.has(record.dorCode) with checkpointSkipped++ and continue ✓
  - writeProgress(progress) inside successful-load branch ✓
  - "already loaded (checkpoint)" in source ✓
  - .select('id, fiscal_years') ✓
  - Array.isArray(existingDs.fiscal_years) guard ✓
  - !existingFiscalYears.includes(fiscalYear) before .update({ fiscal_years: ... }) ✓
  - INSERT path still has fiscal_years: [fiscalYear] ✓
- .gitignore contains scripts/output/ ✓
- Commits 6ce2691 and dbfd325 confirmed in git log ✓
- Dry-run exits 0 and prints all required output ✓
