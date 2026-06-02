---
phase: 22-troutdale-or-budget-load
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/extractTroutdale.py
  - scripts/loadORPopulation.js
  - scripts/processTroutdale.js
  - scripts/seedTroutdaleOregon.js
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four scripts were reviewed: a Python PDF extractor (`extractTroutdale.py`), a Census population loader (`loadORPopulation.js`), a budget tree loader (`processTroutdale.js`), and a municipality seeder (`seedTroutdaleOregon.js`). The overall structure is sound and is a close, consistent port of the Gresham/Portland patterns. One critical bug was found in the null/undefined fiscal-year fallback merging logic. Several warnings involve silently swallowed DB errors that could produce duplicate rows or misleading exit messages, plus a socket leak on HTTP redirect. Three informational items address code clarity.

---

## Critical Issues

### CR-01: Silent data loss when both `null` and `undefined` FY keys exist in fyMap

**File:** `scripts/processTroutdale.js:266-274`
**Issue:** The fiscal-year fallback block handles both `null` and `undefined` keyed rows, but the merge is wrong when both keys are present simultaneously. `fyMap.get(null) || fyMap.get(undefined)` short-circuits: if `fyMap.get(null)` is a non-empty array (truthy), the `undefined` rows are deleted at line 271 but never merged into the inferred key. Those rows are silently dropped.

While the Python extractor always emits `fiscal_year` as either an integer or `null` (never absent), and JS JSON.parse maps Python `null` to JS `null` only (never `undefined`), making the practical trigger path very narrow, the guard is logically broken and will silently eat rows if the extractor ever changes to omit the field.

```js
// Current (broken when both keys exist):
const nullRows = fyMap.get(null) || fyMap.get(undefined);
fyMap.delete(null);
fyMap.delete(undefined);
fyMap.set(inferred, nullRows);   // undefined rows are gone

// Fix — merge both arrays:
const nullRows = [...(fyMap.get(null) ?? []), ...(fyMap.get(undefined) ?? [])];
fyMap.delete(null);
fyMap.delete(undefined);
if (nullRows.length > 0) fyMap.set(inferred, nullRows);
```

---

## Warnings

### WR-01: Supabase select error silently swallowed in `upsertDataSource` — can produce duplicate rows

**File:** `scripts/processTroutdale.js:182-189`
**Issue:** The `error` return from `.maybeSingle()` is not destructured and is silently discarded. If the lookup fails (network error, permission denied, schema routing issue), `existing` is `null/undefined` and the code falls through to an INSERT, potentially creating a duplicate `data_sources` row. The subsequent unique-key violation error is only printed, not re-thrown or exited, meaning the run continues in a partially broken state.

```js
// Current:
const { data: existing } = await supabase.schema('treasury')
  .from('data_sources')
  ...
  .maybeSingle();

// Fix — propagate the error:
const { data: existing, error: selectErr } = await supabase.schema('treasury')
  .from('data_sources')
  ...
  .maybeSingle();
if (selectErr) {
  console.error('  data_source lookup error:', selectErr.message);
  return null;  // caller at line 206 handles null ds
}
```

### WR-02: `ensureMunicipality` discards Supabase error — misleading exit message on DB failure

**File:** `scripts/processTroutdale.js:152-167`
**Issue:** The `error` return from `.maybeSingle()` is silently discarded. If the query fails (e.g., wrong schema, network error), `existing` is `null` and the code exits with `"Troutdale, OR municipality not found — run seedTroutdaleOregon.js first"` — a misleading message that sends the operator chasing a seeder problem when the real issue is a DB connection failure.

```js
// Fix:
const { data: existing, error: selectErr } = await supabase.schema('treasury')
  .from('municipalities')
  .select('id, name')
  .eq('name', 'Troutdale')
  .eq('state', 'OR')
  .maybeSingle();

if (selectErr) {
  console.error('  ERROR querying municipalities:', selectErr.message);
  process.exit(2);
}
```

### WR-03: HTTP redirect in `downloadFile` leaks socket by not draining the redirect response body

**File:** `scripts/loadORPopulation.js:34-36`
**Issue:** When a 3xx redirect is received, `file.close()` is called and a recursive `downloadFile` is initiated — but `res.resume()` is never called on the redirected response. Node.js HTTP keeps the socket alive until the response body is consumed; skipping `res.resume()` causes the socket to remain open and the underlying TCP connection to hang until GC finalizes it. For a one-shot script this is tolerable but can cause the process to take an extra few seconds to exit, and in unusual environments (many redirects, slow GC) may exhaust the socket pool.

```js
// Current:
if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
  file.close();
  return downloadFile(res.headers.location, dest).then(resolve, reject);
}

// Fix — drain the redirect response first:
if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
  file.close();
  res.resume();   // drain the (empty) redirect body, release the socket
  return downloadFile(res.headers.location, dest).then(resolve, reject);
}
```

### WR-04: `KNOWN_VALUES` sanity check silently passes (NaN comparison) when a city is absent from the map

**File:** `scripts/loadORPopulation.js:96-101`
**Issue:** The sanity check iterates `KNOWN_VALUES`, not `EXPECTED_CITIES`. If `cityMap.get(name)` returns `undefined` (city not found), `Math.abs(undefined - expected)` evaluates to `NaN`, and `NaN > 0.01` is `false` — so the sanity check silently succeeds for the missing entry. The preceding `missing` guard (line 89) only covers `EXPECTED_CITIES`. If `KNOWN_VALUES` and `EXPECTED_CITIES` ever diverge, a broken value could pass undetected.

```js
// Fix — guard for undefined before comparison:
for (const [name, expected] of Object.entries(KNOWN_VALUES)) {
  const actual = cityMap.get(name);
  if (actual === undefined) {
    console.warn(`WARNING: ${name} not in cityMap — cannot verify known value`);
    continue;
  }
  if (Math.abs(actual - expected) / expected > 0.01) {
    console.warn(`WARNING: ${name} population drift: got ${actual}, expected ~${expected} (>1% deviation)`);
  }
}
```

---

## Info

### IN-01: Stale `~17,000` estimate in JSDoc comment contradicts code

**File:** `scripts/seedTroutdaleOregon.js:19`
**Issue:** The JSDoc says `"NOTE: ~17,000 is an estimate; actual Census 2024 figure is 15,749."` The comment references an old estimate that no longer appears anywhere in the code. The sentence is confusing — it implies something in the file still uses `~17,000`, which is not true. The code correctly uses `15749`.

```js
// Fix — remove the stale estimate reference:
 * Population source: Census sub-est2024_41.csv, SUMLEV=162, "Troutdale city" (2024) → 15,749
```

### IN-02: OCR fragment detection regex is asymmetric between `extract_budget` and `extract_revenue`

**File:** `scripts/extractTroutdale.py:174-178` and `296-299`
**Issue:** `extract_budget` detects a split number using `re.match(r'^\d{3,}', num_tokens[-1])` (last token starts with 3+ digits). `extract_revenue` uses `re.match(r'^\d{1,3},', num_tokens[-1])` (last token starts with 1–3 digits followed by comma). These patterns are intentionally different (revenue PDF likely has different OCR artifacts) but the difference is undocumented. If the budget pattern were applied to a revenue row like `1,234,567`, the check `^\d{3,}` would not match `1,` and the fragment would be missed. `parse_money` would still produce the correct value for the non-concatenated token — so there is no data corruption — but the inconsistency is a maintenance hazard and should be documented.

**Fix:** Add a comment in `extract_revenue` explaining why the pattern differs from `extract_budget`.

### IN-03: `SANITY_MAX` only covers FY2026; older fiscal years are not sanity-checked

**File:** `scripts/processTroutdale.js:105`
**Issue:** `const SANITY_MAX = { 2026: 30_000_000 }` — FY2019–FY2025 PDFs have no cap. If the extractor mistakenly doubles-counts a subtotal for those years, the load proceeds silently. This is consistent with the Gresham pattern but worth noting since the Troutdale budget grows year-over-year and future FY entries will also need to be added.

**Fix:** Extend with caps for each loaded FY (approximate values acceptable):
```js
const SANITY_MAX = {
  2019: 15_000_000, 2020: 15_000_000, 2021: 18_000_000,
  2022: 18_000_000, 2023: 20_000_000, 2024: 22_000_000,
  2025: 25_000_000, 2026: 30_000_000,
};
```

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
