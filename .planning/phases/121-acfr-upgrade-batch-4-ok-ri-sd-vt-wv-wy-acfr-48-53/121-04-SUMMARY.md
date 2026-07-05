---
phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53
plan: "121-04"
subsystem: database
tags: [acfr, gaap, state-finances, pdftotext, supabase, treasury_sync_budget_tree]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: VT Detail Block (bookend ties, browser-UA requirement, FY2019/FY2020 naming exceptions)
  - phase: 121-03
    provides: gen_state.py / extract_gf.py tooling (SD's singular-label + whole-doc-scan generalizations)
provides:
  - Vermont state node upgraded from NASBO operating-only to full State-ACFR GAAP (FY2015-2025, revenue+operating)
  - extract_gf.py split_row() generalized for zero/one-whitespace dot-leader defect (reusable)
affects: [124-verification-cohort-audit-uat, 123-nasbo-retirement]

# Tech tracking
tech-stack:
  added: []
  patterns: [gen_state.py CONFIGS-driven loader generation, build_state.py download+extract+tie-gate pipeline, ephemeral data_sources lifecycle (LOAD-01)]

key-files:
  created:
    - scripts/processVTAcfr.js
    - scripts/processVTRevenueAcfr.js
    - .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-04-VT-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (CONFIGS['VT'], gitignored scratch)
    - _acfr-work/extract_gf.py (split_row generalization, gitignored scratch)

key-decisions:
  - "VT UNITS=1 (dollars, not thousands) hard-set; both bookends ($2,543,030,123 FY2025 / $1,392,033,404 FY2015) verified whole-dollar with no 1000x skew"
  - "extract_gf.py split_row() separator generalized to accept 2+ mixed dot/whitespace chars (fixes VT FY2024/FY2025 zero/one-whitespace dot-leader defect); zero regression confirmed against ND/SD/MT/NE"
  - "VT colon-less subsection headers (Taxes/Earnings of departments/Licenses) post-processed out of merged labels in vt_all.json -- cosmetic only, values untouched"
  - "FY2023/FY2024 NASBO operating rows replaced in place at the same row IDs, not duplicated"

requirements-completed: [ACFR-51]

# Metrics
duration: 40min
completed: 2026-07-05
---

# Phase 121 Plan 4: Vermont ACFR Upgrade Summary

**Vermont state node upgraded from NASBO-only to full State-ACFR GAAP (FY2015-2025, 11 years, zero honest holes), whole-dollar UNITS=1, ~1.01x near-parity with NASBO (smallest divergence in Batch 4).**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-05
- **Tasks:** 3 completed
- **Files modified:** 3 (2 generated loader scripts + 1 loadlog; gen_state.py/extract_gf.py changes are gitignored scratch)

## Accomplishments
- Downloaded + extracted all 11 target VT ACFR PDFs (FY2015-2025) with a browser User-Agent (finance.vermont.gov 403s bare curl); zero soft-404s
- Discovered and fixed a new shared `extract_gf.py` defect (zero/one-whitespace dot-leader immediately preceding the GF value, VT FY2024/FY2025) with zero regression against the already-loaded ND/SD/MT/NE cohort
- Live-loaded both operating (GF spending-by-function) and revenue (GF revenue-by-source) datasets across all 11 years; FY2023/FY2024 NASBO rows replaced in place at the same row IDs
- Verified idempotency (0 net change on FY2025 re-run) and 0 `data_sources` residue (LOAD-01)
- Confirmed cohort untouched (ND existing ACFR node, WY un-upgraded NASBO state)

## Task Commits

1. **Task 1: Generate both VT loaders (UNITS=1 dollars) via gen_state.py + download/extract FY2015-2025 (browser UA) + dry-run tie** - `933f380` (feat)
2. **Task 2: Live-load VT (operating + revenue) across the tied window, NASBO replaced in place** - live DB writes only, no new tracked files (loader scripts already committed in Task 1)
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification (DB query) + LOADLOG** - included in plan metadata commit

**Plan metadata:** (this commit, following SUMMARY)

## Files Created/Modified
- `scripts/processVTAcfr.js` - VT GF spending-by-function loader (dataset_type='operating'), UNITS=1, FY2015-2025
- `scripts/processVTRevenueAcfr.js` - VT GF revenue-by-source loader (dataset_type='revenue'), UNITS=1, FY2015-2025
- `.planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-04-VT-LOADLOG.md` - per-FY load disposition, browser-UA note, near-parity note, idempotency result
- `_acfr-work/gen_state.py` (gitignored) - added `CONFIGS['VT']`
- `_acfr-work/extract_gf.py` (gitignored) - generalized `split_row()` separator regex

## Decisions Made
- UNITS=1 dollars hard-set for VT (already whole-dollar in the printed statement) — verified against both plan-pinned bookends exactly, no ×1,000 scaling applied.
- Generalized `extract_gf.py`'s `split_row()` to accept a mix of 2+ dot/whitespace characters as the label/value separator (previously whitespace-only) — this is a safe superset since normal cohort rows never have a digit immediately after their trailing dot-or-space run. Re-verified zero regression on ND (5 files), SD (29 files, incl. known non-tying hand-patched/hand-transcribed years), MT (11 files), NE (6 files) — every sum/tie outcome byte-identical before and after.
- Applied a one-off label cleanup to `vt_all.json` stripping VT's three colon-less subsection headers ("Taxes", "Earnings of departments", "Licenses") that had merged into the following item's label via the generic wrapped-label accumulator — cosmetic display-name fix only, no numeric/tie impact, re-verified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] extract_gf.py split_row() dropped 2 expenditure rows on VT FY2024/FY2025**
- **Found during:** Task 1 (dry-run tie verification — FY2024/FY2025 initially failed the expenditure tie by exactly the sum of the two dropped rows)
- **Issue:** VT's `pdftotext -table` rendering ran the dot-leader straight into the GF value with zero or one whitespace character on 2 rows ("Human services", "General education"), which the whitespace-only separator regex silently dropped, understating GF Total Expenditures by $1,046,250,098 (FY2025).
- **Fix:** Generalized `split_row()`'s separator to accept any mix of 2+ dot/whitespace characters immediately followed by the value token.
- **Files modified:** `_acfr-work/extract_gf.py` (gitignored scratch, not committed to git)
- **Verification:** All 11 VT years now tie exactly $0 diff on both revenue and expenditure; zero regression confirmed against ND/SD/MT/NE already-extracted text (identical results before/after).
- **Committed in:** `933f380` (loader scripts generated from the fixed extractor; the extractor itself lives in gitignored `_acfr-work/`)

**2. [Rule 1 - Bug] Colon-less subsection headers merged into item labels**
- **Found during:** Task 1 (post-generation inspection of dry-run output labels)
- **Issue:** VT's revenue section prints three subsection headers with no trailing colon ("Taxes", "Earnings of departments", "Licenses"); `extract_gf.py`'s colon-based heading detector missed them, so they merged into the next item's label via the wrapped-label pending-accumulator (e.g. "Taxes Personal income tax").
- **Fix:** One-off post-process pass over `vt_all.json` stripping the three known header-prefix strings back off the merged labels.
- **Files modified:** `_acfr-work/vt/vt_all.json` (gitignored scratch)
- **Verification:** Ties re-confirmed identical before/after on all 11 years; dry-run output now shows clean category names ("Personal income tax", "Fees", "Business").
- **Committed in:** `933f380` (baked into the generated loader scripts' embedded data)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes in the shared/scratch extraction tooling, not the committed loader logic itself)
**Impact on plan:** Both fixes were necessary for correctness (accurate GF totals and clean display labels). No scope creep — no other states or files touched beyond the regression-check reads.

## Issues Encountered
None beyond the two auto-fixed extraction issues documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vermont (ACFR-51) is fully loaded and verified: all 11 FY2015-2025 years on GAAP ACFR basis, whole-dollar, NASBO replaced in place, Money In auto-enabled, 0 data_sources residue, cohort untouched.
- Hands VT to Phase 124 (Verification + Cohort Audit + UAT).
- No blockers for the next plan in this batch (121-05 or subsequent).

---
*Phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: scripts/processVTAcfr.js
- FOUND: scripts/processVTRevenueAcfr.js
- FOUND: .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-04-VT-LOADLOG.md
- FOUND: .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-04-SUMMARY.md
- FOUND commit: 933f380
