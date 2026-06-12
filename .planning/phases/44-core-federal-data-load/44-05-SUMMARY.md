# 44-05 Summary — Agency Lens + Phase Verification

**Executed:** 2026-06-12 | **Status:** Complete

## Shipped

- `scripts/loadFederalAgencies.js` — MTS T5 @ 2025-09-30, 811 rows paginated, parent_id-walked forest. dataset_type='federal_agency' FY2025, budget `8f97eb19…`, 526 line items, data_source `0a96c9f5…`.
- Tree: **29 departments, 5 depth levels** ({0:29, 1:216, 2:254, 3:40, 4:2}). Top: HHS $2,671.5B, SSA $1,710.4B, Treasury $1,539.7B, DoD $870.9B.
- 30 per-department offset disclosure metrics.
- `20260612110300_add_omb_pbdb_source_registry.sql` + federal budgets rows linked to source_registry via data_source_id (discovered: that FK targets source_registry, not data_sources — ideal for source chips).
- `.planning/phases/44-core-federal-data-load/44-VERIFICATION.md` — all seven DATA requirements PASS.

## The walk algorithm (first attempt reconciled at 7.5% — rewritten)

First version tallied only *named* offset rows and negative *leaves*; negative **subtrees** (Postal-type nets, the Undistributed section) vanished untallied, and legit 'Other' rows were over-excluded. Rewrite: uniform complete-by-construction rule — every leaf dollar lands in a displayed bar or the dropped ledger exactly once; printed subtotals ('Total--*', 80 labels) ignored entirely; parents = sum of kept children (own printed amounts only for leaf fallback + discrepancy logging). Result: identity vs T5's own 'Total Outlays' row = **0.006%**, T9 cross-check 0.007%.

## Idempotency

Re-run → same budget id, same counts.

## Deviations from plan

- Reconciliation target upgraded from hardcoded T9 constant to T5's own 'Total Outlays' row (true identity), T9 kept as cross-check.
- data_source_id semantics discovered (FK → source_registry); federal rows linked; PBDB registry entry added.
