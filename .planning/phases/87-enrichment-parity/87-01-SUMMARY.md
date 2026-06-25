---
phase: 87-enrichment-parity
plan: "01"
subsystem: enrichment
tags: [ohio, enrichment, category-enrichment, universal-rows, parity]
dependency_graph:
  requires: [85-city-loads, 86-county-loads-data-model-linking]
  provides: [OHENR-01]
  affects: [treasury.category_enrichment]
tech_stack:
  added: []
  patterns: [explicit-hand-authored-map, coverage-gate, delete-then-insert, locality-leak-guard]
key_files:
  created:
    - data/ohioEnrichment87.mjs
    - scripts/loadOhioEnrichment87.mjs
    - scripts/loadOhioEnrichment87.test.mjs
    - data/ohio-enrichment-87.expanded.json
  modified:
    - .gitignore
decisions:
  - "51 distinct keys (not 52): 'intergovernmental' is shared between revenue and operating trees — one map entry covers both; coverage gate confirms the live DB also has 51 distinct keys"
  - "Skip-set extends 87-CONTEXT baseline with additional common-English Ohio municipality names (hamilton, warren, fairfield, etc.) to prevent false-positive locality-leak failures"
  - "Gitignore exceptions added for ohioEnrichment87.mjs + ohio-enrichment-87.expanded.json, mirroring vaEnrichment82 pattern"
metrics:
  duration: "~11 minutes"
  completed: "2026-06-25T18:48:42Z"
  tasks_completed: 3
  files_changed: 5
---

# Phase 87 Plan 01: Ohio Enrichment Parity Summary

Inline-authored, state-neutral Ohio enrichment map (51 keys) loaded as universal `category_enrichment` rows via delete-then-insert with 100% coverage gate and locality/dollar leak guards.

## What Was Built

**Task 1 — `data/ohioEnrichment87.mjs`**

51 state-neutral, entity-neutral, bleed-safe enrichment entries covering the full Ohio category vocabulary (17 revenue + 35 operating, depth-0 only — Ohio trees are flat). Each entry has `plain_name`, `short_description`, `description`, `tags`, and `confidence`. Key notes:
- `intergovernmental` is shared between revenue and operating trees in Ohio; one map entry covers both contexts (the live DB has 51 distinct name_keys, not 52)
- Synonym-cluster entries (in-lieu taxes, debt service variants, security-of-persons-and-property variants) all have their own rows with near-identical but individually correct text
- No dollar figures, no locality names, no Ohio-specific facts in any description

**Task 2 — `scripts/loadOhioEnrichment87.mjs` + `scripts/loadOhioEnrichment87.test.mjs`**

Loader mirrors VA Phase 82 exactly (swap map contents, state filter `OH`, depth-0-only key derivation). Exports pure helpers `buildRows`, `findDollarLeaks`, `findLocalityLeaks` for offline tests. Entry-script guard prevents DB access on import. 10 offline tests all pass: coverage gate fires on unknown keys, leak guards catch planted dollar figures and locality names, skip-set correctly excludes common-English Ohio municipality names.

**Task 3 — Dry-run + live apply + verification**

Dry-run output:
- 341 OH city+county entities, 6,616 budgets
- 51 live distinct keys (operating d0=35, revenue d0=17)
- 0 missing, 0 stale, 0 $-leaks, 0 locality-leaks, 0 writes

Live apply: delete-then-insert wrote exactly 51 universal `category_enrichment` rows. Post-apply verification: 51 rows, 0 duplicates. Idempotency confirmed: re-run still 51 rows, 0 duplicates. Spot-checked rows (`police`, `sales taxes`, `human services`, `income taxes`, `property taxes`, `intergovernmental`, `transportation`) are all state-neutral and dollar-free.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 'intergovernmental' key-count discrepancy (52 → 51 distinct keys)**
- **Found during:** Task 1 authoring
- **Issue:** The plan and 87-CONTEXT both say "52 keys" (17 revenue + 35 operating). However, `intergovernmental` appears in BOTH the revenue and operating lists. In a JavaScript object literal, duplicate keys are silently overwritten. The live DB also surfaces exactly 51 distinct name_keys (confirmed by dry-run: `op d0=35 | rev d0=17 | total distinct=51`).
- **Fix:** Authored a single `intergovernmental` entry in `OHIO_ENRICHMENT` whose description covers both the revenue context (payments received from other governments) and the expenditure context (payments made to other governments). EXPECTED_KEYS correctly has 51 entries matching the live DB.
- **Files modified:** `data/ohioEnrichment87.mjs`
- **Impact:** None — coverage gate confirms 0 missing keys with 51 entries. Acceptance criteria met.

**2. [Rule 2 - Missing functionality] Gitignore exception required for new data files**
- **Found during:** Task 1 commit
- **Issue:** `/data/*` gitignores the entire data/ directory. Without an explicit exception, `data/ohioEnrichment87.mjs` and `data/ohio-enrichment-87.expanded.json` would not be tracked.
- **Fix:** Added `!/data/ohioEnrichment87.mjs` and `!/data/ohio-enrichment-87.expanded.json` exceptions to `.gitignore`, mirroring the `vaEnrichment82` pattern already in the file.
- **Files modified:** `.gitignore`

**3. [Rule 2 - Missing functionality] Skip-set extended beyond CONTEXT baseline**
- **Found during:** Task 2 implementation
- **Issue:** 87-CONTEXT listed a baseline skip-set of common-English Ohio municipality names but noted "extend as needed." Ohio has many municipalities named after common English words (Hamilton, Warren, Fairfield, Washington, etc.) that appear in legitimate civic descriptions.
- **Fix:** Extended the `GUARD_NAME_SKIP` set in the loader to include additional common-word names (hamilton, warren, madison, harrison, monroe, jackson, washington, clark, butler, highland, fairfield, athens, gallia, grove city, etc.), preventing false-positive locality-leak failures.
- **Files modified:** `scripts/loadOhioEnrichment87.mjs`

## Self-Check

**Created files exist:**
- `data/ohioEnrichment87.mjs` — FOUND
- `scripts/loadOhioEnrichment87.mjs` — FOUND
- `scripts/loadOhioEnrichment87.test.mjs` — FOUND
- `data/ohio-enrichment-87.expanded.json` — FOUND

**Commits exist:**
- `5728c3f` feat(87-01): author Ohio enrichment map — 51 state-neutral keys + EXPECTED_KEYS
- `9cfa2e7` feat(87-01): Ohio enrichment loader + offline tests (mirror VA 82)
- `a5935ad` feat(87-01): apply Ohio enrichment — 51 universal rows live, dry-run + apply verified

**Verification:**
- `node --test scripts/loadOhioEnrichment87.test.mjs` → 10/10 pass
- Dry-run: 51 live keys, 0 missing, 0 leaks, 0 writes
- After `--apply`: 51 universal rows, 0 duplicates
- Idempotency: re-run still 51 rows, 0 duplicates
- Spot-checks: police, sales taxes, human services, income taxes, property taxes, intergovernmental, transportation — all state-neutral, dollar-free

## Self-Check: PASSED
