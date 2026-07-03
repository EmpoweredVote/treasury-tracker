---
phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
fixed_at: 2026-07-03T16:14:28Z
review_path: .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 115: Code Review Fix Report

**Fixed at:** 2026-07-03T16:14:28Z
**Source review:** .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (fix_scope=critical_warning; 0 Critical, 5 Warning; 4 Info out of scope)
- Fixed: 5
- Skipped: 0

**Verification method:** Baseline `--dry-run` outputs were captured for all 20 ACFR loaders
(NJ/CT/WI/MA × op/rev + the 12 other `maAcfrExtract` consumers: MI/NC/TN/MD/WA/GA × op/rev)
BEFORE any edit, and re-captured after all fixes. All 20 outputs are **byte-identical** to
baseline — every loaded year still ties (NJ 24/24 both datasets, CT 38/38 both, WI 26/26 both,
MA 21/21 both, MI 7, NC 14, TN 17, MD 4, WA 6, GA 5). `node --check` passed on every edited
file after every fix. No live database writes were performed (none of the findings claimed a
production-row defect).

## Fixed Issues

### WR-01: `process.exit(2)` inside `try` bypasses the `finally` ephemeral-cleanup in 6 loaders

**Files modified:** `scripts/processCTAcfr.js`, `scripts/processCTRevenueAcfr.js`,
`scripts/processWIAcfr.js`, `scripts/processWIRevenueAcfr.js`, `scripts/processMAAcfr.js`,
`scripts/processMARevenueAcfr.js`
**Commit:** 102e01e
**Applied fix:** Replaced the three in-loop `console.error(...); process.exit(2)` calls (RPC
error, stamp-lookup error, missing budgets row) with thrown Errors, exactly matching the NJ
reference pattern (`processNJAcfr.js:483-492`). `main().catch` already prints `Fatal:` and
exits 2, and the `finally` ephemeral `data_sources` delete now actually awaits before exit.
Failure path verified by code inspection (throw → finally → catch → exit 2 is guaranteed JS
semantics; no live negative-test was performed because forcing an RPC failure requires live
mode — residue self-heals via the next run's delete-by-dataset_id pre-step regardless, per the
review's mitigating factor). Remaining `process.exit(2)` calls in these files all occur BEFORE
the ephemeral `data_sources` row exists, so they cannot strand residue.

### WR-02: Source-stamp `update` error unchecked — silent provenance failure counted as "loaded"

**Files modified:** `scripts/processCTAcfr.js`, `scripts/processCTRevenueAcfr.js`,
`scripts/processWIAcfr.js`, `scripts/processWIRevenueAcfr.js`, `scripts/processMAAcfr.js`,
`scripts/processMARevenueAcfr.js`
**Commit:** 95d9503
**Applied fix:** The stamp `update` result is now destructured (`{ error: upErr }`) and a
failed stamp throws `FY{fy} source stamp failed: ...` before `loaded.push(fy)` — matching the
NJ `upErr` pattern (`processNJAcfr.js:489-490`). A year whose provenance write fails is never
counted as loaded, and the throw (post-WR-01) also guarantees the finally cleanup runs.

### WR-03: Failed downloads poison the PDF cache permanently (missing `curl --fail` + no cleanup)

**Files modified:** `scripts/processCTAcfr.js`, `scripts/processCTRevenueAcfr.js`,
`scripts/processWIAcfr.js`, `scripts/processWIRevenueAcfr.js`, `scripts/processMAAcfr.js`,
`scripts/processMARevenueAcfr.js`
**Commit:** 4bd92e0
**Applied fix:** (1) Added `--fail` to every curl invocation so HTTP 4xx/5xx exits non-zero
instead of writing an error page to `pdfPath`; (2) the curl `catch` now deletes any partial
artifact (`if (existsSync(pdfPath)) unlinkSync(pdfPath)`); (3) the `%PDF-` magic / 400KB size
check now `unlinkSync(pdfPath)` before returning null. A transient network error can no longer
become a permanent, misdiagnosed "honest hole" on a fresh checkout. `unlinkSync` added to the
`node:fs` imports in all 6 files. Verified by code inspection + dry-run regression (all cached
years unaffected — the download path is only reached when cache is missing).

### WR-04: Unconditional `]`→`1` rewrite in shared `parseRow` mangles labels for all 17 consumers

**Files modified:** `scripts/maAcfrExtract.mjs`
**Commit:** 24cdba9
**Applied fix:** Removed the whole-line `line.replace(/\]/g, '1')` and moved the substitution
into the per-column token loop, applied ONLY when the token is a numeric candidate
(`t.includes(']') && /^\(?[\d,\]]+\)?$/.test(t)`) — label text containing `]` is never
rewritten. Comment updated to document the scoping and why (labels are not tie-gated).
**Regression gate (as directed):** all 18 `--dry-run` consumers (MA both + CT/WI both +
MI/NC/TN/MD/WA/GA both) byte-identical to pre-fix baseline, including MA FY2014 (the year the
glyph fix exists for). Positive behavior additionally confirmed with a synthetic statement:
label `Taxes [note 3]` preserved verbatim while numeric tokens `],904`→1,904 and
`20],257`→201,257 still normalize.

### WR-05: `processNJAcfr.js` comment references `isolateNJStatement()` — function did not exist in committed code

**Files modified:** `scripts/njAcfrExtract.mjs` (new file), `scripts/processNJAcfr.js`
**Commit:** 99eb2f7
**Applied fix:** Took the review's stronger option: committed the disambiguation as a real
module. `scripts/njAcfrExtract.mjs` implements `isolateNJStatement()` (anchors on the exact
bare `STATEMENT OF REVENUES, EXPENDITURES[,] AND CHANGES IN FUND BALANCES` title + bare
`GOVERNMENTAL FUNDS` subtitle within 5 lines, whitespace-tolerant for FY2007's mid-title gap,
first match, padded scoped snippet per the shared extractor's line-1500 convention) and
`extractNJGeneralFund()` (token-order → positional fallback with an exact $0 tie gate), plus a
read-only CLI re-derivation harness (`node scripts/njAcfrExtract.mjs`). The header comment in
`processNJAcfr.js` now points at the committed module.
**Regression verification (as directed):** ran the committed function against all 24 cached
`_acfr-work/nj/NJ{YYYY}.txt` files — **24/24 years reproduce the loaders' embedded control
totals exactly** ($0 diff on both revenue and expenditure, FY2002–FY2003 via the positional
fallback as documented), and both NJ loaders' `--dry-run` outputs (24/24 validation PASS)
are byte-identical to baseline. New file creation is per the review's explicit fix suggestion.

## Skipped Issues

None — all 5 in-scope findings fixed. (IN-01..IN-04 are Info-tier and out of scope for
fix_scope=critical_warning.)

---

_Fixed: 2026-07-03T16:14:28Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
