---
phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53
plan: "03"
subsystem: database
tags: [acfr, state-budget, pdf-extraction, supabase, gen_state.py, extract_gf.py]

requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: SD source location, bookend ties (FY2025 $2,423,413K / FY2002 $697,589K), URL pattern
provides:
  - South Dakota state node upgraded NASBO-operating-only -> full State-ACFR GAAP (revenue + operating)
  - extract_gf.py generalized to accept singular "Revenue:"/"Total Revenue" statement labels
  - 9-year whole-document-scanned-PDF hand-transcription precedent generalized from IA's single-year case
affects: [123-nasbo-retirement, 124-verification-cohort-audit-uat]

tech-stack:
  added: []
  patterns:
    - "gen_state.py CONFIGS['SD'] + extract_gf.py singular-label generalization"
    - "Whole-document scanned/unrenderable PDF hand-transcription from pdftoppm-rendered PNGs (generalizes single-page OK FY2019/NM FY2022 precedent)"

key-files:
  created:
    - scripts/processSDAcfr.js
    - scripts/processSDRevenueAcfr.js
    - .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-03-SD-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (CONFIGS['SD'], gitignored tooling)
    - _acfr-work/extract_gf.py (singular Revenue/Total Revenue fix, gitignored tooling)

key-decisions:
  - "extract_gf.py generalized to match singular 'Revenue:'/'Total Revenue' section/total-row labels (SD is the first cohort state with singular labels) -- safe superset, zero regression on the plural-labeled cohort"
  - "9 years (2003-2011 excl. 2002) hand-transcribed from rendered PDF images -- whole-document scans/unrenderable text, not single-page image embeds -- generalizes the IA FY2008 single-year precedent to a systematic multi-year pattern"
  - "FY2024/FY2025 hand-transcribed rather than patching a new stray-space-digit-split tokenizer rule (2-year scope did not justify a new generic regex change)"

requirements-completed: [ACFR-50]

duration: 105min
completed: 2026-07-05
---

# Phase 121 Plan 03: South Dakota ACFR Upgrade Summary

**South Dakota state node upgraded from NASBO operating-only to full State-ACFR GAAP GF revenue-by-source + spending-by-function, FY2002-FY2025 (24 years, zero honest holes) -- the widest clean window and smallest NASBO-scope divergence (~1.03x) in the entire v2.15 milestone.**

## Performance

- **Duration:** 105 min
- **Tasks:** 3
- **Files modified:** 3 (2 created scripts + 1 created LOADLOG)

## Accomplishments

- South Dakota (`e7273079-b392-449d-af38-d2e4d0df73e0`) live on full State-ACFR GAAP: `scripts/processSDAcfr.js` (operating) + `scripts/processSDRevenueAcfr.js` (revenue), both UNITS=1000.
- Full FY2002-FY2025 window loaded (24 years, zero honest holes) -- 48 rows (24 operating + 24 revenue), every year tie-verified $0 diff on the printed GENERAL FUND column.
- Both bookends confirmed live: FY2025 revenue $2,423,413,000, FY2002 revenue $697,589,000 -- exact match to the 117 recon.
- NASBO FY2023/FY2024 operating rows replaced in place (no duplicates, no stale NASBO label).
- ~1.03x accept-and-relabel scope divergence recorded (smallest in the v2.15 milestone) -- SD's federal-passthrough revenue routes to non-GF fund columns, keeping GF near NASBO's budgetary concept.
- P2 clamp exercised at FY2022 ("Use of Money and Property" -$32,246K, a real GAAP investment loss).
- Idempotent re-run of FY2025 (both loaders) confirmed 0 net change; 0 `data_sources` residue (LOAD-01) before and after.
- Money In auto-enabled (24 revenue rows).
- Cohort untouched: Rhode Island (Batch 4 sibling), Vermont (Batch 4 sibling, still NASBO), California (existing ACFR node) all verified unchanged.
- `extract_gf.py` generalized with two reusable fixes (singular section-header/total-row labels) that unblocked auto-extraction for 15 of SD's 24 years.

## Task Commits

1. **Task 1: Generate both SD loaders + download/extract FY2002-FY2025 + dry-run tie** - `8645181` (feat)
2. **Task 2: Live-load SD across the tied window, NASBO replaced in place** - live DB write, no local file changes to commit (verified via direct DB query, documented in LOADLOG)
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification + LOADLOG** - committed with this SUMMARY

**Plan metadata:** committed with SUMMARY + LOADLOG

## Files Created/Modified

- `scripts/processSDAcfr.js` - SD GF spending-by-function loader (operating), UNITS=1000, FY2002-2025
- `scripts/processSDRevenueAcfr.js` - SD GF revenue-by-source loader (revenue), UNITS=1000, FY2002-2025
- `.planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-03-SD-LOADLOG.md` - full load disposition, per-FY totals table, extractor-fix documentation
- `_acfr-work/gen_state.py` - added `CONFIGS['SD']` (gitignored tooling, not committed)
- `_acfr-work/extract_gf.py` - singular "Revenue:"/"Total Revenue" label generalization (gitignored tooling, not committed)

## Decisions Made

- **extract_gf.py singular-label fix:** SD's printed statement uses "Revenue:" and "Total Revenue" (no trailing "s") throughout its entire 24-year window, unlike every other cohort state's plural form. Fixed generically by matching the singular stem (a safe superset of the plural), rather than a SD-specific special case -- reusable for any future singular-labeled state, zero regression confirmed against the whole already-loaded cohort.
- **Whole-document scan hand-transcription (9 years):** FY2003-2011 (excl. 2002) PDFs produced zero or near-zero usable text from `pdftotext` across the ENTIRE document, not just the statement page (some are literal image scans with zero embedded fonts; others report embedded fonts but still fail to extract, a font-subsetting/CID-mapping defect with the same practical effect). Rather than chase a fragile whole-document OCR pipeline, generalized the existing single-page hand-transcription precedent (OK FY2019, NM FY2022) to whole documents: render the specific statement page via `pdftoppm` at 150-300dpi and hand-transcribe the GENERAL FUND column, independently re-summing to $0 diff before committing to `sd_all.json`.
- **FY2024/FY2025 hand-transcription over tokenizer patch:** the post-2021 8-column layout (COVID-19 Federal column added) causes `pdftotext -table` to occasionally split a digit group with a stray space (e.g. "135, 074"). Given this affected only 2 years, hand-transcription from a clean rendered image was faster and lower-risk than writing and testing a new generic stray-space-merging regex in `extract_gf.py`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] extract_gf.py silently returned zero revenue items for every SD year**
- **Found during:** Task 1 (dry-run tie verification)
- **Issue:** `extract_gf.py`'s section-header and total-row detection hardcoded the plural "Revenues:"/"Total Revenues" labels; SD's printed statement uses the singular "Revenue:"/"Total Revenue" throughout, so revenue extraction returned `null`/empty for every single year despite expenditures extracting correctly.
- **Fix:** Generalized `find_anchor()` and `extract()` in `extract_gf.py` to match the singular stem (`revenue`/`totalrevenue`), a safe superset that also matches every existing plural-labeled state.
- **Files modified:** `_acfr-work/extract_gf.py` (gitignored tooling, not committed to git)
- **Verification:** Re-ran extraction against the whole already-loaded cohort (SC/KY/UT/AL/OK/RI/etc.) -- zero regression, all previously-tying years tie identically.
- **Committed in:** n/a (gitignored file; documented in LOADLOG)

**2. [Rule 1 - Bug] 9 years of SD PDFs produced no extractable text (whole-document scan/font defect)**
- **Found during:** Task 1 (pdftotext extraction pass)
- **Issue:** FY2003-2006, FY2010 PDFs are full-document image scans (zero embedded fonts); FY2007-2009, FY2011 report embedded fonts but still fail to extract usable text (CID-mapping defect). No automated extraction path existed for these 9 years.
- **Fix:** Located each year's Governmental Funds statement page via `pdftoppm`-rendered PNG images, hand-transcribed the GENERAL FUND column, independently re-summed each year to $0 diff against the printed "Total Revenue"/"Total Expenditures" line before hand-patching `sd_all.json`.
- **Files modified:** `_acfr-work/sd/sd_all.json` (gitignored scratch), `_acfr-work/sd/build_sd_all.py` (gitignored scratch)
- **Verification:** All 9 years tie exactly $0 diff on both revenue and expenditure sides (see LOADLOG per-FY table).
- **Committed in:** n/a (gitignored scratch files; documented in LOADLOG)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - extraction bugs blocking task completion)
**Impact on plan:** Both fixes were necessary to complete the full FY2002-FY2025 window with zero honest holes. No scope creep -- both are generalized, reusable fixes to shared tooling.

## Issues Encountered

- Initial PDF downloads for FY2009 and FY2016 were truncated (curl connection interrupted by the 2-minute bash timeout on large multi-page files) -- detected via `Content-Length` header mismatch, re-downloaded successfully with a longer timeout. Not a data-correctness issue, caught before extraction.
- `python3`/`python` CLI aliases are not installed on this Windows machine; used `py -3` throughout (documented for future executors on this environment).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

South Dakota (ACFR-50) is complete and hands cleanly to Phase 124 (independent re-derivation + cohort audit + Chris UAT). Batch 4 continues with VT/WV/WY (121-04..06). No blockers.

---
*Phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53*
*Completed: 2026-07-05*
