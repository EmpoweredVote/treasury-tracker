# Plan 49-04 Summary — Receipts-by-source backfill loader (OMB Hist 2.1)

**Status:** Complete (build + dry-run verified; real writes deferred to 49-05)
**Commit:** `feat(49-04): receipts-by-source backfill from OMB Hist 2.1 (flat)`
**Requirements:** HIST-03, HIST-04, CTX-01

## What changed
- `scripts/extractOMBReceipts.py` (new) — extracts a year's (or the TQ's) receipts-by-source row from OMB Hist 2.1. Data-driven: units read from line 2, source-bucket columns discovered from the header (footnote markers stripped), the parent label column IS the "Total" for grouped headers (on/off-budget sub-columns naturally skipped). Cross-checks bucket sum vs Total Receipts within 0.5%.
- `scripts/loadFederalReceipts.js` (new) — flat one-level `revenue` tree (`hierarchy_columns: ['source']`), `--fy <N>` / `--tq`, per-year anchor from `federal_annual_summary.receipts`, load-anyway + `visual_vs_official_receipts_*` disclosure on a miss.

## Key decision / DEVIATION from CONTEXT D-04
- **D-04 specified 7 buckets** (individual income, corporation income, social insurance, excise, estate & gift, customs, miscellaneous). **The current Hist 2.1 edition (`hist02z1_fy2027.xlsx`) consolidates estate & gift + customs + miscellaneous into a single "Other (3)" column**, so the source exposes **5** top-level buckets. The extractor is data-driven and uses the table's own labels — it would produce 7 automatically from an older edition that splits Other. Loading 5 is the honest, sourced, $0 choice (matches "mirror Hist 2.1 labels exactly" better than hardcoding). **Surfaced to the user for confirmation before the bulk write** (see decision checkpoint).

## Verification (dry-run, $0)
| Period | Buckets | Sum | Anchor delta |
|--------|---------|-----|--------------|
| FY2024 | 5 (II $2426.1B / CI $529.9B / SI $1708.9B / Excise $101.4B / Other $153.6B) | $4,919.9B | 0.0000% |
| FY2000 | 5 | $2,025.2B | 0.0000% |
| FY1976 | 5 | $298.1B | 0.0003% |
| TQ | 5 | $81.2B | self-anchored |

All bucket sums tie to both the table's Total Receipts and the OMB Hist 1.1 receipts anchor.
