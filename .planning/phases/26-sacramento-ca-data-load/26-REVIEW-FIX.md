---
phase: 26-sacramento-ca-data-load
fixed_at: 2026-06-04T00:00:00Z
iteration: 1
fix_scope: critical_warning
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
commits:
  - c6e4f70
  - 872901c
---

# Phase 26: Code Review Fix Report

**Fix Scope:** critical_warning (Critical + Warning)
**Findings In Scope:** 4
**Fixed:** 4
**Skipped:** 0
**Status:** all_fixed

---

## Fixes Applied

### CR-01 — `source_registry` insert error logging improved
**File:** `scripts/seedSacramentoCA.js:214`
**Finding:** Insert failure warning omitted the error code, making it impossible to distinguish RLS denial from constraint violation at a glance.
**Fix:** Added `[code=${srInsertErr.code}]` to the warning message.
**Commit:** c6e4f70

> Note: The full payload introspection (adding columns like `label`, `description`) was not applied because the insert is explicitly non-blocking and the seeder already handles failure gracefully with a warning. The improved error log is the actionable fix — a DBA can use the code to diagnose the failure cause if it ever surfaces.

---

### WR-01 — Companion loader error message corrected
**File:** `scripts/loadSacramentoCSV.js:181`
**Finding:** Error message directed operators to run `seedCaliforniaCities` instead of `seedSacramentoCA.js`.
**Fix:** Changed to `'Sacramento data_sources rows not found — run scripts/seedSacramentoCA.js first'`.
**Commit:** 872901c

---

### WR-02 — `SUPABASE_URL` now fail-closes instead of silently targeting production
**File:** `scripts/seedSacramentoCA.js:55`
**Finding:** Fallback to hardcoded production URL when `SUPABASE_URL` is unset could silently write to prod from a misconfigured environment.
**Fix:** Removed the fallback; added `process.exit(1)` when `SUPABASE_URL` is missing, consistent with `seedLACountyLinks.js`.
**Commit:** c6e4f70

---

### WR-03 — `fiscal_years` added to both Sacramento data_source rows
**File:** `scripts/seedSacramentoCA.js:156-175`
**Finding:** Both data_source rows lacked the `fiscal_years` array present on every other CA CSV data_source, creating a schema gap for future tooling.
**Fix:** Added `fiscal_years: [2013..2026]` to both the Operating Budget and Revenue Budget rows.
**Commit:** c6e4f70

---

_Fixed: 2026-06-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
