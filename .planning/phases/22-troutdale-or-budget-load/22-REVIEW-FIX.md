---
phase: 22-troutdale-or-budget-load
fixed_at: 2026-06-01T00:00:00Z
review_path: .planning/phases/22-troutdale-or-budget-load/22-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-06-01T00:00:00Z
**Source review:** .planning/phases/22-troutdale-or-budget-load/22-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 Critical, 4 Warning)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Silent data loss when both `null` and `undefined` FY keys exist in fyMap

**Files modified:** `scripts/processTroutdale.js`
**Commit:** 13a8116
**Applied fix:** Replaced `fyMap.get(null) || fyMap.get(undefined)` with spread-merge `[...(fyMap.get(null) ?? []), ...(fyMap.get(undefined) ?? [])]` so rows under both keys are combined. Added guard `if (nullRows.length > 0)` before `fyMap.set(inferred, nullRows)` to avoid setting an empty entry.

### WR-01: Supabase select error silently swallowed in `upsertDataSource` — can produce duplicate rows

**Files modified:** `scripts/processTroutdale.js`
**Commit:** 1b8a89e
**Applied fix:** Destructured `error: selectErr` from the `.maybeSingle()` call in `upsertDataSource`. Added early-return guard: if `selectErr` is truthy, logs the error message and returns `null` (which the caller at line 206 already handles via `if (!ds?.id)`).

### WR-02: `ensureMunicipality` discards Supabase error — misleading exit message on DB failure

**Files modified:** `scripts/processTroutdale.js`
**Commit:** f263510
**Applied fix:** Destructured `error: selectErr` from the `.maybeSingle()` call in `ensureMunicipality`. Added check: if `selectErr` is truthy, logs `ERROR querying municipalities: <message>` and calls `process.exit(2)` before reaching the misleading "not found — run seeder" message.

### WR-03: HTTP redirect in `downloadFile` leaks socket by not draining the redirect response body

**Files modified:** `scripts/loadORPopulation.js`
**Commit:** 8b44765
**Applied fix:** Added `res.resume()` immediately after `file.close()` in the 3xx redirect branch of `downloadFile`. This drains the (typically empty) redirect response body and allows Node.js to release the underlying TCP socket promptly.

### WR-04: `KNOWN_VALUES` sanity check silently passes (NaN comparison) when a city is absent from the map

**Files modified:** `scripts/loadORPopulation.js`
**Commit:** 8f2c46d
**Applied fix:** Added `if (actual === undefined)` guard at the top of the `KNOWN_VALUES` loop body. When a city is missing from `cityMap`, logs a warning and `continue`s — preventing the silent `NaN > 0.01 === false` false-pass.

---

_Fixed: 2026-06-01T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
