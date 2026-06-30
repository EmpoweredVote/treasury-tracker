---
phase: 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08
plan: "03"
subsystem: data-loading
tags: [acfr, florida, pdf-extraction, pdftotext, clamp, p2-clamp, dry-run, state-acfr]

# Dependency graph
requires:
  - phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
    provides: "FL FY2021 bookend tie ($46,989,188K), same fye-{YYYY} URL pattern, negative Investment earnings (-$398,287K) flagged"
provides:
  - "processFLAcfr.js extended to FY2021-FY2024: FY2021 General Fund Total expenditures $37,277,963K, 0-diff tie"
  - "processFLRevenueAcfr.js extended to FY2021-FY2024: FY2021 General Fund Total revenues $46,989,188K, 0-diff tie, P2 clamp fires on negative Investment earnings"
  - "Both loaders --dry-run clean; no DB writes"
affects:
  - "104-04 (FL live write wave 2)"
  - "106 (independent re-derivation + UAT)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pdftotext -table extracts FL ACFR Governmental Funds statement; first numeric token per row = General Fund column"
    - "P2 clamp (clampForRender): negative category renders at 0 with '(net loss — shown at 0)' label; root total preserves net"

key-files:
  created: []
  modified:
    - scripts/processFLAcfr.js
    - scripts/processFLRevenueAcfr.js

key-decisions:
  - "FY2021 URL confirmed: same fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf pattern resolves (PDF = 8.4 MB real PDF, not HTML)"
  - "Transportation=0 omitted from FY2021 EXPENDITURES (ACFR shows '--'); still ties exactly to $37,277,963K"
  - "D-03 exact-else-skip satisfied: both FY2021 blocks tie to 0 diff — FY2021 included (no gap log entry needed)"
  - "ACFR-08 clamp confirmed: negative Investment earnings (-398,287K) transcribed as real negative; clampForRender renders at 0; root total $46,989,188,000 preserves the net"

patterns-established:
  - "P2 clamp pattern: transcribe negative as real negative value; clampForRender renders at 0 in icicle; [Note: ...] line printed for each negative category; root total preserved"

requirements-completed: [DEEP-01, RECON-05, ACFR-08]

# Metrics
duration: 15min
completed: 2026-06-30
---

# Phase 104 Plan 03: FL ACFR FY2021 Deepening Summary

**FL ACFR operating + revenue loaders extended to FY2021 via pdftotext -table; exact tie ($46,989,188K revenue, $37,277,963K expenditures); P2 clamp fires on negative Investment earnings (losses) -$398,287K with root total preserved — dry-run clean, zero DB writes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-30T08:30:00Z
- **Completed:** 2026-06-30T08:45:00Z
- **Tasks:** 2 (Tasks 1+2 executed together as one logical unit)
- **Files modified:** 2

## Accomplishments

- Downloaded FY2021 FL ACFR PDF (8.4 MB) from the same `fye-2021-...` URL pattern confirmed in recon; URL resolves to a real PDF (not HTML — recon was correct that FY≤2020 returns HTML but FY2021 does not)
- Extracted Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances using `pdftotext -table` (statement at page 36 of ACFR, preceded by a blank page 35)
- Transcribed General Fund column for FY2021 into both loaders; both tie exactly to printed totals (0 diff)
- P2 clamp confirmed: FY2021 negative "Investment earnings (losses)" -398,287K renders at 0 in the icicle, with `[Note: Investment earnings (losses) true value: -398,287,000 (net loss — shown at 0)]` printed; TOTAL REVENUES preserves $46,989,188,000 net per ACFR-08
- FY2022-FY2024 totals unchanged (operating: 36,205,183K / 44,464,013K / 50,141,014K; revenue: 57,241,428K / 59,446,062K / 59,810,603K)

## Task Commits

1. **Tasks 1+2: Add FY2021 to FL SOURCES + year arrays + transcribe data blocks** - `6cb8f9f` (feat)

## FY2021 Extracted Values

### General Fund Revenue (processFLRevenueAcfr.js)

| Category | Thousands |
|----------|-----------|
| Taxes | 41,873,817 |
| Licenses and permits | 272,136 |
| Fees and charges | 1,629,633 |
| Grants and donations | 3,068,898 |
| Investment earnings (losses) | **-398,287** (P2 clamp fires) |
| Fines, forfeits, settlements and judgments | 526,221 |
| Other | 16,770 |
| **Total revenues** | **46,989,188** |

Category sum = 46,989,188K. Printed total = 46,989,188K. **Diff = 0. PASS.**

### General Fund Expenditures (processFLAcfr.js)

| Category | Thousands |
|----------|-----------|
| General government | 4,241,011 |
| Education | 18,113,925 |
| Human services | 9,728,416 |
| Criminal justice and corrections | 3,981,348 |
| Natural resources and environment | 585,437 |
| Transportation | 0 (shown as '--', omitted) |
| Judicial branch | 479,173 |
| Capital outlay | 125,822 |
| Debt service — Principal retirement | 19,732 |
| Debt service — Interest and fiscal charges | 3,099 |
| **Total expenditures** | **37,277,963** |

Category sum = 37,277,963K. Printed total = 37,277,963K. **Diff = 0. PASS.**

## Dry-Run Verification Output

### processFLAcfr.js --dry-run --fy 2021

```
FY2021 validation: PASS  (actual)
TOTAL EXPENDITURES                                      37,277,963,000
(dry-run)
Done.
```

### processFLRevenueAcfr.js --dry-run --fy 2021

```
FY2021 validation: PASS  (actual)
  Investment earnings (losses) (net loss — sho                 0
  [Note: Investment earnings (losses) true value: -398,287,000 (net loss — shown at 0)]
TOTAL REVENUES                                    46,989,188,000
(dry-run)
Done.
```

## Files Created/Modified

- `scripts/processFLAcfr.js` - Extended SOURCES, main() years, srcPayload.fiscal_years to include 2021; added EXPENDITURES{2021} block
- `scripts/processFLRevenueAcfr.js` - Same SOURCES/years extension; added REVENUE{2021} block with negative Investment earnings as real negative value (-398_287); updated header comments for ACFR-08

## Decisions Made

- D-03 exact-else-skip: Both blocks tie to 0 diff — FY2021 accepted, no gap log entry written
- Transportation=0 in FY2021 expenditures (printed as '--') — omitted per existing pattern of omitting zero-value lines
- No new packages or architectural changes; pure data transcription into existing loader structure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The `fye-2021-...` URL resolved on first attempt (8.4 MB real PDF). The pdftotext -table extraction produced clean columns immediately. Both tie checks passed on first transcription.

## Known Stubs

None. This plan is a dry-run only; live DB writes are in Plan 04 (Wave 2).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan is dry-run only (no DB writes). T-104-03-A mitigated: negative investment income transcribed as real negative (-398_287), P2 clamp fires correctly.

## Next Phase Readiness

- Wave 1 complete for FL: loaders extended + dry-run confirmed
- Wave 2 (Plan 04) can run the live load: `node scripts/processFLAcfr.js --fy 2021` and `node scripts/processFLRevenueAcfr.js --fy 2021`
- Phase 106 independent re-derivation: FY2021 GF Total revenues $46,989,188K; Total expenditures $37,277,963K

---

## Self-Check

- [x] `scripts/processFLAcfr.js` exists and contains "2021": FOUND
- [x] `scripts/processFLRevenueAcfr.js` exists and contains "2021" and "clampForRender": FOUND
- [x] Commit 6cb8f9f exists: FOUND

## Self-Check: PASSED

---

*Phase: 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08*
*Completed: 2026-06-30*
