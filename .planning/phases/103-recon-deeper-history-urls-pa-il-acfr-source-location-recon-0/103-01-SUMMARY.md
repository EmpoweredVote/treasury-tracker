---
phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
plan: "103-01"
subsystem: data
tags: [acfr, recon, pdftotext, state-gf, ca, tx, ny, fl]
requires:
  - phase: 98-recon
    provides: "4-state ACFR source location + durable URL patterns + soft-404 caution"
provides:
  - "Durable deeper-history ACFR URLs for all 4 pilots, bookend-tie-confirmed"
  - "103-DEEPEN-SOURCES.md — per-pilot deepened window + per-year URL pattern + gap log"
affects: [104-deepen-pilots, 103-03-synthesis]
tech-stack:
  added: []
  patterns: ["pdftotext -table bookend tie (line-items-sum + columns-sum) for GF General column"]
key-files:
  created:
    - .planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-DEEPEN-SOURCES.md
  modified:
    - .gitignore
key-decisions:
  - "NY deepens to FY2003-FY2024 (+12 yrs); CA deepens to FY2008-FY2025 (+12 yrs) via the /Files-ARD/CAFR/ path 98 never probed; TX FY2016 hole filled (docs/ infix); FL adds FY2021 only"
  - "FL FY2021 General Fund has a negative investment-income line (-$398,287K) -> P2 clamp must fire in Phase 104"
  - "Durable-or-exclude (D-02): CA FY2002-07 (variant naming) + FL FY<=2020 (no durable PDF) recorded but not greenlit for load"
patterns-established:
  - "Probe the publisher's index/landing page for older-year links rather than extrapolating one URL pattern — 98's CA/FL 'not sourceable' verdicts were path-probe artifacts, not real gaps"
requirements-completed: [RECON-04]
duration: 35min
completed: 2026-06-29
---

# Plan 103-01 Summary — Pilot deepening recon

## What was done

Located + bookend-tie-confirmed (via `pdftotext -table`, $0) the durable deeper-history ACFR URLs for all four v2.11 pilots, below each one's current window. Wrote `103-DEEPEN-SOURCES.md` (per-pilot deepened window + per-year URL pattern + gap log + Phase-104 load notes).

## Results per pilot (GF General-column Total revenues, tie-confirmed)

- **NY** → FY2003–FY2024 (adds FY2003–2014, 12 yrs). FY2003 = **$29,250M** (line items sum to col total; cols sum to printed $84,699M). Units = millions. URL `…/comprehensive-annual-financial-report-{YYYY}.pdf`.
- **TX** → FY2015–FY2024 contiguous (fills the FY2016 hole). FY2016 = **$96,239,551K** (line items + cols both tie). URL FY2016 = `…/2016/docs/96-471.pdf` (`docs/` infix — must be special-cased).
- **CA** → FY2008–FY2025 (adds FY2008–2019, 12 yrs). FY2008 = **$97,774,378K** (cols sum to printed $177,290,329K). URL `…/Files-ARD/CAFR/cafr{NN}web.pdf` (a different dir than FY2020+). FY2002–07 reachable under variant naming (optional further extension).
- **FL** → FY2021–FY2024 (adds FY2021). FY2021 General Fund = **$46,989,188K** (line items sum exactly). Same `fye-{YYYY}-…` pattern. **Negative investment-income line (−$398,287K) → P2 clamp.** FY≤2020 not durably sourceable → gap-logged (D-02).

## Notable finding

98 recon recorded CA (≤FY2019) and FL (≤FY2021) deeper history as not durably sourceable. That was an artifact of probing a single URL path. Probing the publisher landing pages found durable archives at **different paths** (CA `/Files-ARD/CAFR/`; FL FY2021 works on the same naming). Net: CA + NY both extend ~12 years deeper than expected.

## Self-Check: PASSED
- All 4 pilots have a recorded durable disposition (durable extension OR gap-log) ✓
- TX FY2016 alternate file-id located + tied ✓
- Durable-URL-mandatory honored; CA soft-404 not mistaken for a PDF (Content-Type/size filter) ✓
- No DB writes; $0 spend (pdftotext only) ✓
