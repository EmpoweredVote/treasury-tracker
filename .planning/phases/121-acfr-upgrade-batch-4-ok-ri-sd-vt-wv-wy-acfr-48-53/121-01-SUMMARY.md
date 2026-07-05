---
phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53
plan: "01"
subsystem: database
tags: [acfr, oklahoma, state-gf, gaap, supabase, pdftotext, treasury-budgets]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: OK bookend-tied recon (117-BATCH4-SOURCES.md), URL map, GF column identification
provides:
  - Oklahoma state node fully upgraded from NASBO operating-only to State-ACFR GAAP (revenue + operating), FY2002-2024
  - extract_gf.py flat() label-normalizer fix (letter-spaced "T otal Revenues"/"T otal Expenditures" total-row detection)
  - gen_state.py CONFIGS['OK'] entry (reusable for future re-runs/extensions)
affects: [123-nasbo-retirement, 124-verification-cohort-audit-uat]

# Tech tracking
tech-stack:
  added: []
  patterns: [ACFR GF-column extraction via extract_gf.py + gen_state.py, ephemeral data_sources lifecycle, hand-transcription-from-rendered-PNG for image-embedded statement pages]

key-files:
  created:
    - scripts/processOKAcfr.js
    - scripts/processOKRevenueAcfr.js
    - .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-01-OK-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored, local tooling — CONFIGS['OK'] added)
    - _acfr-work/extract_gf.py (gitignored, local tooling — flat() label normalizer fix)

key-decisions:
  - "Fixed extract_gf.py's total-row detection generically (flat() whitespace-stripper) rather than hand-patching FY2013 alone, after discovering it was silently mis-tying against a wrong MD&A-narrative candidate statement"
  - "Hand-transcribed FY2019 from a rendered PNG (page's GF table is embedded as a JPEG image with no text layer) rather than treating it as an honest hole — independently re-summed to $0 diff before patching, NM FY2022 precedent"
  - "Accepted the ~3.35x OK-vs-NASBO GF scope divergence (widest in Batch 4) and relabelled honestly rather than narrowing scope — driven by Federal Grants consolidation into the GENERAL column"

requirements-completed: [ACFR-48]

# Metrics
duration: 30min
completed: 2026-07-05
---

# Phase 121 Plan 01: Oklahoma ACFR Upgrade (ACFR-48) Summary

**Oklahoma state node upgraded from NASBO operating-only to full State-ACFR GAAP (GF revenue-by-source + spending-by-function) across FY2002-2024 (23 years), fixing a shared extract_gf.py bug and hand-patching one image-embedded statement page along the way.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-04T23:42:41Z (approx, phase start)
- **Completed:** 2026-07-05T00:10:43Z
- **Tasks:** 3
- **Files modified:** 3 tracked (scripts/processOKAcfr.js, scripts/processOKRevenueAcfr.js, 121-01-OK-LOADLOG.md) + 2 gitignored local tooling files (_acfr-work/gen_state.py, _acfr-work/extract_gf.py)

## Accomplishments
- Generated `scripts/processOKAcfr.js` + `scripts/processOKRevenueAcfr.js` via `gen_state.py CONFIGS['OK']`, downloaded and extracted 23 OK ACFR/CAFR PDFs (FY2002-2024), all dry-run tied ($0 diff)
- Fixed a real extraction bug in `extract_gf.py` (letter-spaced "T otal Revenues"/"T otal Expenditures" labels in FY2013's PDF caused a silent wrong-statement mis-tie) — generalized fix, zero regression across an 8-state cohort spot-check
- Hand-transcribed FY2019 from a rendered PNG (the only image-embedded, text-layer-free statement page found in the OK archive), independently re-summed to exact $0 diff before patching
- Live-loaded all 23 years (operating + revenue, 46 rows), replacing NASBO FY2023/FY2024 operating rows in place with zero duplicates or stale labels
- Proved idempotency (FY2024 re-run = 0 net change, same row ids) and 0 `data_sources` residue (LOAD-01)
- Confirmed Money In auto-enable (23 revenue rows) and cohort-untouched (CA, AK, RI, VT all unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate both OK loaders + download/extract + dry-run tie** - `49b6156` (feat)
2. **Task 2+3: Live-load OK + idempotency/verification + LOADLOG** - `6ed9419` (docs) — Task 2 made no file changes (live DB writes only), so its result is captured together with Task 3's LOADLOG commit

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `scripts/processOKAcfr.js` - OK GF operating (spending-by-function) loader, UNITS=1000, GAAP-labelled
- `scripts/processOKRevenueAcfr.js` - OK GF revenue (by-source) loader, UNITS=1000, GAAP-labelled
- `.planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-01-OK-LOADLOG.md` - full load disposition, bookend ties, NASBO-replacement confirmation, ~3.35× accept-relabel record, idempotency result
- `_acfr-work/gen_state.py` (gitignored, local-only) - added `CONFIGS['OK']`
- `_acfr-work/extract_gf.py` (gitignored, local-only) - added `flat()` label normalizer, fixes letter-spaced total-row labels

## Decisions Made
- **Extractor bug fix over hand-patch-only:** rather than just hand-patching FY2013's numbers, traced the root cause (letter-spaced bold total-row labels defeating the `startswith('total revenues')` check) and fixed `extract_gf.py` generically, since an un-normalized total-row check is a latent risk for any future state/year with the same PDF rendering quirk.
- **Hand-transcription over honest-hole for FY2019:** the plan's STOP rule says omit years that "won't tie" — but FY2019 DOES have real, readable data, just not in a text layer. Rendering to PNG and hand-transcribing (with independent re-summation to $0 diff) is the established NM FY2022 precedent and preserves a materially complete window (23/23 target years) rather than creating an avoidable 1-year gap.
- **Accept-and-relabel for the ~3.35× divergence:** confirmed the driver (Federal Grants consolidated into GENERAL) is a real structural fact of OK's GAAP presentation, not a transcription error, by checking the line item is present in the GENERAL column (not the Total column) at both bookends.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extract_gf.py total-row detection for letter-spaced labels**
- **Found during:** Task 1 (dry-run tie of FY2013)
- **Issue:** FY2013's `pdftotext -table` output renders "Total Revenues"/"Total Expenditures" as "T otal Revenues"/"T otal Expenditures" (letter-spaced). The un-normalized `label.lower().startswith('total revenues')` check missed these rows, causing `extract_gf.py`'s candidate-statement search to fall through to a WRONG earlier match (an MD&A narrative paragraph that happens to mention the statement's title, with its own unrelated numbers) and silently mis-tie against that wrong statement (T-121-01-B risk: wrong statement/column).
- **Fix:** Added a `flat()` helper that strips all whitespace from a candidate LABEL (not the full row) before comparing to 'totalrevenues'/'totalexpenditures'/'total', applied in both `find_anchor()` and `extract()`.
- **Files modified:** `_acfr-work/extract_gf.py` (gitignored, local tooling)
- **Verification:** FY2013 now resolves to the correct real statement page (line 2772) and ties exactly (rev $16,731,218K / exp $16,862,909K, matching the raw printed figures). Regression-tested against every already-loaded cohort `.txt` file on disk (SC 24/24, MT 11/11, NE 6/6, ND 7/7, KS 7/7, CO 3/3, UT 7/7, ME 24/24 excl. documented pre-GASB-34 holes) — all tie identically to before the fix. MO/OR files that still show non-ties were confirmed already non-tying with a reconstructed pre-fix copy of the script (no new regression).
- **Committed in:** `49b6156` (Task 1 commit)

**2. [Rule 1 - Bug / Rule 3 - Blocking] Hand-transcribed FY2019 from a rendered PNG (image-embedded statement table)**
- **Found during:** Task 1 (extraction pass for FY2019)
- **Issue:** FY2019's Governmental Funds statement page (PDF page 56) has zero text layer for its numeric data table — confirmed via `pdffonts`/`pdfimages` that the entire table is a single embedded JPEG image. `pdftotext` (table, plain, raw, and layout modes) all return nothing but the page title/caption; the extractor's fallback candidate search would otherwise mis-tie against a coincidentally-matching wrong statement (same class of risk as issue #1).
- **Fix:** Rendered PDF page 56 to a 300dpi PNG via `pdftoppm`, read the GENERAL column values directly from the crisp rendered image, and independently re-summed both the revenue items (→ $19,417,878K) and expenditure items (→ $18,344,756K) to confirm exact $0 diff against the printed totals before hand-patching `ok_all.json`.
- **Files modified:** `_acfr-work/ok/ok_all.json` (gitignored scratch data, feeds the generated loaders)
- **Verification:** Both revenue and expenditure category sums tie exactly to the printed FY2019 totals; `node scripts/processOKAcfr.js --dry-run` and `processOKRevenueAcfr.js --dry-run --fy 2019` both print "validation: PASS".
- **Committed in:** `49b6156` (Task 1 commit, via the generated loader's embedded FY2019 data)

---

**Total deviations:** 2 auto-fixed (2 bugs — both Rule 1, one with a Rule 3 blocking-issue flavor since FY2019 would otherwise have required an honest-hole decision)
**Impact on plan:** Both fixes were necessary to reach the plan's target window (FY2002-2024, 23/23 years) without a false wrong-statement figure (issue 1) or an avoidable honest-hole gap (issue 2). No scope creep — both fixes stayed inside OK's own extraction, with issue 1's generic fix additionally verified safe for the whole existing cohort.

## Issues Encountered
None beyond the two deviations documented above (both resolved before any live write).

## User Setup Required
None - no external service configuration required. `.env` already had `SUPABASE_SERVICE_KEY` configured from prior phases.

## Next Phase Readiness
- Oklahoma is fully ACFR-sourced (revenue + operating, GAAP-labelled, NASBO replaced, 0 residue) and ready for Phase 124's independent re-derivation + cohort audit + Chris UAT.
- Plans 121-02 through 121-06 (RI, SD, VT, WV, WY) remain to complete Batch 4; none of their state nodes were touched by this plan (spot-checked RI and VT still cleanly NASBO-only).
- The `extract_gf.py` `flat()` fix is now available to the remaining Batch-4 loads (and any future state) at zero cost — no state-specific code needed to benefit from it.

## Known Stubs
None. No stub/placeholder data was introduced; every loaded figure is ACFR-sourced with a non-null `source_url`/`source_date`.

## Threat Flags
None. All threat-register items (T-121-01-A through T-121-01-G) were mitigated as planned; no new unplanned security-relevant surface was introduced (no new endpoints, no new auth paths, no schema changes).

---
*Phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53*
*Plan: 01*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: scripts/processOKAcfr.js
- FOUND: scripts/processOKRevenueAcfr.js
- FOUND: .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-01-OK-LOADLOG.md
- FOUND commit: 49b6156
- FOUND commit: 6ed9419
