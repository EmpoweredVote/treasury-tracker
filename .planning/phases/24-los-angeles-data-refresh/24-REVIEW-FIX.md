---
phase: 24-los-angeles-data-refresh
fixed_at: 2026-06-03T19:45:00Z
review_path: .planning/phases/24-los-angeles-data-refresh/24-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-06-03T19:45:00Z
**Source review:** .planning/phases/24-los-angeles-data-refresh/24-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (1 Critical, 2 Warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: React Rules of Hooks Violation — Hooks Called After Early Return

**Files modified:** `src/components/dashboard/PlainLanguageSummary.tsx`
**Commit:** ebdadb0
**Applied fix:** Moved all hooks (`useState`, `useRef` x2, `useCallback`, `useAnimatedCounter`, `useEffect`) above the `if (!operatingData) return null;` guard. Derived values needed before the hooks (`budgetedTotal`, `actualTotal`, `hasActualData`, `showActual`, `isCurrentYearWithActuals`, `revenueTarget`) are computed before the hooks using optional chaining so they are safe when `operatingData` is null. The early return guard is now placed immediately after all hook calls, and the remaining non-hook derivations (`currentMonthName`, `total`, `population`, etc.) stay below the guard where `operatingData` is guaranteed non-null.

### WR-01: Silent No-Op on Update in `upsertDataSourceByName`

**Files modified:** `scripts/seedLADataSources.js`
**Commit:** 2019b8d
**Applied fix:** Added an explicit `const row = data?.[0]; if (!row) { console.error(...); process.exit(1); }` block inside `upsertDataSourceByName` after the error check, mirroring `upsertMunicipality`. The function now returns `row` directly (guaranteed truthy) rather than `data?.[0]`. The now-redundant `if (!row)` guard in `main()` (which checked the return value and called `process.exit(1)`) was removed since the function guarantees a truthy return or exits itself.

### WR-02: `where_extra` Contains Raw SQL Stored in the Database

**Files modified:** `scripts/seedLADataSources.js`
**Commit:** 3965eb0
**Applied fix:** Added a SECURITY NOTE comment directly above the `where_extra` field in `LA_DATA_SOURCE()` documenting that this is a raw SQL fragment appended by the ETL pipeline, that it must only ever be set by trusted seeder scripts, and that any future admin path editing `column_mapping` must sanitize or allowlist the field before interpolation.

---

_Fixed: 2026-06-03T19:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
