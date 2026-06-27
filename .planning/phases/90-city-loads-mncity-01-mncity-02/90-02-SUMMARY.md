---
phase: 90-city-loads-mncity-01-mncity-02
plan: 02
completed: 2026-06-27
requirements: [MNCITY-01, MNCITY-02]
status: complete
---

# 90-02 SUMMARY — Live FY2012–2023 city load + verification + basis/residual

## What was done
Ran `loadMNOSABatch` LIVE serially for every FY 2012→2023 against production Supabase
(`kxsdzaojfaibhuzmclfq`), then verified read-only and recorded basis + residual.

### Live load result (37 min, 0 failures)
| Metric | Value |
|---|---|
| Budget rows written | **20,414** (10,207 operating + 10,207 revenue, perfectly balanced) |
| Distinct MN cities | **858** (union across FY; per-FY 846–853) |
| Per-FY op==rev | ✓ every year (FY2012 851/851 … FY2023 851/851) |
| NULL source_url / source_date | **0 / 0** |
| Source-gap residual (filed nothing) | **0** |
| Per-city failures | **0** |

### Verification (read-only, production)
- **Spot-check (SC#1):** stored Minneapolis FY2023 `operating` = **$1,193,970,288**, `revenue` = **$1,192,133,233** — exact match to the Phase 89 proof.
- **Coverage (SC#1):** 858 cities; 20,414 rows; every row stamped `data_source='Minnesota Office of the State Auditor City/County Finances Report'` + per-FY `source_url` (`cired_<YY>_data.xlsx`) + `source_date`.
- **Per-capita (SC#2):** 858/858 cities have `population > 0`.
- **Basis (SC#3):** ≥1 Cash-basis city present (FY2023 GAAP=504 / Cash=347); recorded in `scripts/mnCityBasis.json`.
- **Idempotency (SC#4):** re-running FY2023 live left munis=858, rows=20,414, fy23=1702 unchanged — 0 new municipalities, 0 new rows.
- **RCV anchors:** Minneapolis, Saint Paul, Saint Louis Park, Bloomington, Minnetonka all PRESENT.

## Live-path fixes surfaced during the real run (the plan anticipated these)
1. **GAAPInd encoding varies by year** (`scripts/loadMNOSA.js` `entityBasis` fix): text `GAAP`/`Cash` (FY2018–19, 2023), numeric **`-1`=GAAP / `0`=Cash** (FY2016, 2020–22), and **absent** (FY2012–15, 2017 → basis unavailable). Decoded all three; tests still 14/14.
2. **Population vintage** (`scripts/refreshMNPopulations.js`, new): `treasury_ensure_municipality` is insert-only for population, so the oldest-FY value stuck after an ascending load. Added a reusable, idempotent newest-FY-wins refresh pass → every city's `population` now reflects its latest filed year (Minneapolis 392008→**433633**). Reusable for Phase 91 counties (`--entity-type county`). Idempotent re-run: 0 updates.

## Committed artifacts
- `scripts/mnCityBasis.json` — per-(city,FY) GAAP/Cash from GAAPInd (855 cities; `basis_unavailable_fys=[2012,2013,2014,2015,2017]`; per-FY distribution). No DB schema change (D-02).
- `scripts/mnCityResidual.json` — cross-FY source-gap record: **0 residual cities** (every enumerated city had a financial total); per-FY roster sizes documented; per-FY variation is normal filing, not dropped data (D-03).
- `scripts/refreshMNPopulations.js` — reusable latest-FY population pass.
- `scripts/loadMNOSA.js` — `entityBasis` numeric-GAAPInd decode.

## Files
- Created: `scripts/mnCityBasis.json`, `scripts/mnCityResidual.json`, `scripts/refreshMNPopulations.js`, `90-02-SUMMARY.md`
- Modified: `scripts/loadMNOSA.js` (entityBasis decode)
- Production: 20,414 budget rows + 858 municipalities (MN cities) written/verified

## Self-Check: PASSED
- 20,414 sourced rows (0 NULL), Minneapolis FY2023 read-back exact, 858 cities pop>0, idempotent re-run unchanged, basis + residual files committed.
- Deeper ACFR reconciliation + source-chain audit + UAT are Phase 93.

## Handoff
Phase 91: counties (FY2013–2021, `--entity-type county` — county data lags, no GAAPInd) + MN state node + city→county linking via `ParentEntityName`. Run `refreshMNPopulations.js --entity-type county` after the county load (same insert-only population caveat).
