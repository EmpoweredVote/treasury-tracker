---
phase: 116-verification-source-chain-audit-uat-ver-07-ver-08
plan: 01
subsystem: testing
tags: [verification, acfr, re-derivation, pdftotext, ocr, tesseract, node]

# Dependency graph
requires:
  - phase: 113-acfr-upgrade-batch-1-5-states-acfr-21-25-acfr-31-32
    provides: IN/AZ/OR/MO/CO ACFR General-Fund state-node data (tranche-3 batch 1)
  - phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
    provides: SC/KY/UT/AL/LA ACFR General-Fund state-node data (tranche-3 batch 2)
  - phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
    provides: NJ FY2002-2019, CT FY1988-2001+FY2006, WI FY2000-2001, MA FY2001+FY2014 deepened history
provides:
  - Loader-independent blind ACFR re-derivation harness (scripts/verify-phase116-rederive.mjs) covering the full v2.14 tranche-3 + deepening sample
  - 116-REDERIVATION.md: per-FY independent tie log with headline verdict, feeding VER-07 part (a)
affects: [116-02-cohort-audit, 116-03-uat, gsd-verifier]

# Tech tracking
tech-stack:
  added: []
  patterns: ["blind re-derivation via independent minimal PDF extraction (no shared parser reuse)", "pre-GASB-34 Combined Statement locator (order-independent title-phrase co-occurrence)", "independent re-OCR for scanned-page recovery (pdftoppm + tesseract, bypassing loader's embedded static arrays)"]

key-files:
  created:
    - scripts/verify-phase116-rederive.mjs
    - .planning/phases/116-verification-source-chain-audit-uat-ver-07-ver-08/116-REDERIVATION.md
  modified: []

key-decisions:
  - "Fixed a harness-only title-anchor bug (MA FY2014 PDF renders the statement title with missing kerning spaces) by loosening the regex to be whitespace-tolerant, rather than reusing the loader's tolerant maAcfrExtract.mjs regex — preserves independence"
  - "Both pre-flagged rounding-note candidates (WI FY2001 pre-34 -2K, MA FY2014 -1) tied EXACT $0 in independent re-derivation — the loadlog notes describe printed-vs-line-sum reconciliation internal to the loader's own validation, not printed-vs-stored; no disposition/fix needed"

requirements-completed: [VER-07]

# Metrics
duration: 40min
completed: 2026-07-03
---

# Phase 116 Plan 01: Loader-Independent ACFR Re-Derivation Summary

**Blind re-derivation harness ties all 75 sampled FY-dataset checks across 10 tranche-3 states + 4 deepened states to the live DB at exact $0 delta — zero rounding exceptions needed.**

## Performance

- **Duration:** ~40 min (resumed from a prior session that built the 634-line harness; this session ran it, fixed one harness-only bug, and completed the disposition + documentation work)
- **Completed:** 2026-07-03T17:50:52Z
- **Tasks:** 3 (Task 1 harness build was already complete on resume; this session executed Task 1's verify step, Task 2, and Task 3)
- **Files modified:** 2 created (harness + rederivation log)

## Accomplishments

- Ran `scripts/verify-phase116-rederive.mjs` against all 41 FY targets (75 FY-dataset checks) across IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA (tranche-3) and NJ, CT, WI, MA (deepening)
- First run surfaced 2 FAILs (both MA FY2014) caused by a harness bug, not a data defect; fixed in-harness and re-ran to 75/75 PASS
- Wrote `116-REDERIVATION.md` with the full per-FY comparison table, headline verdict, rounding-note reconciliation, honest-hole confirmation, and clamp-year coverage notes
- Confirmed both loadlog-flagged rounding-note candidates (WI FY2001, MA FY2014) tie at exact $0 independently — no tolerance band exercised anywhere in the sample

## Task Commits

1. **Task 1 (verify) + harness bugfix: run the re-derivation harness, fix MA FY2014 title-anchor bug** - `6147be5` (feat)
2. **Task 2: disposition every delta, write 116-REDERIVATION.md** - `7d280c9` (docs)

**Plan metadata:** committed separately after this SUMMARY (docs: complete plan)

_Note: Task 1's harness code itself (634 lines) was built and left uncommitted by a prior session that hit a limit before running it; this session's `feat` commit is the first commit of that file, since git history had no prior commit for it._

## Files Created/Modified

- `scripts/verify-phase116-rederive.mjs` - Loader-independent ACFR re-derivation harness: blind GF-column re-extraction (modern GASB-34 statements, pre-GASB-34 Combined Statement locator, and independent CT FY2006 OCR recovery), diffed against live `treasury.budgets` at an exact-$0 bar
- `.planning/phases/116-verification-source-chain-audit-uat-ver-07-ver-08/116-REDERIVATION.md` - Full per-FY tie log: 75/75 exact, headline verdict, sample reproducibility notes, rounding-note reconciliation, honest-hole confirmation

## Decisions Made

- **Harness bugfix scope:** MA FY2014's PDF prints "Statement ofRevenues,Expenditures" (missing spaces from a kerning/spacing artifact, documented separately from — but co-located with — the font-glyph substitutions already known from the 115-03 loadlog). Rather than importing the loader's own tolerant regex (`maAcfrExtract.mjs`), wrote a fresh whitespace-tolerant title-anchor regex (`statement\s*of\s*revenues\s*,?\s*expenditures`) and normalized only the one documented "Total revenaes" glyph swap before line-matching — preserving the plan's independence rule (harness must never reuse the loader's extraction logic) while still handling the documented PDF quirk.
- **No in-phase data fixes required:** every one of the 75 checks tied at exact $0 on the first corrected run. The two years pre-identified in the plan interfaces as possible rounding-note dispositions (WI FY2001, MA FY2014) were deliberately sampled to test this, and both resolved to exact $0 — consistent with the 110-REDERIVATION precedent that loadlog "diff" notes describe internal printed-vs-line-sum loader validation, not printed-vs-stored discrepancies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Harness title-anchor regex failed to locate the MA FY2014 Governmental Funds statement page**
- **Found during:** Task 1 verify (first harness run)
- **Issue:** The MA FY2014 source PDF (`_acfr-work/ma/MA2014.pdf`) renders the statement title with no space after "of" and no space after the comma ("Statement ofRevenues,Expenditures and Changes in Fund Balances"). The harness's title-anchor check required a literal `"statement of revenues, expenditures"` substring, so it never located the page, and both MA FY2014 checks reported FAIL ("Governmental Funds statement not auto-located") instead of a numeric delta.
- **Fix:** Loosened `findModernStatementTotals`'s title-anchor to a whitespace-tolerant regex (`/statement\s*of\s*revenues\s*,?\s*expenditures/`) applied in both the primary and relaxed second pass, and normalized the single documented "Total revenaes" → "Total revenues" glyph substitution (115-03 loadlog) before line-matching in `parseModernGFTotals`. Both fixes are scoped to the harness's own independent extraction logic — no loader/parser code was imported or reused.
- **Files modified:** `scripts/verify-phase116-rederive.mjs`
- **Verification:** Re-ran the full harness; MA FY2014 revenue and operating both now report exact `PASS (exact delta=0)`; all other 73 checks were unaffected (re-confirmed unchanged).
- **Committed in:** `6147be5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, Rule 1)
**Impact on plan:** The fix was scoped entirely to the re-derivation harness's own extraction code (the plan's Task 1 deliverable) and did not touch any loader, parser, or stored data. No scope creep; no data changes were needed anywhere in the sample.

## Issues Encountered

None beyond the harness bugfix documented above. All source PDFs were already present in the `_acfr-work/` cache (verified `%PDF` magic + multi-MB size), so no network fetches — including the AZ FY2024 Google Drive link — were exercised this run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `116-REDERIVATION.md` is ready for consumption by Plan 02 (cohort source-chain audit, VER-07 parts b+c) and Plan 03 (live-app UAT, VER-08), and by the gsd-verifier for VER-07 part (a).
- The harness's independent extraction methods (whitespace-tolerant title anchoring, pre-GASB-34 locator, CT FY2006 OCR path) are stable and reusable if Plan 02/03 need to re-verify any individual FY.
- No blockers carried forward.

## Self-Check: PASSED

- FOUND: `scripts/verify-phase116-rederive.mjs`
- FOUND: `.planning/phases/116-verification-source-chain-audit-uat-ver-07-ver-08/116-REDERIVATION.md`
- FOUND commit: `6147be5`
- FOUND commit: `7d280c9`

---
*Phase: 116-verification-source-chain-audit-uat-ver-07-ver-08*
*Completed: 2026-07-03*
