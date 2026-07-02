---
phase: 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
plan: "107-02"
subsystem: docs
tags: [acfr, state-gf, recon, pdftotext, sources, v2.13]

requires:
  - phase: 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
    provides: "107-BATCH1-SOURCES.md (NJ/MA/NC/GA/MD recon mold) + D-01..D-10 locked decisions"
  - phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
    provides: "PA/IL SOURCES doc template shape + per-year SOURCES map pattern"
  - phase: 98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon
    provides: "bookend method + soft-404 caution + pdftotext -table guidance"

provides:
  - "107-BATCH2-SOURCES.md — complete per-state ACFR source location recon for TN, CT, WI, WA, MI"
  - "Per-state durable URL patterns + clean windows + bookend ties + four risk facts + scope-vs-NASBO ratios + loader template mappings for all 5 Batch-2 states"
  - "Phase 109 load input contract for TN/CT/WI/WA/MI"

affects:
  - "Phase 109 (Batch-2 ACFR load): TN/CT/WI/WA/MI SOURCES maps, loader templates, FY-end config"
  - "MI loader: must be a custom template (processMIAcfr.js) due to September 30 FY-end"
  - "WA loader: must special-case FY2025 URL naming in SOURCES map"

tech-stack:
  added: []
  patterns:
    - "pdftotext -table for GAAP GF column extraction (not -layout, which misaligns)"
    - "_reportsSource JavaScript JSON blob pattern for CT URL enumeration"
    - "Per-year SOURCES map with explicit URL enumeration for states with no derivable pattern"

key-files:
  created:
    - .planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-BATCH2-SOURCES.md
  modified: []

key-decisions:
  - "All 5 Batch-2 states: accept-and-relabel ACFR GF scope divergence vs NASBO (TX precedent) — ratios range 1.14x (CT) to 3.56x (MI)"
  - "MI requires custom loader template (processMIAcfr.js): September 30 FY-end is unique among all roster states, no existing template handles it"
  - "MI FY2025 URL (FY-2025-ACFR.pdf) has reversed prefix vs FY2019-FY2024 pattern (ACFR-FY{YYYY}.pdf) — must enumerate separately"
  - "WA FY2025 URL (FY-2025-Annual-Comprehensive-Financial-Report.pdf) has unique naming vs FY2020-FY2024 CAFR/{YYYY}/ACFR{YY}.pdf — must special-case"
  - "CT: URL enumeration requires parsing _reportsSource JavaScript JSON blob on osc.ct.gov/reports — no HTML anchor links"
  - "WA biennial budget confirmed not a blocker: ACFR publishes annual GAAP GF figures despite biennial budgetary basis"

patterns-established:
  - "Parse JavaScript data blobs (not just HTML anchors) when scraping archive pages — CT pattern"
  - "Always confirm Content-Type=application/pdf + size > 1MB before trusting a download as a real ACFR"

requirements-completed: [RECON-06]

duration: 120min
completed: 2026-06-30
---

# Phase 107 Plan 02: Batch-2 ACFR Source Location Recon (TN/CT/WI/WA/MI) Summary

**ACFR GF source location + bookend-tie + four risk facts pinned for TN, CT, WI, WA, MI — all 5 Batch-2 states GREENLIGHT for Phase 109 load; MI FY-end=Sep30 is a unique risk requiring custom loader; scope ratios 1.14x (CT) to 3.56x (MI) all resolved via accept-and-relabel**

## Performance

- **Duration:** ~120 min
- **Started:** 2026-06-30T00:00:00Z
- **Completed:** 2026-06-30T00:00:00Z
- **Tasks:** 3 (Task 0: workspace + scaffold, Task 1: TN+CT+WI, Task 2: WA+MI)
- **Files modified:** 1 (107-BATCH2-SOURCES.md)

## Accomplishments

- All 5 Batch-2 states (TN, CT, WI, WA, MI) reconned end-to-end: ACFR statement located, durable URL patterns enumerated, per-year clean windows established, bookend ties verified with actual dollar figures, four risk facts pinned, scope-vs-NASBO ratios computed, loader templates mapped
- All 10 bookend tie-confirms passed (oldest + latest FY for each of 5 states): TN FY2019 $22.2B + FY2025 $35.5B; CT FY2019 $20.8B + FY2025 $26.1B; WI FY2019 $27.9B + FY2025 $38.7B; WA FY2020 $39.0B + FY2025 $55.8B; MI FY2020 $39.9B + FY2025 $53.8B — all diff=$0 or $1 (GAAP rounding)
- Recency floor GREENLIGHT for all 5 states (FY2023 + FY2024 confirmed accessible with durable URLs)
- Critical MI finding documented: September 30 FY-end (unique among all 10 Batch-1+Batch-2 states) — Phase 109 MI loader must use `fiscal_year_start_month=10` and `source_date={FY}-09-30`
- All $0 spend — `pdftotext -table` + `curl` only, no AI/paid APIs

## Task Commits

Each task was committed atomically:

1. **Task 0: Workspace + scaffold** - `f12b7d9` (chore)
2. **Task 1: Recon TN + CT + WI** - `7467b52` (feat)
3. **Task 2: Recon WA + MI** - `3824883` (docs)

## Files Created/Modified

- `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-BATCH2-SOURCES.md` — complete 7-section ACFR source location document for all 5 Batch-2 states (TN, CT, WI, WA, MI): per-state source table, bookend tie-confirms, four risk facts, scope-vs-NASBO, recency-floor verdicts, consolidated gap log, loader template mapping + Phase-109 pre-load checklist

## Decisions Made

- **TN/CT/WI/WA/MI all accept-and-relabel** (TX precedent, D-09): ACFR GAAP GF is materially broader than NASBO budgetary GF in all 5 states due to federal intergovernmental revenue consolidated inside the GF. Ratios: CT 1.14x, TN 1.51x, WA 1.72x, WI 1.74x, MI 3.56x. All comparable to or less extreme than PA/IL/TX (already live). Accept-and-relabel is the correct disposition for all.

- **MI requires custom loader template**: September 30 fiscal year-end is not supported by any existing loader template (PA/IL/NC/GA/MD/NJ/MA all use June 30). Phase 109 must build a `processMIAcfr.js` template with `fiscal_year_start_month=10`.

- **CT URL enumeration via `_reportsSource` JavaScript JSON blob**: The OSC site does not expose ACFR links as HTML anchors — they are embedded in a JavaScript data structure. The loader must parse this JSON blob (or maintain an explicit hardcoded SOURCES map enumerated from the archive JSON at recon time).

- **WA biennial budget is not a loader concern**: Washington budgets on a 2-year biennium, but the ACFR publishes annual GAAP financial statements for each individual fiscal year ending June 30. FY-end = June 30, load per-year. No special biennial handling needed.

- **MI FY2025 + WA FY2025 naming exceptions**: Both states' most recent ACFR have non-standard URL naming. Must enumerate FY2025 separately in SOURCES maps rather than deriving from a pattern.

## Deviations from Plan

None — plan executed exactly as written. All states reconned per D-04 through D-09 protocol, all 7 required SOURCES doc sections populated, bookend ties confirmed, recency floors checked.

The only "finding" that differs from expectations: MI's September 30 FY-end was identified as a critical risk fact during recon (D-08.4), consistent with plan instructions. Appropriately documented.

## Issues Encountered

- **TN TOC statement page references (doc pages vs PDF pages):** TN ACFR's Table of Contents listed "Governmental Funds statement at page 40" using document page numbers, not PDF page numbers. Fixed by grepping the full extracted text for the statement title and "Total revenues" pattern to locate the actual statement in the raw text stream. Not a gap — statement is present and extractable.

- **CT URL discovery via JavaScript blob:** The OSC site exposes ACFR links through a `_reportsSource` JavaScript JSON object embedded in the page source, not as standard HTML anchor elements. Standard HTML parsing finds no links. Fixed by downloading the page source and parsing the JSON blob with Python regex. All 38 years of ACFR URLs recovered.

- **WA OFM dual URL structures:** OFM has two distinct path patterns: FY2025 uses `/wp-content/uploads/FY-2025-Annual-Comprehensive-Financial-Report.pdf`; FY2020-FY2024 use `wp-content/uploads/sites/default/files/public/accounting/report/CAFR/{YYYY}/ACFR{YY}.pdf`. The `/sites/default/files/...` path does NOT redirect correctly — must use the full path. Confirmed by downloading the correct landing page HTML and parsing actual hrefs.

## Known Stubs

None — 107-BATCH2-SOURCES.md is a documentation artifact (source location recon), not a UI or data-loading component. All figures are real verified values from actual ACFR PDFs.

## Next Phase Readiness

- **107-BATCH2-SOURCES.md is the complete Phase 109 input contract** for TN/CT/WI/WA/MI. All 5 states are GREENLIGHT — ready for Phase 109 ACFR load.
- **Phase 109 pre-load requirements per state:**
  - TN: Standard processILAcfr.js clone; enumerate per-year URLs from TN Finance archive page
  - CT: Standard processILAcfr.js clone; enumerate per-year URLs from `_reportsSource` JSON on osc.ct.gov/reports
  - WI: Standard processILAcfr.js clone; enumerate per-year URLs from DOA archive page
  - WA: processPAAcfr.js clone; special-case FY2025 URL; document biennial-vs-annual note
  - MI: **New processMIAcfr.js template** with `fiscal_year_start_month=10`, `source_date={FY}-09-30`; enumerate FY2025 URL separately; document ~3.56x scope divergence prominently
- Batch-2 recon (this plan) + Batch-1 recon (plan 107-01) together form the complete 10-state input contract for Phase 108 (Batch-1 loads: NJ/MA/NC/GA/MD) and Phase 109 (Batch-2 loads: TN/CT/WI/WA/MI)

---
*Phase: 107-recon-acfr-source-location-roster-lock-overlap-resolution-re*
*Completed: 2026-06-30*
