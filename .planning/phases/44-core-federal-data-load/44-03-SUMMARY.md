# 44-03 Summary — MTS Revenue + Context Metrics

**Executed:** 2026-06-12 | **Status:** Complete — all 3 tasks pass

## Checkpoint (Task 2)

**Decision: GO — load now.** Chris approved the first public federal write 2026-06-12 via in-session question ("GO — load now (Recommended)" selected): sourced data visible immediately through the standard UI; Phase 45 replaces the presentation. Applies to 44-04/44-05 loads as well.

## Shipped

- `scripts/loadFederalMTS.js` (`--dataset revenue|metrics|all`, `--dry-run`)
- **Revenue dataset (PUBLIC):** FY2025 receipts by source, MTS T9 @ 2025-09-30 (September FYTD = full-year actuals). 7 roots + Social Insurance 2-level (3 children) = 10 categories, 9 line items. Total **$5,234,616,386,315.43** — delta vs OMB FY2025 receipts anchor: **0.034%** (cross-source agreement). budgets row: fiscal_year_start_month=10 ✓, hierarchy ['source','subcategory'] ✓. Idempotent (re-run → same counts). data_source `2458feff…`, base_url = exact API query URL.
- **Context metrics (4):** fytd_receipts $3,655.6B + fytd_outlays $4,901.9B (FY2026 through 2026-05-31), total_public_debt $39,213,266,279,741.16 (2026-06-10), fytd_interest_expense $867.3B gross (2026-05-31; label explicitly distinguishes gross interest expense from the Net Interest budget function). All with exact source URLs.
- No negative receipt lines existed in FY2025 → zero exclusions (the handling code is in place for T9 outlay functions where negatives DO exist: Commerce and Housing Credit −$28.6B, Undistributed Offsetting Receipts −$150.2B — relevant to 44-04/44-05).

## Verification

- getCities shape now returns United States (entity_type='federal', available_datasets [{2025, revenue}]) — **first public visibility, as approved**
- FY2025 T9 receipts cross-check: MTS $5,234.6B vs OMB $5,236.4B = 0.034% ✓

## Deviations from plan

None material. FY label expression cleaned up during review.
