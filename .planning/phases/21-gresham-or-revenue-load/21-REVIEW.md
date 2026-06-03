---
phase: 21-gresham-or-revenue-load
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - scripts/extractGresham.py
  - scripts/processGresham.js
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Both files implement the Phase 21 revenue extraction and load pipeline by extending existing Phase 20 scripts with a `--mode revenue` / `--revenue` flag pair. The overall structure is sound and follows the Portland Phase 19 pattern closely. The DB collision-avoidance strategy (`dataset_type` parameter in `upsertDataSource`) is correct. The `spawnSync` subprocess invocation avoids shell injection. The sanity-check gate on `mode === 'operating'` is correct.

One blocker was found: the OCR split-number reconstruction condition in `extract_revenue()` diverges from the one in `extract_budget()` in a way that creates a silent data correctness gap — it can fail to reconstruct some valid OCR-split numbers, producing a truncated amount (or zero) without warning. Three warnings cover: a DB-error return path that silently propagates `null` forward, a section-boundary detection asymmetry in `extract_revenue()`, and a missing `timeout` on `spawnSync` that can cause an indefinite hang. Two info items cover missing diagnostic output and a silent `execSync` hang risk.

---

## Critical Issues

### CR-01: OCR split-number reconstruction condition diverges between `extract_budget()` and `extract_revenue()`

**File:** `scripts/extractGresham.py:258-261`

**Issue:** `extract_budget()` detects an OCR-split adopted amount with:
```python
re.match(r'^\d{3,}', num_tokens[-1]) and ',' in num_tokens[-1]
```
That is: last token starts with 3 or more digits AND contains a comma anywhere.

`extract_revenue()` uses a different condition:
```python
re.match(r'^\d{1,3},', num_tokens[-1])
```
That is: last token starts with 1–3 digits immediately followed by a comma.

These are not equivalent. `extract_budget`'s pattern catches tokens like `'1,494,586'` (starts with `1`, then comma — matches both) and also `'494,586'` (starts with `4`, no comma at position 1 — matches `^\d{3,}` but NOT `^\d{1,3},`). `extract_revenue`'s tighter pattern would silently miss the reconstruction for a token like `'494,586'` when the preceding fragment is e.g. `'3'`, producing an unrepaired adopted value of `494586` instead of the correct `3494586`. Since `parse_money` will not error — it will just return a plausible-looking but wrong amount — this produces a silent data correctness failure.

The comment in `extract_revenue` says it handles `'20,175,800'` → `['2', '0,175,800']` and `'35,569,000'` → `['3', '5,569,000']`. Both examples have a digit-immediately-followed-by-comma pattern (`0,175,800` and `5,569,000`), which `^\d{1,3},` catches. But any OCR split producing a token starting with a 4-digit segment before the first comma (e.g., `'1234,567'`) would pass through unrepaired. More critically, if pdfplumber splits a number like `'61,494,586'` into `['6', '1,494,586']`, the token `'1,494,586'` starts with `'1,'` and matches `^\d{1,3},` — so that specific example works. However `extract_budget`'s broader `^\d{3,}.*,` guard offers additional coverage for splits the comment did not enumerate.

The safest fix is to align both functions to the broader `extract_budget` pattern, which has also been in production for Phase 20:

```python
# In extract_revenue(), replace lines 258-261:
if (len(num_tokens) >= 2
        and re.match(r'^\d{1,3}$', num_tokens[-2])
        and re.match(r'^\d{3,}', num_tokens[-1])
        and ',' in num_tokens[-1]):
    adopted_raw = num_tokens[-2] + num_tokens[-1]
```

---

## Warnings

### WR-01: `upsertDataSource` returns `data` (possibly `null`) after logging a DB error — callers receive `null` silently

**File:** `scripts/processGresham.js:186-194`

**Issue:** Both the update and insert branches log an error with `console.error` but still `return data`. When Supabase returns an error, `data` is `null`. The downstream caller (`loadFiscalYear`, line 200) checks `!ds?.id` and short-circuits — so no incorrect data is written. However, if a DB error occurs on update/insert, the error is logged once, execution continues into `loadFiscalYear`, a second message "data_source upsert failed" is printed, and then the function returns `false` — causing the per-FY load to silently skip. There is no non-zero exit code from the process in this path, so a caller running in CI will see a success exit code despite data not having been loaded.

**Fix:** Either `throw` on DB error (to surface the failure to the caller and trigger the `main().catch` handler), or explicitly `return null` after logging:
```javascript
if (error) {
  console.error('  data_source update error:', error.message);
  return null;   // explicit null — signals failure to caller
}
return data;
```
The same pattern should apply to the insert branch (line 191-194). This ensures the `!ds?.id` check in `loadFiscalYear` always reflects an actual failure rather than a value that happens to have no `.id`.

---

### WR-02: `extract_revenue()` section-end detection is asymmetric — `s.startswith('Requirements')` can trigger prematurely

**File:** `scripts/extractGresham.py:226-228`

**Issue:** `extract_revenue()` ends the `in_resources` section when:
```python
if s_norm == 'Requirements' or s.startswith('Requirements'):
```
The `s.startswith('Requirements')` branch will match any line that begins with the word "Requirements", including the page title line "Resources and Requirements - All Funds". If pdfplumber ever returns that title line after the "Resources" section header (e.g., if page layout causes it to repeat mid-page), `in_resources` will be set to `False` prematurely, silently dropping all remaining revenue categories for that page.

By contrast, `extract_budget()` only uses the normalized equality check `re.sub(r'\s+','',s) == 'Resources'` to end the requirements section — a much stricter guard.

The `s.startswith('Requirements')` branch was added to handle "Requirements Proposed Approved Adopted" column-header lines (analogous to "Resources Proposed Approved Adopted" in the section-start detection). That is a valid concern, but the guard is too broad — it would also fire on the page title.

**Fix:** Mirror the symmetry of the section-start detection, which explicitly excludes the known ambiguous prefix:
```python
if s_norm == 'Requirements' or (
        s.startswith('Requirements') and
        not s.startswith('Resources and')):
    in_resources = False
    continue
```
This matches the section-start pattern (lines 221-224) where `not s.startswith('Resources and')` is used to guard the analogous ambiguity.

---

### WR-03: `spawnSync` has no `timeout` — a stalled Python process hangs the loader indefinitely

**File:** `scripts/processGresham.js:78-81`

**Issue:** `spawnSync` is called without a `timeout` option. If `pdfplumber` hangs on a malformed or corrupt PDF (a known failure mode for PDF parsers), the Node.js process will block indefinitely with no way to recover short of a manual kill. The `maxBuffer` limit only guards against excessive output, not a process that produces no output and never exits.

**Fix:** Add a reasonable timeout. Gresham PDFs are 6–8 MB; extraction completes in under 10 seconds normally. A 60-second timeout provides ample headroom:
```javascript
const result = spawnSync(pythonBin, args, {
  maxBuffer: 8 * 1024 * 1024,
  encoding:  'utf8',
  timeout:   60_000,   // 60 seconds; pdfplumber should never need more
});
if (result.status !== 0 || result.signal === 'SIGTERM') {
  throw new Error(
    `extractGresham.py failed (exit ${result.status}, signal ${result.signal}): ${result.stderr}`
  );
}
```

---

## Info

### IN-01: `extract_revenue()` silently skips zero/negative amounts — no diagnostic log

**File:** `scripts/extractGresham.py:263-264`

**Issue:** `extract_budget()` logs a message to stderr when it skips a row with a zero or negative amount (line 149: `'[skipped] Zero/negative amount: ...'`). `extract_revenue()` skips silently (lines 263-264: `if adopted <= 0: continue`). If an OCR reconstruction failure produces a zero amount, the row disappears without any trace in the output, making it harder to diagnose extraction problems during dry-runs.

**Fix:** Add the same diagnostic that `extract_budget` uses:
```python
if adopted <= 0:
    print(f'  [skipped] Zero/negative amount: {category}', file=sys.stderr)
    continue
```

---

### IN-02: `execSync` for git resolution in `resolvePdfDir()` has no timeout

**File:** `scripts/processGresham.js:45-47`

**Issue:** `execSync('git rev-parse --git-common-dir', ...)` in `resolvePdfDir()` has no `timeout`. This call is only reached when the primary `docs/Gresham/` path does not exist (a worktree edge case), so it is low-risk in normal operation. However, in a CI environment with unusual git configurations or network-mounted filesystems, a git command can block indefinitely.

**Fix:** Add a short timeout:
```javascript
const gitDir = execSync('git rev-parse --git-common-dir', {
  cwd: ROOT, encoding: 'utf8', timeout: 5_000
}).trim();
```

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
