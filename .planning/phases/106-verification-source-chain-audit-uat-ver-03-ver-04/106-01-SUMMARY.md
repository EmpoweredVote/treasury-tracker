---
phase: 106-verification-source-chain-audit-uat-ver-03-ver-04
plan: "01"
subsystem: verification
tags: [ver-03, acfr, re-derivation, blind-rekey, pdftotext, ca, ny, fl, pa, il]
dependency_graph:
  requires: [104-DEEPEN-GAPLOG.md, 105-PA-IL-LOADLOG.md, 103-DEEPEN-SOURCES.md, 103-PA-IL-SOURCES.md]
  provides: [scripts/verify-phase106-rederive.mjs, 106-REDERIVATION.md, VER-03-part-a]
  affects: [106-02-PLAN (cohort audit consumes 106-REDERIVATION.md)]
tech_stack:
  added: []
  patterns: [pdftotext -table GF blind rekey, native-https DB query without supabase-js, env walk-up discovery]
key_files:
  created:
    - scripts/verify-phase106-rederive.mjs
    - .planning/phases/106-verification-source-chain-audit-uat-ver-03-ver-04/106-REDERIVATION.md
  modified: []
decisions:
  - "D-03 exact-0 bar enforced: no $10M tolerance band carried from phase 102 harness"
  - "CA FY2013 chosen as random middle (year 6/12 of FY2008-FY2019)"
  - "NY FY2009 chosen as random middle (year 7/12 of FY2003-FY2014; exercises recession revenue dip)"
  - "Env discovery walks up 6 parent dirs from worktree __dirname to find main-repo .env"
  - "PDF caches shared from main repo via symlinks (_acfr-tmp/{ny,fl,il,pa} -> main repo caches)"
metrics:
  duration: "~4 hours (including page-range empirical debugging)"
  completed: "2026-06-30T21:56:48Z"
  tasks: 2
  files: 2
---

# Phase 106 Plan 01: Loader-Independent VER-03 Re-Derivation Harness + 24/24 Exact Ties Summary

**One-liner:** Blind `pdftotext -table` GF re-derivation of 12 FY-state targets for CA/NY/FL/PA/IL — 24/24 checks at exact delta=$0 with D-03 zero-tolerance bar; VER-03 part (a) satisfied.

---

## What Was Built

### Task 1 — `scripts/verify-phase106-rederive.mjs`

A Node.js script that independently re-derives v2.12's added data surface without importing any `scripts/process*.js` loader code (D-02 blind method):

- Imports only Node built-ins: `node:fs`, `node:child_process`, `node:https`, `node:http`, `node:path`, `node:url`
- Resolves CA/NY/FL municipality IDs from the DB by entity name at runtime; PA/IL hardcoded from 105-PA-IL-LOADLOG.md
- Fetches source ACFR PDFs (with CA SCO soft-404 guard: `Content-Type: application/pdf` + payload >= 1 MB)
- Runs `pdftotext -table -f {start} -l {end} {pdf} -` on the Governmental Funds Statement pages
- Re-keys General Fund column independently (first numeric token on "Total revenues" / "Total expenditures" lines)
- Applies state unit multipliers (NY x1,000,000; CA/FL/PA/IL x1,000)
- Diffs against live `treasury.budgets.total_budget` for (municipality_id, fiscal_year, dataset_type)
- D-03 PASS bar: `abs(delta) === 0` exactly — no tolerance band
- Exits 0 if all checks pass, exits 2 if any delta is non-zero

Risk-weighted sample (12 FY targets x 2 datasets = 24 checks):
- CA: FY2008 (oldest bookend), FY2013 (random middle), FY2019 (newest deepened bookend)
- NY: FY2003 (oldest bookend, millions scaling), FY2009 (random middle, recession dip), FY2014 (newest deepened bookend)
- FL: FY2021 (only deepened FY + negative-clamp year: -$398,287K Investment earnings losses)
- PA: FY2016 (oldest bookend, hyphen URL), FY2025 (newest bookend, %20 URL)
- IL: FY2021 (oldest bookend), FY2022 (negative-clamp: -$197,857K Interest income), FY2025 (newest bookend)

### Task 2 — `106-REDERIVATION.md`

Per-FY tie log documenting:
- Full 24-row table: State | FY | Dataset | Independent total | DB total_budget | Delta | Disposition
- All 24 rows: delta = $0, disposition = "PASS — exact tie"
- Random-middle-year documentation (D-01 reproducibility)
- Negative-clamp year explanations (FL FY2021, IL FY2022)
- Source URLs used for blind re-fetch (D-02 independence documented)
- T-106-01 soft-404 guard: all 3 CA PDFs confirmed application/pdf (2.7 MB, 3.3 MB, 5.1 MB)
- Disposition of non-zero deltas: **None** — D-05 not triggered

---

## Verification Results

```
24 / 24 checks PASS (D-03: exact delta=0 required)
PASS -- All 24 Phase 106 re-derivation checks tie at exact delta=0
exit=0
```

Key spot-checks confirmed (from plan acceptance criteria):
- NY FY2003: revenue $29,250,000,000 + operating $40,910,000,000 ✓
- CA FY2008: revenue $97,774,378,000 + operating $98,975,042,000 ✓
- CA FY2019: revenue $140,503,627,000 + operating $129,113,153,000 ✓
- FL FY2021: revenue $46,989,188,000 + operating $37,277,963,000 ✓
- PA FY2016: revenue $56,741,506,000 + operating $56,135,869,000 ✓
- PA FY2025: revenue $92,414,817,000 + operating $94,758,255,000 ✓
- IL FY2021: revenue $63,136,008,000 + operating $59,523,406,000 ✓
- IL FY2022: revenue root $73,204,339,000 (negative-clamp nets -$197,857K) ✓
- IL FY2025: revenue $78,342,927,000 + operating $75,456,922,000 ✓

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Env file not found from worktree __dirname**
- **Found during:** Task 1 first run
- **Issue:** Script searched `../.env.local` / `../.env` relative to `scripts/__dirname` in the worktree, which resolves to the worktree root — not the main repo where `.env` actually lives.
- **Fix:** Replaced fixed-path search with a directory-tree walk (up to 6 parent directories), stopping when both `SUPABASE_URL` and service key are found.
- **Files modified:** `scripts/verify-phase106-rederive.mjs`
- **Commit:** `8b39f5b` (incorporated into Task 1 commit)

**2. [Rule 3 - Blocking] Wrong PDF page ranges for older CA/NY/FL ACFR formats**
- **Found during:** Task 1 testing
- **Issue:** Initial page ranges copied from Phase 102 harness (pp.58-67) were calibrated for FY2020-2025 CA ACFRs. Older CAFRs (FY2008-FY2019) and older NY/FL formats have the GF statement at different pages.
- **Fix:** Empirically determined correct ranges using `pdftotext` + `grep "Total revenues\|Total expenditures"` across candidate page ranges:
  - CA FY2008: pp.48-56; CA FY2013: pp.53-62; CA FY2019: pp.58-67
  - NY all three years: pp.33-42
  - FL FY2021: pp.33-42
  - PA FY2016/2025: pp.48-62
  - IL FY2021/2022/2025: pp.38-50
- **Files modified:** `scripts/verify-phase106-rederive.mjs`
- **Commit:** `8b39f5b` (incorporated into Task 1 commit)

**3. [Rule 3 - Blocking] PDF cache not present in worktree; cacheFile naming inconsistency**
- **Found during:** Task 1 testing
- **Issue:** Worktree `_acfr-tmp/` was not populated. Existing PDFs live in main repo at `_acfr-tmp/ny/`, `_acfr-tmp/fl/`, `_acfr-work/il/`, `_acfr-work/pa/`. Additionally, downloaded CA PDFs had name `ca-cafr-2008.pdf` while main repo had `cafr08web.pdf`.
- **Fix:** Created symlinks from worktree `_acfr-tmp/{ny,fl,il,pa}` to main repo caches. Updated cacheFile names in TARGETS config to `cafr08web.pdf`, `cafr13web.pdf`, `cafr19web.pdf` to match main repo conventions.
- **Files modified:** `scripts/verify-phase106-rederive.mjs`
- **Commit:** `8b39f5b` (incorporated into Task 1 commit)

---

## Known Stubs

None. Both artifacts are complete and contain real data. The harness runs live against the DB and real PDFs.

---

## Threat Flags

No new threat surface introduced. T-106-01 (CA SCO soft-404) was mitigated in the harness as planned. All DB access is read-only. No network endpoints, auth paths, or schema changes added.

---

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `8b39f5b` | `feat(106-01): build loader-independent ACFR re-derivation harness for v2.12 VER-03` |
| Task 2 | `9664295` | `docs(106-01): write 106-REDERIVATION.md -- 24/24 exact ties VER-03 satisfied` |

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `scripts/verify-phase106-rederive.mjs` exists | FOUND |
| `106-REDERIVATION.md` exists | FOUND |
| `106-01-SUMMARY.md` exists | FOUND |
| Commit `8b39f5b` (Task 1) exists | FOUND |
| Commit `9664295` (Task 2) exists | FOUND |
