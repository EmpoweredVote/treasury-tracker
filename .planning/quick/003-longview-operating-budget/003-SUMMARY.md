---
quick_task: 003
description: Add Longview TX operating budget (spending by department) via pdftotext
date: 2026-05-20
status: complete
---

# Quick Task 003: Longview TX Operating Budget

## What Was Done

Built `scripts/processLongviewBudget.js` to extract 27 General Fund departments from Longview's
340-page Master Budget PDF via pdftotext — no Haiku/AI API calls. Loaded FY2026 adopted budget
($104.8M total) with FY2023-24 actuals.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Build processLongviewBudget.js with initial parser + whitelist/blacklist | (session) |
| 2 | Dry-run → fix continuation-line logic (last-value-wins per column) | (session) |
| 3 | Remove summary parent depts (PUBLIC WORKS, CULTURE AND RECREATION) | (session) |
| 4 | Live load: 27 rows, $104.8M FY2026 | 0eb1f6d |

## Results

- **data_source id:** cbacbaf2-447d-42c1-9d06-34534b9d63ef
- **dataset_type:** operating
- **Fiscal year loaded:** FY2026 (2025-26 Budget = adopted; 2023-24 Actual = actual_amount)
- **Rows loaded:** 27 departments
- **Total adopted budget:** $104,819,589

## Department Breakdown (FY2026 Adopted)

| Department | Adopted |
|-----------|---------|
| Fire Suppression (incl. EMS) | $31.1M |
| Police Operations | $30.5M |
| Public Welfare | $7.8M |
| Street Department | $5.6M |
| Information Systems | $4.8M |
| Parks | $3.0M |
| Animal Services | $2.4M |
| Recreation | $2.4M |
| Development Services | $2.2M |
| Traffic | $2.1M |
| Library | $2.1M |
| + 16 more departments | ~$17M |

## Key Parser Notes

- PDF is 340 pages / ~10k lines of pdftotext -layout output
- `Total Expenditures` labeled lines often show only a sub-component total (e.g. Capital Outlay);
  the department grand total appears on unlabeled continuation lines that follow
- Fix: after finding Total Expenditures line, always scan next 8 lines and take last non-null
  value per column (col 0 = actual, col 3 = adopted)
- CULTURE AND RECREATION and PUBLIC WORKS excluded — parent summary sections that would
  double-count sub-departments (Parks/Recreation/Library and Streets/Traffic/SCADA)
- PUBLIC SAFETY COMMUNICATIONS: adopted=0 is correct — dept zeroed in FY2025-26
- PDF available for FY2018-19 through FY2025-26 — additional years can be loaded by changing URL
