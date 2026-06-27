---
phase: 92-enrichment-parity-mnenr-01
reviewed: 2026-06-27T23:30:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - data/mnEnrichment92.mjs
  - scripts/loadMNEnrichment92.mjs
  - scripts/loadMNEnrichment92.test.mjs
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 92: Code Review Report

**Reviewed:** 2026-06-27T23:30:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files reviewed: the hand-authored CONCEPTS map (`data/mnEnrichment92.mjs`), the loader (`scripts/loadMNEnrichment92.mjs`), and the offline test suite (`scripts/loadMNEnrichment92.test.mjs`). Compared against the established Ohio Phase 87 analog (`scripts/loadOhioEnrichment87.mjs`).

The critical design requirements are satisfied: no upsert (delete-then-insert path confirmed), coverage gate aborts on any unmapped live key, both leak guards are present and correct, the live worklist is paginated past the 1000-row cap, `main()` is entry-guarded, and no hardcoded secrets or API calls exist. All 136 live MN composite keys are covered and the dry-run/apply verified clean.

Two warnings and three info items follow.

---

## Warnings

### WR-01: Eight dead CONCEPTS entries — not mapped to any live key

**File:** `data/mnEnrichment92.mjs:337,385,391,409,417,553,757,1005`
**Issue:** The CONCEPTS map contains 115 entries but only 107 distinct last-segments appear across the 136 live keys. Eight concepts are authored but never referenced by the coverage gate or any live row:

```
state attached machinery aid
state criminal justice aid
state highway grants
statelpa
statehaca
tnwatercharge
general government capital outlay
tnwaterco
```

The expanded artifact (`data/mn-enrichment-92.expanded.json`) confirms these keys produce no rows. This is not a runtime failure — dead map entries are silently ignored — but it creates an ongoing maintenance risk. If a future MN dataset update adds one of these keys live, operators may not realize the concept already exists; conversely, if the text is stale or wrong, it will never be guarded.

The Ohio loader mitigates this with a `stale` counter printed during the run (keys in map but not live): `const stale = EXPECTED_KEYS.filter(k => !liveKeys.includes(k))`. The MN loader omits this stale-key diagnostic entirely.

**Fix:** Either (a) add a stale-concept diagnostic to the MN loader — analogous to the Ohio stale-key check — to make dead entries visible at dry-run time:
```js
const staleConcepts = Object.keys(CONCEPTS).filter(
  seg => !liveKeys.some(k => lastSegment(k) === seg)
);
if (staleConcepts.length)
  console.log('stale concepts (in map, no live key resolves to them):', staleConcepts.join(', '));
```
Or (b) remove the eight unused concepts from the map. Option (a) is preferred if these keys may appear in future MN data loads; option (b) is preferred if they are confirmed to not exist in the OSA vocabulary.

---

### WR-02: Tautological test assertion — name_key composite check tests nothing

**File:** `scripts/loadMNEnrichment92.test.mjs:215`
**Issue:** The assertion on line 215 inside the `'every built row is a universal AI row with required fields'` test is:
```js
assert.equal(r.name_key, r.name_key, 'name_key is the full composite');
```
This is a tautology — a variable compared to itself. It always passes regardless of `r.name_key`'s value and provides zero coverage of the stated intent ("name_key is the full composite"). The real check — that `name_key` equals the original live composite key — is done in the separate test at line 219, but even that test only verifies that the key exists in the LIVE_KEYS set, not that it equals the correct composite verbatim. The self-comparison on line 215 is dead test code.

**Fix:** Replace with a meaningful assertion, or remove it:
```js
// Verify name_key is the full composite (contains no truncation to last-segment)
assert.equal(r.name_key, LIVE_KEYS.find(k => k === r.name_key), 'name_key should equal the full composite live key');
// or more simply, rely on the dedicated test at line 219 and remove line 215 entirely
```

---

## Info

### IN-01: GUARD_NAME_SKIP contains two duplicate entries

**File:** `scripts/loadMNEnrichment92.mjs:80,171 ('island') and 67,173 ('bay')`
**Issue:** `'island'` and `'bay'` each appear twice in the `GUARD_NAME_SKIP` array literal. `new Set([...])` silently deduplicates, so there is no runtime impact, but the duplicate entries inflate the list and create confusion during future maintenance.
**Fix:** Remove the second occurrence of each: line 171 (`'island'`) and line 173 (`'bay'`).

---

### IN-02: Relative paths for artifact write are CWD-dependent

**File:** `scripts/loadMNEnrichment92.mjs:325-326`
**Issue:** `mkdirSync('data', ...)` and `writeFileSync('data/mn-enrichment-92.expanded.json', ...)` use relative paths. The expanded artifact is written to wherever `process.cwd()` resolves at runtime. If the loader is ever invoked from a subdirectory (e.g. `node scripts/loadMNEnrichment92.mjs` from inside `scripts/`), the file lands in `scripts/data/` instead of `data/`. This is the same pattern as the Ohio loader, so it is an accepted project convention — but worth noting for future loaders.
**Fix (optional):** Use `path.resolve(__dirname || new URL('..', import.meta.url).pathname, 'data')` for an import-relative path, or document that the loader must be run from the project root.

---

### IN-03: `statelpa` and `statehaca` have `confidence: 'medium'` with no evidence note

**File:** `data/mnEnrichment92.mjs:414,422`
**Issue:** These two concepts carry `confidence: 'medium'` with no inline comment explaining why. `statelpa` describes a program that may be a historical/legacy aid; `statehaca` explicitly calls itself a "legacy program." The reduced confidence is appropriate, but readers of the map have no documentation of why confidence was lowered — and, per WR-01, these concepts are currently dead (no live key resolves to them), so the risk is low. A brief inline comment aids future authors maintaining the map.
**Fix (optional):** Add a comment such as `// confidence medium: legacy program, may not be live in current OSA data` adjacent to each entry.

---

_Reviewed: 2026-06-27T23:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
