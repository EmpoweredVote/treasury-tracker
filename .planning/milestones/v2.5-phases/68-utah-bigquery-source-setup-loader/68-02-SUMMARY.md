---
phase: 68-utah-bigquery-source-setup-loader
plan: "68-02"
subsystem: data-loader
tags: [utah, bigquery, loader, transparent-utah, UTSRC-02, offline-build]
requirements-completed: [UTSRC-02]
duration: "~30min"
completed: "2026-06-18"
---

# Phase 68 Plan 02: Utah Transparency Loader — Build Summary (UTSRC-02 build portion)

**`scripts/loadUtahTransparency.js` built by mirroring the proven `scripts/bulkLoadStateController.js` — same tree shape, same `treasury_sync_city_budget` RPC, same never-overwrite guard — swapping ONLY the data-fetch layer for a parameterized BigQuery query. The pure logic is proven by 23 offline unit tests (no BigQuery / no Supabase / no network). The live pilot dry-run is handed to 68-03 (gated on the access grant).**

## Analog parity checklist (copied vs swapped)

| Concern | `bulkLoadStateController.js` (analog) | `loadUtahTransparency.js` | Status |
|---------|--------------------------------------|---------------------------|--------|
| Money parse | `amt()` | `amt()` (identical, exported) | copied |
| Tree shape | `{n,a,c}` parents / `{n,a,i}` items, children sorted desc, zero rows skipped | identical | copied |
| Write RPC | `treasury_sync_city_budget` (9 params) | same 9 params | copied |
| Never-overwrite | `findConflictingBudget` (skip if `data_source` differs) | `findConflictingBudget` + pure `neverOverwriteDecision()` | copied |
| Municipality | `treasury_ensure_municipality` | same | copied |
| `source_date` | computed once per run, `--source-date` override | same | copied |
| Source URL | durable ByTheNumbers PAGE url | `entitySourceUrl()` → Transparent Utah page (PLACEHOLDER, finalized 68-03) | adapted |
| **Fetch** | Socrata `fetchAllPages()` (HTTP) | **`fetchFromBigQuery()` (BigQuery, lazy import)** | **SWAPPED** |
| Tree dimension | `category → subcategory_1 → line` | **function/purpose-first: `function1 → cat1 → org1`** (D-05/06) | adapted |

## BQ query shape + free-tier note

```sql
SELECT entity_id, <source-column> AS topcol, <sub> AS subcol, org1, amount, fiscal_year, type
FROM `ut-sao-transparency-prod.transaction.transaction`
WHERE entity_name = @entity AND fiscal_year = @fy AND type = @type
```

- **Column projection + entity/FY/type filters** keep scanned bytes tiny → comfortably inside BigQuery's 1 TB/month free tier → **$0** (a single 15-entity milestone is a small fraction).
- Client: `@google-cloud/bigquery` (added to `package.json` deps, `^7.9.0`), **lazy-imported inside `fetchFromBigQuery()`** via `await import(...)` — so the module loads (and the test suite runs) with the package NOT installed and NO ADC credentials present. Auth = ADC from `gcloud` (68-01); project defaults to `empowered-vote-486302` (override via `GCP_PROJECT_ID`).

## Tree-column config (D-06)

`--source-column` flag (default `function1`). The top column is a single switch: `function1` → sub `cat1`; any other → sub `org1`. The function-vs-cat decision is finalized in 68-03 after inspecting the live data. No reflexive deep icicle — 3 levels (function → cat → org line).

## Type → dataset mapping

`EX → operating`, `RV → revenue`. `PY → salaries` is mapped but explicitly skipped by the CLI (deferred to Phase 71). Unknown types → `null` (skipped).

## Never-overwrite behavior

`neverOverwriteDecision(existingDataSource, runSourceName='Transparent Utah')` → `'skip'` when an existing `(muni, fy, dataset)` row's `data_source` differs from this run (preserve a richer custom-source load), `'refresh'` when it's our own source or unlabeled. Same guard contract as the CA loader; `treasury_sync_city_budget` is not source-safe on its own, so the pre-skip lives in the loader.

## Test command + result

```
$ node --test scripts/loadUtahTransparency.test.mjs
ℹ tests 23  ℹ pass 23  ℹ fail 0
```

23 offline assertions cover: `amt` (numeric passthrough, comma/dollar strings, parenthesized offsets, negatives, empties); `typeToDataset` (EX/RV/PY/unknown); `neverOverwriteDecision` (skip vs refresh, default source); `buildTree` (grand total incl. negative offset, parent=sum-of-children, sub=sum-of-items, descending sort, compact shape, zero-row skip + offset retention, null→Unknown/General fallback, configurable top column). `node --check` parses clean.

## Carried over / GATED on access (→ 68-03)

- **Live BigQuery query** — `fetchFromBigQuery()` is written but never executed here (no grant yet). 68-03 runs it once access lands.
- **`source_url` finalization (D-08)** — `entitySourceUrl()` is a documented placeholder (`transparent.utah.gov/#/<entity_id>`); 68-03 confirms the real per-entity deep-link pattern against the live site.
- **`function1` vs `cat1` decision (D-06)** — `--source-column` default set to `function1`; 68-03 inspects live data and sets the winner.
- **Pilot-city dry-run** — the UTSRC-02 live proof (sane multi-level tree + plausible total + zero writes) happens in 68-03.

## UTSRC-02 (build portion) — SATISFIED

A reusable BigQuery loader mirroring the proven analog, with a unit-tested function/purpose-first tree builder and never-overwrite guard, built and verified WITHOUT BigQuery access. $0; no DB writes. Live pilot dry-run deferred to 68-03 (gated on the 68-01 access grant).

## Files

- `scripts/loadUtahTransparency.js` (new) — the loader
- `scripts/loadUtahTransparency.test.mjs` (new) — 23 offline unit tests
- `package.json` — added `@google-cloud/bigquery` `^7.9.0`
