---
phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
plan: 03
subsystem: database
tags: [pdftotext, state-acfr, pre-gasb-34, massachusetts, font-corruption, regex]

# Dependency graph
requires:
  - phase: 108-acfr-upgrade-batch-1
    provides: processMAAcfr.js/processMARevenueAcfr.js (the runtime-extraction loaders this plan extends), maAcfrExtract.mjs
  - phase: 115-02
    provides: scripts/pre34Extract.mjs (reusable pre-GASB-34 Combined-Statement General-Fund extractor)
provides:
  - MA deepened from a 19-year to a 21-year series (FY2001, FY2003, FY2006-2020, FY2022-2025), 4 honest holes remain (down from 6)
  - maAcfrExtract.mjs hardened against isolated font-glyph substitutions and a period-as-thousands-separator quirk (FY2014 precedent)
  - pre34Extract.mjs generalized to tolerate a reversed "All Governmental Fund Types" / title line order (MA precedent, CT/WI unaffected)
  - Documented investigation of a dot-leader digit-interleaving corruption (FY2002/2004/2005) and a document-wide font cipher corruption (FY2021) that were deliberately left unrecovered rather than risk silently-wrong figures
affects: [116-verification-source-chain-audit-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Narrowly-scoped tolerant regex for isolated font-glyph substitutions (Total reven\\w*s / EXPEND\\w*TURES) — tolerates a single corrupted character in a distinguishing position without widening the match enough to risk false positives"
    - "Superset-widening a shared extractor's lookahead window (pre34Extract.mjs: also look behind the title line) is safe to reuse across states because it can only ADD matching candidates, never remove one that already worked — regression-verified against every dependent state's full year range before shipping"
    - "Investigate-then-abandon: when a heuristic fix cannot be bounded safely (dot-leader corruption's separator-run length overlapping the inter-column-gap range), remove the attempted code and document the honest hole rather than ship a fragile threshold"

key-files:
  created:
    - .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-03-MA-LOADLOG.md
  modified:
    - scripts/maAcfrExtract.mjs
    - scripts/pre34Extract.mjs
    - scripts/processMAAcfr.js
    - scripts/processMARevenueAcfr.js

key-decisions:
  - "FY2014 recovered via three narrowly-scoped fixes in maAcfrExtract.mjs: tolerant Total-revenues/EXPENDITURES anchor regexes, a period-as-thousands-separator normalization (same class as CT1991/1992), and a ']'->'1' digit-substitution normalization"
  - "FY2001 recovered by routing through pre34Extract.mjs after widening its lookahead window to also look behind the title line (MA prints 'All Governmental Fund Types' BEFORE the title, opposite order from CT/WI) — the widened window is a strict superset, verified 0 regression on CT's 38 years and WI's 26 years"
  - "FY2002/2004/2005 investigated (dot-leader digit-interleaving corruption) and left as honest holes: a bounded-separator positional extractor was built and tested but abandoned because the within-number vs inter-column gap-length distributions overlap too much to draw a safe threshold — a wrong-but-plausible dollar figure is worse than an honest hole"
  - "FY2021 investigated and left as an honest hole: the entire financial-statements section of that year's PDF (~16,000 of 17,793 pdftotext lines) is encoded with a document-wide corrupted font ToUnicode mapping that pdftotext cannot decode in either -table or -layout mode — a categorically different, more severe failure than FY2014's isolated substitutions"

patterns-established:
  - "Font-glyph substitution tolerance: when an anchor word has ONE character corrupted in a subset font, widen the regex to the invariant prefix/suffix around the corrupted position rather than trying to enumerate every possible substitution"

requirements-completed: [DEEP-03]

# Metrics
duration: 50min
completed: 2026-07-03
---

# Phase 115 Plan 03: Massachusetts Hole Recovery (FY2001/02/04/05/14/21) Summary

**Recovered 2 of MA's 6 remaining honest holes (FY2001 via pre-GASB-34 routing, FY2014 via font-glyph-substitution-tolerant regexes), deepening MA to a 21-year series while rigorously investigating and documenting why the other 4 years (FY2002/04/05, FY2021) resist safe automated recovery.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-03T09:01:28Z
- **Tasks:** 3
- **Files modified:** 4 (3 loader/extractor files + 1 loadlog)

## Accomplishments

- FY2014 recovered: diagnosed and fixed three distinct corruption patterns in the same year's PDF
  (isolated font-glyph substitutions on section anchors, a period-as-thousands-separator quirk, and
  a "]"→"1" digit substitution) — expenditure ties exactly ($0 diff), revenue ties within TOL
- FY2001 recovered: identified as MA's only pre-GASB-34-format year and routed through
  `pre34Extract.mjs` (from plan 115-02), after generalizing that shared extractor to tolerate MA's
  reversed line order — both revenue and expenditure tie exactly ($0 diff)
- Regression-proved all 19 previously-tying MA years unchanged (byte-identical totals before/after),
  and all 38 CT years + 26 WI years unaffected by the shared `pre34Extract.mjs` change
- Investigated FY2002/2004/2005's dot-leader digit-interleaving corruption thoroughly: built and
  tested a bounded-separator positional extractor, found the corruption's separator-run-length
  distribution statistically overlaps the genuine inter-column-gap distribution, and made the
  disciplined call to abandon the fragile heuristic rather than risk silently-wrong dollar figures
- Investigated FY2021's document-wide font cipher corruption: confirmed via a 16,386-consecutive-line
  gap in common-word occurrences that the entire financial-statements section is undecoded by
  pdftotext in any mode, distinct from and more severe than FY2014's isolated substitutions
- Live-loaded both recovered years, verified idempotent (0 net change on re-run) and 0
  `data_sources` residue

## Task Commits

1. **Task 1: Fix FY2014 anchor breakage in maAcfrExtract.mjs (regression-gated)** - `bf92701` (feat)
2. **Task 2: Recover FY2001 via pre34Extract.mjs; investigate FY2002/2004/2005** - `f395a1d` (feat)
3. **Task 3: Live-load recovered years, verify, loadlog** - `605ab20` (docs, loadlog); live DB writes not separately committed (data, not code)

**Plan metadata:** (this commit) `docs: complete plan`

## Files Created/Modified

- `scripts/maAcfrExtract.mjs` - FY2014 tolerant anchor regexes + period/digit-substitution normalization in `parseRow()`; documented (not shipped) the abandoned FY2002/04/05 dot-leader investigation as a code comment
- `scripts/pre34Extract.mjs` - Widened the "All Governmental Fund Types" lookahead window to also look behind the title line (MA precedent), regression-verified against CT/WI
- `scripts/processMAAcfr.js` - FY2001 pre-34 routing + distinct basis label + Phase-114 hardening (strict parseArgs, --fy validation, try/finally cleanup, surfaced select errors)
- `scripts/processMARevenueAcfr.js` - Same, revenue side
- `.planning/phases/115-.../115-03-MA-LOADLOG.md` - Full per-FY disposition, root-cause investigation detail for all 4 remaining holes, regression evidence, idempotency + residue evidence

## Decisions Made

- FY2014's three corruption patterns fixed with narrowly-scoped regexes (tolerating exactly the
  observed single-character substitutions) rather than broad fuzzy matching, to minimize false-match
  risk against the 19 other already-tying years
- `pre34Extract.mjs`'s lookahead window widened rather than duplicated into a MA-specific copy,
  since the change is a strict superset (safe for CT/WI) and keeps the pre-34 extractor logic in one
  reusable place per the plan's stated reuse intent
- The FY2002/2004/2005 dot-leader positional extractor was built, empirically tested, found unsafe,
  and REMOVED (not shipped even as a disabled/unused fallback) — unreliable extraction code is worse
  than no code, since a future maintainer could be tempted to wire it in without re-discovering the
  overlap problem
- FY2021 was not attempted via OCR (the CT FY2006 precedent) within this plan's scope: unlike CT2006
  (a single scanned page with a working page-boundary marker), FY2021's corruption spans ~16,000
  lines with an unreliable page-boundary marker (form-feed byte collisions with the corrupted
  encoding), making page-location alone a nontrivial sub-investigation — flagged for a future
  dedicated pass rather than rushed here

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened pre34Extract.mjs's lookahead window to recover FY2001**
- **Found during:** Task 2 (FY2001 format determination)
- **Issue:** The plan's interface note said to reuse `pre34Extract.mjs` "as-is" for any pre-34-format
  year, but MA prints the "All Governmental Fund Types..." line BEFORE the title line (CT/WI print it
  after) — the shared extractor's ahead-only lookahead window would never find a match for MA
- **Fix:** Widened the lookahead window to `lines.slice(Math.max(0, i - 6), i + 8)` — a strict
  superset of the original ahead-only window
- **Files modified:** scripts/pre34Extract.mjs (not in the plan's stated `files_modified` list, but
  required to complete Task 2's stated goal of reusing this extractor for MA)
- **Verification:** FY2001 now ties exactly; all 38 CT years + 26 WI years re-verified unchanged via
  full dry-run of all four dependent loaders (operating + revenue, both states)
- **Committed in:** f395a1d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue, required to reuse the shared pre-34
extractor for a state whose line order differs from the precedent states)
**Impact on plan:** Necessary to reach FY2001's recovery, which was the plan's own stated goal for
Task 2. Regression-verified zero impact on CT/WI. No scope creep.

## Issues Encountered

- The FY2002/2004/2005 dot-leader corruption investigation consumed significant effort before being
  abandoned: an initial unbounded regex caused catastrophic column-merging (values inflated to
  10^16-10^21 magnitude), a bounded `{1,4}` variant truncated legitimate numbers with wider internal
  gaps, and a `{0,4}` variant worked for some rows but a systematic audit revealed the underlying
  gap-length distributions are not separable by any fixed threshold. Resolved by abandoning the
  approach and documenting the honest hole with full diagnostic detail, per the plan's own
  "or the loadlog documents the specific irreducible failure" acceptance criterion.
- FY2021's corruption was initially believed (per the 108-02 loadlog's speculation) to be a simple
  "-table column merge" — actual investigation found a much more severe document-wide font cipher
  corruption spanning ~90% of the document's text lines. Resolved by thoroughly documenting the
  actual root cause (distinct from the speculated one) so a future recovery attempt starts from
  accurate diagnostic information rather than re-discovering the same dead end.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MA is now a 21-year contiguous-as-possible series (FY2001, FY2003, FY2006–2020, FY2022–2025) with
  4 documented honest holes (FY2002, FY2004, FY2005, FY2021) — ready for Phase 116's cohort-wide
  verification pass.
- Requirements DEEP-02 (pre-GASB-34 extractor + basis label), DEEP-03 (recoverable-holes recovery
  attempt), and DEEP-04 (per-state format determination discipline) are all now re-confirmable
  across CT/WI (115-02, 0 holes) and MA (115-03, 4 honest holes remaining with full root-cause
  documentation).
- A future recovery pass for FY2002/2004/2005 would need a smarter column-boundary heuristic (e.g.
  deriving expected column START positions from the column-header row rather than inferring
  boundaries from separator-run length alone) or an OCR-based re-transcription.
- A future recovery pass for FY2021 would need to solve page-location first (form-feed byte
  collisions make simple page counting unreliable in the corrupted region) before OCR transcription
  could begin.
- No blockers for Phase 116.

## Self-Check: PASSED

- FOUND: scripts/maAcfrExtract.mjs
- FOUND: scripts/pre34Extract.mjs
- FOUND: scripts/processMAAcfr.js
- FOUND: scripts/processMARevenueAcfr.js
- FOUND: .planning/phases/115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de/115-03-MA-LOADLOG.md
- FOUND commit: bf92701 (Task 1)
- FOUND commit: f395a1d (Task 2)
- FOUND commit: 605ab20 (Task 3 loadlog)

---
*Phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de*
*Completed: 2026-07-03*
