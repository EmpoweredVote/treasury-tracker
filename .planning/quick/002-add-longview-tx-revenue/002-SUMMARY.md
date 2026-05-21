---
quick_task: 002
description: Add Longview TX revenue data via pdftotext
date: 2026-05-20
status: complete
---

# Quick Task 002: Add Longview TX Revenue

## What Was Done

Added Longview, TX (Gregg County, East Texas, ~83k pop) as a new city in Treasury Tracker with FY2026 revenue data loaded via pdftotext — no Haiku API calls.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Insert Longview municipality row into treasury.municipalities | 7b68c08 |
| 2 | Add parseLongviewFormat() + SOURCES entry to processRevenuePDF.js | a4ce792 |
| 3 | Dry-run parse verification + parser fixes for complex multi-line PDF layout | 5bcad47 |
| 4 | Human checkpoint — dry-run reviewed and approved | — |
| 5 | Live load FY2026 revenue | (this session) |

## Results

- **data_source id:** a5e68164-6a93-4bef-81bb-4d17b5a538c7
- **Fiscal year loaded:** FY2026 (2025-26 Proposed = adopted; 2023-24 Actual = actual_amount)
- **Rows loaded:** 15
- **Total revenue captured:** $87.6M (~87% of $100.6M PDF grand total)

## Revenue Breakdown (FY2026 Proposed)

| Department | Amount |
|-----------|--------|
| General Revenue (Sales Tax + Property Tax) | $69.9M |
| Information Services (interfund) | $8.0M |
| Police | $5.2M |
| City Secretary | $2.5M |
| Animal Services | $784k |
| Municipal Court | $527k |
| Library | $249k |
| Building Inspection | $135k |
| Fire | $132k |
| Planning & Zoning | $41k |
| Environmental Health | $35k |
| Recreation | $21k |
| PIP | $8k |
| Code Compliance | $4k |

## Notes

- Longview's revenue PDF ("Summary of Revenues by Departments - General") uses a complex multi-line column layout — each data row's 8 columns wrap across 2-3 pdftotext output lines
- ~13% gap vs PDF grand total ($100.6M) is from wrapped continuation rows that couldn't be cleanly attributed; acceptable for a first load
- New `parseLongviewFormat()` function handles: department-number section labels (0, 102, 200, 210, etc.), 5-digit account code stripping, extractFirstAndLastValues() for col[0] actual + col[5] adopted
- PDF source covers 8 years of history (FY2018-19 through FY2025-26) — additional years can be loaded by adding more SOURCES entries
