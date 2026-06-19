---
phase: 71-utah-city-salaries-compensation
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/loadUtahTransparency.js
  - scripts/loadUtahTransparency.test.mjs
  - docs/utah-salaries-coverage.md
  - .gitignore
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 71: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 71 adds a names-free PY→salaries path to the Utah loader: a new aggregate
`SALARY_QUERY` (org1, cat1, SUM(amount)), a 2-level `buildSalaryTree`, a dataset-type
branch in `importEntityData`/`main`, and a PII-exclusion guard test. The whole
test suite (48 tests) passes.

The headline safety property — that no PII *column* is projected — holds for the
audited code paths. `SALARY_QUERY` projects only `org1`, `cat1`, `SUM(amount)`;
`buildSalaryTree` reads only `row.org1`, `row.cat1`, `row.amount` and emits a tree
with no `i`/`m` keys; the PII-laden fixture test confirms the serialized tree drops
all blocklisted columns and spot-checked values. SQL parameterization is correct
(`@entity`/`@fy`/`@type`, no string interpolation of user input — only the constant
`BQ_TABLE` identifier is templated). The never-overwrite guard for EX/RV is
structurally unchanged.

However, the PII guarantee has real residual gaps the guard does **not** cover, and
there is stale documentation that now actively misdescribes the code. No blockers.

## Warnings

### WR-01: Names-free guarantee rests on untested runtime row-mapping, not just the tree builder

**File:** `scripts/loadUtahTransparency.js:228-234`
**Issue:** The actual column projection that protects PII at runtime is the PY-branch
`rows.map((r) => ({ org1, cat1, amount, fiscal_year, type }))` inside
`fetchFromBigQuery`. This mapper is the real gate (it is what discards any extra
columns BigQuery returns), but it is on the network path and is **never executed by
any test**. The PII-exclusion guard instead tests (a) the static `SALARY_QUERY`
string and (b) `buildSalaryTree` with hand-built fixtures. A future edit that
loosened the mapper to e.g. `...r` (spread) or that added a column to the SELECT
would pass every existing test while leaking PII. The guard gives a false sense of
end-to-end coverage.
**Fix:** Extract the PY row-mapping into an exported pure function (e.g.
`projectSalaryRow(r)`) and assert in a test that, given a BigQuery-shaped row carrying
every PII key, the projected object contains exactly `{org1, cat1, amount, fiscal_year, type}`
and none of the blocklist keys:
```js
export function projectSalaryRow(r, fiscalYear, type) {
  return { org1: r.org1, cat1: r.cat1, amount: r.amount, fiscal_year: fiscalYear, type };
}
// test:
const projected = projectSalaryRow(PII_LADEN_FIXTURE[0], 2024, 'PY');
for (const k of PII_BLOCKLIST) assert.ok(!(k in projected));
```

### WR-02: No runtime assertion that org1/cat1 VALUES are labels, not names

**File:** `scripts/loadUtahTransparency.js:184-212` (and `docs/utah-salaries-coverage.md:10-22`)
**Issue:** The entire names-free guarantee is value-blind: it suppresses PII *column
names* but emits the literal *contents* of `org1` and `cat1` verbatim into the stored
tree. If any entity/FY in the live source places an individual's name (or other PII)
in the `org1` department string or `cat1` field — a known hazard in transaction-level
government data — the loader would publish it with no detection. The coverage doc
itself flags that some entities report org1 at varying granularity (Ogden/St. George
"single org1 department", lines 119-121, 220-222), confirming org1 content is
source-controlled and not validated. No test or runtime check can catch this because
the guard only inspects schema, never the data.
**Fix:** Add a lightweight runtime sanity check on emitted node names before the write
(e.g. reject/flag any `org1`/`cat1` value matching a person-name heuristic, or assert
`cat1` is in an expected small set like `{Wages, Benefits, General}` for PY and log a
warning otherwise). At minimum, document this residual risk explicitly in
`docs/utah-salaries-coverage.md` so it is an acknowledged, accepted assumption rather
than an unstated one. Per the project's federal ground rules, a public-record-only
safety line is expected; PY data needs the same explicit treatment.

### WR-03: Stale docstrings now contradict the implemented behavior

**File:** `scripts/loadUtahTransparency.js:16, 21-26, 109`
**Issue:** Multiple comments still describe PY as deferred/unimplemented after this
phase implemented it:
- Line 16: `type EX→operating, RV→revenue (PY→salaries deferred to Phase 71).`
- Lines 21-26: the file-header "Tree shape (D-69-01): three levels…" describes only
  the EX/RV tree and never mentions the new 2-level salary tree, so the header now
  under-describes the module's behavior.
- Line 109: `/** BigQuery type code → Treasury Tracker dataset_type. PY deferred to Phase 71. */`
  — directly contradicts the `case 'PY': return 'salaries'` immediately below it.

Stale comments that assert the opposite of the code mislead future maintainers and
reviewers (this is the kind of comment that causes someone to "restore" a skip).
**Fix:** Update line 16 to `PY→salaries (Phase 71)`, drop "PY deferred to Phase 71"
from line 109, and extend the header tree-shape note to describe the PY 2-level
`org1 → cat1` salary tree (D-71-02) alongside the EX/RV 3-level tree.

### WR-04: Test stub `typeToDataset` description is wrong/contradictory

**File:** `scripts/loadUtahTransparency.test.mjs:60, 65-66`
**Issue:** The test block header comment says `typeToDataset — EX/RV mapping (PY
deferred)` (line 60) and the PY case is labeled `'PY → salaries (mapped, but out of
scope this phase)'` (line 65). PY is in scope this phase and is fully wired — the test
description now lies about the feature's status, which weakens the test as
documentation and could mask a future regression where PY support is removed but the
"out of scope" label makes it look intentional.
**Fix:** Relabel to `PY → salaries (implemented Phase 71)` and update the block header
to `EX/RV/PY mapping`.

## Info

### IN-01: Redundant COALESCE + JS fallback for org1/cat1

**File:** `scripts/loadUtahTransparency.js:96, 192-193`
**Issue:** `SALARY_QUERY` already `COALESCE(org1,'General')`/`COALESCE(cat1,'General')`,
so `buildSalaryTree`'s `row.org1 || 'General'` / `row.cat1 || 'General'` fallbacks are
dead defenses for the live path (they only fire for hand-built fixtures). Not a bug,
but the double-defaulting obscures which layer owns the NULL contract. Note also a
latent collision: a real department literally named `General` and a NULL-org1 group
would merge into one node — acceptable here but worth a one-line comment.
**Fix:** Keep the JS fallback (it guards the pure-function contract) but add a comment
noting the query already coalesces, so the JS branch is fixture-only insurance.

### IN-02: `isPY` banner flag is cosmetic and slightly misleading for mixed runs

**File:** `scripts/loadUtahTransparency.js:347, 352-356`
**Issue:** `isPY` only controls the header banner, computed once from `bqTypes`. Because
`--type` is not `multiple`, `bqTypes` is `['EX','RV']` (default) or a single
user-supplied type, so `isPY` is correct in practice — but the per-type loop already
branches on `datasetType === 'salaries'` for the real work, making `isPY` a redundant
second source of truth for the same decision.
**Fix:** Optional — derive the banner inside the loop or drop `isPY` and print the tree
shape per type, eliminating the duplicate condition.

### IN-03: Coverage doc presents a single Provo reconciliation as whole-dataset proof

**File:** `docs/utah-salaries-coverage.md:26-53, 57-61`
**Issue:** The doc asserts "complete coverage… No source gaps were found — every year
queried returned data" for all 120 city-FYs, but only Provo FY2024 is reconciled to an
external baseline. SLC FY2014 ($134M vs $234M next year) and Ogden/West Jordan
granularity shifts are noted as "source characteristics" without independent
verification. This is a documentation-confidence overstatement, not a code defect.
**Fix:** Soften the coverage claim to "non-empty result returned for every queried
city-FY; one city (Provo FY2024) externally reconciled," and mark the SLC FY2014 and
granularity anomalies as unverified pending a spot-check.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
