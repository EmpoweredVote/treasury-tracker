# 44-04 Summary — Function Lens Deep Tree

**Executed:** 2026-06-12 | **Status:** Complete — DEEP PATH taken (verify-first gate passed decisively)

## Verify-first result (Task 1)

OMB Public Budget Database outlays file: `https://www.whitehouse.gov/wp-content/uploads/2026/04/outlays_fy2027.xlsx` (found via supplemental-materials page scrape). 5,760 account rows × 84 columns; Agency/Bureau/Account names; Subfunction code+title; per-account **BEA Category**; On/Off-budget flag. Units: **thousands** — FY2025 column sums to 7,011,105,000 thousands = **exactly** the OMB Hist 1.1 outlays figure. **GO-deep.**

## Shipped

- `scripts/extractOMBPublicBudgetDB.py` — account rows + sourced function-title map from Hist 3.2 ("NNN Title:" rows; function codes end in 0). Emits dollars.
- `scripts/loadFederalFunctions.js` — Function → Subfunction → Account tree, dataset_type='operating' FY2025.
- `src/components/BudgetIcicle.tsx` — child widths now normalize by sum-of-displayed-children (identical math for all municipal trees where children sum to parent; required for federal nets). tsc + build green.

## Tree shape (live, budget `10a2cb09…`)

| Depth | Level | Count |
|---|---|---|
| 0 | Function | 18 |
| 1 | Subfunction | 61 |
| 2 | Account | 1,613 |
| — | Line items | 2,108 (account items + 495 negative offsetting items kept honestly as line items) |

## The offsetting-receipts design (load-bearing for Phase 45/46)

Account-level federal data is gross-minus-offsets; bars can't be negative. Resolution:
- Function/subfunction node amounts = official NET totals
- Positive accounts = child nodes; negative accounts = line items on their subfunction (marked "(offsetting)") — in the data, not hidden
- Net-≤0 functions/subfunctions excluded from the tree: Undistributed Offsetting Receipts, Allowances, and 10 subfunctions (largest: Net Interest trust-fund interest −$117.5B/−$70.0B; Higher education −$35.0B)
- **37 disclosure metrics** written: every excluded item + per-function within-subfunction offset totals (−$1,180.1B across 18 functions)
- **Reconciliation identity exact (0.0000%):** displayed $7,532.2B + excluded −$521.1B = official $7,011.1B
- ⚠️ Phase 45/46 MUST disclose: the Money Out visual total ($7,532.2B) is spending before $521.1B of net-negative categories; official net total $7,011.1B (federal_annual_summary FY2025)

## Idempotency

Re-run → same budget id, same counts. data_source `ba94d57d…`, base_url = exact xlsx URL.
