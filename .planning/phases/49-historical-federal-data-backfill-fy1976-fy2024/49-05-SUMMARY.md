# Plan 49-05 Summary — Full backfill run + audit + coverage verification

**Status:** Complete (real data loaded + all verification gates green)
**Commits:** `feat(49-05): backfill orchestrator + loader download cache + source_registry linking`
**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04, CTX-01

## What changed
- `scripts/backfillFederalHistory.mjs` (new) — orchestrator looping FY1976–FY2024 + TQ across the three lenses; per-(period,lens) tier/delta/rows matrix; continue-on-failure with non-zero exit if any cell writes no row; `--dry-run` / `--only` / `--from` / `--to` / `--no-tq`.
- All three loaders: 24h time-bounded download cache (cut ~147 large PBD re-downloads to ~3 across a full-span run) + **`budgets.data_source_id` → `source_registry` linking after the RPC** (the RPC does not set it; FY2025 was linked separately). function/agency → `omb-public-budget-database`, receipts → `omb-historical-tables`.

## Execution
- **Dry-run (full span):** 150/150 ok, 0 failed, 0 Tier-2. Deltas: 130 × 0.0000%, 13 × 0.0001%, 3 × 0.0002%, 1 × 0.0003% — all far inside 0.5%. GO approved by Chris ("Wait for the dry-run, then GO").
- **Real write:** 150/150 ok, **135,056 line items** written. Schema migration 49-01 confirmed applied before the TQ writes.
- **Idempotent re-run** (to populate data_source_id): row count stayed **153** (150 historical + 3 FY2025), 0 duplicates.

## Verification gates (49-05-03) — all green
| Gate | Result |
|------|--------|
| Coverage (HIST-04) | 147/147 (year × lens) present, **0 missing pairs**; 3 TQ rows; 50 distinct years (FY1976–2025) |
| Disclosure (CTX-01) | 22,971 per-period metrics across 51 periods; **0 years missing** their own disclosure; keys year-interpolated (`_fyNNNN` / `_tq1976`), none borrowing fy2025 |
| Source-chain audit | **35 PASS + 26 BROWSER + 0 FAIL** (61 unique URLs); **153/153** budgets link to source_registry with `data_source_info=true` on the production API |
| Idempotency | 153 rows stable on re-run; 0 NULL `data_source_id` |
| Sourcing (HIST-01..04) | every budget linked to a registry source; every metric row carries source_name/url/date |

## Known issue (benign, not a phase-49 defect)
- `auditFederalSources.mjs` exits 1 because it writes results JSON to `.planning/phases/48-source-chain-verification-uat/` which was archived/cleaned at the v2.0 milestone close. All substantive checks pass (0 FAIL); only the file write fails. Phase-48-owned harness path — left as-is (resurrecting an archived phase dir is out of scope).

## Deviations from plan (evidence-based, documented)
- **No Tier-1 fallback built** (function Hist 3.2 rebuild / agency Hist 4.1 flat): account-level PBD data reconciles to the OMB anchor by construction for every one of the 49 years (0 Tier-2 fallbacks fired). Tier-2 (load-anyway + disclosure) exists as the safety net per HIST-04.
- **5 receipts buckets, not 7** (Chris's decision): current Hist 2.1 consolidates estate&gift + customs + miscellaneous into "Other".
