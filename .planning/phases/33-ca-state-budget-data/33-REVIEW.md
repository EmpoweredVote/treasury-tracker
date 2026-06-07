---
phase: 33-ca-state-budget-data
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/seedCAState.js
  - scripts/extractCA.py
  - scripts/processCA.js
  - scripts/enrichCategories.js
  - src/components/AlphaLanding.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-06-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed: two data-pipeline scripts that seed and load the California state budget (`seedCAState.js`, `processCA.js`), a Python extractor (`extractCA.py`), the shared category enrichment pipeline (`enrichCategories.js`), and the AlphaLanding UI component (`AlphaLanding.tsx`).

The pipeline scripts are generally solid — the sanity band, x1000 multiplier, idempotent upserts, and worktree-path fallback are all correct. Two critical defects were found: (1) `enrichCategories.js` silently falls back to the anon key when the service-role key is absent, which means enrichment writes can fail at the RLS layer at runtime without a clear error, and (2) `fy_to_int` in `extractCA.py` can produce silently wrong fiscal-year integers for two-digit suffixes that cross a century boundary (e.g., `'2099-00'` → 2000, not 2100). Both are data-correctness risks. Four warnings cover an `.env.local` overwrite bug in `enrichCategories.js`, a missing `--state` validation in single-city mode, a `preloadedCity` cookie-match that will never match a state entity, and a state entity appearing in the "Your City" preloaded card when the user's saved address is a state-level row. Three info items cover minor issues.

---

## Critical Issues

### CR-01: `enrichCategories.js` falls back to anon key — writes silently fail at RLS

**File:** `scripts/enrichCategories.js:85`
**Issue:** `SUPABASE_KEY` is resolved as `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY`. If `SUPABASE_SERVICE_ROLE_KEY` is absent (e.g., env file not loaded, typo in var name), the script silently continues with the anon key. The anon key does not bypass Row Level Security. Any `upsert` to `treasury.category_enrichment` will fail with an RLS violation, but the error surfaces only per-category as a thrown `Error`, and each failed category is merely logged as `FAIL`. The script exits 0. The operator sees a successful-looking run; no enrichment was stored. The fallback to anon is also a security concern because an operator running with only the anon key still gets a Supabase client object and proceeds to load prompt context, consuming Anthropic API budget.

**Fix:**
```javascript
// Replace line 85:
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  // Do NOT fall back to anon — anon key bypasses nothing and will fail RLS writes
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY (service key required for enrichment writes)');
  process.exit(1);
}
```

---

### CR-02: `fy_to_int` century arithmetic silently produces wrong years for cross-century FY strings

**File:** `scripts/extractCA.py:59-62`
**Issue:** The function parses `'2025-26'` by extracting `century = (int('2025') // 100) * 100 = 2000` and adding `int('26')` → 2026. That is correct for all current LAO data. However, the two-digit suffix is taken literally: a FY string like `'2099-00'` would yield `2000 + 0 = 2000` (off by 100 years), and `'2029-30'` would yield `2000 + 30 = 2030` rather than `2030` — that one happens to be correct only by coincidence since `2000 + 30 == 2030`. The dangerous case is any FY where the two-digit ending year is less than the two-digit starting suffix, i.e., a year that rolls over a decade boundary like `'2029-30'` is fine but `'2099-00'` is silently wrong and would pass all downstream checks. While today's data only goes to FY2025-26 this code will outlive the current dataset; locking in a broken invariant here creates a silent data-quality risk when the script is reused for future years. Additionally, if the LAO ever emits a malformed string like `'2025-6'` (single digit), `int('6')` returns `6`, producing `2006` rather than `2026` — no error is raised.

**Fix:**
```python
def fy_to_int(fy_str):
    """'2025-26' -> 2026 (ending calendar year)"""
    if not fy_str:
        return None
    parts = fy_str.split('-')
    if len(parts) != 2:
        return None
    try:
        start_year = int(parts[0])
        end_suffix = parts[1].strip()
        if len(end_suffix) != 2:
            return None  # reject malformed input like '2025-6'
        end_two = int(end_suffix)
        # Reconstruct full ending year: same century as start_year,
        # but advance century if the two-digit suffix is less than the
        # last two digits of start_year (century rollover).
        start_two = start_year % 100
        century = (start_year // 100) * 100
        if end_two < start_two:
            century += 100  # e.g. 2099-00 → 2100 + 0 = 2100
        return century + end_two
    except (ValueError, TypeError):
        return None
```

---

## Warnings

### WR-01: `enrichCategories.js` `.env.local` overwrite — previously set env vars are clobbered

**File:** `scripts/enrichCategories.js:38-44`
**Issue:** The first `loadEnv` block (`.env.local`) unconditionally sets `process.env[k.trim()] = v.join('=').trim()` at line 41, overwriting any key already present in the environment. This means that if the operator sets `SUPABASE_SERVICE_ROLE_KEY` in their shell before running the script (the normal pattern in CI/CD), the value from `.env.local` silently replaces it. The second block (`.env`) correctly guards with `!process.env[k.trim()]`, so the inconsistency is intentional within that function — but the first block's overwrite behaviour contradicts the operator's expectation and differs from every other script in this codebase (compare `seedCAState.js:44` which guards both blocks). This is the opposite of the documented behaviour: operators expect shell-set vars to take precedence over file vars.

**Fix:**
```javascript
// Line 41 — add the !process.env guard (matching the .env block below it):
if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
```

---

### WR-02: `enrichCategories.js` missing `--state` guard in single-city mode allows `getMunicipality(CITY, null)`

**File:** `scripts/enrichCategories.js:78-82`
**Issue:** The arg validation at line 78 rejects the absence of `--city` but does not validate that `--state` is also provided when in single-city mode. If the operator omits `--state`, `STATE` is `null`. `getMunicipality(city, null)` calls `.eq('state', null)` on Supabase, which in PostgREST translates to `state = NULL` (always false), not `state IS NULL`. The query returns no rows and throws `Municipality not found: <city>, null` — but only after the script has already loaded env vars, created the Supabase and Anthropic clients, and potentially loaded universal enrichments. The error message `Municipality not found: Dallas, null` gives no hint that `--state` was missing. The fix is to also validate `STATE` at the same guard.

**Fix:**
```javascript
if (!ALL_MODE && (!CITY || !STATE)) {
  console.error('Usage: --city "Name" --state "IN" OR --all [--state IN] [--entity-type city|township|county]');
  process.exit(1);
}
```

---

### WR-03: `AlphaLanding.tsx` — state entity can appear in "Your City" preloaded card

**File:** `src/components/AlphaLanding.tsx:245-254`
**Issue:** `preloadedCity` is derived from the cookie address by matching any municipality whose `.name` is contained in the user's address string and whose `.state` matches the cookie state. California's state entity has `name = 'California'` and `state = 'CA'`. Any user with a California address cookie containing the substring `"california"` (e.g., an address in `"California City, CA"` or a raw address string like `"123 Main St, California"`) would have `preloadedCity` resolve to the California state entity. The preloaded card then shows "Your City" with `California, CA` and a "Go to California" hero button, which is incorrect UX — the state budget is not the user's city budget. The `CityGrid` component already excludes state entities from "Near you" (line 148), but the preloaded-city logic in the parent component has no such guard.

**Fix:**
```typescript
// In the useMemo for preloadedCity (line 249), add entity_type guard:
const match = available.find(m =>
  m.entity_type !== 'state' &&     // exclude state entities from city preload
  m.state === userAddress.state &&
  addrLower.includes(m.name.toLowerCase())
);
```

---

### WR-04: `processCA.js` — `extractExcel` stderr output from Python not captured; dry-run summary silently discarded

**File:** `scripts/processCA.js:102-108`
**Issue:** `execSync` is called with `encoding: 'utf8'` but no `stdio` option, so stdout is returned as the function result and stderr flows through to the parent process's stderr. This is intentional for dry-run (the Python script writes FY summaries to stderr). However, when **not** in dry-run mode, if Python prints warnings to stderr (e.g., openpyxl cell-format warnings, or a partial write when the workbook is large), those messages intermix with the node process output with no labeling. More critically, if Python exits non-zero (e.g., the XLSX file is missing), `execSync` throws a `SpawnSyncReturnsError` whose `.stderr` property contains the Python error message. The catch at the top level of `main()` will print `Fatal: <error object>` without surfacing the Python stderr. The operator will see a truncated error with no Python context.

**Fix:**
```javascript
// Capture stderr separately so it can be surfaced clearly on Python failure:
let raw;
try {
  raw = execSync(`${pythonBin} "${pyScript}" ${fyArgs}${dryFlag}`, {
    cwd: mainRoot,
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],  // capture stderr
  });
} catch (err) {
  console.error('Python extractor failed:');
  if (err.stderr) console.error(err.stderr);
  if (err.stdout) console.error('stdout:', err.stdout);
  process.exit(3);
}
if (dryRun) return [];
return JSON.parse(raw);
```

---

## Info

### IN-01: `enrichCategories.js` — progress file written inside `scripts/` directory

**File:** `scripts/enrichCategories.js:104`
**Issue:** `PROGRESS_FILE` is resolved to `scripts/.enrichment-progress.json`. This file contains municipality names, category names, and error messages from previous runs — it lives inside the `scripts/` source tree. If `.gitignore` does not exclude `scripts/.enrichment-progress.json`, incremental run state (including error messages referencing database IDs) could be accidentally committed. The file also grows unbounded across runs with no pruning.

**Fix:** Move progress file to a project-level temp or run-state directory (e.g., `.enrichment-state/progress.json`) and verify it is gitignored.

---

### IN-02: `seedCAState.js` — hardcoded Supabase project URL

**File:** `scripts/seedCAState.js:56`
**Issue:** `SUPABASE_URL` falls back to the hardcoded production URL `https://kxsdzaojfaibhuzmclfq.supabase.co`. This is a project-wide pattern (found in 50+ scripts), so it is not a new concern introduced here. Flagged for awareness: if a developer accidentally runs the seed script without setting the env var (e.g., in a fresh shell with no `.env.local`), it will write to production. The same pattern exists in `processCA.js:59`. No code change is needed unless the team decides to move to a fail-fast model — but worth noting at the script level.

**Fix:** Consider making `SUPABASE_URL` required (fail if not set) for production-targeting scripts, or add a prominent warning when the default is used.

---

### IN-03: `extractCA.py` — negative amounts pass through without warning

**File:** `scripts/extractCA.py:99-115`
**Issue:** The null-amount filter at line 100 checks `if not row[COLS['amount']]` which skips `None` and `0` but passes negative values. The LAO Excel can contain negative amounts for reversals or adjustments (e.g., inter-agency offsets). Negative amounts silently flow into `buildCATree` where they reduce agency totals. The sanity band in `processCA.js` will catch a total that falls below $150B, but it will not catch individual departments going negative due to large reversals. There is no log output indicating that negative rows were encountered.

**Fix:**
```python
# Add after the null-amount check (line 100):
if row[COLS['amount']] < 0:
    # Log but include — negative amounts are valid reversals/offsets in LAO data.
    # Change to `continue` here if reversals should be excluded.
    pass  # currently: include negatives (they reduce agency totals correctly)
```
At minimum, add a dry-run count of negative rows so operators can audit them.

---

_Reviewed: 2026-06-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
