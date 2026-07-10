# Phase 129 — Data Model + Load + Enrichment: Research

**Phase goal:** Stand up the navigation nodes and load Tucson's General Fund with full parity, then enrich.
**Requirements:** TUC-03 (seed Tucson), TUC-04 (Pima County node + link), TUC-05 (load op+rev, sourced, per-capita, idempotent), TUC-06 (bleed-safe enrichment, 100% coverage)
**Researched:** 2026-07-10 (inline, no subagent — per project token/machine-strain policy)
**Primary inputs:** Phase 128 outputs (`128-RECON.md`, `128-RESEARCH.md`, `scripts/extractTucson.py`), `.planning/TUCSON-SCOPING.md` §2 (pipeline fit), `.planning/REQUIREMENTS.md` (TUC-03..06), analog scripts read verbatim (below).

---

## 1. What is already done (do not re-litigate)

- **Source proven + window locked:** FY2015–FY2024, 10 contiguous years, every year bookend-ties the GF column at $0. Durable per-FY tucsonaz.gov PDF URLs pinned in `128-RECON.md`.
- **Extractor built + self-tying:** `scripts/extractTucson.py --mode {operating,revenue}` emits `{fiscal_year, mode, tree, computed_total, printed_total, tie_delta}` and **exits non-zero on any mis-tie**. All 20 (10 FY × 2 mode) dry-runs tie $0. Fault injection confirmed fail-loud.
- Arizona already exists as a **state node** (v2.14 ACFR). Tucson/Pima slot under it.

Phase 129 writes three scripts and runs them. No new source, no schema/RPC change.

## 2. The three scripts (model on existing code)

### `scripts/seedTucsonArizona.js` — data model [TUC-03/04]
Idempotent seeder for **both** the Tucson city node and the Pima County navigation node + link.
- **Tucson city:** copy `seedGreshamOregon.js` structure verbatim — select-by-(name,state) → insert/update; `{name:'Tucson', state:'AZ', entity_type:'city', population:~542000, population_year:2024}`. Do **not** create `data_source` rows (owned by `processTucson.js`).
- **Pima County node + link:** copy the `seedCountyLinks.js` discipline — reuse-or-create the `Pima County` entity (`entity_type='county'`, `state='AZ'`, **population set** — TUC-04 requires it; `seedCountyLinks.js` seeds population 0, so this seeder sets it explicitly), then set `Tucson.county_id → Pima County.id` only if NULL or already this county (never repoint silently).
- Population figures: pin the exact **2024 Census** values (Tucson city ≈ 542,000; Pima County ≈ 1,063,000) from the Census sub-est/co-est 2024 vintage (FIPS state 04). Approximate is a placeholder — the executor pins the real number, as `seedGreshamOregon.js` did (`sub-est2024_41.csv`, SUMLEV 162).

### `scripts/processTucson.js` — loader [TUC-05]
Hybrid of `processGresham.js` (extractor→RPC skeleton) + `processAZAcfr.js` (ACFR source-stamp + ephemeral data_source lifecycle).
- **Extractor call:** `spawnSync(python, [extractTucson.py, pdfPath, '--mode', mode], {args-array, maxBuffer 8MB})` — never a shell string. One PDF per FY from `docs/Tucson/` (worktree-safe `resolvePdfDir()` fallback from `processGresham.js`).
- **Tree mapping** (extractor `{n,a,c}` → RPC `{n,a,i:[{d,a,aa,f,e}]}`):
  - *revenue* (flat): each root child → `{n:child.n, a:child.a, i:[{d:child.n, a:child.a, aa:null, f:null, e:null}]}`.
  - *operating* (2-level): each root child of the extractor tree →
    - if it has `.c` (`Current`, `Debt service`): `{n:parent.n, a:parent.a, i: parent.c.map(gc => ({d:gc.n, a:gc.a, aa:null,f:null,e:null}))}` — the `i[]` children are the drill-down leaves.
    - if it is a root leaf (`Capital outlay`, `Capital projects`): `{n:leaf.n, a:leaf.a, i:[{d:leaf.n, a:leaf.a, aa:null,f:null,e:null}]}`.
  - The mapped-tree total MUST equal the extractor's `computed_total` (== `printed_total`, tie 0) — assert before writing.
- **Data source (ephemeral, WR-05):** `delete` any prior row for the dataset_id, `insert` fresh at run start, `delete` at run end. `dataset_type` ∈ {`operating`,`revenue`}, distinct `dataset_id` per type.
- **Load:** `treasury_sync_budget_tree` (NEVER `treasury_sync_city_budget`). Pre-load `delete` on `(data_source_id, fiscal_year)` for idempotency, then RPC.
- **Source stamp (post-sync):** find the `budgets` row for `(muni, fy, dataset_type)` → `.update({source_url: URLS[fy], source_date: '<FY>-06-30', data_source: <label>})`. `URLS[fy]` = the durable per-FY URL from `128-RECON.md`.
- **Sanity/tie:** loaded total per FY per mode must equal the extractor printed total; log per-capita `$total/population`.
- **CLI:** `--dry-run`, `--revenue` (else operating), `--fy <n>` (single FY, for retry loops).

### `scripts/loadTucsonEnrichment.mjs` — enrichment [TUC-06]
Model on `loadSoCalEnrichment66.mjs`.
- **Worklist LIVE from production:** resolve Tucson's municipality_id → its `budgets` (op + rev, all loaded FYs) → depth-0..depth-1 `budget_categories` → distinct `link_key`/`name_key` set. This is the exact set of labels that loaded (honest per-FY vocabulary union), so 100% coverage is provable, not guessed.
- **Author bleed-safe rows:** universal (`municipality_id = NULL`) where the label is shareable and text is generic (no $ figures, no city/entity names); city-scoped (`municipality_id = Tucson`) otherwise.
- **Write discipline:** universal rows via **delete-then-insert** (NULLS-DISTINCT gotcha — a plain upsert on `(name_key, municipality_id)` inserts dupes when `municipality_id` is NULL). Idempotent. `--dry-run` prints the mapping; `--apply` writes.
- **$0 / no paid API** (API-cost guardrail).

## 3. Landmines / gotchas (all must be handled)

1. **Never `treasury_sync_city_budget`** — it overwrites existing `(muni,fy,dataset)` rows and keeps stale labels (memory: not source-safe). Use `treasury_sync_budget_tree` only.
2. **NULLS-DISTINCT** on `category_enrichment (name_key, municipality_id)` — universal (NULL-muni) upserts duplicate; use delete-then-insert.
3. **Enrichment scoping bleed** — a universal row with Tucson/AZ-specific text bleeds into every other city (the Phase-scoping-fix incident). Keep universal text generic; scope anything specific to Tucson's municipality_id.
4. **Worktree-unsafe** — `docs/Tucson/*.pdf` is gitignored (`docs/*`); load on `main`. `processGresham.js`'s `resolvePdfDir()` git-common-dir fallback handles the worktree case defensively.
5. **Ephemeral data_source (WR-05)** — do not leave a persistent `data_sources` row; `budgets` carry the provenance text-stamp, so a lingering row is unreferenceable residue.
6. **County population** — TUC-04 requires population on the Pima node; `seedCountyLinks.js` defaults it to 0, so set it explicitly.
7. **`county_id` repoint** — link Tucson only if `county_id` is NULL or already Pima; never silently repoint.

## 4. Validation Architecture

**No unit-test framework introduced.** Validation is a **deterministic $0 re-derivation tie + idempotency + coverage assertions** — stronger oracles than stubbed tests for load/enrichment work.

- **Load re-derivation (TUC-05):** for every windowed FY × mode, `Σ loaded budgets leaf amounts == source printed total` (== the extractor's `printed_total`), delta **0**. Independent of the extractor's own self-tie (re-read from the DB after load).
- **Idempotency (TUC-05):** a second full run produces **0 net row change** (same row counts, same totals) — the source-safe RPC + pre-load delete guarantee it.
- **Source chain (TUC-05):** every loaded `budgets` row has a non-null `source_url` (a resolving tucsonaz.gov PDF from `128-RECON.md`) + `source_date`.
- **Money In / per-capita (TUC-05):** a `dataset_type='revenue'` row exists for Tucson (Money In auto-enables); per-capita = total / seeded 2024 population renders a finite `$/resident`.
- **Data model (TUC-03/04):** Tucson row exists (city, AZ, population>0); Pima County row exists (county, AZ, population>0); `Tucson.county_id == Pima County.id`; parent chain resolves US → Arizona → Pima County → Tucson.
- **Enrichment coverage (TUC-06):** for every distinct loaded Tucson category `name_key`, there is a matching `category_enrichment` row (universal or Tucson-scoped) — coverage == 100% of the live worklist. Bleed check: no universal row carries Tucson/$-specific text; city-scoped rows carry `municipality_id = Tucson`.

Manual-only: Chris live-app UAT (icicle drill-down, Money In/Out, source chips, breadcrumb, Cities-in-County panel) — that is **Phase 130**, not 129.

## 5. Non-goals for Phase 129 (fence)

- No verification report / no Chris UAT (Phase 130).
- No Pima County government budget (nav node only).
- No FY2025 (unpublished), no pre-FY2015 (deferred).
- No schema/RPC change, no new source.
