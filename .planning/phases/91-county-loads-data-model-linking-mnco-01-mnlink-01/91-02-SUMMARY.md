---
phase: 91-county-loads-data-model-linking-mnco-01-mnlink-01
plan: 02
completed: 2026-06-27
requirements: [MNCO-01, MNLINK-01]
status: complete
---

# 91-02 SUMMARY — Live county load + city→county linking + state node

## What was done
Live-loaded all MN counties FY2013–2021 against production Supabase, linked every city to its parent
county via `ParentEntityName`, verified the Minnesota state node, refreshed county populations, and
committed the residual.

### County load (3 min, 0 failures)
- **87 counties** loaded across FY2013–2017 + FY2019–2021 (FY2018 has no county XLSX — skipped; gap noted). entity_type='county', stored "<Name> County", basis null (no GAAPInd — D-03).
- Per-FY op==rev: 87/87 (2013–16), 85/85 (2017), 86/86 (2019–20), 85/85 (2021); **0 NULL source_url**.
- Hennepin County FY2021 read-back: operating $1,834,835,822 / revenue $1,851,255,583, pop 1,289,645.
- County populations refreshed to latest FY (88 updated via `refreshMNPopulations --entity-type county`).

### Data-quality fix — "Lake of the Woods County" casing variants
The OSA source spells this county 3 ways across years ("the"/"The"/"Of"), which created 3 duplicate
municipality rows (89 vs 87). **Fixed:** re-pointed all 16 budget rows + cleared stale enrichment_queue
refs onto the canonical "Lake of the Woods County", deleted the 2 variants (→ 87). **Prevented recurrence:**
added `scripts/mnCountyNameCanonical.json` (stem→canonical alias) applied by `loadMNOSABatch` so every FY
collapses to one municipality. (Deliberately NOT blanket title-case — MN has McLeod / Lac qui Parle / Le
Sueur with intentional casing.) Verified: a FY2013 re-run now emits "Lake of the Woods County".

### Linking (MNLINK-01 data layer)
- `scripts/linkMNCitiesToCounties.js` (new) — reads each city's `ParentEntityName` from the city workbook (no authored map, D-04), matches to "<County> County" by normalized stem, sets `county_id` (idempotent set-if-different).
- **852/858 cities linked**; **6 link-residual** (Birchwood, Boy River, Fertile, Gilbert, Thomson, Trosky — blank ParentEntityName in every workbook; recorded, never phantom-linked).
- All 5 RCV anchors resolve: Minneapolis/St. Louis Park/Bloomington/Minnetonka → Hennepin County; Saint Paul → Ramsey County.

### State node + graph (D-05)
- Exactly **1** "Minnesota" entity_type='state' node (pop 5,706,494) — pre-existing, verified, NOT duplicated.
- Counties have `county_id` NULL (top sub-state tier). Graph resolves: US → Minnesota → "<Name> County" → city.

### Idempotency (verified)
- Re-run linker → 0 to-link (852 already correct). Re-run county FY2021 load → 87 county munis unchanged, 0 new.

## Committed artifacts
- `scripts/linkMNCitiesToCounties.js` — ParentEntityName→county_id linker.
- `scripts/mnCountyNameCanonical.json` — canonical county-name alias (Lake of the Woods).
- `scripts/mnCountyResidual.json` — county_residual=0 (no phantom); link_residual=6 cities; 87 normalized distinct counties.
- `scripts/loadMNOSABatch.js` — canonical-county-name mapping in the county path.

## Self-Check: PASSED
- 87 counties live + sourced + per-capita; Hennepin read-back exact; 0 NULL source_url.
- 852/858 cities linked; anchors resolve; 1 state node; counties NULL; idempotent.
- Data-quality dup fixed + recurrence prevented.

## Handoff to 91-03
Data layer complete. 91-03 verifies the EXISTING frontend (breadcrumb + Cities-in-County panel) renders the MN hierarchy via live API probes + a human visual spot-check (no rebuild). Note the 6 link-residual cities for Phase 93.
