---
phase: 20-gresham-or-budget-load
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/extractGresham.py
  - scripts/processGresham.js
  - scripts/seedGreshamOregon.js
  - scripts/loadORPopulation.js
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four scripts implement the Gresham OR budget load pipeline: a Python PDF extractor (`extractGresham.py`), a Node.js loader (`processGresham.js`), a municipality seeder (`seedGreshamOregon.js`), and a Census population loader (`loadORPopulation.js`). Overall the pipeline is structurally sound and consistent with prior Portland/Fremont loaders in the codebase.

Two critical issues were found: a shell-injection surface via the `--pdf` CLI argument in `processGresham.js`, and a silent false-success path in `loadORPopulation.js` where a `.update()` targeting a non-existent municipality row succeeds with zero rows written. Five warnings cover an OCR-concat false-positive that corrupts the adopted amount, a Supabase error swallowing pattern, a partial-file caching defect, `in_requirements` not resetting between sections, and a claimed sanity assertion that is absent from the code. Two info items cover a redundant dynamic import and the hardcoded Supabase project URL.

---

## Critical Issues

### CR-01: Shell Injection via `--pdf` CLI Argument

**File:** `scripts/processGresham.js:73`

**Issue:** `extractPDF()` builds an `execSync` shell command by interpolating `pdfPath` directly into a template literal with only double-quote wrapping:

```js
const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, { ... });
```

`pdfPath` originates from `opts.pdf` (user-supplied CLI argument) at line 277 via `path.resolve(ROOT, opts.pdf)`. `path.resolve` normalizes slashes but does **not** strip or escape double-quote characters. A caller passing:

```
node scripts/processGresham.js --pdf 'x"; touch /tmp/pwned; echo "'
```

produces the shell string:

```
python "…/extractGresham.py" "x"; touch /tmp/pwned; echo ""
```

causing arbitrary command execution. The comment in the JSDoc header (line 17) asserts "PDF path comes from controlled docs/Gresham/ readdir, not user input" but this is false when `--pdf` is provided — that flag accepts any string.

**Fix:** Use `spawnSync` with an args array instead of a shell-interpolated string, or validate `opts.pdf` against the controlled PDF directory before use:

```js
import { spawnSync } from 'node:child_process';

function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractGresham.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const result = spawnSync(pythonBin, [pyScript, pdfPath], {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.slice(0, 200));
  return JSON.parse(result.stdout);
}
```

---

### CR-02: Silent No-Op Update When Municipality Row Does Not Exist

**File:** `scripts/loadORPopulation.js:136-148`

**Issue:** The update path has no guard that ensures the target row actually exists. If a city in `EXPECTED_CITIES` is absent from the `municipalities` table, the idempotence `.single()` call at line 128 returns `null` for `current` (the `error` is destructured away). The code then falls through to `.update()`, which matches zero rows, succeeds without error, and logs `UPDATED Portland: 635749 (2024)` — a false confirmation. The `updated` counter is incremented and the script exits with code 0.

This is especially risky for a bootstrapping scenario (fresh DB or missing municipality) because the script gives no indication that nothing was actually written.

**Fix:** Add a `.select()` to the update call and verify the returned row count, or re-check existence first:

```js
const { data: updated_rows, error } = await supabase
  .from('municipalities')
  .update({ population: pop, population_year: POP_YEAR })
  .eq('name', city)
  .eq('state', 'OR')
  .select();

if (error) {
  console.error(`FAILED ${city}: ${error.message}`);
  failed++;
} else if (!updated_rows || updated_rows.length === 0) {
  console.error(`FAILED ${city}: municipality not found in DB — run seeder first`);
  failed++;
} else {
  console.log(`UPDATED ${city}: ${pop} (${POP_YEAR})`);
  updated++;
}
```

---

## Warnings

### WR-01: OCR Split Concatenation Produces False Positives on Small Legitimate Amounts

**File:** `scripts/extractGresham.py:139-142`

**Issue:** The adopted-column OCR-split repair logic concatenates `num_tokens[-2]` with `num_tokens[-1]` whenever the penultimate token is a 1-3 digit pure-integer and the last token starts with a digit:

```python
if (len(num_tokens) >= 2
        and re.match(r'^\d{1,3}$', num_tokens[-2])
        and re.match(r'^\d', num_tokens[-1])):
    adopted_raw = num_tokens[-2] + num_tokens[-1]
```

This triggers on **legitimate** data where the Adopted column happens to be a small number (e.g., `34`) while the prior column is also a small number (e.g., `12`). In that case the tokens `['…', '…', '…', '…', '12', '34']` would produce an adopted value of `1234` instead of `34` — a 36x inflation that bypasses the `adopted <= 0` guard and silently corrupts the record.

Gresham's budget figures are large enough that this is unlikely in practice, but it is a correctness defect for any row where the adopted column is under $1,000.

**Fix:** Tighten the heuristic: only concatenate when the last token contains a comma (indicating it is the right-hand fragment of a split large number), and the two-token combination is plausibly larger than either piece alone:

```python
if (len(num_tokens) >= 2
        and re.match(r'^\d{1,3}$', num_tokens[-2])
        and re.match(r'^\d{3,}', num_tokens[-1])   # right fragment has ≥3 digits
        and ',' in num_tokens[-1]):                 # has comma = large number fragment
    adopted_raw = num_tokens[-2] + num_tokens[-1]
```

---

### WR-02: `upsertDataSource` Silently Swallows Insert/Update Errors

**File:** `scripts/processGresham.js:159-165`

**Issue:** Both branches of `upsertDataSource` destructure only `data`, discarding `error`:

```js
const { data } = await supabase.schema('treasury').from('data_sources')
  .update(src).eq('id', existing.id).select().single();
return data;   // error silently dropped

const { data } = await supabase.schema('treasury').from('data_sources')
  .insert(src).select().single();
return data;   // error silently dropped
```

When the insert or update fails (constraint violation, network error, RLS policy), `data` is `null` and the function returns `null`. `loadFiscalYear` checks `if (!ds?.id)` and logs "data_source upsert failed" — but the actual Supabase error message is never surfaced, making diagnosis difficult.

**Fix:** Destructure and log the error:

```js
const { data, error } = await supabase.schema('treasury').from('data_sources')
  .update(src).eq('id', existing.id).select().single();
if (error) console.error('  data_source update error:', error.message);
return data;
```

---

### WR-03: Partial CSV Download Is Cached and Silently Reused on Retry

**File:** `scripts/loadORPopulation.js:28-46, 58-62`

**Issue:** If `downloadFile` fails partway through (network drop, server error), `createWriteStream` has already created the file at `CSV_PATH`. On the `file.on('error')` path the stream is closed but the partial file is not deleted. On the next run, `existsSync(CSV_PATH)` returns `true` and the script skips re-downloading, passing the truncated file to `readFileSync`. The header column check at line 71 may still pass if the header row is intact, causing silent population of `cityMap` from partial data — potentially missing cities (`Portland` or `Gresham`) and hitting the `missing.length > 0` guard, or worse, using stale partial rows.

**Fix:** Delete the partial file on any error path:

```js
import { unlinkSync } from 'node:fs';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const cleanup = () => { try { unlinkSync(dest); } catch (_) {} };
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); cleanup();
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close(); cleanup();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { file.close(); cleanup(); reject(err); });
    }).on('error', (err) => { file.close(); cleanup(); reject(err); });
  });
}
```

---

### WR-04: `in_requirements` Flag Never Reset — Resources Rows After Requirements Section Are Included

**File:** `scripts/extractGresham.py:96-106`

**Issue:** The `in_requirements` flag is set to `True` when the `Requirements` section header is encountered but is **never reset to `False`**. If the PDF page layout places the Resources section header *after* the Requirements section (some Gresham PDFs have this layout), any resource-side rows that happen to have 6+ numeric tokens would pass the filter and be incorrectly included as department rows.

The SKIP_ROWS set covers the known resource-category label names (e.g., `Taxes`, `Charges for Services`) but only by exact match. Any resource label not in SKIP_ROWS, or any OCR variant of those labels, would be silently included.

**Fix:** Add a reset trigger when the Resources section header is encountered:

```python
if re.sub(r'\s+', '', s) == 'Requirements':
    in_requirements = True
    continue
if re.sub(r'\s+', '', s) == 'Resources':
    in_requirements = False
    continue
```

---

### WR-05: Documented Sanity Assertion (T-20-05) Is Not Implemented

**File:** `scripts/processGresham.js:19`

**Issue:** The JSDoc header states:

```
 * Security (T-20-05): dry-run + amounts assert FY2026 total under $500M.
```

No such assertion exists anywhere in the file. The dry-run path (line 252-253) only logs the total — it does not compare it against any threshold. If the PDF extractor produces grossly inflated amounts (e.g., due to the OCR-concat false positive in WR-01), the loader will ingest them without any warning.

**Fix:** Add the claimed guard in `processPDF` after `buildOperatingTree`:

```js
const SANITY_MAX = { 2026: 500_000_000 };
if (SANITY_MAX[fy] && total > SANITY_MAX[fy]) {
  console.error(`  SANITY FAIL FY${fy}: total $${total.toLocaleString()} exceeds $500M cap — aborting`);
  return;
}
```

---

## Info

### IN-01: Redundant Dynamic Import of Already-Imported Module

**File:** `scripts/seedGreshamOregon.js:105`

**Issue:** `createClient` is statically imported at line 21. Line 105 performs a redundant `await import('@supabase/supabase-js')` solely to alias it as `createPublicClient`:

```js
const { createClient: createPublicClient } = await import('@supabase/supabase-js');
```

This adds unnecessary async overhead and looks like leftover copy-paste from a context where the static import was not available.

**Fix:** Use the already-imported `createClient` directly:

```js
const publicClient = createClient(SUPABASE_URL, SUPABASE_KEY);  // no db.schema option = public schema
```

---

### IN-02: Hardcoded Supabase Project URL in Three Scripts

**File:** `scripts/processGresham.js:55`, `scripts/seedGreshamOregon.js:24`, `scripts/loadORPopulation.js:9`

**Issue:** All three scripts embed the production Supabase project URL as a fallback:

```js
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
```

This pattern is consistent with the rest of the `scripts/` directory (20+ other scripts do the same), so it is not a deviation from project convention. However, embedding the project identifier in source means switching projects requires editing many files rather than setting one env var. It also means a developer who forgets to set `SUPABASE_URL` silently targets production rather than getting an error.

**Fix (optional):** Make `SUPABASE_URL` mandatory alongside `SUPABASE_KEY`, or document in a `.env.example` that both must be set when targeting non-production.

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
