# 68-03 SUMMARY — Live Recon + Loader Proof (UTSRC-01 mapping + UTSRC-02)

**Status:** ✅ Substantive work complete (mapping, tree-column decision, pilot dry-run proof).
⏸️ One sub-item deferred for a decision: the read-only BigQuery MCP (Task 1, D-12) — see below. $0.

## Task 2 — 15-entity mapping (UTSRC-01 mapping portion) ✅

All 15 exact `entity_name` strings confirmed live and mapped to Treasury-Tracker municipalities + county
linkage (for Phase 70). Recorded in **`docs/utah-entity-mapping.md`**. Naming is uniform `<Name> City` /
`<Name> County`; `govt_lvl` cleanly tags City vs County; all cover FY2014–FY2026. No `entity_id` column exists.

## Task 3 — tree column + pilot dry-run (UTSRC-02 proof) ✅

**Functional-column decision (D-06):** probed `function1` vs `cat1` vs `org1` on Provo FY2024 EX:
- `function1` ~70% NULL (2 distinct) — **unusable**.
- `cat1` = expense object (165 distinct, populated).
- **`org1` = department/purpose (211 distinct, populated) — chosen.** `loadUtahTransparency.js --source-column` now defaults to `org1`; sub = `cat1`.

**Loader fixes** (the live run surfaced real bugs vs. the offline-built 68-02 loader; all fixed in `scripts/loadUtahTransparency.js`, `node --check` passes):
1. Removed `entity_id` from the query/RPC — **column does not exist** (would have crashed).
2. **Added SQL aggregation** (`SUM(amount) GROUP BY top, sub`) — Transparent Utah is transaction-level (unlike CA's pre-aggregated Socrata feed); without it the tree would have one item per raw transaction.
3. `fiscal_year` passed as a Number (INT64), not a String.
4. Default `--source-column` → `org1`; `source_url` no longer entity_id-keyed (returns the durable `transparent.utah.gov` portal).

**Pilot dry-run** (`node scripts/loadUtahTransparency.js --entity "Provo City" --fy 2024 --dry-run`, zero writes):
- **EX→operating:** 2,436 aggregated rows → 211 categories, **$346,484,274.68**.
- **RV→revenue:** 360 rows → 114 categories, **$285,684,200.65**.
- Legible `org1` purpose tree (PATROL, STREET MAINTENANCE, ENERGY ADMINISTRATION, PARKS CIP…), durable portal `source_url`, zero DB writes. Totals match an independent BigQuery probe.

**Phase 69 tuning note:** `org1` top level is wide (≈200 categories, many single-subcat). Consider a fund-based or curated rollup for a tidier icicle when loading all 10 cities.

## Task 1 — read-only BigQuery MCP (D-12) ⏸️ DEFERRED (decision pending)

Not yet wired into `.mcp.json`. **All recon in this phase was completed without it** (via the Node client / `bq`), so it does not block Phase 69 — it is convenience tooling (Chris's request). Pending Chris's decision on whether to add a project-scoped read-only BigQuery MCP server now or defer.

## Requirements

- **UTSRC-01: fully satisfied** — access verified (68-01) + 15 entity_names confirmed & mapped.
- **UTSRC-02: satisfied** — loader live-proven on a pilot city with the chosen `org1` purpose column + durable sourcing, zero writes. Ready for Phase 69 (Utah city loads), modulo the optional MCP and the org1-width tuning note.
