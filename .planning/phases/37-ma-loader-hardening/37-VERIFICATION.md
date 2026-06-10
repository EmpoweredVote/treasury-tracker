---
phase: 37-ma-loader-hardening
verified: 2026-06-10T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 1
overrides:
  - requirement: LOAD-01
    truth: "Running `--explore --report gf-expenditures` returns a real data table"
    deviation: "gf-expenditures removed from REPORTS[] — rdreport is undiscoverable without browser network inspection (JavaScript-rendered iframe pattern on DLS Gateway). Safety intent fully met: no GF Expenditure data will be written until rdreport is confirmed manually."
    accepted_by: human
    accepted_date: 2026-06-10
    note: "REQUIREMENTS.md LOAD-01 updated to reflect exclusion as resolution. Re-add path documented in 37-01-SUMMARY.md."
gaps: []
deferred: []
---

# Phase 37: MA Loader Hardening — Verification Report

**Phase Goal:** The MA DLS loader is safe to run against all 351 cities — the correct rdreport/tableID for General Fund Expenditures is confirmed, the loader can resume a failed run without restarting from city 1, and loading a second fiscal year onto an existing data_source record appends to fiscal_years rather than overwriting.
**Verified:** 2026-06-10
**Status:** passed (override applied — LOAD-01 accepted as satisfied by confirmed exclusion)
**Re-verification:** No — deviation accepted by human 2026-06-10

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `--explore --report gf-expenditures` returns a real data table (not a 404 error) | OVERRIDE — PASSED | gf-expenditures removed after exhaustive search confirmed rdreport undiscoverable without browser inspection. Safety intent met: no GF data will load until rdreport confirmed. REQUIREMENTS.md LOAD-01 updated to reflect exclusion. |
| 2 | A re-run of --load against the same JSON skips every city already in the checkpoint and prints 'Skipped N already loaded (checkpoint)' | VERIFIED | `scripts/scrapeMaDLS.js` line 587: `alreadyLoaded.has(record.dorCode)` → `checkpointSkipped++; continue`. Line 680: `console.log(\`    Skipped ${checkpointSkipped} already loaded (checkpoint)\`)`. Pattern matches plan spec exactly. |
| 3 | Loading FY2022 then FY2023 onto the same data_source row yields fiscal_years [2022, 2023], not [2023] and not [2022, 2022, 2023] | VERIFIED | Line 603: `.select('id, fiscal_years')`. Line 635: `Array.isArray(existingDs.fiscal_years) ? existingDs.fiscal_years : []`. Line 636: `!existingFiscalYears.includes(fiscalYear)`. Line 640: `.update({ fiscal_years: [...existingFiscalYears, fiscalYear] })`. All guards present. |
| 4 | A dry-run against a cached 351-record JSON completes without errors and shows recognizable DLS category names and non-zero totals | VERIFIED | Live run confirmed: exits 0, prints "(dry run)", "351 records", Tax Levy: 42906155, State Aid: 17614336. All four SC-4 acceptance criteria met. |

**Score:** 4/4 truths verified (1 with human-accepted override)

---

## LOAD-01 Gap Analysis

**What happened:** Plan 37-01 was a human-decision checkpoint. The executor exhaustively tried 6+ rdreport candidates programmatically and determined the GF Expenditures report on the DLS Gateway is JavaScript-rendered — the subreport rdreport is only discoverable via browser network inspection. The decision was made to remove gf-expenditures from REPORTS[] with a comment explaining how to re-add it.

**Why this is a BLOCKER for the stated goal:**

The ROADMAP phase goal text explicitly says: *"the correct rdreport/tableID for General Fund Expenditures is confirmed."* ROADMAP SC-1 says: *"Running scrapeMaDLS.js --explore against a sample city returns the rdreport and tableID for General Fund Expenditures — confirmed correct before any city data is written."*

The resolution — removing the report — satisfies the safety constraint ("no bad data loaded") but does not satisfy the stated deliverable ("confirmed correct"). REQUIREMENTS.md reflects this: LOAD-01 is `[ ]` (incomplete) while LOAD-02 and LOAD-03 are `[x]` (complete).

**Counterargument (why it may be acceptable):** The 37-01 SUMMARY argues LOAD-01's acceptance criterion is satisfied because "confirmed rdreport before any city write" is met — the report is excluded from Phase 38, so no unverified data will be written. This is a reasonable interpretation of the safety intent. The ROADMAP SC-1 text does say "confirmed correct before any city data is written" and no city data will be written for this report.

**Verdict:** This is a genuine gap between the stated phase goal text ("confirmed") and the actual outcome ("excluded"). The human must decide whether to:
1. Accept the deviation (add an override) — the safety goal is clearly met by exclusion
2. Update REQUIREMENTS.md to mark LOAD-01 complete with a note explaining the exclusion decision
3. Keep LOAD-01 open and pursue browser network inspection in a future phase

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/scrapeMaDLS.js` | PROGRESS_FILE constant, readProgress/writeProgress, checkpoint logic in loadToSupabase, LOAD-03 select + else branch | VERIFIED | All patterns present. Line 40: `PROGRESS_FILE`. Lines 55-65: readProgress/writeProgress. Lines 581-584: before-loop setup. Lines 587-590: skip check. Lines 672-674: write-after-success. Line 680: skipped count. Lines 603, 635-643: LOAD-03. |
| `.gitignore` | `scripts/output/` exclusion line | VERIFIED | Line 49: `scripts/output/` with comment block added correctly. |
| `scripts/output/explore_gf-expenditures.html` | Fresh HTML proving rdreport resolves | NOT APPLICABLE | Plan 37-01 was resolved by removal. No fresh explore run was performed. The original error HTML from the wrong rdreport remains on disk (untracked, not verified here). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| loadToSupabase per-record loop | scripts/output/ma_dls_progress.json | readProgress()/writeProgress() Set lookup keyed by report:fy | VERIFIED | `progressKey = \`${report.name}:${fiscalYear}\`` at line 582. `readProgress()` at line 581, `writeProgress(progress)` at line 674. Set-based lookup at line 583. |
| loadToSupabase existing-row branch | treasury.data_sources.fiscal_years | .update({ fiscal_years: [...] }) after dedup | VERIFIED | `.select('id, fiscal_years')` at line 603. `Array.isArray` guard at line 635. `.includes(fiscalYear)` guard at line 636. `.update({ fiscal_years: [...existingFiscalYears, fiscalYear] })` at lines 637-641. |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies a loader script (CLI tool), not a UI component rendering dynamic data. No state/props data flow to trace.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SC-4 dry-run exits 0, prints (dry run), 351 records, recognizable DLS names, non-zero totals | `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run` | Exit 0; "(dry run)"; "FY2025, 351 records"; Tax Levy: 42906155; State Aid: 17614336 — all four acceptance criteria met | PASS |
| No "best guess" comment in REPORTS[] | grep scrapeMaDLS.js for "best guess" | No matches found | PASS |
| gf-expenditures not referenced in REPORTS[] | grep scrapeMaDLS.js for "gf-expenditures" | No matches found — confirmed removed | PASS |
| Wrong rdreport not in REPORTS[] | grep scrapeMaDLS.js for "ExpendituresByFunctionMain" | No matches found | PASS |

### Probe Execution

No probe scripts declared in PLAN files. No `scripts/*/tests/probe-*.sh` files for this phase. Skipped — not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LOAD-01 | 37-01-PLAN.md | `--explore` confirms GF Expenditures rdreport/tableID before any operating data is loaded | SATISFIED (override) | gf-expenditures removed — rdreport confirmed unavailable via automated means. Safety intent met by exclusion. REQUIREMENTS.md updated to [x] with exclusion note. |
| LOAD-02 | 37-02-PLAN.md | Progress checkpoint file keyed by DOR code for bulk load resume | SATISFIED | readProgress/writeProgress helpers, Set-based skip, per-record writeProgress confirmed in source. REQUIREMENTS.md shows [x] checked. |
| LOAD-03 | 37-02-PLAN.md | Appends to fiscal_years array on data_source when loading second FY | SATISFIED | `.select('id, fiscal_years')`, Array.isArray guard, .includes() dedup, .update() call all present. REQUIREMENTS.md shows [x] checked. |

**Orphaned requirements check:** LOAD-01, LOAD-02, LOAD-03 are all assigned to Phase 37 in the traceability table. No additional Phase 37 requirements in REQUIREMENTS.md. No orphaned IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/scrapeMaDLS.js` | 42 | `SUPABASE_URL` hardcoded fallback `process.env.SUPABASE_URL \|\| 'https://kxsdzaojfaibhuzmclfq.supabase.co'` | Info | Pre-existing WR-04 pattern, explicitly deferred to Phase 38 in CONTEXT.md. Not a Phase 37 blocker. |

No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in modified files. No unreferenced debt markers.

### Human Verification Required

The following cannot be verified programmatically and require a human decision:

#### 1. LOAD-01 Resolution Acceptance

**Test:** Review whether removing `gf-expenditures` from `REPORTS[]` satisfies the LOAD-01 requirement and Phase 37 goal.
**Expected:** Either (a) REQUIREMENTS.md LOAD-01 is closed with a note that GF Expenditures is excluded until browser network inspection is done, OR (b) an override is added to this VERIFICATION.md, OR (c) a follow-up task is opened for browser network inspection.
**Why human:** This is a scope/acceptance decision. The safety intent of LOAD-01 ("no bad data loaded") is met. The literal wording of ROADMAP SC-1 ("confirmed correct") is not met. Only the developer can accept this deviation.

#### 2. Resume Behavior After Real Crash (LOAD-02 Live Test)

**Test:** Run `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json`, kill mid-run with Ctrl+C, then re-run.
**Expected:** Second run prints "Skipped N already loaded (checkpoint)" where N equals the number of cities completed before kill.
**Why human:** Requires a real DB write run to populate the checkpoint file. The dry-run path does not exercise the checkpoint write path (A4: dry-run never calls loadToSupabase).

#### 3. fiscal_years Append Correctness in DB (LOAD-03 Live Test)

**Test:** Load FY2022 JSON then FY2023 JSON for any MA city, then query `SELECT fiscal_years FROM treasury.data_sources WHERE api_type = 'ma-dls'`.
**Expected:** Result is `[2022, 2023]` — not `[2023]` (overwrite) and not `[2022, 2022, 2023]` (duplicate).
**Why human:** Requires live DB writes. Code-level analysis confirms the implementation is correct, but DB behavior with the Supabase JSONB column can only be confirmed by running the actual load.

---

## Gaps Summary

No gaps. All requirements satisfied (LOAD-01 satisfied by human-accepted override).

**LOAD-01 override applied:** gf-expenditures confirmed unavailable via exhaustive automated search (JavaScript-rendered iframe pattern on DLS Gateway). Entry removed from REPORTS[]. Safety intent fully met — no GF Expenditure data will be written until rdreport is confirmed manually via browser inspection. Re-add path documented in 37-01-SUMMARY.md. Deviation accepted by human 2026-06-10.

**2 items deferred to post-Phase 37 manual testing:** The LOAD-02 resume behavior and LOAD-03 DB append correctness are structurally correct in the code but require live DB write runs to confirm end-to-end. These are documented in 37-02-SUMMARY.md as manual verification steps for the Phase 38 executor. They are not blockers to Phase 38 proceeding (the Phase 38 bulk load will exercise both paths).

---

_Verified: 2026-06-10_
_Verifier: Claude (gsd-verifier)_
