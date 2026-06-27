---
phase: 89-mn-osa-source-loader-mnsrc-01-mnsrc-02
plan: 02
completed: 2026-06-27
requirements: [MNSRC-01, MNSRC-02]
status: complete
---

# 89-02 SUMMARY — MN OSA 3-level Loader (scripts/loadMNOSA.js)

## What was built

`scripts/loadMNOSA.js` — the one reusable loader for v2.9. Parses the MN OSA `Governmental Funds`
sheet (one row per entity) into 3-level-where-natural revenue + expenditure trees and writes via the
existing budget RPCs. Mirrors `loadOhioAOS.js` for the write path verbatim; the new parts are the
3-level label-driven tree builders, GAAPInd basis, and county-tolerant identity lookup.

Exports: `cellNum`, `cellText`, `normalizeLabel`, `buildRevenueTree`, `buildExpenditureTree`,
`entityPopulation`, `entityCounty`, `entityBasis`, `resolveSourceUrl`, `getSupabase`,
`findConflictingBudget`, `importDataset`, `importEntity`, `DATA_SOURCE_NAME`.

## How it satisfies the decisions

- **D-01/D-02 (3-level where natural):** builders walk `scripts/mnOsaTreeMap.json`. Revenue groups →
  sub-groups → grant-type leaves (Intergovernmental is genuine 3-level); expenditure function →
  sub-function → {Current, Capital} deepest leaves. Tree shape `{n,a,c:[...]}`, variable depth.
- **D-03 (subtotals as parents, no double-count):** `subtotal_label` columns are the authoritative
  parent `a`; `assertSubtotal()` validates each group's recomputed child sum ties to the workbook
  subtotal within 0.5% (throws on drift). Cross-function rollups (`Total Current Expenditures`,
  `Total Capital Outlay`, `Total Public Safety Capital Outlay`) are in `validation_only_totals` and
  never placed as nodes.
- **D-04:** Intergovernmental included as a top-level revenue group.
- **D-05:** totals = `Total Revenues` / `Total Expenditures`; the `& Other Sources/Uses` financing
  lines are excluded (never matched).
- **D-07:** `entityBasis` reads the per-row `GAAPInd` column → 'GAAP'/'Cash'; returns null when the
  column is absent (counties).
- **D-08 (county divergence):** every column matched by NORMALIZED label (lowercase, strip
  non-alphanumeric) + one `label_aliases` entry (`ecenomic`→`economic`); identity reads return
  null/'' when a label is absent. The SAME code path loads both city and county files.
- **Source-safety:** `findConflictingBudget` pre-skip never-overwrite guard before every
  `treasury_sync_city_budget` call; `data_source='Minnesota Office of the State Auditor City/County
  Finances Report'`, per-FY `source_url` from `resolveSourceUrl(fy, entityType)`, `source_date`.
- **County entity_type:** `importEntity` passes `p_entity_type` from `--entity-type` (county →
  entity_type='county', avoiding a phantom city row).

## Verification (dry-run, zero writes) — all tie EXACTLY (drift=0)

| Entity | Type | Basis | Parent | Revenue tree=Total | Expenditure tree=Total |
|---|---|---|---|---|---|
| Minneapolis | city | GAAP | Hennepin | $1,192,133,233 ✓ | $1,193,970,288 ✓ |
| Ada | city | **Cash** | Norman | $2,281,736 ✓ | $2,966,174 ✓ |
| Adams | city | **Cash** | Mower | $1,153,656 ✓ | $1,196,541 ✓ |
| Aitkin | county | null (no GAAPInd) | — | $36,720,288 ✓ | $38,425,573 ✓ |
| Anoka | county | null (no GAAPInd) | — | $369,021,022 ✓ | $338,553,843 ✓ |

No D-03 subtotal-guard error on any entity. CLI `--dry-run` prints the full 3-level trees + basis +
population + parent county + manifest source_url with zero writes; `--entity-type county` parses the
divergent county file through the same builders.

## Files
- Created: `scripts/loadMNOSA.js`, `.planning/.../89-02-SUMMARY.md`

## Self-Check: PASSED
- All exports present and typed `function`.
- Revenue + expenditure trees tie to row totals for GAAP city, Cash cities, and counties (drift 0).
- Never-overwrite guard present before every RPC write; DATA_SOURCE_NAME literal present;
  `p_entity_type` threaded from `--entity-type`.
- No DB writes (dry-run only). Full live-proof + a committed proof doc are 89-04.

## Handoff
89-03 writes offline tests importing these functions. 89-04 runs the formal de-risk dry-run gate
(Minneapolis + a Cash city + a county) and commits `89-PROOF.md`.
