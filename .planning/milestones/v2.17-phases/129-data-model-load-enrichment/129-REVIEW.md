---
phase: 129-data-model-load-enrichment
reviewed: 2026-07-10T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/seedTucsonArizona.js
  - scripts/processTucson.js
  - scripts/loadTucsonEnrichment.mjs
  - data/tucsonEnrichment129.mjs
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 129: Code Review Report

**Reviewed:** 2026-07-10
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the Tucson, AZ data-model seeder, budget loader, and category-enrichment
loader for shell/SQL-injection safety, idempotency/source-safety of privileged
writes, enrichment bleed-safety, and extractor-tree → RPC-tree mapping
correctness.

**No injection vulnerabilities found.** `spawnSync` in `processTucson.js` is
called with an args array (never `shell: true`, never a concatenated command
string), and PDF paths are drawn from a controlled `readdirSync` listing
matched against a fixed regex, never from interpolated user/network input. All
Supabase reads/writes across all four files use the parameterized query
builder or `rpc()` — no raw SQL string-building anywhere.

**Enrichment bleed-safety is solid.** `loadTucsonEnrichment.mjs` correctly
derives its worklist live from production, delete-then-inserts universal
(`municipality_id = NULL`) rows to avoid the NULLS-DISTINCT duplicate-row trap,
upserts Tucson-scoped rows safely, and gates on both a `$`-figure leak and an
AZ-locality-name leak before any write — checked against a live query of all
AZ municipality names, so it would catch "Tucson", "Pima County", or any other
AZ city name leaking into a universal row.

**The extractor→RPC tree mapping in `processTucson.js` is correct** — cross-
checked against `scripts/extractTucson.py`'s `build_operating`/`build_revenue`,
which guarantees a 2-level parent's `.a` is exactly the sum of its `.c[].a`
children by construction, so the JS mapper's pass-through of `child.a` cannot
silently diverge from the leaf sum.

**The one real defect (BLOCKER) is in the ephemeral `data_sources` lifecycle**
in `processTucson.js`: every per-fiscal-year failure path calls
`process.exit(2)` from inside the FY loop, which terminates the process before
the ephemeral `data_sources` row created at the top of the run is ever
deleted — directly contradicting this file's own documented "0 residue"
WR-05/LOAD-01 guarantee for any run that fails partway through a multi-year
window. Additional WARNING-level robustness gaps are noted below (a dead
pre-load-delete that filters on a key that can never match, soft-fail
verification in the seeder, and a missing sanity guard in the enrichment
loader).

## Critical Issues

### CR-01: Ephemeral `data_sources` row is not cleaned up on any per-FY failure

**File:** `scripts/processTucson.js:306-351` (six `process.exit(2)` calls inside the FY loop) vs. cleanup at `scripts/processTucson.js:354-357`

**Issue:** `processMode()` creates one ephemeral `data_sources` row per run
(`ds = await createEphemeralDataSource(...)`, line 301) and only deletes it
*after* the `for (const fy of years)` loop completes (lines 354-357). But
every failure branch inside that loop — missing PDF (line 308), extractor
failure (line 316), tie-delta guard (line 323), mapped-total mismatch (line
331), sanity-ceiling breach (line 335), and `loadFiscalYear` failure (line
351) — calls `process.exit(2)` directly. `process.exit()` terminates the
Node process synchronously; none of the code after the loop (including
`deleteEphemeralDataSource`) ever runs.

This means any live, multi-year run (`node scripts/processTucson.js` /
`--revenue`, no `--fy`) that fails on FY *n* out of 10 leaves a permanent
orphaned row in the shared production `treasury.data_sources` table — the
exact "unreferenceable residue" failure mode the file's own header comment
(lines 34-38, 60) and the project's WR-05/LOAD-01 convention explicitly claim
to prevent. The row is only cleaned up if the operator happens to re-run the
*same* mode again later (the next `createEphemeralDataSource` call deletes any
prior row for that `dataset_id` before inserting a fresh one) — cleanup is
therefore accidental and conditional, not guaranteed as documented.

Given this loader targets a shared, service-role-writable production table,
and the header explicitly documents "(e) data_sources residue — ephemeral
create/delete lifecycle (WR-05)" as a solved security/hygiene concern, this is
a genuine regression against a documented invariant, not merely a style
nit.

**Fix:** Wrap the per-FY work in `try/finally` so the ephemeral row is always
deleted, regardless of how the run ends. Convert internal hard-fails to thrown
errors instead of `process.exit()` so the `finally` block actually executes:

```js
async function processMode(supabase, muniId, dryRun, mode, targetFY, pdfsByFY) {
  const datasetType = mode === 'revenue' ? 'revenue' : 'operating';
  const years = targetFY ? [targetFY] : FYS;

  let ds = null;
  if (!dryRun) ds = await createEphemeralDataSource(supabase, muniId, datasetType);

  try {
    for (const fy of years) {
      const pdfPath = pdfsByFY.get(fy);
      console.log(`\n── FY${fy} ${mode} ${'─'.repeat(40)}`);
      if (!pdfPath) {
        throw new Error(`No PDF found for FY${fy} in docs/Tucson/`);
      }
      // ... existing logic, but throw Error(...) instead of console.error + process.exit(2)
      // at every abort point (extract failure, tie-delta, total mismatch, sanity ceiling,
      // loadFiscalYear failure) ...
    }
  } finally {
    if (!dryRun && ds) {
      await deleteEphemeralDataSource(supabase, ds.id);
      console.log(`\ndata_source ${ds.id} deleted (ephemeral cleanup — 0 residue, WR-05/LOAD-01)`);
    }
  }
}
```

And let `main()`'s existing `main().catch(e => { console.error('Fatal:', e); process.exit(2); })` supply the process-level non-zero exit code once cleanup has run.

## Warnings

### WR-01: Pre-load delete in `loadFiscalYear` is dead code — it can never match a row

**File:** `scripts/processTucson.js:260-263`

**Issue:**
```js
async function loadFiscalYear(supabase, muniId, dsId, fy, datasetType, tree, total, rowCount) {
  // Pre-load delete for idempotency (per data_source_id + fiscal_year).
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', dsId).eq('fiscal_year', fy).eq('dataset_type', datasetType);
```
`dsId` is the `id` of the ephemeral row this run just inserted into
`treasury.data_sources` (a fresh UUID every run — `createEphemeralDataSource`
deletes-then-inserts a brand-new row every time it's called). Two independent
facts make this delete a guaranteed no-op:

1. Per `supabase/migrations/20260614_city_budget_source_attribution.sql:9`,
   `treasury.budgets.data_source_id` FKs to `source_registry`, **not**
   `data_sources` — so it isn't even the same key space as `dsId`.
2. The RPC that actually writes `budgets` rows
   (`treasury_sync_budget_tree`, `supabase/migrations/20260613120000_add_budget_period_label.sql:73-77`)
   never sets `data_source_id` in its `INSERT` — the column is left `NULL` on
   every row this pipeline writes. `.eq('data_source_id', dsId)` against a
   `NULL` column can never match, on this run or any prior run.

The comment claims this delete provides idempotency; it does not, and never
has. The *actual* idempotency guarantee comes entirely from
`treasury_sync_budget_tree`'s own find-existing-budget-or-insert logic keyed
on `(municipality_id, fiscal_year, dataset_type, period_label)`. This is
harmless today (real dedup is provided elsewhere) but is misleading dead code
that could give a future maintainer false confidence that this line is doing
real work, and masks the fact that the loader has no independent, defense-in-
depth check of its own before calling the RPC.

**Fix:** Either remove the dead delete and the stale comment, or replace it
with a delete keyed on the columns that actually identify the target row
(`municipality_id`, `fiscal_year`, `dataset_type`) if a defense-in-depth
pre-clear is still wanted ahead of the RPC call:
```js
await supabase.schema('treasury').from('budgets')
  .delete().eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType);
```

### WR-02: `seedTucsonArizona.js` verification failures don't produce a non-zero exit code

**File:** `scripts/seedTucsonArizona.js:235-240, 255-257`

**Issue:** The end-of-run verification block logs mismatches with
`console.error('  WARNING: ...')` but never calls `process.exit(1)`:
```js
if (mc.population !== TUCSON.population) {
  console.error(`  WARNING: expected population ${TUCSON.population}, got ${mc.population}`);
}
if (mc.county_id !== pimaId) {
  console.error(`  WARNING: expected county_id=${pimaId}, got ${mc.county_id} (link outcome was "${linkOutcome}")`);
}
...
if (pc.population !== PIMA_POPULATION_2024) {
  console.error(`  WARNING: expected population ${PIMA_POPULATION_2024}, got ${pc.population}`);
}
```
`main()` prints `'\nDone.'` and exits 0 regardless. A one-off production
seeder that detects its own postcondition failed should fail loudly (non-zero
exit) so a human or CI harness running it doesn't mistake a broken seed for a
successful one — especially since this script runs with a service-role key
against a shared production table.

**Fix:** Track an `ok` flag across the verification block and `process.exit(1)`
at the end if any check failed, e.g.:
```js
let verifyOk = true;
if (mc.population !== TUCSON.population) { console.error(...); verifyOk = false; }
if (mc.county_id !== pimaId) { console.error(...); verifyOk = false; }
...
if (!verifyOk) process.exit(1);
```

### WR-03: `loadTucsonEnrichment.mjs` has no sanity guard for zero live keys

**File:** `scripts/loadTucsonEnrichment.mjs:118-130`

**Issue:** After confirming Tucson has loaded budgets (`if (!bids.length) { ...; process.exit(1); }`, line 99), the script derives `liveKeys` from `budget_categories` at depth 0/1 (lines 118-120) with no check that this set is actually non-empty:
```js
const d0 = await collectKeys(0);
const d1 = await collectKeys(1);
const liveKeys = [...new Set([...d0, ...d1])].sort();
...
for (const key of liveKeys) { ... } // no-ops silently if liveKeys is empty
```
If the depth filter, column name, or join assumption were ever wrong (e.g. a
future schema change alters how `depth` is populated for this dataset shape),
`liveKeys` would come back empty even though Tucson clearly has loaded budget
data. The script would then report `coverage: 0/0`, find nothing to author,
and exit 0 with "already 100% covered" — a false-positive success that hides
a real querying bug rather than surfacing it.

**Fix:** Treat zero live keys against existing budgets as fatal:
```js
if (!liveKeys.length) {
  console.error(`ABORT: 0 live budget_categories keys found for ${bids.length} Tucson budgets — check depth/query assumptions.`);
  process.exit(1);
}
```

## Info

### IN-01: Inconsistent `.env` resolution between the two loader scripts

**File:** `scripts/loadTucsonEnrichment.mjs:36-38` vs. `scripts/processTucson.js:92-103`

**Issue:** `processTucson.js`'s `loadEnv()` resolves `.env.local`/`.env`
relative to the script's own directory (`path.join(ROOT, f)`, where `ROOT` is
derived from `import.meta.url`), so it works regardless of the current
working directory. `loadTucsonEnrichment.mjs` instead reads `.env.local`/`.env`
relative to `process.cwd()`:
```js
for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { ... } } catch {}
}
```
If invoked from any directory other than the repo root, the env file silently
fails to load (caught by the empty `catch {}`), and the script falls through
to its explicit `Missing SUPABASE_URL or service key` exit — a safe failure
mode, but an avoidable inconsistency between two sibling loaders in the same
phase.

**Fix:** Reuse the same `ROOT`-relative resolution pattern as `processTucson.js` for consistency.

### IN-02: Universal-row insert isn't chunked like its paired delete

**File:** `scripts/loadTucsonEnrichment.mjs:181-188`

**Issue:** The universal-row delete is chunked in batches of 100 (`for (let i = 0; i < keysToWrite.length; i += 100)`), but the corresponding insert is a single unchunked call: `await supabase.from('category_enrichment').insert(universalRows)`. With today's map (5 universal rows max) this is a non-issue, but the asymmetry is a latent gap if this file is ever copied forward (as its header suggests, modeled on `loadVAEnrichment82.mjs`) to a city/state with a much larger enrichment map.

**Fix:** Chunk the insert the same way as the delete, for consistency and future-proofing:
```js
for (let i = 0; i < universalRows.length; i += 100) {
  const { error } = await supabase.from('category_enrichment').insert(universalRows.slice(i, i + 100));
  if (error) { console.error('universal insert error:', error.message); process.exit(1); }
}
```

---

_Reviewed: 2026-07-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
