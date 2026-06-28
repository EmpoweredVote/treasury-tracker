---
phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03
plan: "04"
subsystem: state-general-fund-sourcing
tags: [virginia, acfr, gaap, state-node, false-provenance-fix, sgfs-03]
dependency_graph:
  requires: [95-03]
  provides: [VA-ACFR-operating-FY2022-2025, VA-ACFR-revenue-FY2022-2025]
  affects: [treasury.budgets, treasury.data_sources]
tech_stack:
  added: []
  patterns: [processMN-pattern, p2-negative-clamp, post-rpc-source-stamp]
key_files:
  created:
    - scripts/processVAAcfr.js
    - scripts/processVARevenueAcfr.js
  modified: []
decisions:
  - "VA ACFR uses aggregate revenue categories (6: Taxes, Rights/Privileges, Institutional Revenue, Interest/Investment Income, Federal Grants, Other) — verbatim from section G; not the more granular 8-12 taxonomy the plan mentioned as possible (ACFR is the authority)"
  - "FY2022 revenue has negative Interest/Investment Income (-498,365k); P2 clamp applied; root total carries audited Total Revenues verbatim"
  - "Extraction: pdftotext -table worked cleanly for all 4 FYs; no render-to-image fallback needed"
  - "FY2022 section-G PDF resolved at www.doa.virginia.gov (Pitfall 2 / A5 verified)"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-28"
  tasks_completed: 2
  files_created: 2
---

# Phase 95 Plan 04: Virginia ACFR GAAP General Fund Loaders (FY2022-FY2025) Summary

Replaced Virginia's falsely-sourced DPB estimate rows with GAAP actuals from the Virginia DOA ACFR section G (G_Major_Governmental_Funds.pdf), creating processVAAcfr.js (operating) + processVARevenueAcfr.js (revenue) — 8 rows live, 0-NULL stamped, idempotent.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create processVAAcfr.js (operating) | 828cf19 | scripts/processVAAcfr.js |
| 2 | Create processVARevenueAcfr.js (revenue); live-load both datasets | 7bd8858 | scripts/processVARevenueAcfr.js |

## Per-FY Checksum Results (pdftotext -table extraction)

### Operating — General Fund Total Expenditures

| FY | Extracted Total | Published ACFR Total | Diff | Method |
|----|----------------|---------------------|------|--------|
| FY2022 | $25,212,453,000 | $25,212,453k | $0 | pdftotext -table |
| FY2023 | $28,345,459,000 | $28,345,459k | $0 | pdftotext -table |
| FY2024 | $31,022,979,000 | $31,022,979k | $0 | pdftotext -table |
| FY2025 | $34,099,267,000 | $34,099,267k | $0 | pdftotext -table |

### Revenue — General Fund Total Revenues

| FY | Extracted Total | Published ACFR Total | Diff | Method |
|----|----------------|---------------------|------|--------|
| FY2022 | $29,208,709,000 | $29,208,709k | $0 | pdftotext -table |
| FY2023 | $28,408,798,000 | $28,408,798k | $0 | pdftotext -table |
| FY2024 | $32,875,046,000 | $32,875,046k | $0 | pdftotext -table |
| FY2025 | $31,593,096,000 | $31,593,096k | $0 | pdftotext -table |

All 8 checksums: **0-diff** vs. published ACFR totals.

## DB Probe Results

```
Total rows (FY2022-2025, operating+revenue): 8
Rows with any NULL (source_url/source_date/data_source): 0
Rows referencing dpb.virginia.gov or 'estimated': 0
```

All 8 rows carry:
- `source_url` → doa.virginia.gov G_Major_Governmental_Funds.pdf (per-FY)
- `source_date` → YYYY-06-30
- `data_source` → "State of Virginia ACFR — General Fund (FYyyyy actual, GAAP basis)" or revenue variant

## Negative Revenue (P2) Application

**FY2022 Interest, Dividends, Rents, and Other Investment Income: -$498,365,000**

P2 applied per policy:
- Rendered area = 0 (clamped via `clampForRender()`)
- Label = "Interest, Dividends, Rents, and Other Investment Income (net loss — shown at 0)"
- Root node total = $29,208,709,000 (audited Total Revenues, already nets the negative)
- Note printed on dry-run: `[Note: Interest/Investment Income true value: -498,365,000 (net loss — shown at 0)]`

## Extraction Method

**pdftotext -table** — used for all 4 FYs, worked cleanly. No render-to-image (pdftoppm) fallback needed. The VA section-G PDF is a small (~85KB–1.8MB per year) targeted document; columns extracted correctly in all years. All 8 checksums tied to published ACFR totals at 0-diff.

## Revenue Taxonomy Note

The Virginia ACFR section G uses **6 aggregate revenue categories** (verbatim from the statement):
1. Taxes
2. Rights and Privileges
3. Institutional Revenue
4. Interest, Dividends, Rents, and Other Investment Income
5. Federal Grants and Contracts
6. Other

The plan anticipated 8-12 granular categories (Individual Income Tax, etc.) but the section-G Governmental Funds statement uses these 6 aggregate categories. These are the verbatim ACFR names — correct per P1/P3 (actuals only, verbatim source names). The more granular breakdown would require a different ACFR section (schedule-level detail), which is a different extraction scope. Using verbatim section-G names is correct.

## Source URL Verification (Pitfall 2 / A5)

FY2022 PDF resolved at: `https://www.doa.virginia.gov/reports/ACFReport/2022/G_Major_Governmental_Funds.pdf` (HTTP 200, 85,593 bytes). The www.doa.virginia.gov absolute URL form was used (Pitfall 2 / A5 confirmed — FY2022 index had relative paths).

## Idempotency (P6)

Second run of both loaders: 0 net rows inserted across all FYs. Confirmed idempotent.

## Deviations from Plan

None — plan executed exactly as written.

The revenue taxonomy of 6 aggregate categories (vs. 8-12 mentioned as possible) is not a deviation — the plan explicitly said "verbatim ACFR source names" and the ACFR section G is the authority. The 6-category structure IS the ACFR.

## Known Stubs

None. All 8 rows carry real sourced GAAP actuals from published DOA ACFR PDFs.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond the planned treasury.budgets rows. The FY2026 estimate rows remain (handled by Plan 05 per T-95-14).

## Self-Check: PASSED

- scripts/processVAAcfr.js — FOUND
- scripts/processVARevenueAcfr.js — FOUND
- 95-04-SUMMARY.md — FOUND
- commit 828cf19 — FOUND (processVAAcfr.js)
- commit 7bd8858 — FOUND (processVARevenueAcfr.js)
