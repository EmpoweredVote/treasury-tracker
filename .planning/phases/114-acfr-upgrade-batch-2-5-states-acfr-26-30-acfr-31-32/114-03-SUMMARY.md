---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
plan: 03
subsystem: database
tags: [acfr, pdftotext, supabase, state-budget, treasury]

requires:
  - phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
    provides: UT source location (direct wp-content URLs), bookend ties, GF-alone scope-decision flag, clean-NASBO-only overlap probe
  - phase: 113-acfr-upgrade-batch-1-in-az-or-mo-co
    provides: extract_gf.py + gen_state.py Phase-113 tooling reused as-is
  - phase: 114-02
    provides: gen_state.py rev_boundary option + wrapped-label pending-prefix fix (not needed by UT but same toolchain)
provides:
  - UT state node fully on State-ACFR GAAP (GF revenue-by-source + spending-by-function, FY2019-FY2025, zero honest holes)
  - GF-alone scope decision resolved and recorded (ACFR-31) — UT is the tranche's one narrower-than-NASBO state
  - gen_state.py generalized fix for singular-"Tax"-label pluralization (default_rev_name)
affects: [116-verification-source-chain-audit-uat]

tech-stack:
  added: []
  patterns: [gen_state.py CONFIGS-entry per-state loader generation, ephemeral data_sources create/RPC/delete lifecycle, P2 clamp for negative GF lines]

key-files:
  created:
    - scripts/processUTAcfr.js
    - scripts/processUTRevenueAcfr.js
    - .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-03-UT-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (UT CONFIGS entry + default_rev_name singular-tax pluralization fix; gitignored)

key-decisions:
  - "GF-alone scope decision (ACFR-31): loaded the printed General Fund column alone, not a GF+Income Tax Fund composite — resolves the 112-recon load-phase flag"
  - "UT's ~0.83x-0.91x narrower-than-NASBO divergence documented as honest and GAAP-correct (Amendment G constitutional income-tax earmark in a separate major fund), not padded over"
  - "GF column selected by position (1st numeric token), never by the 2nd column's header string, across the Education (FY2019) -> Income Tax (FY2025) fund-rename"
  - "FY2019 'Human Services and Juvenile Justice Services' label truncation (pdftotext line-wrap) hand-corrected in ut_all.json per the KY FY2002-OCR-typo precedent — numeric value unaffected"

patterns-established:
  - "default_rev_name generalized to pluralize a label already ending in singular 'Tax' instead of appending a redundant ' taxes' suffix — reusable for future states with a 'Tax'-suffixed leaf label under a 'Taxes:' subsection"

requirements-completed: [ACFR-28, ACFR-31, ACFR-32]

duration: 20min
completed: 2026-07-02
---

# Phase 114 Plan 03: Utah ACFR Upgrade Summary

**Utah state node upgraded from NASBO operating-only to full State-ACFR GAAP (GF revenue-by-source + spending-by-function) across FY2019–FY2025, resolving the recon's GF-alone-vs-composite load-phase decision and proving the tranche's one narrower-than-NASBO divergence is honest and GAAP-correct.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-02T19:05:57-07:00 (immediately following 114-02 completion)
- **Completed:** 2026-07-02T19:20:27-07:00
- **Tasks:** 3 completed
- **Files modified:** 3 (2 loader scripts + 1 LOADLOG; `_acfr-work/gen_state.py` change is gitignored tooling)

## Accomplishments

- Both UT loaders (`processUTAcfr.js`, `processUTRevenueAcfr.js`) built via `_acfr-work/gen_state.py`'s new UT CONFIGS entry, on the proven IL/KY/SC template
- All 7 FYs (2019–2025) downloaded, extracted via `pdftotext -table` + `extract_gf.py`, and tie-verified to $0 diff on both revenue and expenditure printed General Fund totals — zero honest holes, the full requested window loaded
- Bookends confirmed exactly: FY2025 GF Total revenues $11,404,950K, FY2019 $6,509,587K
- Live-loaded operating + revenue for all 7 FYs; NASBO FY2023/FY2024 operating rows replaced in place (0 NASBO labels remain, exactly one operating row per (UT, fy))
- GF-alone scope decision (ACFR-31) resolved and documented: Utah's ACFR GF is narrower than NASBO (~0.83×–0.91×, the only state in this tranche to undershoot NASBO), driven by the constitutional Amendment G income-tax earmark sitting in a separate major fund column (labeled "Education" in FY2019, renamed "Income Tax" by FY2025)
- FY2022 "Investment Income (Loss)" = −$4,304K confirmed live via the P2 clamp path (ACFR-32) — rendered at $0 with the signed magnitude in the label, root total unaffected
- Idempotency proven: re-running FY2024 operating + revenue live a second time produced 0 net change; `treasury.data_sources` has 0 `ut-acfr-%` rows both before the first load and after the re-run (WR-05/LOAD-01 ephemeral lifecycle holds)
- Confirmed untouched: the 15 UT v2.5 Transparent-Utah municipal rows, the existing ACFR cohort (spot-checked IN/SC/KY), and a NASBO-only sample (WY)
- Money In auto-enabled data-driven (7 new revenue rows)

## Task Commits

1. **Task 1: Build both UT loaders + download/extract/transcribe FY2019–FY2025 + dry-run tie** - `116e108` (feat)
2. **Task 2 + Task 3: Live-load UT + idempotency/0-residue/cohort/municipal-untouched verification + LOADLOG** - `4fef6b9` (docs) — Task 2 produced no file changes (pure DB write); combined with Task 3's LOADLOG per established plan convention (see 114-02 precedent)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/processUTAcfr.js` - UT GF spending-by-function loader (dataset_type='operating'), UNITS=1000, tie-verified FY2019–FY2025
- `scripts/processUTRevenueAcfr.js` - UT GF revenue-by-source loader (dataset_type='revenue'), UNITS=1000, P2 clamp wired, tie-verified FY2019–FY2025
- `.planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-03-UT-LOADLOG.md` - Full load disposition, scope-decision record, idempotency + 0-residue proof, municipal/cohort-untouched checks
- `_acfr-work/gen_state.py` (gitignored) - Added UT CONFIGS entry; fixed `default_rev_name` to pluralize a label already ending in singular "Tax" (was about to produce "Sales and Use Tax taxes")

## Decisions Made

- **GF-alone over GF+Income-Tax-Fund composite (ACFR-31):** the printed GF column ties exactly to $0 diff every year and matches the cohort-wide uniform mold; a composite total is unprintable and unverifiable against any source statement. The resulting drop vs. NASBO is honest, not padded.
- **Position-anchored column selection:** confirmed via `extract_gf.py`'s existing anchor-on-"Total revenues"-row mechanism — no change needed, the Education→Income Tax rename never risked corrupting extraction since selection was already position-based, not header-string-based.
- **FY2019 label fix hand-corrected in JSON, not the extractor:** the "Human Services and Juvenile Justice Services" split-across-two-lines truncation was a one-off (every other year prints it on a single line) — followed the KY FY2002-OCR-typo precedent of a targeted JSON correction rather than generalizing `extract_gf.py` for a rare suffix-continuation case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `gen_state.py`'s `default_rev_name` producing a redundant "Tax taxes" label**
- **Found during:** Task 1 (dry-run review of generated revenue loader)
- **Issue:** UT's raw revenue label "Sales and Use Tax" already ends in singular "Tax"; the existing suffix logic only checked for an existing "taxes" ending, so it would append " taxes" onto "Tax", producing the incorrect "Sales and Use Tax taxes"
- **Fix:** Added a check for the singular "tax" ending — pluralizes in place ("Sales and Use Tax" → "Sales and Use Taxes") instead of appending a redundant suffix
- **Files modified:** `_acfr-work/gen_state.py` (gitignored)
- **Verification:** Regenerated loaders; dry-run output confirms "Sales and Use Taxes" (clean, no double-tax); this fix is reusable for any future state with a similar singular-"Tax"-suffixed leaf label
- **Committed in:** `116e108` (Task 1 commit)

**2. [Rule 1 - Bug] Hand-corrected a one-off pdftotext line-wrap label truncation (FY2019 only)**
- **Found during:** Task 1 (reviewing extracted expenditure categories across all 7 years)
- **Issue:** `pdftotext -table` split "Human Services and Juvenile Justice Services" across two physical lines in the FY2019 PDF only (numbers on the first line, a bare "Services ...." continuation below `extract_gf.py`'s existing pending-accumulator length threshold on the second) — the label was truncated to "Human Services and Juvenile Justice" in FY2019's extraction; every other loaded year (2020–2025) prints the full label on one line, confirming this was a one-off, not a systemic extractor gap
- **Fix:** Hand-corrected the label in `ut_all.json` (per the KY FY2002-OCR-typo precedent); the numeric value ($908,593K) was never affected
- **Files modified:** `_acfr-work/ut/ut_all.json` (gitignored, generated data)
- **Verification:** `node scripts/processUTAcfr.js --dry-run --fy 2019` confirms the full label "Human Services and Juvenile Justice Services" renders correctly with the correct amount
- **Committed in:** `116e108` (Task 1 commit) — the fix lives in gitignored JSON but the generated loader (committed) reflects the corrected label

---

**Total deviations:** 2 auto-fixed (2 bugs — both label-display corrections, no numeric/data-integrity impact)
**Impact on plan:** Both fixes necessary for correctness of displayed category names. No scope creep; no change to any stored dollar amount.

## Issues Encountered

None beyond the two deviations above. All 7 PDFs downloaded cleanly on the first attempt with a standard browser User-Agent (no Cloudflare block, unlike AZ in Phase 113); all 7 years extracted and tied on the first `pdftotext -table` + `extract_gf.py` pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Utah is fully ACFR-sourced (operating + revenue, GAAP-labelled, NASBO replaced, Money In enabled, 0 data_sources residue, municipal + cohort rows untouched) and ready for Phase 116's independent re-derivation + cohort audit + UAT. No blockers or concerns carried forward.

---
*Phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32*
*Plan: 03*
*Completed: 2026-07-02*

## Self-Check: PASSED

All created files verified present (scripts/processUTAcfr.js, scripts/processUTRevenueAcfr.js, 114-03-UT-LOADLOG.md, 114-03-SUMMARY.md); all referenced commits (116e108, 4fef6b9, f7ba322) verified present in git log.
