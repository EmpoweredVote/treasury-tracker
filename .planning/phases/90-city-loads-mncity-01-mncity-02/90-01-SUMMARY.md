---
phase: 90-city-loads-mncity-01-mncity-02
plan: 01
completed: 2026-06-27
requirements: [MNCITY-01, MNCITY-02]
status: complete
---

# 90-01 SUMMARY — enumerateEntities + batch driver + dry-run proof

## What was built
- **`enumerateEntities(workbook, entityType)`** added + exported on `scripts/loadMNOSA.js` — walks the
  `Governmental Funds` `Entity Name` column from the data-start row, including only rows with a finite
  non-zero `Total Revenues` OR `Total Expenditures` (skips blank/footer rows), deduped by normalized
  key. Label-driven → works for city AND county sheets. All Phase 89 exports unchanged.
- **`scripts/loadMNOSABatch.js`** — the Phase 90 batch driver. Per `--fy`: acquire the one city
  workbook (`--file` override or download `cired_<YY>_data.xlsx` from the manifest into gitignored
  `_mn-recon/`), `enumerateEntities`, then loop the Phase 89 `importEntity` write path over the full
  roster. **No GAAP/CASH/MOD precedence** (MN has one workbook/FY; basis is the per-row `GAAPInd`).
  Tallies GAAP-vs-Cash, collects a source-gap residual (filed-nothing cities), resilient per-city
  try/catch, `--fy/--file/--dry-run/--limit`, serial.
- **`scripts/loadMNOSA.test.mjs`** — +3 cases (enumerateEntities roster, county layout-agnostic,
  batch FY2023 dry-run).

## FY2023 full-roster dry-run proof (zero writes)
```
Processed: 851 cities
Basis distribution: GAAP=504, Cash=347
Source-gap residual (filed nothing): 0
Failures: 0
Minneapolis → basis=GAAP  rev $1,192,133,233  op $1,193,970,288  pop 433633
```
851 cities (≈ the ~853 estimate), mixed basis (GAAP+Cash both present), zero failures, Minneapolis ties
exactly to the Phase 89 proof. (Note: RCV anchors are stored under the source spelling — "Saint Paul",
"Saint Louis Park" — not "St. Paul"; relevant for 90-02 verification.)

## Tests
`node --test scripts/loadMNOSA.test.mjs` → **14/14 pass** (11 Phase 89 + 3 new). No regression.

## Decisions honored
- D-04 single-workbook driver (no precedence); D-02 basis tally from GAAPInd; D-03 source-gap residual;
  D-05 serial + resilient loop; reuses Phase 89 `importEntity`/`resolveSourceUrl`/never-overwrite guard verbatim.

## Files
- Modified: `scripts/loadMNOSA.js` (+enumerateEntities), `scripts/loadMNOSA.test.mjs` (+3 tests)
- Created: `scripts/loadMNOSABatch.js`, `.planning/.../90-01-SUMMARY.md`

## Self-Check: PASSED
- `enumerateEntities` + `loadMNOSABatch` exported; FY2023 dry-run = 851 cities, 0 failures, 0 writes, Minneapolis GAAP ties.
- 14/14 tests pass; no Phase 89 regression.
- No DB writes (dry-run only). Live FY2012–2023 sweep + basis/residual files are 90-02.

## Handoff to 90-02
Driver is proven. 90-02 acquires all FY2012–2023 workbooks, dry-runs each, runs the live serial load,
verifies (Minneapolis read-back, coverage, per-capita, idempotency), and writes committed
`scripts/mnCityBasis.json` + `scripts/mnCityResidual.json`.
