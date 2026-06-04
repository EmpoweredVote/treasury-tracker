---
phase: 27-carry-forwards-longview-tx-revenue-state-labels
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - scripts/.enrichment-progress.json
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

One machine-generated file was reviewed: `scripts/.enrichment-progress.json`, the resume-checkpoint written by `enrichCategories.js` after the Longview, TX enrichment run for this phase.

The file contains no credentials, PII, tokens, or other sensitive data. The `failed` array is empty, confirming a clean run. Two correctness concerns were identified in the checkpoint data that reflect underlying script behavior: duplicate progress keys caused by multi-budget name collisions, and a misspelled category name key that propagates into the enrichment DB table.

The `enrichCategories.js` source was read for context to evaluate whether the JSON content is consistent with the script's expected behavior.

---

## Warnings

### WR-01: Duplicate progress keys — same category name across multiple budgets overwrites DB enrichment silently

**File:** `scripts/.enrichment-progress.json:12,28,33-36` (and corresponding lines in `scripts/enrichCategories.js:387`)

**Issue:** Five category names appear twice in the `processed` array, each under the same `municipality_id`:

- `animal services` (lines 12 and 33)
- `city secretary` (lines 28 and 34)
- `municipal court` (lines 15 and 35)
- `library` (lines 13 and 36)
- `recreation` (lines 10 and 41)

This happens because a municipality can have multiple budgets for the same fiscal year (e.g., an expenditure budget and a revenue budget), and the progress key is `{municipality_id}::{name_key}` — it does not encode `budget_id`. On the first pass both budget rows pass the `progress.processed.includes(key)` guard (neither is in the list yet), so both are sent to Claude and both call `saveEnrichment`. Because `saveEnrichment` upserts on `(name_key, municipality_id)` the second call silently overwrites the first result with a different enrichment generated from different line-item/vendor context (revenue-side vs. expense-side). The enrichment stored for `library`, `recreation`, etc. may therefore reflect whichever budget happened to be processed last in the concurrent batch rather than the more informative one.

**Fix:** Include `budget_id` or `dataset_type` in the progress key so each budget's version is tracked independently, and decide at the `saveEnrichment` level whether to upsert or skip when a municipal enrichment already exists for the key:

```js
// enrichCategories.js — processMunicipality, inside processor()
const progressKey = `${municipality.id}::${cat.budget_id}::${nameKey}`;
// (and in the skip-check earlier in the loop)
if (progress.processed.includes(`${municipality.id}::${cat.budget_id}::${key}`)) continue;
```

Alternatively, add a `dataset_type` discriminator to the `category_enrichment` unique constraint so revenue and expense enrichments can coexist without overwriting each other.

---

### WR-02: Misspelled category name key persisted in enrichment DB

**File:** `scripts/.enrichment-progress.json:5`

**Issue:** The progress key `75c90200-418f-4e52-aede-5e221b9e50ad::fire suppresion` contains a typo (`suppresion` instead of `suppression`). This key is derived verbatim from `budget_categories.name` via `normalize()`. Because `saveEnrichment` uses `normalize(cat.name)` as `name_key`, the corresponding row in `treasury.category_enrichment` is stored under the misspelled key `fire suppresion`. Any future lookup that uses the correctly-spelled key `fire suppression` will miss the enrichment and trigger a redundant AI call.

**Fix:** Either correct the `budget_categories.name` value at the source (UPDATE the DB row) so the key normalizes correctly, or add a name-normalization/alias layer in the enrichment lookup path. If the DB value is corrected, also delete the misspelled enrichment row and reset the progress entry so a clean enrichment is generated under the correct key.

---

## Info

### IN-01: Progress file grows unboundedly with duplicate entries across runs

**File:** `scripts/.enrichment-progress.json:2-43`

**Issue:** The `processed` array is append-only and never deduplicated. Each run appends new keys. Duplicate entries (see WR-01) additionally inflate the array. For small single-city runs this is harmless, but for large `--all` runs over hundreds of municipalities the file will accumulate thousands of entries including duplicates, making the `Array.includes()` linear scan increasingly slow with each resumed run.

**Fix:** Deduplicate on load or switch `processed` to a JSON object/Set structure. A simple fix at the top of `processMunicipality` after progress is loaded:

```js
// loadProgress() or at start of main()
progress.processed = [...new Set(progress.processed)];
```

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
