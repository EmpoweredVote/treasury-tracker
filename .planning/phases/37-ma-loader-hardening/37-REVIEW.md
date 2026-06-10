---
phase: 37-ma-loader-hardening
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - scripts/scrapeMaDLS.js
  - .gitignore
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 37 added two hardening features to `loadToSupabase()` in `scripts/scrapeMaDLS.js`: a per-`(report, FY)` progress checkpoint (LOAD-02) and fiscal_years append-with-deduplication (LOAD-03), plus a `.gitignore` exclusion for `scripts/output/`.

The core logic of both features is correct. The Set-based checkpoint lookup is type-consistent (string DOR codes throughout), `writeFileSync` is correctly placed for crash-safety, the `Array.isArray` null guard prevents the `[...null]` TypeError, and the `.includes()` dedup correctly prevents duplicate fiscal year entries. No critical correctness bugs were found in the Phase 37 changes themselves.

Three warnings were identified: one involves a pre-existing silent error discard (the `error` from `maybeSingle()` is never checked) that Phase 37's new code inherits; one is a permanent checkpoint gap for zero-amount records; and one is the pre-existing hardcoded Supabase project URL that the context explicitly deferred. Two info items round out minor quality observations.

---

## Warnings

### WR-01: `maybeSingle()` error silently discarded — INSERT attempted on query failure

**File:** `scripts/scrapeMaDLS.js:600-607`
**Issue:** The `data_sources` existence check uses `const { data: existingDs } = await supabase...maybeSingle()` — the `error` return value is destructured away and never checked. If the query fails (network timeout, RLS denial, schema mismatch), `existingDs` is `null` and the code falls through to the INSERT path. The INSERT also fails and is caught at line 627 — so the city is silently `skipped++` with the message "data source: ..." and its DOR code is never written to the checkpoint. The root cause (a query error rather than a missing row) is lost.

This pattern was pre-existing before Phase 37 (same at line 543 in `seedMunicipalities`). Phase 37's new `else` branch on line 633 does not make it worse, but LOAD-03 depends on `existingDs.fiscal_years` being a reliable read — if the query silently failed and returned `null`, `existingDs` is null, the INSERT runs, and LOAD-03 is simply bypassed. The data loss risk is low because the INSERT failure is caught, but silent query failures make resume behavior unpredictable.

**Fix:**
```javascript
const { data: existingDs, error: dsLookupErr } = await supabase
  .schema('treasury')
  .from('data_sources')
  .select('id, fiscal_years')
  .eq('municipality_id', municId)
  .eq('api_type', 'ma-dls')
  .eq('dataset_type', report.datasetType)
  .maybeSingle();

if (dsLookupErr) {
  console.log(`    ❌ ${record.municipality} data source lookup: ${dsLookupErr.message}`);
  skipped++;
  continue;
}
```

---

### WR-02: Zero-amount records create un-checkpointed data_source rows

**File:** `scripts/scrapeMaDLS.js:611-657`
**Issue:** When `tree.length === 0` (line 657), the code does `skipped++; continue` without writing the checkpoint. However, if the INSERT path ran first (i.e., this is the first load for this municipality), the `data_sources` row was already created with `fiscal_years: [fiscalYear]` before the tree-length check. On every subsequent re-run for the same JSON, `maybeSingle()` returns the existing row (dsId truthy → else branch), the LOAD-03 `fiscal_years` UPDATE runs (no-op since fiscalYear is already present), then `tree.length === 0` hits again — `skipped++; continue`, no checkpoint write.

The net effect: cities with entirely zero-valued rows are re-processed on every run (querying data_sources, running the else branch, discovering tree is empty) without ever being checkpointed. For the 351-city bulk load this means a consistent set of cities hit the DB on every run even after "completion."

The broader question is whether `tree.length === 0` records should be checkpointed anyway (to record that the city was seen and had no data), or whether the zero-amount guard should come earlier, before the data_source INSERT.

**Fix (option A — checkpoint zero-amount cities so they are skipped on re-run):**
```javascript
if (tree.length === 0) {
  // Record in checkpoint so re-runs skip this city rather than re-querying
  alreadyLoaded.add(record.dorCode);
  progress[progressKey] = [...alreadyLoaded];
  writeProgress(progress);
  skipped++;
  continue;
}
```

**Fix (option B — guard before data_source creation to avoid creating orphan rows):**
Move the tree-building and `tree.length === 0` check above the `data_sources` INSERT/UPDATE block, and only create/update the data_source when there is data to write.

Option A is a smaller, safer change given the existing structure.

---

### WR-03: Hardcoded Supabase project URL

**File:** `scripts/scrapeMaDLS.js:42`
**Issue:** `const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';` embeds the production project ID as a fallback. If the script is run without `SUPABASE_URL` set — including in any CI/CD or developer environment — it silently targets the production database. This was flagged in the CONTEXT.md as a known WR-04 pattern deferred from Phase 36 code review, so it is not new to Phase 37.

Since Phase 38 will run the bulk load (351 cities × 5 FYs), the risk of accidentally targeting production without intending to is real. The `--dry-run` flag does not protect against this; it bypasses `loadToSupabase` entirely but `--seed` and `--scrape` (when Supabase writes occur) would still hit production.

**Fix:**
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL && SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL env var');
  process.exit(1);
}
```
Or at minimum: fail loudly if `SUPABASE_URL` is absent rather than silently falling back to the hardcoded URL.

---

## Info

### IN-01: `fiscal_years` type consistency — integers vs. possible strings

**File:** `scripts/scrapeMaDLS.js:636`
**Issue:** `existingFiscalYears.includes(fiscalYear)` compares JavaScript number to JavaScript number. `fiscalYear` is always an integer (from `parseInt(values.fy) || 2025`), and values retrieved from Postgres JSONB via Supabase JS come back as numbers. This is correct for the current data path. However, if any row was ever written with a string fiscal year (e.g., `"2023"` instead of `2023`) in the JSONB array — from a manual DB edit or a different loader — `.includes(2023)` would not match `"2023"` and the dedup guard would fail, inserting a duplicate. This is a latent type-mismatch risk.

**Fix (defensive):**
```javascript
const existingFiscalYears = (Array.isArray(existingDs.fiscal_years)
  ? existingDs.fiscal_years
  : []
).map(Number);  // normalize to integers in case of mixed types
```

---

### IN-02: `mkdirSync(OUTPUT_DIR)` runs unconditionally at module load for all modes

**File:** `scripts/scrapeMaDLS.js:39`
**Issue:** `mkdirSync(OUTPUT_DIR, { recursive: true })` runs at module initialization for every invocation of the script, including `--list` (which only prints to console and exits). This creates `scripts/output/` as a side effect of `node scripts/scrapeMaDLS.js --list`. The directory is gitignored so there is no version-control impact, but the behavior is surprising — `--list` has a filesystem side effect.

**Fix:** Move `mkdirSync` into the code paths that actually write files (`scrapeReport`, `exploreReport`, and `loadToSupabase`), or guard it with a lazy-init pattern. For a script this small the current approach is unlikely to cause problems, but it violates least-surprise.

---

_Reviewed: 2026-06-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
