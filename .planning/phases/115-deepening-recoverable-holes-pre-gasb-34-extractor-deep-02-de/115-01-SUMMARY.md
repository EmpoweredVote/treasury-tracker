---
phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
plan: 01
subsystem: database
tags: [acfr, pdftotext, supabase, state-budget, new-jersey, gasb-34]

# Dependency graph
requires:
  - phase: 108-acfr-upgrade-batch-1
    provides: processNJAcfr.js / processNJRevenueAcfr.js loaders + FY2020-2025 NJ ACFR GAAP baseline
  - phase: 111-loader-debt-atomic-data-sources-upsert
    provides: ephemeral data_sources create/delete lifecycle (0-residue pattern)
provides:
  - New Jersey General Fund operating + revenue extended from 6 years (FY2020-2025) to 24 years (FY2002-2025)
  - Per-year URL map enumerated from nj.gov/treasury/omb/fr.shtml for FY2002-FY2019
  - isolateNJStatement() disambiguation fix preventing false-positive matches against NJ's Budgetary Comparison Schedule / Non-Major Governmental Funds tables
  - Phase-114 hardening (strict parseArgs, --fy validation, try/finally cleanup, surfaced select errors) applied to both NJ loaders
affects: [116-verification-source-chain-audit-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Statement-title anchoring before generic extraction: isolate the exact bare statement title+subtitle before handing a scoped snippet to a shared token-order/positional extractor, when a state's ACFR contains multiple statements sharing loose header vocabulary"

key-files:
  created:
    - .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-01-NJ-LOADLOG.md
  modified:
    - scripts/processNJAcfr.js
    - scripts/processNJRevenueAcfr.js

key-decisions:
  - "NJ has no pre-GASB-34 boundary to stop at -- it adopted GASB 34 in FY2002 (its first ACFR year), so the descent hits the archive's own edge, not a format boundary"
  - "Embedded (not runtime-parsed) architecture retained for consistency with the loader's existing Phase-108 design and to guarantee zero risk to already-loaded FY2020-2025 rows -- newly-recovered FY2002-2019 categories were extracted once via the shared parser, verified tied, then embedded as static data, mirroring the transcription discipline (not the live-dispatch architecture) of processCTAcfr.js"
  - "Caught and fixed a false-positive statement match before any data was embedded: NJ's ACFR also contains a BUDGETARY COMPARISON SCHEDULE and NON-MAJOR GOVERNMENTAL FUNDS table that satisfy the shared extractor's loose header heuristic -- isolateNJStatement() anchors on the exact bare GAAP statement title before extraction"

requirements-completed: [DEEP-03]

# Metrics
duration: 32min
completed: 2026-07-03
---

# Phase 115 Plan 01: New Jersey Pre-FY2020 Deepening Summary

**Extended New Jersey's General Fund operating + revenue from 6 years to 24 years (FY2002-2025) via URL-enumerated pre-2020 ACFRs, catching and fixing a false-positive statement-match bug before any data was embedded.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-07-03T06:57:32Z
- **Completed:** 2026-07-03T07:27:03Z
- **Tasks:** 3
- **Files modified:** 2 (scripts/processNJAcfr.js, scripts/processNJRevenueAcfr.js); 1 file created (loadlog)

## Accomplishments

- Enumerated exact per-year PDF URLs for FY2002-FY2019 from `nj.gov/treasury/omb/fr.shtml` (never derived blindly), downloaded and `pdftotext -table`-extracted all 18 candidate years to `_acfr-work/nj/`
- Confirmed NJ has NO pre-GASB-34 boundary in its available archive — FY2002 (NJ's first GASB-34 year) is the earliest year online, so the descent stops at the archive's edge, not a format boundary
- Discovered and fixed a serious false-positive extraction bug: the shared extractor's loose header heuristic matched NJ's "BUDGETARY COMPARISON SCHEDULE" table (a non-GAAP budgetary-basis figure) instead of the true GAAP "Statement of Revenues, Expenditures, and Changes in Fund Balances" — `isolateNJStatement()` now anchors on the exact bare statement title before extraction
- All 24 years (FY2002-2025) tie exactly ($0 diff) on both revenue and expenditure totals; verified the new extraction path reproduces the existing FY2020-2025 embedded totals exactly (bookend regression) before embedding the new FY2002-2019 data
- Live-loaded all 18 new years per-FY for both loaders; confirmed FY2020-2025 rows byte-identical pre/post, one FY re-run produced 0 net change, and 0 `data_sources` residue throughout
- Applied Phase-114 hardening (strict parseArgs, --fy validation, try/finally cleanup, surfaced select errors) to both loaders

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate pre-FY2020 URLs, download/extract, extend both NJ loaders, dry-run tie every recoverable year** - `6e56625` (feat)
2. **Task 2: Capture pre-load baseline, live-load new years per-FY, verify modern rows untouched + idempotency + 0 residue** - `c193235` (docs)

_Task 3 (this summary + final metadata commit) follows._

## Files Created/Modified

- `scripts/processNJAcfr.js` - NJ GF operating loader extended with FY2002-2019 URL map + embedded categories (verified via corrected extraction), Phase-114 hardening
- `scripts/processNJRevenueAcfr.js` - NJ GF revenue loader, same extension + hardening
- `.planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-01-NJ-LOADLOG.md` - Full per-FY disposition, false-positive bug writeup, units verification, idempotency + residue evidence

## Decisions Made

- **No pre-GASB-34 boundary in NJ's window:** NJ's earliest online ACFR (FY2002) is already GASB-34 format — there is nothing older to stop at, so all 18 candidate years were evaluated and all 18 tied.
- **Embedded data over runtime dispatch:** kept the loader's existing embedded-EXPENDITURES/REVENUE-map architecture (Phase 108 precedent) rather than converting to a CT-style live-download-and-parse dispatch. The newly-recovered years were extracted once via the shared parser (mirroring CT's token-order + positional discipline), verified to tie exactly, then embedded as static data — this guarantees the already-loaded FY2020-2025 rows cannot be perturbed by any runtime parsing quirk, since their embedded blocks are untouched.
- **isolateNJStatement() disambiguation:** NJ's ACFR contains three statements sharing loose header vocabulary with the true GAAP statement. Anchoring on the exact bare title/subtitle pair (not a loose "General" + "Governmental Funds" substring match) was necessary to avoid loading budgetary-basis figures mislabelled as GAAP.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] False-positive statement match against NJ's Budgetary Comparison Schedule**
- **Found during:** Task 1 (dry-run tie verification)
- **Issue:** The shared extractor (`maAcfrExtract.mjs`)'s loose `/General/` + `/Governmental Funds/i` header heuristic matched NJ's "BUDGETARY COMPARISON SCHEDULE — MAJOR GOVERNMENTAL FUNDS" table (a non-GAAP budgetary-basis actual figure) for FY2004, producing a coincidental exact tie against the WRONG total. Undetected, this would have loaded a budgetary-basis figure mislabelled "GAAP basis."
- **Fix:** Added `isolateNJStatement()` to both NJ loader files' derivation process — anchors on the exact bare "STATEMENT OF REVENUES, EXPENDITURES[,] AND CHANGES IN FUND BALANCES" title followed by a bare "GOVERNMENTAL FUNDS" subtitle (whitespace-tolerant regex, handles a `pdftotext -table` mid-word gap in FY2007's title), isolates a scoped snippet, and only then hands it to the shared token-order/positional extractors.
- **Files modified:** scripts/processNJAcfr.js, scripts/processNJRevenueAcfr.js (embedded data corrected before commit; the disambiguation logic itself lived in a scratchpad extraction script, not committed to the repo, since the loaders use embedded — not runtime-parsed — data)
- **Verification:** Re-ran extraction with the fix; all 24 years now tie against the correct GAAP statement, confirmed by reproducing the existing FY2020-2025 embedded totals exactly (regression check) and by manually inspecting the FY2002/FY2004 statement text at the matched line number.
- **Committed in:** 6e56625 (Task 1 commit — the embedded data reflects the corrected extraction)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential correctness fix caught before any data was written to the database — no incorrect data was ever live-loaded. No scope creep.

## Issues Encountered

- Initial extraction attempt (before the isolateNJStatement fix) produced plausible-looking ties for several years that were later found to be false positives against the wrong statement — resolved by debugging the extractor's matched `statementLine` and comparing against manually-read statement text.
- FY2018/FY2019 source URLs contain literal spaces (`FR 2018 Secured Final.pdf`, `NJFR2019 Complete.pdf`) — required curl `--url`/percent-encoding for successful download and %20-encoding in the stored `source_url` values.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- New Jersey is now the deepest-loaded state in the ACFR cohort alongside AL/LA/SC (24 years, FY2002-2025), with 0 honest holes and 0 pre-GASB-34 boundary.
- Ready for Phase 116's cohort-wide verification/source-chain audit/UAT, which will incorporate NJ's new 18-year window into the full re-derivation and audit pass.
- No blockers for Phase 115's other plans (CT/WI pre-GASB-34 extractor, MA holes) — this plan touched only NJ-scoped files.

---
*Phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: scripts/processNJAcfr.js
- FOUND: scripts/processNJRevenueAcfr.js
- FOUND: .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-01-NJ-LOADLOG.md
- FOUND: .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-01-SUMMARY.md
- FOUND commit: 6e56625 (Task 1)
- FOUND commit: c193235 (Task 2)
