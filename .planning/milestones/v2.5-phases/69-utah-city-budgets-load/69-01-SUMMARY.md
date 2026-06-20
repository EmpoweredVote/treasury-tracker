# 69-01 SUMMARY — Loader fund-tree refactor + SLC canary (D-69-01, UCITY-01/02)

**Status:** ✅ Complete. SLC canary loaded for FY2014–FY2025 (op+rev), all-funds, durably sourced; ACFR reconciliation approved by operator. The 9-city sweep (69-02) is unblocked. $0.

## Task 1 — fund1→org1→cat1 three-level tree (D-69-01) ✅

Refactored `scripts/loadUtahTransparency.js` to build a genuine 3-level icicle: **top = `fund1`** (the fund), **sub = `org1`** (department), **leaf = `cat1`** (expense object). Supersedes the 68-03 `org1`-as-top default (which was too wide, ~200 flat categories).

- `fetchFromBigQuery`: now `SELECT COALESCE(fund1,'Unknown') AS fund1, COALESCE(org1,'General') AS org1, COALESCE(cat1,'General') AS cat1, SUM(amount) AS amount … GROUP BY fund1, org1, cat1`; returns rows keyed `{fund1, org1, cat1, amount, fiscal_year, type}`. Dropped the old `function1`/`--source-column` aliasing.
- `buildTree` call sites (`importEntityData` + dry-run path) and defaults → `{topCol:'fund1', subCol:'org1', itemCol:'cat1'}`; `buildTree` internals unchanged (still generic on opts, emits `{n,a,c}`/`{n,a,i}`).
- **All-funds basis preserved (D-69-02):** no fund filter, no governmental/enterprise split — `fund1` at the top gives that separation for free.
- Tests reshaped to `fund1/org1/cat1` fixtures: **24/24 pass**, `node --check` clean.
- Commit: `1ff3848`.

## Task 2 — SLC canary live load (UCITY-01/02) ✅

Confirmed a live BigQuery session via dry-run (SLC FY2025 EX → fund-topped tree: General Fund, Airport Improvement Fund, Water Fund…), then live-loaded **Salt Lake City** operating + revenue for **FY2014–FY2025** (12 FYs each; **FY2026 excluded** per D-69-04). $0 (column-projected + entity/FY/type filtered).

DB verification (production `treasury.budgets`, municipality `711c4fd0-3fc3-42e2-adad-8e3dca2f49d6`):
- **24 rows** — operating + revenue for every FY 2014–2025, no gaps.
- **0** rows with a wrong/absent source — all `data_source = 'Transparent Utah'`, `source_url = https://transparent.utah.gov`.
- **0** FY2026 rows.
- Never-overwrite guard active; SLC was all-new (no different-source SKIPs).

Loaded all-funds totals (operating | revenue), $M: FY14 723|852, FY15 716|771, FY16 708|829, FY17 758|885, FY18 918|964, FY19 850|1003, FY20 1740|1055, FY21 1505|1289, FY22 1526|1607, FY23 1810|1459, FY24 887|1101, FY25 1529|1800.

## Task 3 — ACFR reconciliation (SC#4) ✅ approved

Operator reconciled the SLC all-funds totals against the published ACFR and **approved**. No order-of-magnitude discrepancy — totals sit in the right band for SLC all-funds (includes the airport's multi-billion capital program).

**Documented variance / data characteristics (carried into the sweep, not bugs):**
- Year-over-year volatility (e.g. operating $1.81B FY23 → $887M FY24 → $1.53B FY25) is consistent with lumpy all-funds accounting — bond proceeds, airport capital draws, inter-fund gross-ups in some years.
- SLC source data carries both bare and number-prefixed fund labels (`General Fund` & `1000 General Fund`; `Airport Improvement Fund` & `5401 Airport Improvement Fund`), inflating FY2024–25 fund counts to 200+. Icicle renders fine (sorted by amount). **Curated fund rollup is deferred to Phase 72** per CONTEXT.md.

## Requirements

- **UCITY-01 (operating):** SLC operating loaded FY2014–FY2025, all-funds, durably sourced. Per-capita pending population (69-03).
- **UCITY-02 (revenue):** SLC revenue loaded FY2014–FY2025, durably sourced.

## Key files

- `scripts/loadUtahTransparency.js` — 3-level fund→org→cat loader (refactored).
- `scripts/loadUtahTransparency.test.mjs` — offline unit tests (24/24).

## Next

69-02: sweep the remaining 9 Utah cities through the same loader (op+rev FY2014–FY2025), then reconcile Provo against the 68-03 dry-run baseline ($346.5M EX / $285.7M RV) + a published reference.
