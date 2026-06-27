---
phase: 91-county-loads-data-model-linking-mnco-01-mnlink-01
plan: 01
completed: 2026-06-27
requirements: [MNCO-01]
status: complete
---

# 91-01 SUMMARY — County batch tooling + dry-run proof

## What was built (3 additive changes, no new tree/parse/write logic)
1. **`importEntity` `municipalityName` override** (`scripts/loadMNOSA.js`): when set, it is the DB name (`treasury_ensure_municipality` p_name) while `entityName` stays the workbook row-lookup key. Cities unchanged (override omitted → `dbName === entityName`). Enables counties stored as "`<Name> County`" (D-02 — MN city/county name collision).
2. **`loadMNOSABatch.js` `--entity-type county`**: `acquireWorkbook` resolves `resolveSourceUrl(fy, entityType)` (cored_/county_/dash handled by the manifest URL), the loop computes `municipalityName="<Name> County"` and threads `entityType='county'` into `importEntity` (writes `entity_type='county'`, no phantom city). `--entity-type city` unchanged.
3. **`refreshMNPopulations.js` county name reconciliation** (D-06): strips trailing " County" from the DB muni name before matching the bare workbook roster key ("Aitkin County" ↔ "Aitkin").

## County FY2021 dry-run proof (zero writes)
```
Processed: 85 counties
Basis distribution: GAAP=0, Cash=0, other/unknown=85   (no GAAPInd — D-03)
Source-gap residual: 0 | Failures: 0
Hennepin County → rev $1,851,255,583  op $1,834,835,822  pop 1,289,645
Aitkin County  → rev $36,720,288  op $38,425,573  pop 16,002  (name override applied; ties to Phase 89)
```
City path unaffected (FY2023 --limit 5 dry-run: GAAP=3/Cash=2). `refreshMNPopulations --entity-type county` resolves 87 county entities from the workbooks (DB-match exercised in 91-02 once counties exist).

## Tests
`node --test scripts/loadMNOSA.test.mjs` → **16/16 pass** (14 prior + 2 new: municipalityName override, county-batch dry-run). No regression.

## Files
- Modified: `scripts/loadMNOSA.js` (municipalityName override), `scripts/loadMNOSABatch.js` (--entity-type county), `scripts/refreshMNPopulations.js` (county name fix), `scripts/loadMNOSA.test.mjs` (+2 tests)

## Self-Check: PASSED
- County dry-run: 85 counties, "<Name> County" names, basis null, 0 failures, 0 writes, Aitkin/Hennepin tie.
- City behavior unchanged; 16/16 tests pass.
- No DB writes (dry-run only). Live county load + linking + state-node verify are 91-02.

## Handoff to 91-02
Tooling ready. 91-02 live-loads counties FY2013–2021 (`--entity-type county`), runs `refreshMNPopulations --entity-type county`, links cities via `linkMNCitiesToCounties.js` (ParentEntityName→county_id), verifies the pre-existing Minnesota state node, and commits `mnCountyResidual.json`.
