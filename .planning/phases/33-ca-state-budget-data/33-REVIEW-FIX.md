---
phase: 33-ca-state-budget-data
fixed_at: 2026-06-07T00:00:00Z
review_path: .planning/phases/33-ca-state-budget-data/33-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 33: Code Review Fix Report

**Fixed at:** 2026-06-07T00:00:00Z
**Source review:** .planning/phases/33-ca-state-budget-data/33-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical, 4 Warning; 3 Info items out of scope)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: `enrichCategories.js` falls back to anon key

**Files modified:** `scripts/enrichCategories.js`
**Commit:** 3bed79d
**Applied fix:** Replaced `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY` fallback with a direct assignment of `SUPABASE_SERVICE_ROLE_KEY` only. Added a fail-fast `if (!SUPABASE_KEY)` guard that exits with a clear error before any clients are created, preventing silent RLS write failures and wasted Anthropic API budget.

---

### CR-02: `fy_to_int` century arithmetic bug in `extractCA.py`

**Files modified:** `scripts/extractCA.py`
**Commit:** d32ab37
**Applied fix:** Rewrote `fy_to_int` to detect century rollover by comparing `end_two < start_two` and advancing `century += 100` when needed (e.g. `'2099-00'` now correctly yields 2100, not 2000). Also added a length check on the suffix — single-digit suffixes like `'2025-6'` now return `None` instead of silently producing a wrong year. All assertions for normal, century-rollover, decade-boundary, malformed, and empty inputs pass.

---

### WR-01: `enrichCategories.js` `.env.local` overwrites shell-set env vars

**Files modified:** `scripts/enrichCategories.js`
**Commit:** 2edc6f1
**Applied fix:** Added `!process.env[k.trim()]` guard to the `.env.local` loader block (line 41), matching the existing guard in the `.env` block below it and the pattern used in `seedCAState.js`. Shell-set vars now correctly take precedence over file vars in both blocks.

---

### WR-02: `enrichCategories.js` missing `--state` guard in single-city mode

**Files modified:** `scripts/enrichCategories.js`
**Commit:** 73f2589
**Applied fix:** Changed the arg-validation condition from `!ALL_MODE && !CITY` to `!ALL_MODE && (!CITY || !STATE)`. Omitting `--state` in single-city mode now exits immediately with the usage message instead of reaching `getMunicipality(city, null)` which would produce a misleading "Municipality not found: Dallas, null" error.

---

### WR-03: State entity in "Your City" preloaded card in `AlphaLanding.tsx`

**Files modified:** `src/components/AlphaLanding.tsx`
**Commit:** 70880ac
**Applied fix:** Added `m.entity_type !== 'state'` as the first condition in the `available.find()` call inside the `preloadedCity` useMemo. Users with California addresses (e.g. "California City, CA") will no longer have the state entity matched as their preloaded city. Matches the guard already in place in `CityGrid` for the "Near you" section.

---

### WR-04: `processCA.js` `extractExcel` stderr not captured

**Files modified:** `scripts/processCA.js`
**Commit:** 7adc909
**Applied fix:** Split `extractExcel` into two code paths. Non-dry-run: wraps `execSync` in a try/catch with `stdio: ['pipe', 'pipe', 'pipe']`; on Python failure, surfaces `err.stderr` and `err.stdout` explicitly before calling `process.exit(3)`. Dry-run: keeps the original passthrough behavior (stderr flows to parent) so FY summaries remain visible to the operator, but also wraps in try/catch to surface Python errors in that path too.

---

## Skipped Issues

None — all 6 in-scope findings were successfully fixed.

---

_Fixed: 2026-06-07T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
