---
phase: 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08
plan: 02
subsystem: database
tags: [acfr, california, ca, sco, pdftotext, state-finance, general-fund, operating, revenue]

# Dependency graph
requires:
  - phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
    provides: CA FY2008-FY2019 durable URL pattern (cafr{NN}web.pdf), FY2008 bookend tie ($97,774,378K), soft-404 caution
provides:
  - CA GF operating loader (processCA.js) extended to FY2008-FY2025 with 12 added years under /Files-ARD/CAFR/
  - CA GF revenue loader (processCARevenueAcfr.js) extended to FY2008-FY2025 with 12 added years
  - 104-DEEPEN-GAPLOG.md created (CA section: all 12 FYs PASS, no gaps)
affects: [104-04, 106-verify-deepened-pilots]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-directory SOURCES map: FY2008-2019 under /Files-ARD/CAFR/, FY2020+ under /Files-ARD/ACFR/, both coexist"
    - "Per-FY exact tie-check (validate()) against printed GF Total as acceptance gate"
    - "Soft-404 detection: check Content-Type/size before extracting (HTML = soft-404)"
    - "pdftotext -table extracts GF columns cleanly (NOT -layout)"

key-files:
  created:
    - .planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-DEEPEN-GAPLOG.md
  modified:
    - scripts/processCA.js
    - scripts/processCARevenueAcfr.js

key-decisions:
  - "All 12 CA added FYs (2008-2019) retained — no gaps needed; all PDFs are real multi-MB files"
  - "Category names shift at FY2016: old schema (Resources, Correctional programs, etc.) → new schema matching FY2020+ (Natural resources, Corrections and rehabilitation, etc.)"
  - "Motor vehicle excise taxes appears from FY2012 onward (=0 in 2012-2015, non-zero from 2016)"
  - "Managed care organization enrollment tax appears from FY2017 onward (=0 in 2017-2019)"
  - "No negative revenue categories in FY2008-FY2019 window — P2 clamp wired but not triggered"

patterns-established:
  - "Dual-directory SOURCES: older CAFR dir + newer ACFR dir coexist in single SOURCES map keyed by FY"
  - "Exact tie validation gates each FY: any non-zero diff causes process.exit(2)"

requirements-completed: [DEEP-01, RECON-05, ACFR-08]

# Metrics
duration: 45min
completed: 2026-06-30
---

# Phase 104 Plan 02: CA ACFR FY2008-FY2019 Deepening Summary

**CA GF operating + revenue loaders extended backward 12 years (FY2008-FY2025) under /Files-ARD/CAFR/cafr{NN}web.pdf, all 12 added FYs tie exactly at 0 diff, FY2008 bookend confirmed at $97,774,378,000**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-30T00:00:00Z
- **Completed:** 2026-06-30T00:45:00Z
- **Tasks:** 2
- **Files modified:** 3 (processCA.js, processCARevenueAcfr.js, 104-DEEPEN-GAPLOG.md)

## Accomplishments

- Extended `scripts/processCA.js` (operating) and `scripts/processCARevenueAcfr.js` (revenue) with 12 added SOURCES keys (FY2008-FY2019) under `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf`, leaving FY2020-FY2025 `/Files-ARD/ACFR/` entries untouched
- Downloaded and verified all 12 CAFRs as real multi-MB PDFs (1.1–7.8 MB) — zero soft-404 HTML responses
- Transcribed verbatim General-column blocks from each CAFR's Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances; all 12 FYs tie EXACTLY to printed totals (0 diff)
- FY2008 revenue anchor confirmed: $97,774,378,000 (matches recon bookend from Phase 103)
- Both loaders run `--dry-run` clean with all 18 FYs (FY2008-FY2025) printing PASS; no DB writes

## FY-by-FY Extraction Results

| FY | Rev total ($K) | Rev tie | Exp total ($K) | Exp tie | Notes |
|----|----------------|---------|----------------|---------|-------|
| 2008 | 97,774,378 | PASS | 98,975,042 | PASS | Recon bookend confirmed |
| 2009 | 84,202,979 | PASS | 92,605,222 | PASS | |
| 2010 | 85,129,367 | PASS | 87,247,026 | PASS | |
| 2011 | 93,479,815 | PASS | 90,431,674 | PASS | |
| 2012 | 86,536,015 | PASS | 88,281,652 | PASS | Motor vehicle excise taxes line added |
| 2013 | 99,379,153 | PASS | 90,114,980 | PASS | |
| 2014 | 104,182,125 | PASS | 95,337,085 | PASS | |
| 2015 | 116,777,374 | PASS | 107,163,567 | PASS | |
| 2016 | 117,573,422 | PASS | 111,804,448 | PASS | Category schema shifts to FY2020+ naming |
| 2017 | 125,121,644 | PASS | 116,260,039 | PASS | Managed care enrollment tax line added |
| 2018 | 135,625,020 | PASS | 124,239,316 | PASS | |
| 2019 | 140,503,627 | PASS | 129,113,153 | PASS | |

**Negative categories:** None. P2 clamp is wired but did not trigger in this window.

## Task Commits

1. **Task 1: Extend CA SOURCES with FY2008-FY2019 under /Files-ARD/CAFR/** — `fd307ba` (feat)
2. **Task 2: Transcribe + tie-check FY2008-FY2019 GENERAL-column blocks** — `c6b113b` (feat)

## Files Created/Modified

- `scripts/processCA.js` — CA GF operating loader, extended from FY2020-FY2025 to FY2008-FY2025 (12 new EXPENDITURES blocks + SOURCES + years array + fiscal_years)
- `scripts/processCARevenueAcfr.js` — CA GF revenue loader, extended from FY2020-FY2025 to FY2008-FY2025 (12 new REVENUE blocks + SOURCES + years array + fiscal_years)
- `.planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-DEEPEN-GAPLOG.md` — Gap log created; CA section shows all 12 FYs PASS, no holes

## Decisions Made

- **Retained all 12 FYs (no gaps):** All 12 PDFs responded as real multi-MB application/pdf files; all tied exactly. No soft-404s encountered.
- **Category schema transition at FY2016:** The CA ACFR changed category names starting FY2016 from the legacy schema (Resources, State and consumer services, Business and transportation, Correctional programs) to the current schema matching FY2020+ (Natural resources and environmental protection, Business, consumer services, and housing, Transportation, Corrections and rehabilitation). Both sets of names are preserved verbatim.
- **Motor vehicle excise taxes (FY2012+):** This revenue line appears starting FY2012; it is 0 for FY2012-FY2015 but non-zero from FY2016 onward. Included as-is.
- **Managed care organization enrollment tax (FY2017+):** This revenue line is 0 in FY2017-FY2019. Included as-is per verbatim ACFR transcription.
- **No P2 clamp triggered:** Investment and interest is positive across all FY2008-FY2019 (the low was FY2011 at $38,928K, still positive). No negative revenue categories found.

## Deviations from Plan

None — plan executed exactly as written. All 12 added FYs available and tie-checked. The "skip + log" path (D-02/D-03) was not needed because all years pass.

## Issues Encountered

None. The pre-existing `ca-acfr-2008.pdf` in `_acfr-tmp/ca/` (from Phase 103 probing) was a soft-404 HTML file — the correct PDF lives at `/Files-ARD/CAFR/cafr08web.pdf` (not at the Phase 103 probe path). All 12 PDFs were downloaded fresh from the correct URLs.

## Known Stubs

None. Both loaders are fully wired with actual ACFR data for all FY2008-FY2019.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. Threat model mitigations applied:
- T-104-02-A (soft-404): All downloads verified as real PDFs via Content-Type + size check before extraction
- T-104-02-B (wrong directory): Added years pinned to /Files-ARD/CAFR/ per recon; existing /Files-ARD/ACFR/ entries untouched
- T-104-02-C (tolerance widening): validate() tolerance NOT widened; all 12 years tie exactly at 0 diff
- T-104-02-D (wrong column): FY2008 General-column Total revenues = $97,774,378K ties to recon bookend

## Next Phase Readiness

- Both CA loaders are ready for production load (Wave 2, plan 104-04) — no blocking issues
- Phase 106 (independent re-derivation + audit) can verify all 12 added CA FYs from source PDFs in `_acfr-tmp/ca/`
- Gap log (104-DEEPEN-GAPLOG.md) is initialized; NY and FL plans should append their sections

---
*Phase: 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08*
*Completed: 2026-06-30*
