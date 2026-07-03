---
phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
reviewed: 2026-07-03T15:32:04Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - scripts/pre34Extract.mjs
  - scripts/maAcfrExtract.mjs
  - scripts/processNJAcfr.js
  - scripts/processNJRevenueAcfr.js
  - scripts/processCTAcfr.js
  - scripts/processCTRevenueAcfr.js
  - scripts/processWIAcfr.js
  - scripts/processWIRevenueAcfr.js
  - scripts/processMAAcfr.js
  - scripts/processMARevenueAcfr.js
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 115: Code Review Report

**Reviewed:** 2026-07-03T15:32:04Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the new pre-GASB-34 extractor, the modified shared MA extractor, and all 8 touched
loaders. In addition to static review, all reviewable behavior was exercised dynamically with
`--dry-run` against cached `_acfr-work/` text (no live writes):

- **Extraction correctness verified:** CT 38/38 years tie (both datasets), WI 26/26 (both),
  MA recovers FY2001 + FY2014 and reports exactly the 4 documented honest holes
  (2002/2004/2005/2021). pre34Extract output labels inspected directly on CT1988/1991/1992/2000
  cached text — labels clean, Debt-service prefixing correct, sums re-verified by hand.
- **No downstream regression from the shared-extractor changes:** dry-ran every other consumer
  of `extractGovFundGeneralColumn` with cached text (MI 7/7, NC 9/9, TN 13/13, MD 4/4, WA 6/6,
  GA 5/5) — all still tie.
- **Phase-114 hardening verification (as directed):** strict `parseArgs`
  (`strict: true, allowPositionals: false`) — present in all 8 loaders; `--fy` validation —
  present in all 8, exit codes confirmed (`--fy 1987` → 2, `--fy 20x2` → 2, `--bogus` → 2,
  valid → 0); WR-07 surfaced select errors — present in all 8. **However, the try/finally
  data_sources cleanup is present but DEFEATED in 6 of 8 loaders** (WR-01 below), and the final
  source-stamp update error is unchecked in the same 6 (WR-02). The NJ pair implements both
  correctly; the CT/WI/MA pair-of-pairs does not.

No Critical findings: no injection paths (`execFileSync` with argument arrays, static URL maps),
no secrets (Supabase key from env; URL fallback is a public project URL consistent with the
codebase), and the tie-gate + up-front validation discipline protects every figure that can reach
the database. The warnings below are correctness-of-invariant and robustness defects, not
wrong-dollar risks.

## Warnings

### WR-01: `process.exit(2)` inside `try` bypasses the `finally` ephemeral-cleanup in 6 loaders

**File:** `scripts/processCTAcfr.js:211,213,214` (also `processCTRevenueAcfr.js:207,209,210`,
`processWIAcfr.js:163,165,166`, `processWIRevenueAcfr.js:163,165,166`,
`processMAAcfr.js:142,144,145`, `processMARevenueAcfr.js:125,127,128`)
**Issue:** These loaders call `process.exit(2)` on RPC error, stamp-lookup error, or missing
budgets row *inside* the `try` block whose `finally` performs the ephemeral `data_sources`
deletion. `process.exit()` terminates Node immediately — `finally` blocks do NOT run (empirically
confirmed in this review: a `finally` after `process.exit(3)` never executes). On any mid-run
failure the ephemeral `data_sources` row is left behind, which is exactly the WR-05/LOAD-01
residue class Phase 111 eliminated — and directly contradicts the comment on the `finally` block
("runs on success AND on any mid-run failure (WR-04)"). The NJ loaders implement this correctly
by `throw`ing (`processNJAcfr.js:483-492`), letting `finally` await the delete before
`main().catch` exits 2. Mitigating factor: the next run's delete-by-`dataset_id` pre-step
self-heals the residue, so this is a warning, not a blocker.
**Fix:** Replace each in-loop `console.error(...); process.exit(2);` with the NJ pattern:
```js
if (rpcErr || r?.error) throw new Error(`FY${fy} RPC error: ${rpcErr?.message || r.error}`);
if (selErr) throw new Error(`FY${fy} stamp lookup failed: ${selErr.message}`);
if (!bud?.id) throw new Error(`FY${fy}: no ${dataset} row to stamp`);
```
`main().catch` already prints `Fatal:` and exits 2, and the `finally` cleanup then actually runs.

### WR-02: Source-stamp `update` error unchecked — silent provenance failure counted as "loaded"

**File:** `scripts/processCTAcfr.js:215` (also `processCTRevenueAcfr.js:211`,
`processWIAcfr.js:167`, `processWIRevenueAcfr.js:167`, `processMAAcfr.js:146`,
`processMARevenueAcfr.js:129`)
**Issue:** `await supabase...update({ source_url, source_date, data_source }).eq('id', bud.id)`
discards the result — the `error` is never checked. If this update fails, the budgets row keeps
its PREVIOUS `data_source` label (e.g., the NASBO label being replaced, or a GAAP label on a
pre-GASB-34 year's freshly written figures) while the FY is logged and counted as successfully
loaded. Mislabeled provenance violates the project's always-sourced ground rule, and the
pre-34-basis-label separation is one of this phase's explicit success criteria. The NJ loaders
check `upErr` and throw (`processNJAcfr.js:489-490`); these 6 do not.
**Fix:**
```js
const { error: upErr } = await supabase.schema('treasury').from('budgets')
  .update({ source_url: urlFor(fy), source_date: `${fy}-06-30`, data_source: dataSource(fy) })
  .eq('id', bud.id);
if (upErr) throw new Error(`FY${fy} source stamp failed: ${upErr.message}`);
```

### WR-03: Failed downloads poison the PDF cache permanently (missing `curl --fail` + no cleanup)

**File:** `scripts/processCTAcfr.js:149-150` (also `processCTRevenueAcfr.js:145-146`,
`processWIAcfr.js:101-102`, `processWIRevenueAcfr.js:101-102`, `processMAAcfr.js:85-86`,
`processMARevenueAcfr.js:69-70`)
**Issue:** Two compounding defects in `loadYear`: (1) `curl` is invoked without `-f/--fail`, so
an HTTP 404/500 writes the error-page body to `pdfPath` and exits 0 — the `catch` never fires;
(2) when the `%PDF-` magic / 400KB size check then fails, the function returns `null` but leaves
the corrupt file on disk. Every subsequent run sees `existsSync(pdfPath)` true, skips the
download, runs `pdftotext` on garbage, and reports the year as `SKIP (not parseable) — honest
hole` forever — a transient network error is silently converted into a permanent, misdiagnosed
data hole until someone manually deletes the file. (Currently masked because all years are
cached and live-verified, but this bites on any fresh checkout / cleared cache.)
**Fix:** Add `'--fail'` to the curl args and delete the bad artifact before returning:
```js
const b = readFileSync(pdfPath);
if (b.slice(0,5).toString() !== '%PDF-' || b.length < 400000) { unlinkSync(pdfPath); return null; }
```

### WR-04: Unconditional `]`→`1` rewrite in shared `parseRow` mangles labels for all 17 consumers

**File:** `scripts/maAcfrExtract.mjs:31`
**Issue:** The FY2014 glyph fix `line.replace(/\]/g, '1')` is applied to the ENTIRE line —
label text included — for EVERY line of EVERY year of EVERY loader that imports
`extractGovFundGeneralColumn`/`extractMAGeneralFund` (17 loader files across MA/NC/GA/MI/CT/TN/
WI/MD/WA). Numeric damage is caught by the per-FY total-tie gates, and this review dry-ran all
cached consumers with no regressions — but **category labels are not tie-gated**: a legitimate
`]` in any label (e.g., a bracketed source annotation) would silently ship to production as the
digit `1`. The dot-thousands normalization on line 32 has the same whole-line scope but is
lower-risk (requires the exact `\d{1,3}(.\d{3})+` shape). The comment's claim of regression
verification covers only MA's 19 previously-tying years, not the other 9 states.
**Fix:** Scope the substitution to numeric-candidate tokens rather than the whole line, e.g.
apply `]`→`1` inside the per-column loop only when the token matches `/^\(?[\d,\]]+\)?$/`, and
leave the label columns untouched.

### WR-05: `processNJAcfr.js` comment references `isolateNJStatement()` "below" — function does not exist in committed code

**File:** `scripts/processNJAcfr.js:29-30`
**Issue:** The header states "isolateNJStatement() below anchors on that exact bare
title+subtitle pair before handing a scoped snippet to the shared token-order/positional
extractors". No such function exists in this file — or anywhere in `scripts/` (grep confirms the
only definition-adjacent text is in `.planning/.../115-01-NJ-LOADLOG.md`). The loader embeds the
already-tied transcription output, which is fine per its architecture, but the disambiguation
guard that the LOADLOG says prevented loading budgetary-basis figures mislabeled as GAAP exists
only as prose in a planning doc. Anyone extending NJ to FY2026 (or re-deriving per the Phase-110
discipline) must reconstruct the false-match guard from markdown, re-exposing the exact
mis-extraction risk it was written to prevent. The revenue twin (`processNJRevenueAcfr.js:29`)
avoids naming a function and is merely vague; the operating loader's comment is factually wrong.
**Fix:** Either commit `isolateNJStatement()` (e.g., in `maAcfrExtract.mjs` or a
`njAcfrExtract.mjs` helper) so the extraction is reproducible from the repo, or correct the
comment to state the function lives in the 115-01 LOADLOG and was used one-time offline.

## Info

### IN-01: Dry-run summary reports "Loaded 0: none" even when every year ties

**File:** `scripts/processCTAcfr.js:209,222` (same pattern in the CT-rev/WI/WI-rev/MA/MA-rev loaders)
**Issue:** `if (dryRun) continue;` executes before `loaded.push(fy)`, so a fully successful
dry-run ends with `[dry-run] Loaded 0: none. Holes (0): none.` — misleading at a glance
(observed in this review's runs).
**Fix:** Push the FY to a `wouldLoad` list before the dry-run `continue`, or word the summary as
"would load N".

### IN-02: `pre34Extract.mjs` duplicates the positional-extractor helpers, and the copies have already diverged

**File:** `scripts/pre34Extract.mjs:50-80` vs `scripts/maAcfrExtract.mjs:135-152,173-184`
**Issue:** `numTokensWithPos`, `labelBefore`, and `pickGF` are copy-pasted from the positional
variant. The pre-34 copy gained the dot-thousands normalization (CT1991/1992 quirk); the
positional variant in `maAcfrExtract.mjs` did not — so a dot-corrupted year that falls back to
the positional path would tokenize `6.859.289` as three separate numbers (tie gate would turn it
into a hole rather than a wrong figure, but the inconsistency is a divergence trap for future
fixes).
**Fix:** Export the shared helpers from one module (with the normalization as an option) and
import them in the other.

### IN-03: Truthiness check rejects legitimate zero totals and accepts negative ones

**File:** `scripts/maAcfrExtract.mjs:110,216`
**Issue:** `if (revTotal && expTotal && ...)` — a printed total of exactly 0 (thousands) would
be treated as "not found" and a negative total accepted; `!== null` is the intended test (the
pre-34 extractor at `pre34Extract.mjs:165` gets this right).
**Fix:** `if (revTotal !== null && expTotal !== null && revenues.length && expenditures.length)`.

### IN-04: Per-capita console output uses the 2020 census population for FY1988–FY2025

**File:** `scripts/processNJAcfr.js:75,480` (same pattern in all 8 loaders)
**Issue:** `POPULATION` is a single 2020-era constant, so the per-capita sanity line printed for
e.g. FY1988/FY2002 divides historical dollars by today's population. Console-only (never
persisted), but the header comments cite these per-capita figures as part of the units
verification argument.
**Fix:** Note the vintage in the printed line (e.g., "per 2020-census capita") or drop the line
for deep-history years.

---

_Reviewed: 2026-07-03T15:32:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
