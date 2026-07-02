---
phase: 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
plan: "107-01"
subsystem: recon
tags: [acfr, recon, batch1, nj, ma, nc, ga, md, documentation]
dependency_graph:
  requires: []
  provides: [RECON-06-batch1-sources]
  affects: [phase-108-batch1-loads]
tech_stack:
  added: []
  patterns: [pdftotext-table, bookend-tie-confirm, scope-vs-nasbo, p2-clamp]
key_files:
  created:
    - .planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-BATCH1-SOURCES.md
  modified: []
decisions:
  - NJ reports in raw dollars (not thousands) — loader must NOT multiply by 1000
  - NJ FY2025 URL drops FR infix (NJFY2025Complete.pdf vs NJFRFYxxxxComplete.pdf) — special-case required
  - MA FY2017 naming exception (acfr_fy2017.pdf, no hyphen) — special-case required
  - NC has no derivable URL pattern — all 14 per-year URLs must be enumerated from archive page
  - GA pre-FY2021 gap (only 5 years on SAO pages) — clean window is FY2021-FY2025
  - MD pre-FY2022 gap (site restructured from marylandtaxes.gov) — clean window is FY2022-FY2025
  - MD FY2022 negative investment income (-$275,992K) — P2 clamp required at load
  - All five states recommend accept-and-relabel (TX precedent) for ACFR-vs-NASBO scope divergence
metrics:
  duration: "~180 minutes (across context break)"
  completed: "2026-07-01"
  tasks_completed: 3
  files_created: 1
  files_modified: 0
---

# Phase 107 Plan 01: Batch 1 ACFR Source Location Recon (NJ/MA/NC/GA/MD) Summary

ACFR Governmental Funds General Fund column located for all 5 Batch-1 states, bookend-tie-confirmed, four risk facts pinned, scope-vs-NASBO documented, and loader templates mapped — $0 spend, no DB writes.

## What Was Built

`107-BATCH1-SOURCES.md` — the complete Batch-1 source location document mirroring the 103-PA-IL-SOURCES.md shape, with 7 sections:

1. Per-state source table (statement, GF column header, units, FY-end, durable window, per-year URL pattern)
2. Bookend tie-confirmations (oldest + latest FY GF Total revenues, tie verified to printed page total)
3. Four risk facts per D-08 (units / negative GF lines / exact column header + statement / FY-end month)
4. Scope vs NASBO — TX-trap ratios and accept-and-relabel recommendations
5. Recency-floor verdict per D-07 (FY2023 + FY2024 coverage)
6. Consolidated gap log (pre-FY2020 NJ, MA FY2017 naming exception, GA pre-FY2021, MD pre-FY2022, NC pre-FY2012)
7. Loader template mapping + Phase-108 pre-load checklist

## Key Findings Per State

| State | GF Total Rev (latest) | GF Total Rev (oldest) | Units | Window | NASBO Ratio | Recency |
|-------|----------------------|----------------------|-------|--------|-------------|---------|
| NJ | $60,979,024,211 FY2025 | $38,768,977,008 FY2020 | **dollars** | FY2020-FY2025 | ~1.15x | GREENLIGHT |
| MA | $61,907,573K FY2025 | $35,029,512K FY2015 | thousands | FY2001-FY2025 | ~1.73x | GREENLIGHT |
| NC | $75,416,082K FY2025 | $44,930,429K FY2020 | thousands | FY2012-FY2025 | ~2.58x | GREENLIGHT |
| GA | $68,445,055K FY2025 | $55,378,103K FY2021 | thousands | FY2021-FY2025 | ~1.98x | GREENLIGHT |
| MD | $48,689,018K FY2025 | $50,540,136K FY2022 | thousands | FY2022-FY2025 | ~1.78x | GREENLIGHT |

All bookend ties: NJ/MA/NC/GA diff = $0; MD diff = $1-2 (GAAP thousands rounding — acceptable).

## Critical Flags for Phase-108 Loaders

1. **NJ units = dollars** — the only Batch-1 state NOT in thousands. Loader must NOT multiply by 1000.
2. **NJ FY2025 URL naming change** — `NJFY2025Complete.pdf` (drops "FR" infix); all prior years use `NJFRFYxxxxComplete.pdf`. Must special-case.
3. **MA FY2017 naming exception** — `acfr_fy2017.pdf` (no hyphen) vs `acfr_fy-{YYYY}.pdf` all other years.
4. **NC requires explicit per-year URL enumeration** — no derivable pattern; 14 URLs from archive page.
5. **GA F-97-01 Medicaid fix supersede** — GA's NASBO FY2023 row has a Phase-97 Medicaid correction; the ACFR load replaces the same key and must cleanly supersede it (handled in plan 107-03).
6. **MD P2 clamp for FY2022** — `Interest and other investment income = -$275,992K` in GF revenue; P2 clamp to 0 required per policy.
7. **MD URL case change at FY2024** — FY2022-FY2023 = `ACFR{YYYY}.pdf` (uppercase); FY2024-FY2025 = `acfr{YYYY}.pdf` (lowercase).

## Loader Template Mapping

| State | Template | Reason |
|-------|----------|--------|
| NJ | `processILAcfr.js` / `processILRevenueAcfr.js` | Explicit per-year SOURCES map (FY2025 special-case); similar multi-fund-column layout |
| MA | `processPAAcfr.js` / `processPARevenueAcfr.js` | Similar 3-column layout (GF | Other GF | Total); derivable pattern with FY2017 exception |
| NC | `processILAcfr.js` / `processILRevenueAcfr.js` | Explicit per-year SOURCES map required (no derivable pattern); 4-column layout |
| GA | `processILAcfr.js` / `processILRevenueAcfr.js` | Explicit per-year SOURCES map (5 opaque Drupal URLs); F-97-01 supersede |
| MD | `processPAAcfr.js` / `processPARevenueAcfr.js` | Similar multi-fund layout; URL case exception + P2 clamp |

## Deviations from Plan

None — plan executed exactly as written. All recon was done via `pdftotext -table` + `curl`. No DB writes. $0 spend.

The following discoveries were made during recon (documented honestly, no plan deviation):

- NJ's primary ACFR URL (`/treasury/omb/publications/acfr/`) returned a soft-404 HTML page. Navigated to the Financial Publications landing page (`/treasury/omb/fr.shtml`) to discover the correct URL pattern. This is correct per T-107-01 (soft-404 caution).
- NC's per-year marketing pages all redirect to current-year content. Used the archive page (`/annual-report-and-popular-report-archives`) as the canonical URL source. This is consistent with D-06 (durable URL requirement).
- MD's former marylandtaxes.gov paths returned 404. Located the correct marylandcomptroller.gov page via sitemap. Pre-FY2022 not found — clean window starts FY2022.
- GA uses opaque Drupal document slugs with a `-0` suffix on FY2023 (`fy-2023-acfr-0`). All 5 slugs confirmed durable via direct HEAD request.

## Known Stubs

None. All sections of 107-BATCH1-SOURCES.md are fully populated with real, verified data. No placeholder values remain.

## Threat Flags

None. This plan is documentation-only (read-only recon). No new network endpoints, auth paths, file writes to DB, or schema changes were introduced. Soft-404 threat T-107-01 was mitigated for all five states (all downloads verified by Content-Type application/pdf and file size before trusting extracted figures).

## Self-Check: PASSED

- [x] `107-BATCH1-SOURCES.md` exists at `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-BATCH1-SOURCES.md`
- [x] Task 0 commit: `680ffdf` (scaffold skeleton)
- [x] Task 1 commit: `7f793ae` (NJ+MA+NC recon)
- [x] Task 2 commit: `4fe2814` (GA+MD recon + pre-load checklist)
- [x] All 5 states have bookend ties, four risk facts, scope-vs-NASBO, recency verdict, loader template
- [x] GA F-97-01 supersede requirement flagged
- [x] MD P2 clamp requirement flagged
- [x] NJ dollars vs thousands risk flagged
- [x] Gap log populated for GA pre-FY2021, MD pre-FY2022, NC pre-FY2012, MA FY2017 naming, NJ pre-FY2020
