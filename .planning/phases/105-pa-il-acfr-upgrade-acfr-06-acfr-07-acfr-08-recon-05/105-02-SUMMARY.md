---
phase: 105-pa-il-acfr-upgrade
plan: "02"
subsystem: state-acfr-loaders
tags: [illinois, acfr, general-fund, revenue, operating, loader, dry-run]
dependency_graph:
  requires: []
  provides:
    - scripts/processILAcfr.js (IL GF spending-by-function, dry-run-clean FY2021-FY2025)
    - scripts/processILRevenueAcfr.js (IL GF revenue-by-source, dry-run-clean FY2021-FY2025)
  affects:
    - IL state node (treasury.budgets — deferred to Plan 105-03 live write)
tech_stack:
  added: []
  patterns:
    - v2.11 ACFR loader pattern (FL/TX analog)
    - explicit per-year SOURCES map (audited-only, variant filename)
    - clampForRender P2 negative-category handling (ACFR-08)
    - pdftotext -table extraction + tie verification
key_files:
  created:
    - scripts/processILAcfr.js
    - scripts/processILRevenueAcfr.js
  modified: []
decisions:
  - "FY2022 uses 'ACFR Final FY 2022.pdf' (with 'FY' prefix, confirmed via HTTP redirect); all other years use 'ACFR Final {YYYY}[...]pdf' naming"
  - "FY2022 Interest and other investment income is NEGATIVE (-197,857K) — clamped via clampForRender, signed net carried in root total (P2/ACFR-08)"
  - "FY2022 included as an honest non-hole: the audited final file was locatable via the comptroller page redirect and the sum ties 0 diff"
  - "TX-trap accept-and-relabel: IL ACFR GF ~1.5x NASBO GF (federal ~$22.1B inside GAAP GF); accepted and relabelled per D-04 precedent"
metrics:
  duration: "~75 minutes"
  completed_date: "2026-06-30"
  tasks_completed: 3
  files_created: 2
---

# Phase 105 Plan 02: Illinois ACFR Loaders (processILAcfr.js + processILRevenueAcfr.js) Summary

One-liner: IL GF ACFR loaders (spending + revenue) on the FL/TX v2.11 pattern, all 5 FYs (2021-2025) dry-run-tied at 0 diff, explicit audited-only SOURCES, FY2022 P2 clamp wired.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Download + extract IL FINAL audited ACFR PDFs FY2021-FY2025 | (no commit — gitignored work dir) | `_acfr-work/il/il-{fy}.pdf` + `.txt` (5 PDFs, 5 txt files) |
| 2 | Build scripts/processILAcfr.js (GF spending-by-function) | 46dc3d1 | `scripts/processILAcfr.js` |
| 3 | Build scripts/processILRevenueAcfr.js (GF revenue-by-source) with P2 clamp | 218b833 | `scripts/processILRevenueAcfr.js` |

## IL FY Window Actually Transcribed

FY2021, FY2022, FY2023, FY2024, FY2025 — all 5 years present and dry-run-tied.

**No FY omitted as an honest hole.** FY2022 was locatable: the comptroller's page URL for FY2022 (`/fiscal-year-2022`) redirects via HTTP 302 to `ACFR Final FY 2022.pdf` (with "FY" prefix in the filename). The file is a valid PDF (6.16 MB, `%PDF-`, audited final), and its General Fund categories sum exactly to the printed total (0 diff). It is included.

## Bookend Tie Confirmations

| FY | General Fund Total revenues (thousands) | Dollar total (×1000) | Diff |
|----|----------------------------------------|----------------------|------|
| FY2025 | 78,342,927 | 78,342,927,000 | 0 |
| FY2023 | 73,827,795 | 73,827,795,000 | 0 |

Both bookends confirmed in the dry-run output. All 5 FYs: revenue sums tie 0 diff; expenditure sums tie 0 diff.

## SOURCES — Audited-Only Confirmation

All 5 SOURCES entries point to `illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR/ACFR%20Final…pdf` files:

| FY | Filename | Note |
|----|----------|------|
| 2021 | `ACFR%20Final%202021.pdf` | No Bookmarked suffix (FY2021-specific naming) |
| 2022 | `ACFR%20Final%20FY%202022.pdf` | "FY" prefix (confirmed via HTTP 302 redirect from page URL) |
| 2023 | `ACFR%20Final%202023%20-%20Bookmarked.pdf` | Bookmarked |
| 2024 | `ACFR%20Final%202024%20-%20Bookmarked.pdf` | Bookmarked |
| 2025 | `ACFR%20Final%202025%20-%20Bookmarked.pdf` | Bookmarked |

No SOURCES entry contains "Interim" or "unaudited". The audited-only rule is documented in both loader headers.

## FY2022 Negative Category (P2 Clamp — ACFR-08)

`processILRevenueAcfr.js` FY2022: "Interest and other investment income" = -197,857 thousands (General Fund column). The `clampForRender` function maps this to 0 for rendered area, with the label "Interest and other investment income (net loss — shown at 0)". The root total (73,204,339,000) carries the signed net as printed.

## Dry-Run PASS Results

### processILAcfr.js (spending-by-function)

```
node scripts/processILAcfr.js --dry-run
FY2021 validation: PASS  (actual) — Total expenditures: 59,523,406,000
FY2022 validation: PASS  (actual) — Total expenditures: 62,089,769,000
FY2023 validation: PASS  (actual) — Total expenditures: 68,661,594,000
FY2024 validation: PASS  (actual) — Total expenditures: 71,610,582,000
FY2025 validation: PASS  (actual) — Total expenditures: 75,456,922,000
```

### processILRevenueAcfr.js (revenue-by-source)

```
node scripts/processILRevenueAcfr.js --dry-run
FY2021 validation: PASS  (actual) — Total revenues: 63,136,008,000
FY2022 validation: PASS  (actual) — Total revenues: 73,204,339,000
FY2023 validation: PASS  (actual) — Total revenues: 73,827,795,000
FY2024 validation: PASS  (actual) — Total revenues: 74,749,262,000
FY2025 validation: PASS  (actual) — Total revenues: 78,342,927,000
```

## TX-Trap Scope Note (D-04)

IL ACFR General Fund ~1.5× NASBO GF because the GAAP General Fund consolidates federal intergovernmental revenue (~$22.1B in FY2025 per the "Federal government" line item) that NASBO's budgetary GF concept excludes. This is the same mechanism as TX (~3×) and PA (~2×). The divergence is accepted-and-relabelled honestly per D-04: `dataSource(fy) = "Illinois State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)"`. The accept-and-relabel call is confirmed at live load in Plan 105-03.

## Deviations from Plan

None — plan executed exactly as written. One decision added:

**FY2022 "ACFR Final FY 2022.pdf" variant filename discovered at execution time** (plan noted it as "to enumerate"). The filename was confirmed via HTTP redirect from the comptroller's `/fiscal-year-2022` page. This is a purely factual discovery, not a deviation.

## Threat Mitigations Applied

| Threat | Applied |
|--------|---------|
| T-105-02-A: Wrong statement/column | GF column (1st numeric token) verified; bookend ties confirmed before transcription |
| T-105-02-B: Units mis-scale | UNITS=1_000, thousands stored, ×1000 at buildTree; bookend dollar totals (78,342,927,000) printed in dry-run |
| T-105-02-C: Soft-404 HTML as PDF | All 5 PDFs: `%PDF-` magic bytes + >400KB confirmed |
| T-105-02-D: Interim/unaudited file | Explicit per-year ACFR Final URLs; no "Interim"/"unaudited" in any SOURCES entry; header rule documented |
| T-105-02-E: Negative GF category unclamped | clampForRender + signed-net root total in processILRevenueAcfr.js (FY2022 -197,857K case) |
| T-105-02-F: IL GAAP GF scope inflation without relabel | TX-trap note in header; GAAP basis in dataSource(); Federal government line visible in icicle |

## Self-Check: PASSED

- `scripts/processILAcfr.js` FOUND (worktree path confirmed at commit 46dc3d1)
- `scripts/processILRevenueAcfr.js` FOUND (worktree path confirmed at commit 218b833)
- Task 2 commit 46dc3d1 EXISTS (from git log)
- Task 3 commit 218b833 EXISTS (from git log)
- All 5 FYs dry-run PASS confirmed in output above
- Both bookend totals (78,342,927,000 and 73,827,795,000) confirmed in dry-run output
