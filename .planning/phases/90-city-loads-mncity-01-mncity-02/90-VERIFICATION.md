---
phase: 90-city-loads-mncity-01-mncity-02
verified: 2026-06-27
status: passed
requirements: [MNCITY-01, MNCITY-02]
method: goal-backward (inline) — read-back probes against production + idempotency re-run
---

# Phase 90 Verification — MN City Loads

**Phase goal:** Load all ~853 Minnesota cities operating + revenue across the FY range, sourced, per-capita, idempotent.

## Success criteria (ROADMAP) — all PASS

1. **All ~853 cities loaded operating + revenue across the XLSX-era FY range; every row carries source metadata.**
   ✅ PASS — **858** distinct MN cities; **20,414** budget rows (10,207 operating + 10,207 revenue, balanced) across **FY2012–FY2023**; **0** rows with NULL `source_url` or `source_date`; every row stamped `data_source='Minnesota Office of the State Auditor City/County Finances Report'`. Spot-check: stored Minneapolis FY2023 operating $1,193,970,288 / revenue $1,192,133,233 (exact vs Phase 89 proof).

2. **Per-capita renders from the built-in `Population` column.**
   ✅ PASS — 858/858 cities have `population > 0`, set to each city's **latest filed FY** value (via `refreshMNPopulations.js` — fixes the insert-only `ensure_municipality` vintage). Minneapolis 433,633 (FY2023).

3. **GAAP/Cash basis recorded per-entity; cross-FY source-gap residual documented (no phantom municipalities).**
   ✅ PASS — `scripts/mnCityBasis.json` records per-(city,FY) basis from `GAAPInd` (855 cities; `basis_unavailable_fys=[2012,2013,2014,2015,2017]` where the column is absent; numeric `-1`=GAAP/`0`=Cash decoded). `scripts/mnCityResidual.json` documents **0** source-gap cities (every enumerated city had a financial total) — no phantom municipalities.

4. **Idempotent re-run writes 0 rows.**
   ✅ PASS — re-running FY2023 live left munis=858, rows=20,414, fy23=1702 unchanged (0 new municipalities, 0 new rows); the never-overwrite guard + insert-only population keep re-runs stable.

## Requirements
- **MNCITY-01** ✅ — all cities loaded op+rev across FY2012–2023, sourced, per-capita.
- **MNCITY-02** ✅ — per-entity GAAP/Cash basis recorded; cross-FY residual documented (0); idempotent re-run = 0 writes.

## Notable findings (carried forward)
- **City XLSX range is FY2012–2023** (12 years; floor 3 years earlier than the roadmap's ~2015 estimate) — full range loaded.
- **`GAAPInd` encoding varies by year** (text / numeric `-1`,`0` / absent) — decoded in `entityBasis`; 5 early FYs have no basis flag.
- **Population is insert-only** on `ensure_municipality` → added the reusable `refreshMNPopulations.js` newest-FY pass (Phase 91 counties must run it too, `--entity-type county`).
- Tooling regression net intact: `node --test scripts/loadMNOSA.test.mjs` → 14/14.

## Scope discipline
- Counties + state node + linking = Phase 91; enrichment = Phase 92; ACFR reconciliation + source-chain audit + UAT = Phase 93. This phase did the in-phase spot-check only.

**Verdict: PASSED.** All ~853 MN cities are live, sourced, per-capita, basis-recorded, and idempotent. Ready for Phase 91.
