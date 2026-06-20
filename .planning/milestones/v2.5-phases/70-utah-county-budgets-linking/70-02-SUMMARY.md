# 70-02 SUMMARY — county op+rev load + population (UCO-01)

**Status:** ✅ Code + data complete; live-app human-verify (Task 4) pending Chris sign-off. $0.

## Task 1 — `--entity-type` flag (D-70-04 fix) ✅
`treasury_ensure_municipality` keys on `name+state+entity_type`, but `importEntityData` hardcoded `p_entity_type:'city'`. Added `--entity-type` (default `city`, validated `city|county`), threaded into both `treasury_ensure_municipality` (`p_entity_type: entityType`) and `findEntityMunicipality` (`.eq('entity_type', entityType)`). `node --check` + `node --test` green (24/24). Commit `ea0e1ec`.

## ⚠ Deviation / incident — phantom county rows (caught + recovered)
On the first live load I ran the county load **before** committing the Task 1 fix. With the old hardcoded `'city'`, `--entity-type county` was silently ignored (parseArgs `strict:false`) and the loader created **5 phantom `entity_type='city'` "<X> County" rows** carrying all 120 budget rows; the real county entities got none. The dry-run had looked fine because dry-runs don't write, so the entity_type bug never surfaced there.

**Recovery:** implemented + committed the `--entity-type` fix, deleted the 5 phantom rows + their 120 budget rows (scoped to `entity_type='city'` AND name `LIKE '% County'` — real county rows untouched), then re-loaded with the fixed loader. **Lesson:** never run 70-02 Task 2 before Task 1; the plan's sequencing existed precisely to prevent this.

## Task 2 — county op+rev load FY2014–FY2025 ✅
Live-loaded all 5 counties (EX+RV, 12 FYs each) with `--entity-type county`. DB-verified: **0 phantom rows**; each county op=12/rev=12, FY range 2014–2025, `data_source='Transparent Utah'` + non-null `source_url` on every row, **0 FY2026 rows**; the 10 city rows untouched (240 budget rows = SC#4 honored). Operating totals (recent FY): Salt Lake ~$1.46B, Utah ~$594M, Davis ~$322M, Weber ~$227M, Washington ~$160M — plausible for county governments (full ACFR reconciliation is Phase 73).

## Task 3 — county population (D-70-03) ✅
Added a `--counties` mode to `loadUTPopulation.js`: Census co-est county file (SUMLEV 050, FIPS 49, vintage 2024 — matches the cities). Column layout verified live (POPESTIMATE2024@12, vs the places file's @15) with an abort-on-drift header guard. Set 2024 population: Salt Lake 1,216,274 · Utah 747,234 · Davis 378,470 · Weber 276,118 · Washington 207,943. Commit `9c21817`.

## Requirements
- **UCO-01:** 5 counties op+rev loaded on their own county entities + per-capita population. County-page render (icicle/summary + per-capita, SC#1) pending live-app confirmation.

## Self-Check: PASSED
loader `node --check`+`node --test` green; DB shows 5 counties × (op12/rev12) all Transparent-Utah-sourced, no phantoms, no FY2026, cities intact, population set.
