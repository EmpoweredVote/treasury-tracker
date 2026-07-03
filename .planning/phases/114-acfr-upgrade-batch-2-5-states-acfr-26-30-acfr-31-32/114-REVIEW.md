---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
reviewed: 2026-07-03T03:26:39Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - scripts/processSCAcfr.js
  - scripts/processSCRevenueAcfr.js
  - scripts/processKYAcfr.js
  - scripts/processKYRevenueAcfr.js
  - scripts/processUTAcfr.js
  - scripts/processUTRevenueAcfr.js
  - scripts/processALAcfr.js
  - scripts/processALRevenueAcfr.js
  - scripts/processLAAcfr.js
  - scripts/processLARevenueAcfr.js
findings:
  critical: 0
  warning: 7
  info: 7
  total: 14
status: issues_found
---

# Phase 114: Code Review Report

**Reviewed:** 2026-07-03T03:26:39Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed all 10 Phase-114 state-ACFR loaders (SC/KY/UT/AL/LA × operating/revenue), generated from the shared gen_state.py template on the Illinois/Phase-113 loader pattern. All 10 were independently re-executed with `--dry-run` during this review: every embedded fiscal year's category sum ties to its printed General Fund control total within the 10-thousands tolerance (exit 0 across all 10 files, all 118 state-years). Cross-file invariants also verified: EXPECTED_MUNI_ID matches between each state's operating/revenue pair; UNITS, source dates (including AL's Sep-30 FY-end with `fiscal_year_start_month: 10` on both the data_sources payload and the budgets stamp), dataset_ids, and years arrays are internally consistent; the KY FY2023 omission is consistent across SOURCES, data arrays, years list, and fiscal_years payload, and matches the documented honest hole in 114-02-KY-LOADLOG.md.

No security issues (no injection surface, no secrets in code; service key comes from env). No arithmetic or units errors found. The findings below are: two production data-label defects (UT trailing-space category name, AL suspected "Changes"/"Charges" transcription flip), one header comment that misstates load behavior (KY FY2023), and a set of template-level robustness gaps shared by all 10 files (error-path residue of the "ephemeral" data_sources row, silent flag-typo live runs, mid-run abort leaving partial loads, swallowed select errors).

Because these loaders have already live-run successfully, the data-label warnings (WR-01, WR-02) describe defects that are now present in production `budgets` rows, not just in code.

## Warnings

### WR-01: UT FY2020 category name has a trailing space — inconsistent stored label across years

**File:** `scripts/processUTAcfr.js:111`
**Issue:** `{ name: 'Health and Environmental Quality ', ... }` (trailing space) — every other UT year uses `'Health and Environmental Quality'` (no trailing space; e.g. lines 97, 125). `buildTree()` passes the name through verbatim, so the FY2020 tree leaf stored in production carries the trailing space. Any name-keyed cross-year matching (trend lines, category enrichment `name_key` joins — note the project's `category_enrichment` NULLS-DISTINCT keying) will treat FY2020's category as distinct from the same category in FY2019/FY2021.
**Fix:**
```js
{ name: 'Health and Environmental Quality',             total:    3_423_327 },
```
Then re-run `node scripts/processUTAcfr.js --fy 2020` to replace the FY2020 operating row in place. Better template fix for Phase 115: `n: label.trim()` in `buildTree()` so the generator can never emit this class of defect again.

### WR-02: AL expenditure label flips "Charges" → "Changes" at FY2018 and stays wrong for 8 years — suspected transcription typo now in production

**File:** `scripts/processALAcfr.js:297, 308, 319, 330, 341, 352, 363, 375`
**Issue:** FY2002–FY2017 (14 years) use `'Debt Service - Interest and Other Charges'`; FY2018–FY2025 (8 years) use `'Debt Service - Interest and Other Changes'`. "Interest and Other Charges" is the standard GASB debt-service caption; "Interest and Other Changes" is not a recognized accounting term. The KY loader documents hand-correcting an analogous single-glyph OCR typo ("Rnes and forfeits"), but this 8-year label flip was not caught — and unlike the KY case it is now stamped into 8 production budgets rows. It is possible Alabama's ACFR genuinely prints "Changes" from FY2018 onward (agencies do copy typos forward), but neither the loader head comment nor 114-04-AL-LOADLOG.md records verifying this, and the mid-series flip is exactly the signature of an extraction defect.
**Fix:** Check the printed FY2018 and FY2024 AL ACFR Governmental Funds statements. If the source prints "Charges", correct the 8 labels and re-run the affected years; if the source genuinely prints "Changes", add a one-line comment at line 297 documenting the verified source-label change so the next reader doesn't re-open this.

### WR-03: KY header comment claims FY2023 NASBO row is replaced — it is not (intentionally)

**File:** `scripts/processKYAcfr.js:8` (same text at `scripts/processKYRevenueAcfr.js:8`)
**Issue:** Line 8 says "Replaces the NASBO operating rows on the KY state node in place ... for FY2023/FY2024". FY2023 is absent from the years array (line 401), `EXPENDITURES`, and `SOURCES` — the FY2023 NASBO operating row is deliberately left in place per the documented honest hole (lines 17–25 and 114-02-KY-LOADLOG.md). The boilerplate on line 8 directly contradicts the honest-hole note 9 lines below it. In a codebase where these headers are the operative provenance record, a future maintainer acting on line 8 could wrongly conclude the surviving NASBO FY2023 row is stale residue and delete it.
**Fix:** In both KY files, change line 8 to: "Replaces the NASBO operating row on the KY state node in place (same (muni,fy,'operating') RPC key) for FY2024 only; FY2023 NASBO row intentionally retained (see HONEST HOLE below); other FYs net-new."

### WR-04: Ephemeral data_sources row leaks on every error path — no try/finally around cleanup

**File:** `scripts/processSCAcfr.js:440–468` (same pattern in all 10 files, e.g. processSCRevenueAcfr.js:491–519, processKYAcfr.js:417–445, processUTAcfr.js:232–260, processALAcfr.js:418–446, processLAAcfr.js:712–740)
**Issue:** The "ephemeral" data_sources row is inserted (SC operating line 440), but every failure path between insert and the end-of-run delete (line 468) calls `process.exit(2)` directly — validation failure (446), RPC error (458–459), stamp-lookup miss (466), stamp failure (464) — and a thrown exception lands in `main().catch` (471), which also skips cleanup. Any mid-run failure leaves an orphaned data_sources row, contradicting the "leaves 0 residue" guarantee in the comment on line 468. The delete-by-dataset_id at line 439 only self-heals if the same loader is re-run; a one-off failed run leaves permanent residue (the exact WR-05/LOAD-01 condition Phase 111 was shipped to eliminate).
**Fix:** Wrap the per-FY loop in `try { ... } finally { if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); }` and replace in-loop `process.exit(2)` with a thrown error so the finally block runs before exit.

### WR-05: `parseArgs` with `strict: false` — a mistyped `--dry-run` silently performs a live production write

**File:** `scripts/processSCAcfr.js:422` (same in all 10 files: processSCRevenueAcfr.js:473, processKYAcfr.js:399, processKYRevenueAcfr.js:373, processUTAcfr.js:214, processUTRevenueAcfr.js:184, processALAcfr.js:400, processALRevenueAcfr.js:321, processLAAcfr.js:694, processLARevenueAcfr.js:335)
**Issue:** `strict: false` makes unknown flags silently ignored. Running `node scripts/processSCAcfr.js --dryrun` (or `--dry_run`, `--fy=2024 --dryRun`) does not error — it runs a full live load against the production Supabase database, since `.env.local` supplies the service key automatically. For a script whose only safety toggle is that one flag, silent typo-tolerance defeats the toggle.
**Fix:** Use `strict: true` (with `allowPositionals: false`) so an unrecognized option throws before any client is created; the two declared options are already the complete surface.

### WR-06: Per-year validation runs inside the write loop — a failing year aborts mid-run, leaving a partial load

**File:** `scripts/processSCAcfr.js:443–446` (same in all 10 files)
**Issue:** `validate(fy)` is called immediately before each year's RPC write. If year N fails validation (e.g. after a future data edit), years 1..N-1 have already been written and the process exits mid-run — leaving a partially loaded series plus the WR-04 orphaned data_sources row. Since all data is static and known before any write, validation of every target year should gate the entire run.
**Fix:** Before creating the data_sources row: `for (const fy of years) if (EXPENDITURES[fy] && !validate(fy)) process.exit(2);` — then the write loop can assume validated data.

### WR-07: Budgets stamp-lookup select error is swallowed and misreported as a missing row

**File:** `scripts/processSCAcfr.js:461` (same in all 10 files: processSCRevenueAcfr.js:512, processKYAcfr.js:438, processKYRevenueAcfr.js:412, processUTAcfr.js:253, processUTRevenueAcfr.js:223, processALAcfr.js:439, processALRevenueAcfr.js:360, processLAAcfr.js:733, processLARevenueAcfr.js:374)
**Issue:** `const { data: bud } = await supabase...maybeSingle();` discards the `error` field. A transient network/DB error (or a `maybeSingle()` multiple-rows error) yields `bud === undefined`, which falls into the `else` branch and prints the misleading "Could not find FY{fy} budget row to stamp source" before exiting — sending whoever debugs it hunting for a missing row that exists. Meanwhile the RPC write for that FY already succeeded, so the row is live but unstamped (no source_url/data_source label), violating the always-sourced rule until re-run.
**Fix:** Destructure and check the error: `const { data: bud, error: selErr } = ...; if (selErr) { console.error(\`stamp lookup failed: ${selErr.message}\`); process.exit(2); }` before the `bud?.id` check.

## Info

### IN-01: All 10 headers say "Phase 113" — these are Phase 114 loaders

**File:** `scripts/processSCAcfr.js:8` (same at line 8 of all 10 files)
**Issue:** The generator template carried the Phase-113 attribution forward; the LOADLOGs and plans for these five states live under `.planning/phases/114-...`. Misattributes provenance to the wrong phase in every file header.
**Fix:** s/Phase 113/Phase 114/ in all 10 headers; parameterize the phase number in gen_state.py before Phase 115.

### IN-02: Hardcoded production Supabase URL fallback

**File:** `scripts/processSCAcfr.js:66` (same in all 10 files)
**Issue:** `SUPABASE_URL` defaults to the production instance when the env var is absent, so an environment misconfiguration silently targets production. Long-standing convention across the existing loader fleet (and the key still must come from env), so noted for consistency rather than as new debt.
**Fix:** Optionally fail closed when `process.env.SUPABASE_URL` is unset, matching the existing `SUPABASE_KEY` check.

### IN-03: `loadEnv()` parsing is fragile

**File:** `scripts/processSCAcfr.js:57–61` (same in all 10 files)
**Issue:** Splits every line on `=` with no comment handling (`# FOO=bar` sets a key named `# FOO`) and no quote stripping (`KEY="value"` keeps the quotes). Works for the current well-formed `.env.local` but breaks silently on common `.env` idioms.
**Fix:** Skip lines matching `/^\s*(#|$)/` and strip matching surrounding quotes from the value; or use dotenv.

### IN-04: ~90% of each file is duplicated template code across the 10 files (and the 10 Phase-113 siblings)

**File:** `scripts/processSCAcfr.js:51–471` et al.
**Issue:** `loadEnv`, `clampForRender`, `validate`, `buildTree`, and the entire `main()` body are byte-identical modulo state constants across 20+ loaders. Every template defect (WR-04–WR-07) must now be fixed in 20+ places; the AL fiscal-year-start variant is the only structural divergence.
**Fix:** Acceptable for this phase (generator-produced, matches the established mold), but Phase 115's extractor work is the natural point to extract a shared `scripts/lib/stateAcfrLoader.mjs` that takes `{stateConfig, data}` — fixing WR-04/05/06/07 once.

### IN-05: AL header claims a "uniform 6-revenue-category / 11-12-expenditure-category statement shape" — the embedded data has 5–6 revenue and 7–10 expenditure categories

**File:** `scripts/processALAcfr.js:46–47` (same text in processALRevenueAcfr.js:46–47)
**Issue:** No AL year has 11 or 12 expenditure categories (max is 10: FY2003/2004/2010/2025; min is 7: FY2013/2015), and several revenue years have 5 categories (FY2002, 2005, 2019, 2021–2025). The counts in the comment don't describe the data below it.
**Fix:** Correct the counts, or drop the numeric claim and keep "uniform statement shape".

### IN-06: Tie-verified but anomalous values worth a one-line source recheck

**File:** `scripts/processALRevenueAcfr.js:126, 134`; `scripts/processSCRevenueAcfr.js:424`
**Issue:** (a) AL FY2003 and FY2004 both report exactly `75_612` for "Federal Grants and Reimbursements" — an improbable two-year repeat, though both years' sums tie exactly to their distinct printed totals, so a compensating second error would be required for this to be wrong. (b) SC FY2024 "Licenses, fees, and permits" is `51_104` vs `382_111` (FY2023) and `964_578` (FY2025) — an order-of-magnitude dip that reverses; also ties exactly. Both are most likely genuine, but each is the kind of value a wrong-row/wrong-column pick could produce while still tying if the total came from the same misread region.
**Fix:** One-glance confirmation against the printed FY2004 AL and FY2024 SC statements; note the result in the LOADLOG if checked.

### IN-07: `--fy` with an out-of-scope year warns but exits 0 with "Done."

**File:** `scripts/processSCAcfr.js:444, 469` (same in all 10 files)
**Issue:** `node scripts/processKYAcfr.js --fy 2023` (or a typo like `--fy 224`) prints "No data/source for FY2023", loads nothing, then prints "Done." and exits 0. Wrapping automation (retry loops, batch scripts) reads that as success.
**Fix:** When `targetFY` is set and has no data, exit non-zero (or at least print an unambiguous "0 years loaded" summary).

---

_Reviewed: 2026-07-03T03:26:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
