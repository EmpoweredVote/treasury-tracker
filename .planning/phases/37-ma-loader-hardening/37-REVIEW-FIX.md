---
phase: 37-ma-loader-hardening
fixed_at: 2026-06-10T00:00:00Z
review_path: .planning/phases/37-ma-loader-hardening/37-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 37: Code Review Fix Report

**Fixed at:** 2026-06-10
**Source review:** .planning/phases/37-ma-loader-hardening/37-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — Critical and Warning only; IN-01, IN-02 excluded per fix_scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-03: Hardcoded Supabase project URL

**Files modified:** `scripts/scrapeMaDLS.js`
**Commit:** 07654ef
**Applied fix:** Removed the hardcoded production project URL (`https://kxsdzaojfaibhuzmclfq.supabase.co`) from the `SUPABASE_URL` fallback. `SUPABASE_URL` is now read directly from `process.env.SUPABASE_URL` with no fallback. Added a fail-loud guard: if `SUPABASE_KEY` is present but `SUPABASE_URL` is absent, the script logs `Missing SUPABASE_URL env var` and exits with code 1 rather than silently targeting production.

---

### WR-01: `maybeSingle()` error silently discarded

**Files modified:** `scripts/scrapeMaDLS.js`
**Commit:** b44f965
**Applied fix:** Added `error: dsLookupErr` to the destructuring of the `data_sources` existence-check query at the `maybeSingle()` call. Added an immediate `if (dsLookupErr)` guard that logs the error message and does `skipped++; continue` — so a query failure (network timeout, RLS denial, etc.) is reported clearly and the city is skipped without falling through to the INSERT path with a misleading null `existingDs`.

---

### WR-02: Zero-amount records create un-checkpointed data_source rows

**Files modified:** `scripts/scrapeMaDLS.js`
**Commit:** 592481a
**Applied fix:** Expanded the `if (tree.length === 0)` single-line guard into a block that writes the DOR code to the progress checkpoint (`alreadyLoaded.add` / `progress[progressKey]` / `writeProgress`) before doing `skipped++; continue`. This mirrors the same checkpoint-write pattern used on the successful-load path (lines 682-684). Zero-amount cities are now recorded in `ma_dls_progress.json` on first encounter and will be skipped on all subsequent runs instead of re-querying `data_sources` every time.

---

_Fixed: 2026-06-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
