# 43-03 Summary — Backend Audit + E2E Verification

**Executed:** 2026-06-12 | **Status:** Complete — zero backend changes needed (as predicted, now proven)

## Task 1: backend entity_type touchpoint audit

| Touchpoint | Disposition |
|---|---|
| `treasuryService.ts:42` `TREASURY_ENTITY_MTFCC` | 'federal' absent → no geofence lookup; comment confirms NULL geo_id is the legitimate path for unmapped types. **No change.** |
| `treasuryService.ts` getCities/getCityById | entity_type is a SELECT-passthrough (`string \| null`), no allowlist. **No change.** |
| `coverageService.ts:360` `TREASURY_ENTITY_TO_LEVEL` | 'federal' unmapped → `if (!level) continue;` — explicitly skipped, same path 'state' takes today. **No change.** |
| `campaignFinanceService.ts` | Different domain (FEC contributor entity_type). **Not applicable.** |
| `sourceVerificationService.ts` / `routes/sourceVerifications.ts` | Different domain (compass_stance/readrank_quote). **Not applicable.** |

## getCities SQL (captured verbatim, the serving gate)

```sql
SELECT m.id, ..., COALESCE(json_agg(json_build_object('fiscal_year', b.fiscal_year, 'dataset_type', b.dataset_type) ...), '[]') AS available_datasets
FROM treasury.municipalities m
LEFT JOIN treasury.budgets b ON b.municipality_id = m.id
GROUP BY m.id
HAVING COUNT(b.id) > 0
```

## ⚠️ Finding for Phase 44 (load-bearing)

**Visibility is gated on `treasury.budgets`** (the per-FY dataset-metadata table: municipality_id, fiscal_year, dataset_type, total_budget, fiscal_year_start_month NOT NULL, data_source), **not** on `operating_budgets` rows. Phase 44 loaders MUST write a `treasury.budgets` row per (fiscal_year × dataset_type) in addition to line-item rows — exactly as city loaders do. Federal `fiscal_year_start_month = 10` (federal FY starts October).

## Task 2: E2E evidence

| Step | Result |
|---|---|
| BEFORE counts | munis 567, op_budgets 32575, budgets 19101, served 532 |
| Temp federal row inserted (`_test United States`, US, pop 340,110,988) | id `69f5165f…` |
| getCities shape, no data | **ABSENT** ✓ (hidden until Phase 44 — no feature flag needed) |
| + treasury.budgets row (FY2025, operating, $7,011.1B, start month 10) + operating_budgets row with `source_url` + `source_date` populated | both inserted; sourcing columns round-tripped ✓ |
| getCities shape, with data | **PRESENT**: entity_type='federal', available_datasets=[{2025, operating}] ✓ |
| Cleanup | AFTER counts identical to BEFORE; `_test%` residue = 0 ✓ |
| Regression spot-check | Plano TX: municipality, pop 293,286, 19 budget rows — unchanged ✓ |

## Deviations from plan

One addition: the plan's E2E script assumed an `operating_budgets` row alone would make the entity visible; the audit revealed `treasury.budgets` is the actual gate, so the test inserted both (and the finding is recorded above for Phase 44). No code changes; `files_modified` remains empty.
