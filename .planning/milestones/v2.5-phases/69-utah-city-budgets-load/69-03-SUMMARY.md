# 69-03 SUMMARY — Utah city population loader (D-69-03, SC#2)

**Status:** ✅ Complete. All 10 Utah cities carry a non-zero Census-2024 population + `population_year=2024`, so per-capita ($/resident) renders. Idempotent + never-lower-to-0 guarded. $0.

## Task 1 — `scripts/loadUTPopulation.js` ✅

Built modeled on `scripts/loadORPopulation.js` (download/redirect-follow, CSV-column guard, idempotent update) + `loadTXPopulation.js` (EXPECTED_CITIES / KNOWN_VALUES sanity check):
- `CSV_URL` = Census place file `sub-est2024_49.csv` (Utah FIPS 49); `POP_YEAR = 2024` (latest reliable Population Estimates vintage, D-69-03 discretion).
- Column guard (SUMLEV col0 / NAME col8 / POPESTIMATE2024 col15) aborts on Census format drift; filters `SUMLEV==='162'` (incorporated place).
- `KNOWN_VALUES` read from the actual Utah CSV (not guessed): Layton 84,348 · Lehi 93,446 · Ogden 88,656 · Orem 96,646 · Provo 115,479 · Salt Lake City 217,783 · Sandy 92,840 · St. George 106,288 · West Jordan 116,688 · West Valley City 138,144.
- **D-69-03 never-lower-to-0 guard** added (the OR analog lacked it): refuses to write a non-positive population. Idempotent SKIP when already set. `--dry-run` performs zero writes.
- `node --check` clean.

## Task 2 — dry-run + live load ✅ (all 10 cities)

Dry-run resolved all 10 cities from the CSV (no "Missing cities" abort), then live-loaded.

**Deviation corrected (plan interface assumption was wrong):** Plan 69-03's interface listed the DB municipality names as stripped (e.g. `Layton`), assuming the budget loader dropped the trailing " City" for most cities. In reality `loadUtahTransparency.js` creates each municipality from the **full Transparent Utah `entity_name`**, so all 10 DB rows carry the "City" suffix (`Layton City`, `Provo City`, …; SLC + WVC already did). The first live run only matched SLC + West Valley City (8 "matched 0 rows"). Fixed by adding a `DB_NAME` map (Census-normalized name → exact `municipalities.name`) and keying the UPDATE/SELECT on it. Re-run: **8 UPDATED, 2 SKIP (idempotent), 0 FAILED.**

DB verification: `SELECT … WHERE state='UT' AND name IN (10 cities) AND population>0 AND population_year=2024` → **10/10**. Re-running reports SKIP for already-set cities (idempotent).

## Requirements

- **UCITY-01 (per-capita):** satisfied — all 10 cities have a real population + source year; per-capita renders (SC#2).

## Key files

- `scripts/loadUTPopulation.js` — Census-2024 population loader for the 10 Utah cities (idempotent, never-lower-to-0).

## Note for Phase 70+

The DB municipality names for Utah cities are the full entity_names with "City" (e.g. `Provo City`). Any future loader keying on `municipalities.name` for Utah must use those exact strings (not stripped). The `Utah` state node (pop 3,271,616 / 2024) already exists in the DB.
