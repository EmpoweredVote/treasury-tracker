---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
reviewed: 2026-07-03T04:55:00Z
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
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 114: Code Review Report (RE-REVIEW after fix pass)

**Reviewed:** 2026-07-03T04:55:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Re-review of all 10 Phase-114 state-ACFR loaders (SC/KY/UT/AL/LA × operating/revenue) after the fix pass (commits 5176f38, 6cfc208, 2020925, fba8977, abb37f5, 97dfa1c, 6f393c4). Every file was fully re-read; all 10 loaders were independently re-executed with `--dry-run` (exit 0 across all 10 — every embedded fiscal year's category sum ties to its printed General Fund control within the 10-thousands tolerance). Strict-flag behavior was verified live: `--bogus-flag` and `--dryrun` both exit 2 with a clear "Unknown option" message. Cross-file invariants re-checked: EXPECTED_MUNI_ID matches within each state pair; AL stamps Sep-30 dates and `fiscal_year_start_month: 10` on both the data_sources payload and the budgets update in both files; KY's FY2023 honest hole is consistent across SOURCES, data arrays, years lists, and fiscal_years payloads in both files; P2 clamp/label path is present and identical in all 10 (accepted cohort design — clamped children intentionally exceed the printed root total by the clamp magnitude, per Ph113 precedent).

**All 7 prior findings are genuinely resolved** (verification detail below). The fixes did not break anything I could detect, but one residual edge of the WR-05 failure class survives: strict parsing now rejects mistyped flag *names*, while a mistyped flag *value* (`--fy 224`, `--fy abc`) still silently no-ops with exit 0 — demonstrated live. That is the single new Warning.

## Prior-Finding Verification (WR-01 … WR-07)

| Prior | Status | Evidence |
|-------|--------|----------|
| WR-01 (UT FY2020 trailing-space label) | **RESOLVED** | `scripts/processUTAcfr.js:111` now reads `'Health and Environmental Quality'` (no trailing space). Regex scan for `name: '...[space]'` across all 10 files: zero matches. |
| WR-02 (AL "Interest and Other Changes") | **RESOLVED** | `scripts/processALAcfr.js:297-300` now carries a comment documenting the label as VERIFIED source-faithful (checked against `_acfr-work/al/AL2018–AL2025.txt`; AL's own caption typo copied forward FY2018+; explicit "do not correct to Charges"). Comment is present, specific, and accurate — not re-opened. |
| WR-03 (KY header misstated FY2023 replacement) | **RESOLVED** | `scripts/processKYAcfr.js:8` now says "for FY2024 only; FY2023 NASBO row intentionally retained (see HONEST HOLE below)"; `scripts/processKYRevenueAcfr.js:8` says "FY2023 intentionally absent". No stale FY2023-replacement claims remain in either file. |
| WR-04 (cleanup must survive error paths) | **RESOLVED** | All 10 files wrap the per-FY loop in `try { … } finally { if (!dryRun && ds) …delete().eq('id', ds.id); }` (e.g. `processSCAcfr.js:445-474`). No `process.exit()` calls inside the `try` block in any file — all mid-run failures are `throw`s, so `finally` always runs before `main().catch` exits 2. The `ds` insert happens before `try` with only a `console.log` between, and `ds` is checked for truthiness in `finally`. Verified in all 10. |
| WR-05 (parseArgs strict) | **RESOLVED** | All 10 use `parseArgs({ …, strict: true, allowPositionals: false })`. Live-verified: `node scripts/processSCAcfr.js --dry-run --bogus-flag` → "Fatal: Unknown option '--bogus-flag'", exit 2; `--dryrun` (typo) → exit 2. See WR-01 (new) below for the residual flag-*value* gap. |
| WR-06 (validate all target years before any write) | **RESOLVED** | All 10 run `for (const fy of years) { if (DATA[fy] && !validate(fy)) { …; process.exit(2); } }` before the Supabase client is even created (e.g. `processSCAcfr.js:427`), so a failing later year aborts before ANY write — never mid-run. |
| WR-07 (surface stamp-lookup select errors) | **RESOLVED** | All 10 destructure `{ data: bud, error: selErr }` and `throw new Error(\`FY… stamp lookup failed: ${selErr.message}\`)` before the `bud?.id` check (e.g. `processSCAcfr.js:463-464`). A select failure can no longer be misreported as a missing row. |

## Warnings

### WR-01: `--fy` value is never validated — a typo'd fiscal year silently no-ops with exit 0

**File:** `scripts/processSCAcfr.js:423-424, 447` (identical pattern in all 10 files: KY 400-401/424, UT 215-216/239, AL 405-406/429, LA 695-696/719, and the same lines ±1 in each revenue twin)
**Issue:** The prior WR-05 fix (strict parseArgs) closed the mistyped-flag-*name* hole, but the flag-*value* half of the same failure class survives. `targetFY = parseInt(opts.fy, 10)` accepts any string: `--fy abc` yields `[NaN]`, `--fy 1999` / `--fy 224` yield a year with no data. In every case the up-front validation loop skips (`EXPENDITURES[fy]` is undefined), the per-FY loop hits `console.warn('No data/source for FY…'); continue;`, and the script prints `Done.` and **exits 0**. Verified live: `--fy abc`, `--fy 1999` → exit 0. In a live (non-dry) run this also creates and then deletes the ephemeral data_sources row, so an operator or pipeline checking the exit code sees indistinguishable-from-success output while zero rows were loaded. For a single-`--fy` invocation, "the one year I asked for doesn't exist" is an error, not a warning — the current behavior converts a typo into a silent no-op.
**Fix:** Validate the resolved target before the WR-06 loop, in all 10 files:
```js
const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
if (opts.fy && (!Number.isInteger(targetFY) || !EXPENDITURES[targetFY] || !SOURCES[targetFY])) {
  console.error(`--fy ${opts.fy}: no data/source for that fiscal year (valid: ${Object.keys(EXPENDITURES).join(', ')})`);
  process.exit(2);
}
```
(Use `REVENUE` in the revenue twins.) This also gives KY's documented FY2023 hole a loud, correct error instead of a warn-and-exit-0. The full-run path is unaffected (its years arrays exactly match the data keys in all 10 files — re-verified).

## Info

### IN-01: Ephemeral data_sources cleanup ignores the delete's own error — "0 residue" can silently fail

**File:** `scripts/processSCAcfr.js:441, 473` (same two lines in all 10 files)
**Issue:** supabase-js never throws; both the pre-clean `delete().eq('dataset_id', …)` and the `finally`-block `delete().eq('id', ds.id)` discard their `{ error }` result. If the finally-delete fails (e.g. the same network drop that aborted the run), the row remains as residue with no message and — on the success path — exit code 0, contradicting the "leaves 0 residue" comment. Mitigated by the next run's pre-clean-by-dataset_id, but a silent failure of the lifecycle's whole purpose deserves at least a log line.
**Fix:** `const { error: delErr } = await …; if (delErr) console.error(\`WARNING: ephemeral data_sources cleanup failed (${ds.id}): ${delErr.message} — residue until next run\`);`

### IN-02: Mid-run failure leaves earlier fiscal years loaded, later years stale (no cross-year atomicity)

**File:** `scripts/processSCAcfr.js:446-470` (per-FY loop; same in all 10)
**Issue:** Each FY is a separate RPC + stamp; a throw at FY *k* leaves FY&lt;k upgraded and FY≥k untouched, so the node temporarily mixes ACFR and pre-existing rows. Acceptable for these idempotent, re-runnable loaders (re-running completes the load), and the WR-06 fix already eliminated the most likely mid-run abort cause (validation). Recorded so the partial-state window is a known, accepted property rather than a surprise.
**Fix:** None required; re-run the loader to completion on any mid-run failure.

---

_Reviewed: 2026-07-03T04:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
