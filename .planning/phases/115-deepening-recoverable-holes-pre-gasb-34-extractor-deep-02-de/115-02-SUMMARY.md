---
phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
plan: 02
subsystem: database
tags: [pdftotext, tesseract-ocr, pdftoppm, state-acfr, pre-gasb-34, connecticut, wisconsin]

# Dependency graph
requires:
  - phase: 109-acfr-upgrade-batch-2
    provides: processCTAcfr.js/processCTRevenueAcfr.js/processWIAcfr.js/processWIRevenueAcfr.js (the runtime-extraction loaders this plan extends)
  - phase: 111-loader-debt
    provides: ephemeral data_sources lifecycle (create/delete per run) — reused verbatim
provides:
  - scripts/pre34Extract.mjs — reusable pre-GASB-34 Combined-Statement General-Fund extractor (committed, generic, importable by any state's loader)
  - CT deepened to a full 38-year contiguous series (FY1988–FY2025), 0 honest holes
  - WI deepened to a 26-year contiguous series (FY2000–FY2025), 0 honest holes
  - CT FY2006 recovered via free OCR (pdftoppm + tesseract), embedded with full provenance
affects: [115-03-ma-deepening, 116-verification-source-chain-audit-uat]

# Tech tracking
tech-stack:
  added: [tesseract-ocr-5.4 (already installed, first use in this codebase), pdftoppm (already installed, first use)]
  patterns:
    - "Position-anchored GF-column extraction (nearest-to-anchor-token matching) for statement formats where token-order parsing misassigns blank-cell rows"
    - "OCR-transcribed years are embedded static data (not runtime-parsed) with a provenance comment; every row cross-tied against its own printed row total as the OCR-error defense"
    - "Distinct honest basis label per statement era (GAAP vs pre-GASB-34) on the same node's data_source column — no frontend change needed"

key-files:
  created:
    - scripts/pre34Extract.mjs
    - .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-02-CT-WI-LOADLOG.md
  modified:
    - scripts/processCTAcfr.js
    - scripts/processCTRevenueAcfr.js
    - scripts/processWIAcfr.js
    - scripts/processWIRevenueAcfr.js

key-decisions:
  - "Position-anchored extraction (ported from _acfr-work/extract_gf.py's proven Python design) chosen over token-order for pre34Extract.mjs, since pre-34 statements have the same blank-GF-cell risk as modern ones"
  - "CT1991/1992's period-as-thousands-separator scan quirk fixed generically (regex normalization scoped to the statement tokenizer) rather than hand-corrected per year"
  - "FY2006 OCR data embedded as static arrays (not re-parsed at runtime) since OCR output isn't stable enough to trust on every run — matches the plan's explicit guidance"
  - "WI pre-FY2000 (4-section multi-file era) intentionally NOT attempted — recorded as an honest scope boundary in the loadlog, not a hole"

patterns-established:
  - "Pre-GASB-34 title anchor: 'Combined Statement of Revenues, Expenditures, and Changes in Fund Balances' + 'All Governmental Fund Types' within ~8 lines, confirmed by a genuine Revenues:/Expenditures: section-header sequence within a bounded window (rejects ToC entries, statistical trend tables, and sibling Higher-Ed/Budget-and-Actual statements in the same CAFR)"

requirements-completed: [DEEP-02, DEEP-03, DEEP-04]

# Metrics
duration: 65min
completed: 2026-07-03
---

# Phase 115 Plan 02: Pre-GASB-34 Extractor + CT/WI Deepening + CT FY2006 OCR Summary

**Built a reusable pre-GASB-34 General-Fund extractor and used it to deepen Connecticut to a full 38-year contiguous series (FY1988–FY2025) and Wisconsin to 26 years (FY2000–FY2025), plus recovered CT's scanned FY2006 via free OCR — zero honest holes remain in either state's series.**

## Performance

- **Duration:** ~65 min
- **Completed:** 2026-07-03T08:13:05Z
- **Tasks:** 3
- **Files modified:** 6 (1 new extractor + 4 loaders + 1 loadlog)

## Accomplishments

- New `scripts/pre34Extract.mjs` anchors on the exact pre-GASB-34 statement title, rejecting every
  confounder verified present in the same CAFRs (Higher-Ed/proprietary variants, Budget-and-Actual
  statements, statistical trend tables, Table-of-Contents false-matches)
- All 14 candidate CT pre-34 years (FY1988–FY2001) tie EXACTLY ($0 diff) on both revenue and
  expenditure — a 100% clean deepening pass, no honest holes
- Both WI pre-34 years (FY2000–FY2001) tie within tolerance (one −2K rounding diff, consistent with
  the modern series' documented GAAP-rounding pattern)
- CT's scanned FY2006 recovered via `pdftoppm` + `tesseract 5.4` (both free local tools, $0 spend) —
  every one of 21 leaf rows cross-verified against its own printed row total, in addition to both
  grand totals tying
- CT is now a fully contiguous 38-year series (FY1988–FY2025) with zero honest holes anywhere
- Idempotency and 0-residue proven for both states via live re-runs and `data_sources` probes

## Task Commits

1. **Task 1: Build pre34Extract.mjs + wire into CT/WI loaders + dry-run tie all pre-34 years** - `ba118f1` (feat)
2. **Task 2: CT FY2006 OCR recovery** - `a806848` (feat)
3. **Task 3: Live-load per-FY, verify + loadlog** - `01d6582` (docs, loadlog); live DB writes not separately committed (data, not code)

**Plan metadata:** (this commit) `docs: complete plan`

## Files Created/Modified

- `scripts/pre34Extract.mjs` - New reusable pre-GASB-34 Combined-Statement GF-column extractor (position-anchored, sub-header propagate-then-clear, period-as-thousands-separator normalization)
- `scripts/processCTAcfr.js` - Added FY1988–2001 pre-34 routing + FY2006 OCR-embedded data + Phase-114 hardening
- `scripts/processCTRevenueAcfr.js` - Same, revenue side + fixed a pre-existing log-message bug (Rule 1)
- `scripts/processWIAcfr.js` - Added FY2000–2001 pre-34 routing + Phase-114 hardening
- `scripts/processWIRevenueAcfr.js` - Same, revenue side
- `.planning/phases/115-.../115-02-CT-WI-LOADLOG.md` - Full per-FY disposition, OCR provenance, idempotency evidence

## Decisions Made

- Position-anchored extraction (nearest-to-anchor-token matching) chosen for `pre34Extract.mjs` over token-order, mirroring `extract_gf.py`'s proven design — the same blank-GF-cell risk exists in pre-34 statements as modern ones
- CT1991/1992's period-as-thousands-separator scan quirk fixed with a generic regex normalization (scoped to the statement's own tokenizer) rather than a per-year hand-correction, so any future state hitting the same OCR/scan artifact is covered for free
- FY2006 OCR data embedded as static arrays rather than left as a runtime-reparsed source, per the plan's explicit "OCR output is not stable enough to re-parse on every run" guidance
- WI pre-FY2000 intentionally excluded (4-section multi-file era) — recorded as an honest scope boundary, not chased

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CT1988's "Revenues:"/"Expenditures:" header regex — trailing stray "$"**
- **Found during:** Task 1 (initial full-year sweep found CT1988 "NOT FOUND")
- **Issue:** CT1988's printed statement has a stray lone "$" character after "Revenues:" (the first data column's dollar sign orphaned onto the header line), which the original `/^\s*Revenues:?\s*$/i` regex didn't tolerate
- **Fix:** Relaxed both the `Revenues:` and `Expenditures:` header regexes to `/^\s*Revenues:?\s*\$?\s*$/i` (symmetric allowance)
- **Files modified:** scripts/pre34Extract.mjs
- **Verification:** CT1988 now ties exactly ($0/$0)
- **Committed in:** ba118f1 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed CT1991/CT1992's period-as-thousands-separator scan quirk**
- **Found during:** Task 1 (CT1991 initially "NOT FOUND"; CT1992 initially mis-parsed expTotal=7)
- **Issue:** CT1991's and CT1992's printed "Total Expenditures" row misprints the thousands separator as a period instead of a comma on that one row (`6.859.289` for 6,859,289; `7.215,567` for 7,215,567) — a scan artifact in the source PDF
- **Fix:** Added a normalization step in `numTokensWithPos()` that converts any `\d{1,3}(\.\d{3})+` run to comma-separated before tokenizing (scoped to the narrow statement tokenizer)
- **Files modified:** scripts/pre34Extract.mjs
- **Verification:** CT1991 and CT1992 both now tie exactly ($0/$0)
- **Committed in:** ba118f1 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed pre-existing display bug in processCTRevenueAcfr.js's hole-skip log message**
- **Found during:** Task 1 (while touching this file for the pre-34 wiring)
- **Issue:** The "SKIP (rev sum ... )" console message interpolated `ex.expTotal` instead of `ex.revTotal` — a pre-existing copy-paste artifact, display-only (never affected which years were skipped or what was stored)
- **Fix:** Corrected the interpolation to `ex.revTotal`
- **Files modified:** scripts/processCTRevenueAcfr.js
- **Verification:** Log message now shows the correct comparison value; no functional change
- **Committed in:** ba118f1 (Task 1 commit)

**4. [Rule 2 - Missing critical] Applied Phase-114 hardening while touching all four loaders**
- **Found during:** Task 1 (per the plan's explicit "fix-while-touching only" instruction)
- **Issue:** These Phase 108/109-era loaders predated the Phase-114 WR-01/WR-04/WR-07 hardening pattern (loose `parseArgs`, no `--fy` value validation, non-atomic cleanup on mid-run failure, silently-swallowed select errors)
- **Fix:** Applied `strict: true` parseArgs + `--fy` value validation, wrapped the per-FY write loop in `try/finally` for guaranteed ephemeral `data_sources` cleanup, surfaced `budgets`-select errors
- **Files modified:** all four loader files
- **Verification:** Dry-run and live-run behavior identical to before for existing years; mistyped-flag/invalid-year rejection confirmed via `--fy` validation logic review
- **Committed in:** ba118f1 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (2 bug fixes required to reach the tie gate, 1 cosmetic bug fix, 1 missing-critical hardening pass)
**Impact on plan:** All four were necessary to reach the plan's own tie-gate acceptance criteria (CT1988/1991/1992 would otherwise be undercounted honest holes) or were explicitly directed by the plan (fix-while-touching hardening). No scope creep.

## Issues Encountered

- The plan's automated dry-run verify commands (`grep -qi "PASS"`) don't match these loaders'
  pre-existing `"TIE"` console wording (a Phase 108/109 convention, not a `gen_state.py`-generated
  loader). Documented in the loadlog rather than changing 37 years of established output text for a
  cosmetic string match — the actual acceptance criteria (every year ties, `diff` within `TOL`) are
  satisfied and verified.
- CT2006's page location required a two-step OCR search (150dpi title-scan across an 11-page
  window, then a 300dpi full transcription of the confirmed page) rather than a single-shot
  transcription — resolved cleanly, no escalation to `--psm 6` retry or 400dpi was needed beyond the
  first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/pre34Extract.mjs` is committed, generic (`extractPre34GeneralFund(text)`), and ready for
  Phase 115-03 (MA deepening) to import if MA's pre-GASB-34 years need the same statement format —
  though MA's holes (FY2001/02/04/05/14/21) are all within the GASB-34 era per the phase inventory,
  so 115-03 likely won't need it; the export is generic regardless.
- CT and WI ACFR nodes are both fully deepened with 0 honest holes remaining — ready for Phase 116's
  cohort-wide verification pass.
- No blockers.

## Self-Check: PASSED

- FOUND: scripts/pre34Extract.mjs
- FOUND: scripts/processCTAcfr.js
- FOUND: scripts/processCTRevenueAcfr.js
- FOUND: scripts/processWIAcfr.js
- FOUND: scripts/processWIRevenueAcfr.js
- FOUND: .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-02-CT-WI-LOADLOG.md
- FOUND commit: ba118f1 (Task 1)
- FOUND commit: a806848 (Task 2)
- FOUND commit: 01d6582 (Task 3 loadlog)

---
*Phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de*
*Completed: 2026-07-03*
